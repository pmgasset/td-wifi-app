// ===== src/pages/api/guest-checkout.js ===== (COMPREHENSIVE DEBUG VERSION)

/**
 * Debug version to identify why "Invalid input" is occurring
 */

export default async function handler(req, res) {
  const requestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== GUEST CHECKOUT DEBUG (STOREFRONT API) [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    const { customerInfo, shippingAddress, cartItems, orderNotes } = req.body;
    
    console.log('Processing guest checkout for:', customerInfo?.email);
    console.log('Cart items count:', cartItems?.length || 0);

    // Basic validation
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        error: 'Cart is empty',
        request_id: requestId
      });
    }

    // Import Zoho API
    let zohoAPI;
    try {
      const hybridModule = await import('../../lib/zoho-api-hybrid');
      zohoAPI = hybridModule.hybridZohoAPI || hybridModule.zohoAPI;
      console.log('✓ Zoho API imported successfully');
    } catch (importError) {
      console.log('⚠️ Could not import Zoho API:', importError.message);
    }

    // Process first cart item for debugging
    const item = cartItems[0];
    console.log('Processing item:', {
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      name: item.product_name || item.name
    });

    // ===== COMPREHENSIVE PRODUCT DEBUGGING =====
    
    let variantId = item.variant_id || item.product_variant_id;
    let productDetails = null;

    if (!variantId && zohoAPI) {
      try {
        console.log('\n=== PRODUCT LOOKUP VIA ADMIN API ===');
        productDetails = await zohoAPI.getProduct(item.product_id);
        
        if (productDetails) {
          console.log('Product found via Admin API:', {
            product_id: productDetails.product_id,
            name: productDetails.name,
            status: productDetails.status,
            show_in_storefront: productDetails.show_in_storefront,
            category_name: productDetails.category_name,
            variants_count: productDetails.variants?.length || 0
          });

          // Analyze variants
          if (productDetails.variants && productDetails.variants.length > 0) {
            console.log('Available variants:');
            productDetails.variants.forEach((variant, index) => {
              console.log(`  Variant ${index + 1}:`, {
                variant_id: variant.variant_id,
                name: variant.name,
                status: variant.status,
                rate: variant.rate,
                stock_on_hand: variant.stock_on_hand,
                available_stock: variant.available_stock,
                is_default: variant.is_default
              });
            });

            // Use first variant
            variantId = productDetails.variants[0].variant_id;
            console.log(`✓ Using variant ID: ${variantId}`);
          } else {
            console.log('⚠️ No variants found - using product_id as fallback');
            variantId = item.product_id;
          }
        } else {
          console.log('❌ Product not found via Admin API');
          variantId = item.product_id;
        }
      } catch (productError) {
        console.log('❌ Product lookup failed:', productError.message);
        variantId = item.product_id;
      }
    } else if (!variantId) {
      variantId = item.product_id;
    }

    // ===== STOREFRONT API PRODUCT CHECK =====
    
    console.log('\n=== CHECKING STOREFRONT API PRODUCT ACCESS ===');
    try {
      const storefrontProductResponse = await storefrontApiRequest(`/products/${item.product_id}?`, {
        method: 'GET'
      });
      
      const storefrontProduct = storefrontProductResponse.payload?.product;
      if (storefrontProduct) {
        console.log('✓ Product accessible via Storefront API:', {
          product_id: storefrontProduct.product_id,
          name: storefrontProduct.name,
          status: storefrontProduct.status,
          variants_count: storefrontProduct.variants?.length || 0
        });

        // Check storefront variants
        if (storefrontProduct.variants && storefrontProduct.variants.length > 0) {
          console.log('Storefront variants:');
          storefrontProduct.variants.forEach((variant, index) => {
            console.log(`  Storefront Variant ${index + 1}:`, {
              variant_id: variant.variant_id,
              name: variant.name,
              available_stock: variant.available_stock,
              rate: variant.rate
            });
          });
        }
      } else {
        console.log('❌ Product payload empty from Storefront API');
      }
    } catch (storefrontProductError) {
      console.log('❌ Product NOT accessible via Storefront API:', storefrontProductError.message);
      console.log('This might mean the product is not published to the storefront');
    }

    // ===== CART ADDITION ATTEMPTS =====
    
    console.log('\n=== ATTEMPTING CART ADDITION WITH DIFFERENT FORMATS ===');
    
    // Try different payload formats
    const payloadFormats = [
      {
        name: 'Standard format with variant_id',
        data: {
          product_variant_id: variantId,
          quantity: "1"
        }
      },
      {
        name: 'Format with empty custom_fields',
        data: {
          product_variant_id: variantId,
          quantity: "1",
          custom_fields: []
        }
      },
      {
        name: 'Format with explicit cart_id null',
        data: {
          product_variant_id: variantId,
          quantity: "1",
          cart_id: null
        }
      },
      {
        name: 'Fallback with product_id',
        data: {
          product_variant_id: item.product_id,
          quantity: "1"
        }
      }
    ];

    let cartResponse = null;
    let successfulFormat = null;

    for (const format of payloadFormats) {
      try {
        console.log(`\n--- Trying: ${format.name} ---`);
        console.log('Payload:', JSON.stringify(format.data, null, 2));
        
        cartResponse = await storefrontApiRequest('/cart?', {
          method: 'POST',
          body: JSON.stringify(format.data)
        });
        
        console.log(`🎉 SUCCESS with ${format.name}!`);
        console.log('Response:', JSON.stringify(cartResponse, null, 2));
        successfulFormat = format.name;
        break;
        
      } catch (formatError) {
        console.log(`❌ Failed with ${format.name}:`, formatError.message);
        
        // Log additional error details if available
        if (formatError.message.includes('400')) {
          console.log('This is a client error - check payload format or product availability');
        }
      }
    }

    if (!successfulFormat) {
      console.log('\n=== ALL CART FORMATS FAILED ===');
      
      // Return detailed debugging information
      return res.status(500).json({
        error: 'All cart addition formats failed',
        debug_info: {
          request_id: requestId,
          product_id: item.product_id,
          resolved_variant_id: variantId,
          admin_api_product_found: !!productDetails,
          product_show_in_storefront: productDetails?.show_in_storefront,
          product_status: productDetails?.status,
          variants_available: productDetails?.variants?.length || 0,
          attempted_formats: payloadFormats.map(f => f.name),
          suggestion: 'Check if product is published to storefront and has available stock'
        }
      });
    }

    // If we got here, cart creation succeeded!
    const cartId = cartResponse.payload?.cart_id;
    const checkoutId = cartId;

    console.log(`\n=== CART CREATED SUCCESSFULLY ===`);
    console.log(`Cart ID: ${cartId}`);
    console.log(`Used format: ${successfulFormat}`);

    // Continue with address and checkout completion...
    try {
      console.log('\n=== ADDING ADDRESS ===');
      
      const addressData = {
        shipping_address: {
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          email_address: customerInfo.email,
          address: shippingAddress.address1,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.zipCode,
          telephone: customerInfo.phone || '',
          country: shippingAddress.country || 'US',
          same_billing_address: true
        }
      };

      addressData.billing_address = { ...addressData.shipping_address };

      await storefrontApiRequest(`/checkout/address?checkout_id=${checkoutId}`, {
        method: 'POST',
        body: JSON.stringify(addressData)
      });

      console.log('✓ Address added successfully');

      // Complete the order
      console.log('\n=== COMPLETING ORDER ===');
      
      const orderResponse = await storefrontApiRequest(`/checkout/offlinepayment?checkout_id=${checkoutId}`, {
        method: 'POST'
      });

      const order = orderResponse.payload;
      const orderId = order?.salesorder?.salesorder_id || order?.order_id || checkoutId;
      const orderNumber = order?.salesorder?.salesorder_number || `TDW-${orderId}`;

      console.log('🎉 ORDER COMPLETED SUCCESSFULLY!');

      return res.status(200).json({
        success: true,
        order_id: orderId,
        order_number: orderNumber,
        cart_id: cartId,
        successful_format: successfulFormat,
        debug_info: {
          product_id: item.product_id,
          variant_id: variantId,
          request_id: requestId
        }
      });

    } catch (checkoutError) {
      console.log('❌ Checkout completion failed:', checkoutError.message);
      
      return res.status(500).json({
        error: 'Cart created but checkout failed',
        details: checkoutError.message,
        cart_id: cartId,
        successful_cart_format: successfulFormat,
        request_id: requestId
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    
    return res.status(500).json({
      error: 'Unexpected error',
      details: error.message,
      request_id: requestId
    });
  }
}

// Helper function
async function storefrontApiRequest(endpoint, options = {}) {
  const url = `https://commerce.zoho.com/storefront/api/v1${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'domain-name': 'traveldatawifi.com', // Your custom domain
    'Accept': 'application/json'
  };

  if (options.method === 'POST') {
    defaultHeaders['X-ZCSRF-TOKEN'] = `csrfp=${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  console.log(`API Request: ${options.method || 'GET'} ${url}`);

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });

  const responseText = await response.text();
  console.log(`API Response (${response.status}):`, responseText);

  if (!response.ok) {
    throw new Error(`Storefront API error: ${response.status} - ${responseText}`);
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