// ===== src/pages/api/orders/[id].js ===== (UPDATED VERSION)

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log(`Fetching order details for ID: ${id}`);
    
    // ✅ UPDATED: Try both Admin API and Storefront API endpoints
    const orderEndpoints = [
      // Admin API endpoints (existing)
      { url: `/orders/${id}`, type: 'admin', auth: 'oauth' },
      { url: `/salesorders/${id}`, type: 'admin', auth: 'oauth' },
      { url: `/stores/${process.env.ZOHO_STORE_ID}/orders/${id}`, type: 'admin', auth: 'oauth' },
      
      // Storefront API endpoints (new)
      { url: `/storefront/orders/${id}`, type: 'storefront', auth: 'domain' },
      { url: `/storefront/api/v1/orders/${id}`, type: 'storefront', auth: 'domain' },
      { url: `/checkout/orders/${id}`, type: 'storefront', auth: 'domain' }
    ];

    let orderData = null;
    let successEndpoint = null;
    let apiType = null;

    // Try Admin API first (requires zohoAPI import)
    console.log('Trying Admin API endpoints...');
    for (const endpoint of orderEndpoints.filter(e => e.type === 'admin')) {
      try {
        console.log(`Trying Admin API: ${endpoint.url}`);
        
        // Import zohoAPI only when needed
        const zohoModule = await import('../../../lib/zoho-api.ts');
        const zohoAPI = zohoModule.zohoAPI || zohoModule.simpleZohoAPI;
        
        orderData = await zohoAPI.apiRequest(endpoint.url);
        successEndpoint = endpoint.url;
        apiType = 'admin';
        console.log(`✅ Order found via Admin API: ${endpoint.url}`);
        break;
      } catch (error) {
        console.log(`❌ Admin API ${endpoint.url} failed: ${error.message}`);
        continue;
      }
    }

    // If Admin API failed, try Storefront API
    if (!orderData) {
      console.log('Admin API failed, trying Storefront API endpoints...');
      
      for (const endpoint of orderEndpoints.filter(e => e.type === 'storefront')) {
        try {
          console.log(`Trying Storefront API: ${endpoint.url}`);
          
          const response = await fetch(`https://commerce.zoho.com${endpoint.url}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'domain-name': process.env.ZOHO_STORE_DOMAIN || 'traveldatawifi.zohostore.com'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const responseData = await response.json();
          
          // Handle different response structures
          orderData = responseData.payload?.order || responseData.order || responseData;
          successEndpoint = endpoint.url;
          apiType = 'storefront';
          console.log(`✅ Order found via Storefront API: ${endpoint.url}`);
          break;
        } catch (error) {
          console.log(`❌ Storefront API ${endpoint.url} failed: ${error.message}`);
          continue;
        }
      }
    }

    if (!orderData) {
      console.log(`Order ${id} not found in any API`);
      return res.status(404).json({ 
        error: 'Order not found',
        order_id: id,
        endpoints_tried: orderEndpoints.map(e => e.url),
        apis_tried: ['Admin API', 'Storefront API']
      });
    }

    // ✅ UPDATED: Normalize data from both API types
    const normalizedOrder = {
      order_id: orderData.salesorder_id || orderData.order_id || orderData.id || id,
      order_number: orderData.salesorder_number || orderData.order_number || orderData.number || `ORDER-${id}`,
      status: orderData.status || orderData.order_status || 'pending',
      total: orderData.total || orderData.total_amount || orderData.amount || 0,
      currency: orderData.currency_code || orderData.currency || 'USD',
      customer_name: orderData.customer_name || orderData.customer?.name || 'Customer',
      customer_email: orderData.customer_email || orderData.customer?.email || '',
      created_date: orderData.date || orderData.created_time || orderData.created_at || orderData.order_date || new Date().toISOString(),
      items: orderData.line_items || orderData.items || orderData.products || [],
      shipping_address: orderData.shipping_address || {},
      billing_address: orderData.billing_address || {},
      subtotal: orderData.sub_total || orderData.subtotal || orderData.subtotal_amount || 0,
      tax: orderData.tax_total || orderData.tax_amount || orderData.taxes || 0,
      shipping: orderData.shipping_charge || orderData.shipping_amount || orderData.shipping || 0,
      
      // Metadata
      source_api: apiType,
      source_endpoint: successEndpoint,
      raw_data_keys: Object.keys(orderData),
      
      // Payment info (varies by API)
      payment_status: orderData.payment_status || orderData.paid_status || 'unknown',
      payment_method: orderData.payment_method || 'unknown'
    };

    console.log('Returning normalized order data:', {
      order_id: normalizedOrder.order_id,
      order_number: normalizedOrder.order_number,
      total: normalizedOrder.total,
      status: normalizedOrder.status,
      source_api: apiType
    });

    res.status(200).json(normalizedOrder);

  } catch (error) {
    console.error('Order lookup error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch order details',
      details: error.message,
      order_id: id,
      timestamp: new Date().toISOString()
    });
  }
}