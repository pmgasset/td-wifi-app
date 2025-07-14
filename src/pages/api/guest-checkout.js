// ===== src/pages/api/guest-checkout.js ===== (FINAL VERSION)

export default async function handler(req, res) {
  const requestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== GUEST CHECKOUT (STOREFRONT API) [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    // Import hybrid API
    let zohoAPI;
    try {
      // Try hybrid API first, fall back to existing API
      try {
        const hybridModule = await import('../../lib/zoho-api-hybrid');
        zohoAPI = hybridModule.hybridZohoAPI || hybridModule.zohoAPI;
        console.log('✓ Using hybrid Zoho API');
      } catch {
        const existingModule = await import('../../lib/zoho-api');
        zohoAPI = existingModule.zohoAPI || existingModule.simpleZohoAPI;
        console.log('✓ Using existing Zoho API (fallback)');
      }
      
      if (!zohoAPI) {
        throw new Error('No Zoho API available');
      }
    } catch (importError) {
      console.error('❌ Failed to import Zoho API:', importError);
      return res.status(500).json({
        error: 'API configuration error',
        details: 'Could not load Zoho API client',
        type: 'IMPORT_ERROR',
        request_id: requestId,
        timestamp: new Date().toISOString()
      });
    }

    const { customerInfo, shippingAddress, cartItems, orderNotes } = req.body;
    
    console.log('Processing guest checkout for:', customerInfo?.email);
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
    
    const tax = Math.round(subtotal * 0.0875 * 100) / 100;
    const shipping = subtotal >= 100 ? 0 : 9.99;
    const total = subtotal + tax + shipping;

    console.log('Order totals calculated:', { subtotal, tax, shipping, total });

    let order;
    let apiType = 'unknown';

    // Try Storefront API first (preferred for guests)
    if (zohoAPI.createGuestCheckout && typeof zohoAPI.createGuestCheckout === 'function') {
      try {
        console.log('Attempting Storefront API checkout...');
        
        order = await zohoAPI.createGuestCheckout({
          customerInfo,
          shippingAddress,
          cartItems,
          orderNotes
        });
        
        apiType = 'storefront';
        console.log('✅ Storefront API checkout successful');
      } catch (storefrontError) {
        console.log('⚠️ Storefront API failed, falling back to Admin API:', storefrontError.message);
        
        // Fall back to Admin API
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
          
          // Minimal address to avoid 100-char limit
          shipping_address: {
            attention: `${customerInfo.firstName} ${customerInfo.lastName}`.substring(0, 25),
            address1: shippingAddress.address1.substring(0, 25),
            city: shippingAddress.city.substring(0, 15),
            state: shippingAddress.state.substring(0, 5),
            zip: shippingAddress.zipCode.substring(0, 10),
            country: 'US'
          }
        };

        // Use the same address for billing
        orderData.billing_address = orderData.shipping_address;
        
        order = await zohoAPI.createOrder(orderData);
        apiType = 'admin';
        console.log('✅ Admin API fallback successful');
      }
    } else {
      // Only Admin API available
      console.log('Only Admin API available, using minimal address format...');
      
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
        
        // Minimal address to avoid 100-char limit
        shipping_address: {
          attention: `${customerInfo.firstName} ${customerInfo.lastName}`.substring(0, 25),
          address1: shippingAddress.address1.substring(0, 25),
          city: shippingAddress.city.substring(0, 15),
          state: shippingAddress.state.substring(0, 5),
          zip: shippingAddress.zipCode.substring(0, 10),
          country: 'US'
        }
      };

      // Use the same address for billing
      orderData.billing_address = orderData.shipping_address;
      
      order = await zohoAPI.createOrder(orderData);
      apiType = 'admin';
      console.log('✅ Admin API order creation successful');
    }

    const orderId = order.salesorder_id || order.order_id || order.id;
    const orderNumber = order.salesorder_number || order.order_number || order.number || `TDW-GUEST-${orderId}`;
    
    console.log('✅ Guest order created successfully:', {
      orderId: orderId,
      orderNumber: orderNumber,
      customerEmail: customerInfo.email,
      apiUsed: apiType
    });

    // Create success response
    const successResponse = {
      success: true,
      type: 'guest_checkout',
      order_id: orderId,
      order_number: orderNumber,
      total_amount: total,
      currency: 'USD',
      api_used: apiType,
      
      // Payment URL
      payment_url: `${req.headers.origin}/payment/invoice?${new URLSearchParams({
        order_id: orderId,
        order_number: orderNumber,
        amount: total.toString(),
        currency: 'USD',
        customer_email: customerInfo.email,
        customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        return_url: `${req.headers.origin}/checkout/success`,
        request_id: requestId,
        api_type: apiType
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
        `Order created via ${apiType.toUpperCase()} API`,
        'You will be redirected to secure payment',
        'Complete payment to confirm your order',
        'You will receive confirmation via email'
      ],
      
      request_id: requestId,
      checkout_type: 'guest',
      checkout_id: order.checkout_id || null
    };

    console.log('✅ Guest checkout successful');
    return res.status(200).json(successResponse);

  } catch (error) {
    console.error('❌ Guest checkout failed:', error);
    
    const errorResponse = {
      error: 'Guest checkout processing failed',
      details: error.message || 'An unexpected error occurred',
      type: 'GUEST_CHECKOUT_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    // Add specific error context
    if (error.message?.includes('100 characters')) {
      errorResponse.type = 'ADDRESS_LENGTH_ERROR';
      errorResponse.suggestion = 'Address data was too long for Admin API - trying Storefront API would resolve this';
    } else if (error.message?.includes('Storefront API')) {
      errorResponse.type = 'STOREFRONT_API_ERROR';
      errorResponse.suggestion = 'Check ZOHO_STORE_DOMAIN configuration and Storefront API access';
    } else if (error.message?.includes('zohoAPI')) {
      errorResponse.type = 'API_IMPORT_ERROR';
      errorResponse.suggestion = 'Check Zoho API configuration and imports';
    }

    return res.status(500).json(errorResponse);
  }
}