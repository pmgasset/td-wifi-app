// ===== src/pages/api/zoho-checkout.js =====
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== ZOHO COMMERCE CHECKOUT PROCESSING ===');
    
    const {
      customerInfo,
      shippingAddress,
      billingAddress,
      cartItems,
      paymentMethod,
      orderNotes,
      checkoutType = 'api' // 'api', 'hosted', or 'embedded'
    } = req.body;

    // Validate required fields
    const validationErrors = validateCheckoutData({
      customerInfo,
      shippingAddress,
      cartItems
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) => 
      sum + (item.product_price * item.quantity), 0
    );
    
    const tax = calculateTax(subtotal, shippingAddress.state);
    const shipping = calculateShipping(cartItems, shippingAddress);
    const total = subtotal + tax + shipping;

    // Handle different checkout types
    switch (checkoutType) {
      case 'hosted':
        return await handleHostedCheckout(req, res, { 
          customerInfo, shippingAddress, billingAddress, cartItems, total, orderNotes 
        });
      
      case 'embedded':
        return await handleEmbeddedCheckout(req, res, { 
          customerInfo, shippingAddress, billingAddress, cartItems, total, orderNotes 
        });
      
      case 'api':
      default:
        return await handleAPICheckout(req, res, { 
          customerInfo, shippingAddress, billingAddress, cartItems, paymentMethod, total, orderNotes 
        });
    }

  } catch (error) {
    console.error('Zoho Checkout API Error:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    
    res.status(500).json({
      error: 'Checkout processing failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Handle Zoho Hosted Checkout (redirects to Zoho's checkout page)
async function handleHostedCheckout(req, res, data) {
  const { customerInfo, shippingAddress, cartItems, total } = data;

  try {
    console.log('Creating Zoho hosted checkout session...');

    // Create a checkout session in Zoho Commerce
    const checkoutSessionData = {
      checkout_session: {
        customer: {
          email: customerInfo.email,
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          phone: customerInfo.phone || ''
        },
        line_items: cartItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.product_price,
          product_name: item.product_name
        })),
        shipping_address: {
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          address1: shippingAddress.address1,
          address2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: shippingAddress.country || 'US',
          phone: customerInfo.phone || ''
        },
        success_url: `${req.headers.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/checkout?cancelled=true`,
        payment_methods: ['card', 'paypal'], // Configure based on your Zoho setup
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes
      }
    };

    // Create checkout session via Zoho API
    const checkoutSession = await zohoAPI.apiRequest('/checkout_sessions', {
      method: 'POST',
      body: JSON.stringify(checkoutSessionData)
    });

    console.log('Zoho checkout session created:', checkoutSession.checkout_session_id);

    return res.status(200).json({
      type: 'hosted',
      success: true,
      checkout_url: checkoutSession.checkout_url,
      session_id: checkoutSession.checkout_session_id,
      expires_at: checkoutSession.expires_at
    });

  } catch (error) {
    console.error('Hosted checkout creation failed:', error);
    throw new Error(`Failed to create hosted checkout: ${error.message}`);
  }
}

// Handle Zoho Embedded Checkout (returns widget configuration)
async function handleEmbeddedCheckout(req, res, data) {
  const { customerInfo, shippingAddress, cartItems, total } = data;

  try {
    console.log('Creating Zoho embedded checkout widget...');

    // Create embedded checkout configuration
    const embeddedConfig = {
      widget_type: 'embedded_checkout',
      config: {
        store_id: process.env.ZOHO_STORE_ID,
        customer: {
          email: customerInfo.email,
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          phone: customerInfo.phone || ''
        },
        items: cartItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.product_price
        })),
        prefill: {
          shipping_address: shippingAddress,
          billing_address: data.billingAddress?.sameAsShipping ? shippingAddress : data.billingAddress
        },
        styling: {
          primary_color: '#004e89', // travel-blue
          accent_color: '#ff6b35',  // travel-orange
          font_family: 'Inter, sans-serif'
        },
        callbacks: {
          success_url: `${req.headers.origin}/checkout/success`,
          cancel_url: `${req.headers.origin}/checkout`,
          webhook_url: `${req.headers.origin}/api/zoho-webhook`
        }
      }
    };

    // Generate widget token via Zoho API
    const widgetResponse = await zohoAPI.apiRequest('/checkout_widgets', {
      method: 'POST',
      body: JSON.stringify(embeddedConfig)
    });

    console.log('Zoho embedded widget created:', widgetResponse.widget_id);

    return res.status(200).json({
      type: 'embedded',
      success: true,
      widget_id: widgetResponse.widget_id,
      widget_token: widgetResponse.widget_token,
      widget_url: widgetResponse.widget_url,
      config: embeddedConfig.config
    });

  } catch (error) {
    console.error('Embedded checkout creation failed:', error);
    throw new Error(`Failed to create embedded checkout: ${error.message}`);
  }
}

