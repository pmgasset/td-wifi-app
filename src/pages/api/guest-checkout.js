// ===== src/pages/api/guest-checkout.js ===== (CORRECT STOREFRONT API IMPLEMENTATION)

/**
 * Guest checkout using Zoho's Storefront API with the correct cart-based flow
 * Flow: Add to Cart → Get Cart → Add Address → Complete Checkout
 */

export default async function handler(req, res) {
  const requestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== GUEST CHECKOUT (STOREFRONT API) [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    const { customerInfo, shippingAddress, cartItems, orderNotes } = req.body;
    
    console.log('Processing Storefront API guest checkout for:', customerInfo?.email);
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

    // ===== STOREFRONT API CHECKOUT FLOW =====
    
    let cartId = null;
    let checkoutId = null;

    // Step 1: Add items to cart (creates cart_id)
    console.log('Step 1: Adding items to cart...');
    
    try {
      // Add first item to create cart
      const firstItem = cartItems[0];
      
      const addToCartResponse = await storefrontApiRequest('/cart', {
        method: 'POST',
        body: JSON.stringify({
          product_variant_id: firstItem.variant_id || firstItem.product_id,
          quantity: firstItem.quantity || 1,
          custom_fields: orderNotes ? [
            {
              label: "Order Notes",
              data_type: "string", 
              value: orderNotes
            }
          ] : []
        })
      });

      cartId = addToCartResponse.payload?.cart_id;
      if (!cartId) {
        throw new Error('No cart ID received from add to cart');
      }

      console.log('✓ Cart created with first item:', cartId);

      // Add remaining items to the same cart
      for (let i = 1; i < cartItems.length; i++) {
        const item = cartItems[i];
        
        await storefrontApiRequest('/cart', {
          method: 'POST',
          body: JSON.stringify({
            product_variant_id: item.variant_id || item.product_id,
            quantity: item.quantity || 1,
            cart_id: cartId
          })
        });
        
        console.log(`✓ Added item ${i + 1} to cart`);
      }

      // Set checkout ID (same as cart ID per Zoho docs)
      checkoutId = cartId;

    } catch (cartError) {
      console.error('❌ Failed to create cart:', cartError);
      throw new Error(`Cart creation failed: ${cartError.message}`);
    }

    // Step 2: Get cart details to verify totals
    console.log('Step 2: Getting cart details...');
    
    try {
      const cartResponse = await storefrontApiRequest(`/cart?cart_id=${cartId}`, {
        method: 'GET'
      });

      const cartData = cartResponse.payload;
      console.log('✓ Cart details retrieved:', {
        items: cartData.count,
        subtotal: cartData.sub_total,
        total: cartData.total_price
      });

    } catch (cartDetailsError) {
      console.log('⚠️ Could not get cart details, continuing:', cartDetailsError.message);
    }

    // Step 3: Add address to checkout (cart_id = checkout_id)
    console.log('Step 3: Adding address to checkout...');
    
    try {
      const addressData = {
        shipping_address: {
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          email_address: customerInfo.email,
          address: shippingAddress.address1,
          address2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.zipCode,
          telephone: customerInfo.phone || '',
          country: shippingAddress.country || 'US',
          same_billing_address: true
        }
      };

      // Add billing address (same as shipping)
      addressData.billing_address = { ...addressData.shipping_address };

      const addressResponse = await storefrontApiRequest(`/checkout/address?checkout_id=${checkoutId}`, {
        method: 'POST',
        body: JSON.stringify(addressData)
      });

      console.log('✓ Address added to checkout');

    } catch (addressError) {
      console.error('❌ Failed to add address:', addressError);
      throw new Error(`Address addition failed: ${addressError.message}`);
    }

    // Step 4: Complete checkout with offline payment
    console.log('Step 4: Completing checkout...');
    
    try {
      const checkoutResponse = await storefrontApiRequest(`/checkout/offlinepayment?checkout_id=${checkoutId}`, {
        method: 'POST'
      });

      const orderData = checkoutResponse.payload;
      console.log('✅ Storefront checkout completed successfully');

      // ===== SUCCESS RESPONSE =====

      const orderId = orderData?.salesorder?.salesorder_id || orderData?.order_id || checkoutId;
      const orderNumber = orderData?.salesorder?.salesorder_number || `TDW-SF-${orderId}`;

      // Calculate totals (fallback if not in response)
      const subtotal = cartItems.reduce((sum, item) => {
        const price = item.product_price || item.price || 0;
        const quantity = item.quantity || 1;
        return sum + (price * quantity);
      }, 0);
      
      const tax = Math.round(subtotal * 0.0875 * 100) / 100;
      const shipping = subtotal >= 100 ? 0 : 9.99;
      const total = subtotal + tax + shipping;

      const successResponse = {
        success: true,
        type: 'guest_checkout_storefront',
        order_id: orderId,
        order_number: orderNumber,
        checkout_id: checkoutId,
        cart_id: cartId,
        total_amount: orderData?.total || total,
        currency: 'USD',
        api_used: 'storefront',
        
        // Payment information
        payment_url: orderData?.payment_url || 
                    `${req.headers.origin}/payment/invoice?${new URLSearchParams({
                      order_id: orderId,
                      order_number: orderNumber,
                      amount: (orderData?.total || total).toString(),
                      currency: 'USD',
                      customer_email: customerInfo.email,
                      customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
                      return_url: `${req.headers.origin}/checkout/success`,
                      request_id: requestId,
                      checkout_id: checkoutId
                    }).toString()}`,
        
        // Order details
        order_details: {
          subtotal: orderData?.sub_total || subtotal,
          tax: orderData?.tax_total || tax,
          shipping: orderData?.shipping_charge || shipping,
          total: orderData?.total || total,
          items: cartItems.length,
          customer: `${customerInfo.firstName} ${customerInfo.lastName}`,
          email: customerInfo.email,
          shipping_address: shippingAddress
        },
        
        next_steps: [
          'Order created via Storefront API',
          'Cart converted to checkout successfully',
          'You will be redirected to secure payment',
          'Complete payment to confirm your order'
        ],
        
        request_id: requestId,
        timestamp: new Date().toISOString()
      };

      return res.status(200).json(successResponse);

    } catch (checkoutError) {
      console.error('❌ Failed to complete checkout:', checkoutError);
      throw new Error(`Checkout completion failed: ${checkoutError.message}`);
    }

  } catch (error) {
    console.error('❌ Guest checkout failed:', error);
    
    const errorResponse = {
      error: 'Storefront API guest checkout failed',
      details: error.message || 'An unexpected error occurred',
      type: 'STOREFRONT_CHECKOUT_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString(),
      suggestion: getErrorSuggestion(error.message)
    };

    return res.status(500).json(errorResponse);
  }
}

