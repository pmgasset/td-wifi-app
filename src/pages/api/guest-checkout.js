// ===== src/pages/api/guest-checkout.js ===== (FIXED - CORRECT VARIANT ID)

/**
 * Guest checkout using correct Storefront API flow with proper variant ID handling
 * FIXES: Uses correct product_variant_id instead of product_id
 */

export default async function handler(req, res) {
  const requestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== GUEST CHECKOUT (STOREFRONT API) [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    const { customerInfo, shippingAddress, cartItems, orderNotes } = req.body;
    
    console.log('Processing guest checkout for:', customerInfo?.email);
    console.log('Cart items count:', cartItems?.length || 0);
    console.log('Cart items structure:', cartItems?.map(item => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      name: item.product_name || item.name
    })));

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

    // ===== GET PRODUCT VARIANT IDs =====
    
    // Import Zoho API to get product variant information
    let zohoAPI;
    try {
      const hybridModule = await import('../../lib/zoho-api-hybrid');
      zohoAPI = hybridModule.hybridZohoAPI || hybridModule.zohoAPI;
    } catch {
      try {
        const existingModule = await import('../../lib/zoho-api');
        zohoAPI = existingModule.zohoAPI;
      } catch (importError) {
        console.error('Could not import Zoho API for product lookup');
        // Continue without product lookup - use fallback IDs
      }
    }

    // ===== RESOLVE VARIANT IDs =====
    
    const resolvedCartItems = [];
    
    for (const item of cartItems) {
      let variantId = item.variant_id || item.product_variant_id;
      
      // If we don't have a variant_id, try to get it from the product
      if (!variantId && zohoAPI) {
        try {
          console.log(`Looking up variants for product: ${item.product_id}`);
          const product = await zohoAPI.getProduct(item.product_id);
          
          if (product && product.variants && product.variants.length > 0) {
            // Use the first variant or find a matching one
            const variant = product.variants[0];
            variantId = variant.variant_id;
            console.log(`✓ Found variant ID: ${variantId} for product: ${item.product_id}`);
          } else {
            console.log(`⚠️ No variants found for product: ${item.product_id}, using product_id as fallback`);
            variantId = item.product_id; // Fallback: some products might not have separate variants
          }
        } catch (productError) {
          console.log(`⚠️ Product lookup failed for ${item.product_id}:`, productError.message);
          variantId = item.product_id; // Fallback
        }
      } else if (!variantId) {
        // No Zoho API available, use product_id as fallback
        variantId = item.product_id;
      }

      resolvedCartItems.push({
        product_variant_id: variantId,
        quantity: item.quantity || 1,
        // Keep original item data for reference
        original_product_id: item.product_id,
        product_name: item.product_name || item.name,
        product_price: item.product_price || item.price
      });
    }

    console.log('Resolved cart items for Storefront API:', resolvedCartItems);

    // ===== STOREFRONT API GUEST CHECKOUT FLOW =====
    
    let cartId = null;
    let checkoutId = null;

    try {
      // STEP 1: Add items to cart (creates anonymous cart for guest)
      console.log('Step 1: Adding items to cart...');
      
      for (const [index, item] of resolvedCartItems.entries()) {
        console.log(`Adding item ${index + 1}: variant_id=${item.product_variant_id}, quantity=${item.quantity}`);
        
        const addToCartData = {
          product_variant_id: item.product_variant_id,
          quantity: item.quantity
        };

        console.log(`Cart API payload for item ${index + 1}:`, JSON.stringify(addToCartData));

        const cartResponse = await storefrontApiRequest('/cart', {
          method: 'POST',
          body: JSON.stringify(addToCartData)
        });

        // Get cart ID from first item (all subsequent items use the same cart)
        if (!cartId && cartResponse.payload) {
          cartId = cartResponse.payload.cart_id;
          checkoutId = cartId; // Cart ID and checkout ID are the same
          console.log('✓ Cart created with ID:', cartId);
        }

        console.log(`✓ Item ${index + 1} added to cart`);
      }

      if (!cartId) {
        throw new Error('Failed to create cart - no cart ID received from any item');
      }

      // STEP 2: Add address to checkout
      console.log('Step 2: Adding address to checkout...');
      
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

      // Add billing address (copy of shipping for guests)
      addressData.billing_address = { ...addressData.shipping_address };

      await storefrontApiRequest(`/checkout/address?checkout_id=${checkoutId}`, {
        method: 'POST',
        body: JSON.stringify(addressData)
      });

      console.log('✓ Address added to checkout');

      // STEP 3: Get available shipping methods and select one
      console.log('Step 3: Setting up shipping...');
      
      try {
        // Get checkout details including shipping methods
        const checkoutDetailsResponse = await storefrontApiRequest(`/checkout?checkout_id=${checkoutId}`, {
          method: 'GET'
        });

        const shippingMethods = checkoutDetailsResponse.payload?.checkout?.shipping_methods || [];
        
        if (shippingMethods.length > 0) {
          // Select first available shipping method
          const selectedShipping = shippingMethods[0];
          
          const shippingData = {
            shipping: selectedShipping.shipping_id || selectedShipping.id
          };

          await storefrontApiRequest(`/checkout/shipping-methods?checkout_id=${checkoutId}`, {
            method: 'POST',
            body: JSON.stringify(shippingData)
          });

          console.log('✓ Shipping method selected:', selectedShipping.name || selectedShipping.shipping_id);
        } else {
          console.log('⚠️ No shipping methods available, continuing without specific shipping selection...');
        }
      } catch (shippingError) {
        console.log('⚠️ Shipping setup failed, continuing:', shippingError.message);
        // Continue with checkout - shipping might be configured differently
      }

      // STEP 4: Place the order
      console.log('Step 4: Placing order...');
      
      const orderResponse = await storefrontApiRequest(`/checkout/offlinepayment?checkout_id=${checkoutId}`, {
        method: 'POST'
      });

      // Extract order information
      const order = orderResponse.payload;
      const orderId = order?.salesorder?.salesorder_id || order?.order_id || order?.id || checkoutId;
      const orderNumber = order?.salesorder?.salesorder_number || order?.order_number || `TDW-SF-${orderId}`;
      
      // Get order summary for totals
      const orderSummary = order?.checkout_order_summary?.order || order?.order || {};
      const total = orderSummary.total_amount || orderSummary.total || 0;

      console.log('✅ Guest checkout completed successfully via Storefront API');

      // ===== SUCCESS RESPONSE =====

      const successResponse = {
        success: true,
        type: 'guest_checkout_storefront',
        order_id: orderId,
        order_number: orderNumber,
        total_amount: total,
        currency: 'USD',
        api_used: 'storefront',
        
        // Payment information
        payment_url: order?.payment_url || orderSummary.payment_url ||
                    `${req.headers.origin}/payment/invoice?${new URLSearchParams({
                      order_id: orderId,
                      order_number: orderNumber,
                      amount: total.toString(),
                      currency: 'USD',
                      customer_email: customerInfo.email,
                      customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
                      return_url: `${req.headers.origin}/checkout/success`,
                      request_id: requestId,
                      api_type: 'storefront'
                    }).toString()}`,
        
        // Order details
        order_details: {
          subtotal: orderSummary.sub_total || 0,
          tax: orderSummary.tax_amount || 0,
          shipping: orderSummary.shipping_charge || 0,
          total: total,
          items: cartItems.length,
          customer: `${customerInfo.firstName} ${customerInfo.lastName}`,
          email: customerInfo.email,
          shipping_address: shippingAddress
        },
        
        next_steps: [
          'Order created successfully via Storefront API',
          'You will be redirected to secure payment',
          'Complete payment to confirm your order',
          'You will receive confirmation via email'
        ],
        
        // Technical details
        request_id: requestId,
        cart_id: cartId,
        checkout_id: checkoutId,
        resolved_variants: resolvedCartItems.map(item => ({
          original_product_id: item.original_product_id,
          used_variant_id: item.product_variant_id
        })),
        timestamp: new Date().toISOString()
      };

      return res.status(200).json(successResponse);

    } catch (storefrontError) {
      console.error('❌ Storefront API checkout failed:', storefrontError);
      
      // Enhanced error response with debugging info
      const errorResponse = {
        error: 'Storefront API checkout failed',
        details: storefrontError.message || 'Storefront API error occurred',
        type: 'STOREFRONT_API_ERROR',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        suggestion: getErrorSuggestion(storefrontError.message),
        
        // Debugging information
        debug_info: {
          cart_id: cartId,
          checkout_id: checkoutId,
          step_reached: cartId ? 'address_or_shipping' : 'cart_creation',
          resolved_variants: resolvedCartItems.map(item => ({
            original_product_id: item.original_product_id,
            resolved_variant_id: item.product_variant_id
          })),
          original_cart_items: cartItems.map(item => ({
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity
          }))
        }
      };

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

async function storefrontApiRequest(endpoint, options = {}) {
  const url = `https://commerce.zoho.com/storefront/api/v1${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'domain-name': process.env.ZOHO_STORE_DOMAIN || 'traveldatawifi.zohostore.com',
    'Accept': 'application/json'
  };

  // Add CSRF token for POST requests
  if (options.method === 'POST') {
    // Generate a basic CSRF token
    defaultHeaders['X-ZCSRF-TOKEN'] = `csrfp=${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  console.log(`Storefront API Request: ${options.method || 'GET'} ${url}`);
  console.log(`Request payload:`, options.body || 'No body');

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
      throw new Error(`Storefront API error: ${jsonResponse.status_message || jsonResponse.developer_message || 'Unknown error'}`);
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
  if (errorMessage?.includes('Invalid input')) {
    return 'Check product variant IDs - products may need valid variant_id instead of product_id';
  } else if (errorMessage?.includes('404')) {
    return 'API endpoint not found - check ZOHO_STORE_DOMAIN and endpoint URLs';
  } else if (errorMessage?.includes('domain-name')) {
    return 'Check ZOHO_STORE_DOMAIN environment variable is set correctly';
  } else if (errorMessage?.includes('CSRF')) {
    return 'CSRF token issue - this should be automatically handled';
  } else if (errorMessage?.includes('product_variant_id')) {
    return 'Product variant ID issue - check if products have valid variants in Zoho';
  } else if (errorMessage?.includes('cart_id')) {
    return 'Cart creation failed - check product variant IDs and quantities';
  } else if (errorMessage?.includes('address')) {
    return 'Address validation failed - check required address fields';
  } else if (errorMessage?.includes('shipping')) {
    return 'Shipping method selection failed - this is optional for checkout';
  } else {
    return 'Check Zoho Commerce Storefront API configuration and product setup';
  }
}