// Handle API-based checkout with Zoho payment processing
async function handleAPICheckout(req, res, data) {
  const { customerInfo, shippingAddress, billingAddress, cartItems, paymentMethod, total, orderNotes } = data;

  try {
    console.log('Processing API checkout with Zoho Commerce...');

    // Step 1: Create the order in Zoho Commerce
    const orderData = {
      customer: {
        email: customerInfo.email,
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        phone: customerInfo.phone || ''
      },
      line_items: cartItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.product_price,
        product_name: item.product_name
      })),
      shipping_address: {
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zipCode,
        country: shippingAddress.country || 'US',
        phone: customerInfo.phone || ''
      },
      billing_address: billingAddress.sameAsShipping ? {
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zipCode,
        country: shippingAddress.country || 'US',
        phone: customerInfo.phone || ''
      } : {
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        address1: billingAddress.address1,
        address2: billingAddress.address2 || '',
        city: billingAddress.city,
        state: billingAddress.state,
        zip: billingAddress.zipCode,
        country: billingAddress.country || 'US',
        phone: customerInfo.phone || ''
      },
      payment_status: 'pending',
      fulfillment_status: 'pending',
      notes: orderNotes || '',
      total_price: total,
      currency: 'USD'
    };

    // Create order in Zoho
    console.log('Creating order in Zoho Commerce...');
    const zohoOrder = await zohoAPI.createOrder(orderData);
    console.log('Zoho order created:', zohoOrder.order_id || zohoOrder.id);

    // Step 2: Process payment through Zoho's payment gateway
    const paymentData = {
      order_id: zohoOrder.order_id || zohoOrder.id,
      amount: total,
      currency: 'USD',
      payment_method: {
        type: paymentMethod.type || 'credit_card',
        card_number: paymentMethod.cardNumber?.replace(/\s/g, ''),
        expiry_month: paymentMethod.expiryMonth,
        expiry_year: paymentMethod.expiryYear,
        cvv: paymentMethod.cvv,
        name_on_card: paymentMethod.nameOnCard
      },
      billing_address: billingAddress.sameAsShipping ? shippingAddress : billingAddress,
      customer_email: customerInfo.email
    };

    console.log('Processing payment through Zoho...');
    const paymentResult = await processZohoPayment(paymentData);

    if (!paymentResult.success) {
      // Update order status to failed
      await zohoAPI.apiRequest(`/orders/${zohoOrder.order_id || zohoOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          payment_status: 'failed',
          notes: `Payment failed: ${paymentResult.error}`
        })
      });

      return res.status(400).json({
        error: 'Payment processing failed',
        details: paymentResult.error,
        orderId: zohoOrder.order_id || zohoOrder.id
      });
    }

    // Step 3: Update order with successful payment
    await zohoAPI.apiRequest(`/orders/${zohoOrder.order_id || zohoOrder.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        payment_status: 'paid',
        payment_gateway_transaction_id: paymentResult.transaction_id,
        fulfillment_status: 'processing'
      })
    });

    console.log('Payment processed successfully:', paymentResult.transaction_id);

    // Step 4: Trigger Zoho's automated email notifications
    try {
      await zohoAPI.apiRequest(`/orders/${zohoOrder.order_id || zohoOrder.id}/notifications`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'order_confirmation',
          send_to_customer: true
        })
      });
      console.log('Order confirmation email triggered');
    } catch (emailError) {
      console.error('Failed to trigger email notification:', emailError);
      // Don't fail the order for email issues
    }

    // Return success response
    return res.status(200).json({
      type: 'api',
      success: true,
      orderId: zohoOrder.order_id || zohoOrder.id,
      orderNumber: zohoOrder.order_number || `TDW-${zohoOrder.order_id}`,
      total: total,
      paymentId: paymentResult.transaction_id,
      message: 'Order placed successfully!',
      estimatedDelivery: calculateEstimatedDelivery(shippingAddress),
      trackingInfo: {
        available: false,
        message: 'Tracking information will be available once your order ships'
      },
      zohoOrderUrl: `https://commerce.zoho.com/store/orders/${zohoOrder.order_id}`
    });

  } catch (error) {
    console.error('API checkout processing failed:', error);
    throw error;
  }
}