// ===== HELPER FUNCTIONS =====

async function storefrontApiRequest(endpoint, options = {}) {
  const url = `https://commerce.zoho.com/storefront/api/v1${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'domain-name': process.env.ZOHO_STORE_DOMAIN || 'traveldatawifi.zohostore.com',
    'Accept': 'application/json'
  };

  // Add CSRF token for POST requests
  if (options.method === 'POST' || options.method === 'PUT') {
    // Generate a basic CSRF token - in production, implement proper CSRF handling
    defaultHeaders['X-ZCSRF-TOKEN'] = `csrfp=${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  console.log(`Storefront API Request: ${options.method || 'GET'} ${url}`);

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });

  const responseText = await response.text();
  console.log(`Storefront API Response (${response.status}):`, responseText);

  if (!response.ok) {
    throw new Error(`Storefront API error: ${response.status} - ${responseText || response.statusText}`);
  }

  try {
    const jsonResponse = JSON.parse(responseText);
    
    if (jsonResponse.status_code && jsonResponse.status_code !== '0') {
      throw new Error(`Storefront API error: ${jsonResponse.status_message || 'Unknown error'}`);
    }
    
    return jsonResponse;
  } catch (parseError) {
    if (parseError.message.includes('Storefront API error:')) {
      throw parseError;
    }
    throw new Error(`Invalid JSON response: ${responseText}`);
  }
}

function getErrorSuggestion(errorMessage) {
  if (errorMessage?.includes('cart')) {
    return 'Check product variant IDs and ensure products exist in Zoho Commerce';
  } else if (errorMessage?.includes('address')) {
    return 'Verify address format and required fields for Storefront API';
  } else if (errorMessage?.includes('domain-name')) {
    return 'Check ZOHO_STORE_DOMAIN environment variable is set correctly';
  } else if (errorMessage?.includes('404')) {
    return 'API endpoint not found - verify Storefront API endpoint and product IDs';
  } else if (errorMessage?.includes('CSRF')) {
    return 'CSRF token issue - may need proper session-based token implementation';
  } else {
    return 'Check Zoho Storefront API configuration and product variant IDs';
  }
}