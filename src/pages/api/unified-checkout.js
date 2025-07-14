// ===== src/pages/api/unified-checkout.js ===== (NEW UNIFIED APPROACH)

/**
 * Unified checkout API that handles both guest and customer checkouts using Storefront API
 * This replaces both guest-checkout.js and customer-first-checkout.js
 */

export default async function handler(req, res) {
  const requestId = `unified_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== UNIFIED CHECKOUT (STOREFRONT API) [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    const { 
      customerInfo, 
      shippingAddress, 
      cartItems, 
      orderNotes,
      checkoutType = 'guest', // 'guest' | 'create_account' | 'existing_customer'
      customerPassword = null,
      existingCustomerId = null
    } = req.body;
    
    console.log('Processing unified checkout:', {
      email: customerInfo?.email,
      type: checkoutType,
      items: cartItems?.length || 0
    });

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

    // Additional validation for account creation
    if (checkoutType === 'create_account' && !customerPassword) {
      validationErrors.push('Password is required for account creation');
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

    // ===== UNIFIED STOREFRONT API CHECKOUT =====
    
    let checkoutId;
    let customerId = existingCustomerId;
    let customerCreated = false;
    let customerLoggedIn = false;

    // Step 1: Create checkout session
    console.log('Step 1: Creating checkout session...');
    
    const checkoutResponse = await storefrontApiRequest('/checkout', {
      method: 'POST',
      body: JSON.stringify({
        line_items: cartItems.map(item => ({
          variant_id: item.variant_id || item.product_id,
          quantity: item.quantity || 1
        }))
      })
    });

    checkoutId = checkoutResponse.payload?.checkout_id;
    if (!checkoutId) {
      throw new Error('No checkout ID received from Storefront API');
    }

    console.log('✓ Checkout session created:', checkoutId);

    // Step 2: Handle customer account logic
    if (checkoutType === 'create_account') {
      console.log('Step 2a: Creating new customer account...');
      
      try {
        const customerResult = await createCustomerAccount({
          customerInfo,
          shippingAddress,
          customerPassword
        });
        
        if (customerResult.success) {
          customerId = customerResult.customerId;
          customerCreated = true;
          console.log('✓ Customer account created:', customerId);
        }
      } catch (customerError) {
        console.log('⚠️ Customer creation failed, continuing as guest:', customerError.message);
      }
      
    } else if (checkoutType === 'existing_customer' && existingCustomerId) {
      console.log('Step 2b: Using existing customer:', existingCustomerId);
      customerId = existingCustomerId;
      customerLoggedIn = true;
      
    } else {
      console.log('Step 2c: Processing as guest checkout');
    }

    // Step 3: Associate customer with checkout (if we have one)
    if (customerId) {
      console.log('Step 3: Associating customer with checkout...');
      
      try {
        await storefrontApiRequest(`/checkout/customer?checkout_id=${checkoutId}`, {
          method: 'POST',
          body: JSON.stringify({
            customer: {
              id: customerId,
              first_name: customerInfo.firstName,
              last_name: customerInfo.lastName,
              email: customerInfo.email,
              phone: customerInfo.phone || ''
            }
          })
        });
        
        console.log('✓ Customer associated with checkout');
      } catch (error) {
        console.log('⚠️ Customer association failed, continuing:', error.message);
      }
    }

    // Step 4: Add address to checkout
    console.log('Step 4: Adding address to checkout...');
    
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

    // Add billing address (copy of shipping for simplicity)
    addressData.billing_address = { ...addressData.shipping_address };

    await storefrontApiRequest(`/checkout/address?checkout_id=${checkoutId}`, {
      method: 'POST',
      body: JSON.stringify(addressData)
    });

    console.log('✓ Address added to checkout');

    // Step 5: Add order notes if provided
    if (orderNotes) {
      console.log('Step 5: Adding order notes...');
      
      try {
        await storefrontApiRequest(`/checkout/notes?checkout_id=${checkoutId}`, {
          method: 'POST',
          body: JSON.stringify({
            note: orderNotes,
            attributes: [
              { key: 'source', value: 'Travel Data WiFi Website' },
              { key: 'checkout_type', value: checkoutType },
              { key: 'request_id', value: requestId }
            ]
          })
        });
        
        console.log('✓ Order notes added');
      } catch (error) {
        console.log('⚠️ Order notes failed, continuing:', error.message);
      }
    }

    // Step 6: Complete the order
    console.log('Step 6: Completing order...');
    
    const orderResponse = await storefrontApiRequest(`/checkout/offlinepayment?checkout_id=${checkoutId}`, {
      method: 'POST'
    });

    const orderId = orderResponse.payload?.salesorder?.salesorder_id || orderResponse.payload?.order_id;
    const orderNumber = orderResponse.payload?.salesorder?.salesorder_number || `TDW-${orderId}`;

    console.log('✅ Unified checkout completed successfully:', {
      orderId,
      orderNumber,
      customerId,
      customerCreated,
      customerLoggedIn,
      checkoutType
    });

    // Create comprehensive success response
    const successResponse = {
      success: true,
      type: 'unified_checkout_storefront',
      order_id: orderId,
      order_number: orderNumber,
      total_amount: total,
      currency: 'USD',
      api_used: 'storefront',
      
      // Customer status
      checkout_type: checkoutType,
      customer_id: customerId,
      customer_created: customerCreated,
      customer_logged_in: customerLoggedIn,
      customer_status: customerId 
        ? (customerCreated ? 'new_account' : 'existing_account')
        : 'guest',
      
      // Payment information
      payment_url: orderResponse.payload?.payment_url || 
                  `${req.headers.origin}/payment/invoice?${new URLSearchParams({
                    order_id: orderId,
                    order_number: orderNumber,
                    amount: total.toString(),
                    currency: 'USD',
                    customer_email: customerInfo.email,
                    customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
                    customer_id: customerId || 'guest',
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
      
      // Process summary
      process_summary: [
        `✓ Checkout type: ${checkoutType}`,
        customerId 
          ? (customerCreated ? `✓ New customer account created: ${customerId}` : `✓ Used existing customer: ${customerId}`)
          : '✓ Processed as guest',
        `✓ Order created: ${orderNumber}`,
        '✓ Ready for payment'
      ],
      
      // Metadata
      request_id: requestId,
      checkout_id: checkoutId,
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(successResponse);

  } catch (error) {
    console.error('❌ Unified checkout failed:', error);
    
    return res.status(500).json({
      error: 'Unified checkout processing failed',
      details: error.message || 'An unexpected error occurred',
      type: 'UNIFIED_CHECKOUT_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString(),
      
      suggestion: getErrorSuggestion(error.message)
    });
  }
}

// ===== HELPER FUNCTIONS =====

async function storefrontApiRequest(endpoint, options = {}) {
  const url = `https://commerce.zoho.com/storefront/api/v1${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'domain-name': process.env.ZOHO_STORE_DOMAIN || 'traveldatawifi.zohostore.com',
      ...options.headers,
    },
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Storefront API error: ${response.status} ${response.statusText} - ${responseText}`);
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

async function createCustomerAccount({ customerInfo, shippingAddress, customerPassword }) {
  try {
    const customerData = {
      customer: {
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        email: customerInfo.email,
        phone: customerInfo.phone || '',
        password: customerPassword,
        accepts_marketing: false,
        
        addresses: [{
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          address1: shippingAddress.address1,
          address2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: shippingAddress.country || 'US',
          phone: customerInfo.phone || '',
          default: true
        }]
      }
    };

    const response = await storefrontApiRequest('/customers', {
      method: 'POST',
      body: JSON.stringify(customerData)
    });

    const customerId = response.payload?.customer?.id || response.payload?.customer?.customer_id;
    
    if (!customerId) {
      throw new Error('No customer ID received from customer creation');
    }

    return {
      success: true,
      customerId: customerId,
      customerData: response.payload?.customer
    };

  } catch (error) {
    console.error('Customer creation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function getErrorSuggestion(errorMessage) {
  if (errorMessage?.includes('Checkout creation')) {
    return 'Check cart items and product availability';
  } else if (errorMessage?.includes('Customer creation')) {
    return 'Customer account creation failed, but checkout can continue as guest';
  } else if (errorMessage?.includes('Address assignment')) {
    return 'Check address format and required fields';
  } else if (errorMessage?.includes('Order completion')) {
    return 'Check payment configuration in Zoho Commerce';
  } else if (errorMessage?.includes('domain-name')) {
    return 'Check ZOHO_STORE_DOMAIN environment variable';
  } else {
    return 'Check Zoho Commerce configuration and try again';
  }
}