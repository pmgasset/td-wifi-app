// ===== src/pages/api/guest-checkout.js ===== (FIXED VERSION)

export default async function handler(req, res) {
  const requestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== GUEST CHECKOUT [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    // ✅ FIXED: Import zohoAPI with proper error handling
    let zohoAPI;
    try {
      const zohoModule = await import('../../lib/zoho-api');
      zohoAPI = zohoModule.zohoAPI;
      
      if (!zohoAPI) {
        throw new Error('zohoAPI is undefined after import');
      }
      
      console.log('✓ zohoAPI imported successfully');
    } catch (importError) {
      console.error('❌ Failed to import zohoAPI:', importError);
      return res.status(500).json({
        error: 'API configuration error',
        details: 'Could not load Zoho API client',
        type: 'IMPORT_ERROR',
        request_id: requestId,
        timestamp: new Date().toISOString()
      });
    }

    const { customerInfo, shippingAddress, cartItems, orderNotes, checkoutType = 'guest' } = req.body;
    
    console.log('Processing guest checkout for:', customerInfo?.email);
    console.log('Cart items count:', cartItems?.length || 0);

    // Validate required fields
    const validationErrors = [];

    if (!customerInfo?.email) validationErrors.push('Email is required');
    if (!customerInfo?.firstName) validationErrors.push('First name is required');  
    if (!customerInfo?.lastName) validationErrors.push('Last name is required');
    
    if (!shippingAddress?.address1) validationErrors.push('Shipping address is required');
    if (!shippingAddress?.city) validationErrors.push('City is required');
    if (!shippingAddress?.state) validationErrors.push('State is required');
    if (!shippingAddress?.zipCode) validationErrors.push('ZIP code is required');
    
    if (!cartItems || cartItems.length === 0) {
      validationErrors.push('Cart is empty');
    }

    // Basic email validation
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

    // Calculate order totals
    const subtotal = cartItems.reduce((sum, item) => {
      const price = item.product_price || item.price || 0;
      const quantity = item.quantity || 1;
      return sum + (price * quantity);
    }, 0);
    
    const tax = Math.round(subtotal * 0.0875 * 100) / 100; // 8.75% tax
    const shipping = subtotal >= 100 ? 0 : 9.99; // Free shipping over $100
    const total = subtotal + tax + shipping;

    console.log('Order totals calculated:', { subtotal, tax, shipping, total });

    // ✅ FIXED: Create order data without customer_id (this was causing issues)
    const orderData = {
      customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
      customer_email: customerInfo.email,
      customer_phone: customerInfo.phone || '',
      
      line_items: cartItems.map(item => ({
        item_name: item.product_name || item.name,
        quantity: item.quantity || 1,
        rate: item.product_price || item.price || 0,
        amount: (item.product_price || item.price || 0) * (item.quantity || 1)
      })),
      
      date: new Date().toISOString().split('T')[0],
      
      sub_total: subtotal,
      tax_total: tax,
      shipping_charge: shipping,
      total: total,
      
      notes: orderNotes || `Guest checkout via Travel Data WiFi website`,
      
      // Add shipping address
      shipping_address: {
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zipCode,
        country: shippingAddress.country || 'US'
      },
      
      custom_fields: [
        { label: 'Checkout Type', value: 'Guest Checkout' },
        { label: 'Source', value: 'Travel Data WiFi Website' },
        { label: 'Request ID', value: requestId }
      ]
    };

    console.log('Creating guest order with data:', JSON.stringify(orderData, null, 2));

    // ✅ FIXED: Test that createOrder method exists before calling
    if (typeof zohoAPI.createOrder !== 'function') {
      throw new Error('zohoAPI.createOrder is not a function');
    }

    // Create order in Zoho Commerce
    const zohoOrder = await zohoAPI.createOrder(orderData);
    
    const orderId = zohoOrder.salesorder_id || zohoOrder.id || zohoOrder.order_id;
    const orderNumber = zohoOrder.salesorder_number || zohoOrder.number || `TDW-GUEST-${orderId}`;
    
    console.log('✅ Guest order created successfully:', {
      orderId: orderId,
      orderNumber: orderNumber,
      customerEmail: customerInfo.email
    });

    // Create guest checkout success response
    const successResponse = {
      success: true,
      type: 'guest_checkout',
      order_id: orderId,
      order_number: orderNumber,
      total_amount: total,
      currency: 'USD',
      
      // Payment URL for guest checkout
      payment_url: `${req.headers.origin}/payment/invoice?${new URLSearchParams({
        order_id: orderId,
        order_number: orderNumber,
        amount: total.toString(),
        currency: 'USD',
        customer_email: customerInfo.email,
        customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        return_url: `${req.headers.origin}/checkout/success`,
        request_id: requestId
      }).toString()}`,
      
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
        'You will be redirected to secure payment',
        'Complete payment to confirm your order',
        'You will receive confirmation via email'
      ],
      
      request_id: requestId,
      checkout_type: 'guest'
    };

    console.log('✅ Guest checkout successful');
    return res.status(200).json(successResponse);

  } catch (error) {
    console.error('❌ Guest checkout failed:', error);
    
    // Enhanced error reporting
    const errorResponse = {
      error: 'Guest checkout processing failed',
      details: error.message || 'An unexpected error occurred',
      type: 'GUEST_CHECKOUT_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    // Add specific error context
    if (error.message?.includes('zohoAPI')) {
      errorResponse.type = 'API_IMPORT_ERROR';
      errorResponse.suggestion = 'Check Zoho API configuration and imports';
    } else if (error.message?.includes('Authentication')) {
      errorResponse.type = 'AUTH_ERROR';
      errorResponse.suggestion = 'Check Zoho OAuth credentials';
    } else if (error.message?.includes('createOrder')) {
      errorResponse.type = 'ORDER_CREATION_ERROR';
      errorResponse.suggestion = 'Check order data format and Zoho API permissions';
    }

    return res.status(500).json(errorResponse);
  }
}