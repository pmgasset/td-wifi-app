// ===== RECOMMENDED: Use Zoho Commerce Storefront API for Guest Checkout =====

// Replace your current guest-checkout.js with this Storefront API approach:

export default async function handler(req, res) {
  const requestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== GUEST CHECKOUT (STOREFRONT API) [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    const { customerInfo, shippingAddress, cartItems, orderNotes } = req.body;
    
    // Validation (same as before)
    const validationErrors = [];
    if (!customerInfo?.email) validationErrors.push('Email is required');
    if (!customerInfo?.firstName) validationErrors.push('First name is required');  
    if (!customerInfo?.lastName) validationErrors.push('Last name is required');
    if (!shippingAddress?.address1) validationErrors.push('Shipping address is required');
    if (!shippingAddress?.city) validationErrors.push('City is required');
    if (!shippingAddress?.state) validationErrors.push('State is required');
    if (!shippingAddress?.zipCode) validationErrors.push('ZIP code is required');
    if (!cartItems || cartItems.length === 0) validationErrors.push('Cart is empty');

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

    // ✅ SOLUTION: Use Storefront API workflow (3 steps)
    
    // Step 1: Create a checkout session
    console.log('Step 1: Creating checkout session...');
    const checkoutData = {
      line_items: cartItems.map(item => ({
        variant_id: item.variant_id || item.product_id,
        quantity: item.quantity || 1
      }))
    };
    
    const checkoutResponse = await fetch(`https://commerce.zoho.com/storefront/api/v1/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'domain-name': process.env.ZOHO_STORE_DOMAIN || 'traveldatawifi.zohostore.com'
      },
      body: JSON.stringify(checkoutData)
    });

    if (!checkoutResponse.ok) {
      throw new Error(`Checkout creation failed: ${checkoutResponse.status} ${checkoutResponse.statusText}`);
    }

    const checkout = await checkoutResponse.json();
    const checkoutId = checkout.payload?.checkout_id;
    
    if (!checkoutId) {
      throw new Error('No checkout ID received from Storefront API');
    }

    console.log('✓ Checkout session created:', checkoutId);

    // Step 2: Add address to checkout (NO 100-character limit!)
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
      },
      billing_address: {
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

    const addressResponse = await fetch(`https://commerce.zoho.com/storefront/api/v1/checkout/address?checkout_id=${checkoutId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'domain-name': process.env.ZOHO_STORE_DOMAIN || 'traveldatawifi.zohostore.com'
      },
      body: JSON.stringify(addressData)
    });

    if (!addressResponse.ok) {
      const errorText = await addressResponse.text();
      throw new Error(`Address assignment failed: ${addressResponse.status} ${addressResponse.statusText} - ${errorText}`);
    }

    const addressResult = await addressResponse.json();
    console.log('✓ Address added to checkout successfully');

    // Step 3: Complete the order with offline payment
    console.log('Step 3: Completing order...');
    const orderResponse = await fetch(`https://commerce.zoho.com/storefront/api/v1/checkout/offlinepayment?checkout_id=${checkoutId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'domain-name': process.env.ZOHO_STORE_DOMAIN || 'traveldatawifi.zohostore.com'
      }
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      throw new Error(`Order completion failed: ${orderResponse.status} ${orderResponse.statusText} - ${errorText}`);
    }

    const orderResult = await orderResponse.json();
    const orderId = orderResult.payload?.salesorder?.salesorder_id || orderResult.payload?.order_id;
    const orderNumber = orderResult.payload?.salesorder?.salesorder_number || `TDW-${orderId}`;

    console.log('✅ Guest order completed successfully:', {
      orderId,
      orderNumber,
      customerEmail: customerInfo.email
    });

    // Create success response
    const successResponse = {
      success: true,
      type: 'guest_checkout_storefront',
      order_id: orderId,
      order_number: orderNumber,
      total_amount: total,
      currency: 'USD',
      
      // Payment URL from Zoho Commerce
      payment_url: orderResult.payload?.payment_url || 
                  `${req.headers.origin}/payment/invoice?order_id=${orderId}&amount=${total}`,
      
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
        'Order created in Zoho Commerce',
        'Complete payment to confirm your order',
        'You will receive confirmation via email'
      ],
      
      request_id: requestId,
      checkout_type: 'guest_storefront',
      checkout_id: checkoutId
    };

    return res.status(200).json(successResponse);

  } catch (error) {
    console.error('❌ Guest checkout failed:', error);
    
    const errorResponse = {
      error: 'Guest checkout processing failed',
      details: error.message || 'An unexpected error occurred',
      type: 'STOREFRONT_API_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    // Add specific error context
    if (error.message?.includes('Checkout creation')) {
      errorResponse.suggestion = 'Check cart items and Zoho store domain configuration';
    } else if (error.message?.includes('Address assignment')) {
      errorResponse.suggestion = 'Check address format for Storefront API requirements';
    } else if (error.message?.includes('Order completion')) {
      errorResponse.suggestion = 'Check offline payment configuration in Zoho Commerce';
    }

    return res.status(500).json(errorResponse);
  }
}