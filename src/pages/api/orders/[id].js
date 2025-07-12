// ===== src/pages/api/orders/[id].js ===== (CREATE THIS FILE)
import { zohoAPI } from '../../../lib/zoho-api';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log(`Fetching order details for ID: ${id}`);
    
    // Try different endpoints to find the order
    const orderEndpoints = [
      `/orders/${id}`,
      `/salesorders/${id}`,
      `/stores/${process.env.ZOHO_STORE_ID}/orders/${id}`,
      `/commerce/orders/${id}`
    ];

    let orderData = null;
    let successEndpoint = null;

    for (const endpoint of orderEndpoints) {
      try {
        console.log(`Trying order endpoint: ${endpoint}`);
        orderData = await zohoAPI.apiRequest(endpoint);
        successEndpoint = endpoint;
        console.log(`✅ Order found at ${endpoint}`);
        break;
      } catch (error) {
        console.log(`❌ Order endpoint ${endpoint} failed: ${error.message}`);
        continue;
      }
    }

    if (!orderData) {
      console.log(`Order ${id} not found in any endpoint`);
      return res.status(404).json({ 
        error: 'Order not found',
        order_id: id,
        endpoints_tried: orderEndpoints
      });
    }

    // Normalize the order data structure
    const normalizedOrder = {
      order_id: orderData.salesorder_id || orderData.order_id || orderData.id || id,
      order_number: orderData.salesorder_number || orderData.order_number || orderData.number || `ORDER-${id}`,
      status: orderData.status || 'pending',
      total: orderData.total || orderData.total_amount || 0,
      currency: orderData.currency_code || orderData.currency || 'USD',
      customer_name: orderData.customer_name || 'Customer',
      customer_email: orderData.customer_email || '',
      created_date: orderData.date || orderData.created_time || orderData.created_at || new Date().toISOString(),
      items: orderData.line_items || orderData.items || [],
      shipping_address: orderData.shipping_address || {},
      billing_address: orderData.billing_address || {},
      subtotal: orderData.sub_total || orderData.subtotal || 0,
      tax: orderData.tax_total || orderData.tax_amount || 0,
      shipping: orderData.shipping_charge || orderData.shipping_amount || 0,
      source_endpoint: successEndpoint,
      raw_data_keys: Object.keys(orderData)
    };

    console.log('Returning normalized order data:', {
      order_id: normalizedOrder.order_id,
      order_number: normalizedOrder.order_number,
      total: normalizedOrder.total,
      status: normalizedOrder.status
    });

    res.status(200).json(normalizedOrder);

  } catch (error) {
    console.error('Order lookup error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch order details',
      details: error.message,
      order_id: id
    });
  }
}