// ===== src/pages/api/guest-checkout.js ===== (FIXED - SIMPLE WORKING VERSION)

/**
 * Simple, reliable guest checkout using Admin API only
 * FIXES: Removes Storefront API calls that were causing 404 errors
 */

export default async function handler(req, res) {
  const requestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== GUEST CHECKOUT (ADMIN API ONLY) [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    // Import API with fallback
    let zohoAPI;
    try {
      const hybridModule = await import('../../lib/zoho-api-hybrid');
      zohoAPI = hybridModule.hybridZohoAPI || hybridModule.zohoAPI;
      console.log('✓ Using hybrid Zoho API');
    } catch {
      try {
        const existingModule = await import('../../lib/zoho-api');
        zohoAPI = existingModule.zohoAPI || existingModule.simpleZohoAPI;
        console.log('✓ Using existing Zoho API (fallback)');
      } catch (importError) {
        console.error('❌ Failed to import any Zoho API:', importError);
        return res.status(500).json({
          error: 'API configuration error',
          details: 'Could not load Zoho API client',
          type: 'IMPORT_ERROR',
          request_id: requestId
        });
      }
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

    console.log('Order totals:', { subtotal, tax, shipping, total });

    // ===== ADMIN API CHECKOUT (RELIABLE METHOD) =====
    
    try {
      // Use the hybrid API's guest checkout method
      let order;
      
      if (zohoAPI.createGuestCheckout) {
        // Use the hybrid API method
        order = await zohoAPI.createGuestCheckout({
          customerInfo,
          shippingAddress,
          cartItems,
          orderNotes
        });
      } else if (zohoAPI.createOrder) {
        // Direct Admin API method
        console.log('Using direct Admin API order creation...');
        
        // Create optimized address (if method available)
        let optimizedAddress;
        if (zohoAPI.formatAddressForAdmin) {
          optimizedAddress = zohoAPI.formatAddressForAdmin(customerInfo, shippingAddress);
        } else {
          // Fallback address optimization
          optimizedAddress = {
            attention: `${customerInfo.firstName} ${customerInfo.lastName}`.substring(0, 20),
            address1: shippingAddress.address1.substring(0, 30),
            city: shippingAddress.city.substring(0, 15),
            state: shippingAddress.state.substring(0, 2),
            zip: shippingAddress.zipCode.substring(0, 10),
            country: shippingAddress.country?.substring(0, 2) || 'US'
          };
          
          // Ensure total length under 90 chars
          const totalLength = Object.values(optimizedAddress).join('').length;
          if (totalLength > 90) {
            optimizedAddress.attention = optimizedAddress.attention.substring(0, 15);
            optimizedAddress.address1 = optimizedAddress.address1.substring(0, 25);
            optimizedAddress.city = optimizedAddress.city.substring(0, 12);
          }
          
          console.log('Optimized address length:', Object.values(optimizedAddress).join('').length);
        }
        
        const orderData = {
          customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
          customer_email: customerInfo.email,
          customer_phone: customerInfo.phone || '',
          
          line_items: cartItems.map(item => ({
            item_name: item.product_name || item.name || 'Product',
            quantity: item.quantity || 1,
            rate: item.product_price || item.price || 0,
            amount: (item.product_price || item.price || 0) * (item.quantity || 1)
          })),
          
          date: new Date().toISOString().split('T')[0],
          sub_total: subtotal,
          tax_total: tax,
          shipping_charge: shipping,
          total: total,
          notes: orderNotes || 'Guest checkout via Travel Data WiFi website',
          
          // Use optimized address
          shipping_address: optimizedAddress,
          billing_address: optimizedAddress
        };

        order = await zohoAPI.createOrder(orderData);
      } else {
        throw new Error('No suitable API method available for order creation');
      }

      console.log('✅ Guest checkout successful via Admin API');

      // ===== SUCCESS RESPONSE =====

      const orderId = order.salesorder_id || order.order_id || order.id;
      const orderNumber = order.salesorder_number || order.order_number || `TDW-${orderId}`;

      const successResponse = {
        success: true,
        type: 'guest_checkout',
        order_id: orderId,
        order_number: orderNumber,
        total_amount: total,
        currency: 'USD',
        api_used: 'admin',
        
        // Payment information
        payment_url: order.payment_url || 
                    `${req.headers.origin}/payment/invoice?${new URLSearchParams({
                      order_id: orderId,
                      order_number: orderNumber,
                      amount: total.toString(),
                      currency: 'USD',
                      customer_email: customerInfo.email,
                      customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
                      return_url: `${req.headers.origin}/checkout/success`,
                      request_id: requestId
                    }).toString()}`,
        
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
          'Order created successfully via Admin API',
          'You will be redirected to secure payment',
          'Complete payment to confirm your order',
          'You will receive confirmation via email'
        ],
        
        request_id: requestId,
        timestamp: new Date().toISOString()
      };

      return res.status(200).json(successResponse);

    } catch (checkoutError) {
      console.error('❌ Guest checkout failed:', checkoutError);
      
      const errorResponse = {
        error: 'Guest checkout processing failed',
        details: checkoutError.message || 'An unexpected error occurred',
        type: 'GUEST_CHECKOUT_ERROR',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        suggestion: getErrorSuggestion(checkoutError.message)
      };

      // Add specific error context
      if (checkoutError.message?.includes('100 characters')) {
        errorResponse.type = 'ADDRESS_LENGTH_ERROR';
        errorResponse.suggestion = 'Address data was too long - this should now be fixed with address optimization';
      } else if (checkoutError.message?.includes('authentication') || checkoutError.message?.includes('token')) {
        errorResponse.type = 'AUTHENTICATION_ERROR';
        errorResponse.suggestion = 'Check Zoho OAuth credentials and refresh token';
      } else if (checkoutError.message?.includes('404')) {
        errorResponse.type = 'API_ENDPOINT_ERROR';
        errorResponse.suggestion = 'API endpoint not found - check Zoho API configuration';
      }

      return res.status(500).json(errorResponse);
    }

  } catch (error) {
    console.error('❌ Unexpected error in guest checkout:', error);
    
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

function getErrorSuggestion(errorMessage) {
  if (errorMessage?.includes('100 characters')) {
    return 'Address data too long - enable address truncation (should be fixed now)';
  } else if (errorMessage?.includes('authentication') || errorMessage?.includes('token')) {
    return 'Check Zoho OAuth credentials and refresh token';
  } else if (errorMessage?.includes('404')) {
    return 'API endpoint not found - using Admin API only should resolve this';
  } else if (errorMessage?.includes('Missing required Zoho environment variables')) {
    return 'Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, and ZOHO_STORE_ID in environment variables';
  } else if (errorMessage?.includes('ZOHO_STORE_ID')) {
    return 'Check ZOHO_STORE_ID environment variable is set correctly';
  } else {
    return 'Check Zoho Commerce Admin API configuration and try again';
  }
}