// Process payment through Zoho's payment gateway
async function processZohoPayment(paymentData) {
  try {
    console.log('Processing payment through Zoho payment gateway...');

    // Use Zoho's payment processing API
    const paymentResponse = await zohoAPI.apiRequest('/payments', {
      method: 'POST',
      body: JSON.stringify({
        order_id: paymentData.order_id,
        amount: paymentData.amount,
        currency: paymentData.currency,
        payment_method: paymentData.payment_method,
        billing_address: paymentData.billing_address,
        customer_email: paymentData.customer_email,
        capture: true // Immediately capture the payment
      })
    });

    if (paymentResponse.status === 'succeeded' || paymentResponse.payment_status === 'paid') {
      return {
        success: true,
        transaction_id: paymentResponse.transaction_id || paymentResponse.payment_id,
        gateway_response: paymentResponse
      };
    } else {
      return {
        success: false,
        error: paymentResponse.failure_reason || 'Payment was declined',
        gateway_response: paymentResponse
      };
    }

  } catch (error) {
    console.error('Zoho payment processing error:', error);
    return {
      success: false,
      error: `Payment processing failed: ${error.message}`
    };
  }
}

// Validation helper (same as before)
function validateCheckoutData({ customerInfo, shippingAddress, cartItems }) {
  const errors = [];

  if (!customerInfo?.email) errors.push('Email is required');
  if (!customerInfo?.firstName) errors.push('First name is required');
  if (!customerInfo?.lastName) errors.push('Last name is required');
  
  if (customerInfo?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
    errors.push('Valid email address is required');
  }

  if (!shippingAddress?.address1) errors.push('Shipping address is required');
  if (!shippingAddress?.city) errors.push('City is required');
  if (!shippingAddress?.state) errors.push('State is required');
  if (!shippingAddress?.zipCode) errors.push('ZIP code is required');

  if (shippingAddress?.zipCode && !/^\d{5}(-\d{4})?$/.test(shippingAddress.zipCode)) {
    errors.push('Valid ZIP code is required (e.g., 12345 or 12345-6789)');
  }

  if (!cartItems || cartItems.length === 0) {
    errors.push('Cart is empty');
  } else {
    cartItems.forEach((item, index) => {
      if (!item.product_id) errors.push(`Cart item ${index + 1}: Product ID is required`);
      if (!item.quantity || item.quantity <= 0) errors.push(`Cart item ${index + 1}: Valid quantity is required`);
      if (!item.product_price || item.product_price <= 0) errors.push(`Cart item ${index + 1}: Valid price is required`);
    });
  }

  return errors;
}

// Tax calculation
function calculateTax(subtotal, state) {
  const taxRates = {
    'CA': 0.0875, 'NY': 0.08, 'TX': 0.0625, 'FL': 0.06, 'WA': 0.065
  };
  const rate = taxRates[state] || 0.05;
  return Math.round(subtotal * rate * 100) / 100;
}

// Shipping calculation
function calculateShipping(cartItems, shippingAddress) {
  const subtotal = cartItems.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
  if (subtotal >= 100) return 0; // Free shipping over $100
  return 9.99;
}

// Calculate estimated delivery
function calculateEstimatedDelivery(shippingAddress) {
  const businessDays = 3;
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + businessDays);
  
  return {
    estimatedDays: businessDays,
    estimatedDate: deliveryDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  };
}