// ===== src/pages/api/guest-checkout-inventory.js ===== (ZOHO INVENTORY COMPLETE FLOW)

/**
 * Complete guest checkout flow using Zoho Inventory
 * Flow: Contact → Sales Order → Invoice → Payment Collection
 */

export default async function handler(req, res) {
  const requestId = `inv_guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== GUEST CHECKOUT (ZOHO INVENTORY) [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    const { customerInfo, shippingAddress, cartItems, orderNotes } = req.body;
    
    console.log('Processing Inventory guest checkout for:', customerInfo?.email);
    console.log('Cart items count:', cartItems?.length || 0);

    // Validation
    const validationErrors = [];
    if (!customerInfo?.email) validationErrors.push('Email is required');
    if (!customerInfo?.firstName) validationErrors.push('First name is required');  
    if (!customerInfo?.lastName) validationErrors.push('Last name is required');
    if (!shippingAddress?.address1) validationErrors.push('Shipping address is required');
    if (!shippingAddress?.city) validationErrors.push('City is required');
    if (!shippingAddress?.state) validationErrors.push('State is required');
    if (!shippingAddress?.zipCode) validationErrors.push('ZIP code is required');
    if (!cartItems || cartItems.length === 0) validationErrors.push('Cart is empty');

    if (customerInfo?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
      validationErrors.push('Valid email address is required');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
        request_id: requestId
      });
    }

    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) => {
      const price = item.product_price || item.price || 0;
      const quantity = item.quantity || 1;
      return sum + (price * quantity);
    }, 0);
    
    const taxRate = 0.0875; // 8.75% tax
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const shipping = subtotal >= 100 ? 0 : 9.99; // Free shipping over $100
    const total = subtotal + tax + shipping;

    console.log('Order totals:', { subtotal, tax, shipping, total });

    // ===== ZOHO INVENTORY GUEST CHECKOUT FLOW =====
    
    let contactId = null;
    let salesOrderId = null;
    let invoiceId = null;

    try {
      // STEP 1: Create or find contact in Zoho Inventory
      console.log('Step 1: Creating guest contact in Zoho Inventory...');
      
      const contactData = {
        contact_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        contact_type: 'customer',
        customer_sub_type: 'individual',
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        email: customerInfo.email,
        phone: customerInfo.phone || '',
        website: '',
        
        // Billing address (default)
        billing_address: {
          address: shippingAddress.address1,
          address2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: shippingAddress.country || 'US',
          phone: customerInfo.phone || ''
        },
        
        // Shipping address
        shipping_address: {
          address: shippingAddress.address1,
          address2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: shippingAddress.country || 'US',
          phone: customerInfo.phone || ''
        },
        
        // Guest-specific settings
        notes: `Guest customer - Order ${requestId}`,
        payment_terms: 0, // Net 0 (immediate payment)
        currency_code: 'USD'
      };

      const contactResponse = await inventoryApiRequest('/contacts', {
        method: 'POST',
        body: JSON.stringify(contactData)
      });

      contactId = contactResponse.contact?.contact_id;
      console.log('✓ Guest contact created:', contactId);

      // STEP 2: Create sales order
      console.log('Step 2: Creating sales order...');
      
      const salesOrderData = {
        customer_id: contactId,
        date: new Date().toISOString().split('T')[0],
        shipment_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
        
        // Line items from cart
        line_items: cartItems.map((item, index) => ({
          item_id: item.product_id, // Use product_id as item_id in Inventory
          name: item.product_name || item.name,
          description: item.description || `${item.product_name || item.name} - Guest Order`,
          rate: item.product_price || item.price || 0,
          quantity: item.quantity || 1,
          unit: 'qty',
          item_order: index
        })),
        
        // Addresses
        billing_address: {
          address: shippingAddress.address1,
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: shippingAddress.country || 'US'
        },
        
        shipping_address: {
          address: shippingAddress.address1,
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: shippingAddress.country || 'US'
        },
        
        // Order details
        notes: orderNotes || `Guest order from Travel Data WiFi website - ${requestId}`,
        terms: 'Payment due upon receipt. Thank you for your business!',
        
        // Shipping
        delivery_method: 'Standard Shipping',
        shipping_charge: shipping,
        
        // Reference
        reference_number: requestId,
        
        // Automatically calculate tax
        is_inclusive_tax: false
      };

      const salesOrderResponse = await inventoryApiRequest('/salesorders', {
        method: 'POST',
        body: JSON.stringify(salesOrderData)
      });

      salesOrderId = salesOrderResponse.sales_order?.salesorder_id;
      console.log('✓ Sales order created:', salesOrderId);

      // STEP 3: Create invoice from sales order
      console.log('Step 3: Creating invoice from sales order...');
      
      const invoiceData = {
        customer_id: contactId,
        salesorder_id: salesOrderId,
        date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0], // Due today (guest checkout)
        
        // Copy line items from sales order
        line_items: cartItems.map((item, index) => ({
          item_id: item.product_id,
          name: item.product_name || item.name,
          description: item.description || `${item.product_name || item.name} - Guest Order`,
          rate: item.product_price || item.price || 0,
          quantity: item.quantity || 1,
          unit: 'qty',
          item_order: index
        })),
        
        // Invoice settings
        payment_terms: 0, // Net 0 (immediate)
        payment_terms_label: 'Due on Receipt',
        
        // Shipping
        shipping_charge: shipping,
        
        // Notes
        notes: orderNotes || `Guest invoice from Travel Data WiFi website - ${requestId}`,
        terms: 'Payment due upon receipt. Thank you for your business!',
        
        // Reference
        reference_number: requestId,
        
        // Auto-calculate tax
        is_inclusive_tax: false
      };

      const invoiceResponse = await inventoryApiRequest('/invoices', {
        method: 'POST',
        body: JSON.stringify(invoiceData)
      });

      invoiceId = invoiceResponse.invoice?.invoice_id;
      const invoiceNumber = invoiceResponse.invoice?.invoice_number;
      console.log('✓ Invoice created:', invoiceId, invoiceNumber);

      // STEP 4: Generate payment URL
      console.log('Step 4: Generating payment URL...');
      
      // Option A: Use Zoho Checkout (if configured)
      let paymentUrl = null;
      
      try {
        // Try to get hosted payment page from Zoho
        const hostedPageResponse = await inventoryApiRequest(`/invoices/${invoiceId}/hostedpage`, {
          method: 'GET'
        });
        
        paymentUrl = hostedPageResponse.hosted_page?.url;
        console.log('✓ Zoho hosted payment page:', paymentUrl);
      } catch (hostedPageError) {
        console.log('⚠️ Zoho hosted page not available, using custom payment URL');
        
        // Option B: Generate custom payment URL
        paymentUrl = `${req.headers.origin}/payment/invoice?${new URLSearchParams({
          invoice_id: invoiceId,
          invoice_number: invoiceNumber,
          contact_id: contactId,
          amount: total.toString(),
          currency: 'USD',
          customer_email: customerInfo.email,
          customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
          return_url: `${req.headers.origin}/checkout/success`,
          request_id: requestId,
          api_type: 'inventory'
        }).toString()}`;
      }

      console.log('✅ Guest checkout completed successfully via Zoho Inventory');

      // ===== SUCCESS RESPONSE =====

      const successResponse = {
        success: true,
        type: 'guest_checkout_inventory',
        
        // Order identifiers
        contact_id: contactId,
        sales_order_id: salesOrderId,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        
        // Financial details
        total_amount: total,
        subtotal: subtotal,
        tax_amount: tax,
        shipping_amount: shipping,
        currency: 'USD',
        
        // Customer details
        customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        customer_email: customerInfo.email,
        
        // Payment
        payment_url: paymentUrl,
        payment_status: 'pending',
        
        // Order details
        order_details: {
          subtotal,
          tax,
          shipping,
          total,
          items: cartItems.length,
          customer: `${customerInfo.firstName} ${customerInfo.lastName}`,
          email: customerInfo.email,
          shipping_address: shippingAddress
        },
        
        next_steps: [
          'Contact created in Zoho Inventory',
          'Sales order generated and confirmed',
          'Invoice created and ready for payment',
          'Click payment link to complete purchase',
          'Order will be processed after payment confirmation'
        ],
        
        // Technical details
        api_used: 'zoho_inventory',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        
        // Fulfillment info
        estimated_shipping: '3-5 business days',
        tracking_available: true
      };

      return res.status(200).json(successResponse);

    } catch (inventoryError) {
      console.error('❌ Zoho Inventory checkout failed:', inventoryError);
      
      // Enhanced error response with step tracking
      const errorResponse = {
        error: 'Zoho Inventory checkout failed',
        details: inventoryError.message || 'Inventory API error occurred',
        type: 'INVENTORY_API_ERROR',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        
        // Progress tracking
        progress: {
          contact_created: !!contactId,
          sales_order_created: !!salesOrderId,
          invoice_created: !!invoiceId,
          step_failed: !contactId ? 'contact_creation' : 
                       !salesOrderId ? 'sales_order_creation' : 
                       !invoiceId ? 'invoice_creation' : 'payment_setup'
        },
        
        // Debugging information
        debug_info: {
          contact_id: contactId,
          sales_order_id: salesOrderId,
          invoice_id: invoiceId,
          cart_items_count: cartItems.length,
          calculated_total: total
        },
        
        suggestion: getInventoryErrorSuggestion(inventoryError.message)
      };

      return res.status(500).json(errorResponse);
    }

  } catch (error) {
    console.error('❌ Unexpected error in Inventory guest checkout:', error);
    
    return res.status(500).json({
      error: 'Unexpected checkout error',
      details: error.message || 'An unexpected error occurred',
      type: 'UNEXPECTED_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString()
    });
  }
}

// ===== HELPER FUNCTIONS =====

async function inventoryApiRequest(endpoint, options = {}) {
  const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID || process.env.ZOHO_STORE_ID;
  
  if (!organizationId) {
    throw new Error('ZOHO_INVENTORY_ORGANIZATION_ID environment variable is required');
  }

  // Get access token (reuse existing auth logic)
  const token = await getZohoAccessToken();
  
  const url = `https://www.zohoapis.com/inventory/v1${endpoint}?organization_id=${organizationId}`;
  
  const defaultHeaders = {
    'Authorization': `Zoho-oauthtoken ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  console.log(`Inventory API Request: ${options.method || 'GET'} ${url}`);

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });

  const responseText = await response.text();
  console.log(`Inventory API Response (${response.status}):`, responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));

  if (!response.ok) {
    throw new Error(`Inventory API error: ${response.status} - ${responseText || response.statusText}`);
  }

  try {
    const jsonResponse = JSON.parse(responseText);
    
    if (jsonResponse.code && jsonResponse.code !== 0) {
      throw new Error(`Inventory API error: ${jsonResponse.message || 'Unknown error'} (Code: ${jsonResponse.code})`);
    }
    
    return jsonResponse;
  } catch (parseError) {
    if (parseError.message.includes('Inventory API error:')) {
      throw parseError;
    }
    throw new Error(`Invalid JSON response: ${responseText}`);
  }
}

async function getZohoAccessToken() {
  // Reuse your existing token logic from the hybrid API
  if (!process.env.ZOHO_REFRESH_TOKEN || !process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
    throw new Error('Missing required Zoho environment variables');
  }

  try {
    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zoho auth failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('No access token received from Zoho');
    }

    console.log('✓ Zoho access token obtained for Inventory API');
    return data.access_token;
  } catch (error) {
    console.error('Failed to get Zoho access token:', error);
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

function getInventoryErrorSuggestion(errorMessage) {
  if (errorMessage?.includes('organization_id')) {
    return 'Check ZOHO_INVENTORY_ORGANIZATION_ID environment variable';
  } else if (errorMessage?.includes('contact')) {
    return 'Contact creation failed - check customer information format';
  } else if (errorMessage?.includes('item_id')) {
    return 'Product not found in Inventory - check if products are synced from Commerce to Inventory';
  } else if (errorMessage?.includes('sales_order') || errorMessage?.includes('salesorder')) {
    return 'Sales order creation failed - check line items and pricing';
  } else if (errorMessage?.includes('invoice')) {
    return 'Invoice creation failed - check sales order exists and is valid';
  } else if (errorMessage?.includes('authentication') || errorMessage?.includes('token')) {
    return 'Check Zoho OAuth credentials and refresh token';
  } else {
    return 'Check Zoho Inventory API configuration and organization settings';
  }
}