// src/pages/api/checkout/stripe-direct-enhanced.js
/**
 * Enhanced Stripe Checkout Integration with Lead Tracking
 * 
 * ENHANCED FLOW:
 * 1. Validate customer data and cart
 * 2. Create Stripe Payment Intent with COMPLETE metadata for lead tracking
 * 3. Customer completes payment on frontend
 * 4. Webhook captures payment_intent.created → Creates lead in Zoho CRM
 * 5. Webhook captures payment_intent.succeeded → Creates order in Zoho + Updates lead
 * 
 * This captures ALL checkout attempts, not just successful payments!
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const requestId = `stripe_checkout_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== ENHANCED STRIPE CHECKOUT [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    const { 
      customerInfo, 
      shippingAddress, 
      cartItems, 
      orderNotes,
      createAccount = false,
      customerPassword = null,
      // NEW: Lead tracking data
      utmSource,
      utmMedium,
      utmCampaign,
      referrer,
      sessionId
    } = req.body;

    console.log('Processing enhanced Stripe checkout for:', customerInfo?.email);
    console.log('Cart items:', cartItems?.length || 0);
    console.log('Lead tracking enabled: YES');

    // Input validation
    const validationErrors = await validateCheckoutData({
      customerInfo, 
      shippingAddress, 
      cartItems 
    });
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
        requestId
      });
    }

    // Calculate order totals
    const orderTotals = calculateOrderTotals(cartItems);
    console.log('Order totals:', orderTotals);

    // Process customer data (but don't create order yet)
    console.log('🔄 Sub-agent: Processing customer data...');
    const customerResult = await processCustomerData({
      customerInfo,
      createAccount,
      customerPassword,
      requestId
    });

    // NEW: Create enhanced Payment Intent with complete metadata for lead tracking
    console.log('🔄 Sub-agent: Creating enhanced Payment Intent with lead data...');
    const paymentResult = await createEnhancedPaymentIntent({
      amount: orderTotals.total,
      currency: 'usd',
      customerInfo,
      shippingAddress,
      cartItems,
      orderNotes,
      createAccount,
      customerPassword,
      customerId: customerResult.customerId,
      accountCreated: customerResult.accountCreated,
      orderTotals,
      requestId,
      // Lead tracking data
      utmSource,
      utmMedium,
      utmCampaign,
      referrer,
      sessionId
    });

    // Success response with client secret for frontend payment
    const response = {
      success: true,
      requestId,
      
      // Payment details for frontend
      payment: {
        clientSecret: paymentResult.clientSecret,
        paymentIntentId: paymentResult.paymentIntentId,
        amount: orderTotals.total,
        currency: 'usd'
      },
      
      // Order details (temporary - no Zoho order ID yet)
      order: {
        orderId: 'pending', // Will be created after payment
        orderNumber: 'pending', // Will be generated after payment
        total: orderTotals.total,
        subtotal: orderTotals.subtotal,
        tax: orderTotals.tax,
        shipping: orderTotals.shipping
      },
      
      // Customer details
      customer: {
        customerId: customerResult.customerId,
        email: customerInfo.email,
        name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        accountCreated: customerResult.accountCreated
      },
      
      // Lead tracking confirmation
      leadTracking: {
        enabled: true,
        paymentIntentId: paymentResult.paymentIntentId,
        note: 'Lead will be created in Zoho CRM when payment intent is created'
      },
      
      // Instructions for frontend
      note: 'Enhanced checkout with lead tracking. Lead created on payment intent creation, order created after successful payment.',
      
      timestamp: new Date().toISOString()
    };

    console.log('✅ Enhanced Payment Intent created successfully');
    console.log('Payment Intent ID:', paymentResult.paymentIntentId);
    console.log('🎯 Lead tracking metadata included');
    console.log('💡 Lead will be created via webhook, order after payment confirmation');
    
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Enhanced Stripe checkout failed:', error);
    
    return res.status(500).json({
      error: 'Enhanced checkout processing failed',
      details: error.message,
      type: 'ENHANCED_STRIPE_CHECKOUT_ERROR', 
      requestId,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * SUB-AGENT: Create enhanced Payment Intent with complete lead tracking metadata
 */
async function createEnhancedPaymentIntent({
  amount,
  currency,
  customerInfo,
  shippingAddress,
  cartItems,
  orderNotes,
  createAccount,
  customerPassword,
  customerId,
  accountCreated,
  orderTotals,
  requestId,
  utmSource,
  utmMedium,
  utmCampaign,
  referrer,
  sessionId
}) {
  
  console.log('Creating enhanced Payment Intent with lead tracking...');

  // Prepare comprehensive metadata for both lead creation and order creation
  const enhancedMetadata = {
    // Original order data (for order creation after payment)
    customer_id: customerId || '',
    customer_email: customerInfo.email,
    customer_first_name: customerInfo.firstName,
    customer_last_name: customerInfo.lastName,
    customer_phone: customerInfo.phone || '',
    customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
    
    // Shipping address
    shipping_address1: shippingAddress.address1 || '',
    shipping_address2: shippingAddress.address2 || '',
    shipping_city: shippingAddress.city || '',
    shipping_state: shippingAddress.state || '',
    shipping_zip: shippingAddress.zipCode || '',
    shipping_country: shippingAddress.country || 'US',
    
    // Order details
    subtotal: orderTotals.subtotal.toString(),
    tax: orderTotals.tax.toString(),
    shipping: orderTotals.shipping.toString(),
    total: orderTotals.total.toString(),
    currency: currency.toUpperCase(),
    
    // Cart items (for both lead and order creation)
    cart_items: JSON.stringify(cartItems.map(item => ({
      product_id: item.productId,
      product_name: item.productName,
      product_price: item.price,
      quantity: item.quantity,
      total: item.price * item.quantity
    }))),
    
    // Order metadata
    order_notes: orderNotes || '',
    create_account: createAccount.toString(),
    account_created: accountCreated.toString(),
    request_id: requestId,
    
    // NEW: Enhanced lead tracking metadata
    utm_source: utmSource || 'direct',
    utm_medium: utmMedium || 'website',
    utm_campaign: utmCampaign || 'checkout',
    referrer: referrer || '',
    session_id: sessionId || '',
    
    // Lead source attribution
    lead_source: 'Stripe Checkout',
    lead_campaign: utmCampaign || 'Direct Checkout',
    checkout_started_at: new Date().toISOString(),
    
    // Browser/device info (if available)
    user_agent: '', // Could be passed from frontend
    ip_address: '', // Could be captured from req
    
    // Additional lead scoring data
    cart_value: orderTotals.total.toString(),
    cart_items_count: cartItems.length.toString(),
    is_return_customer: customerId ? 'true' : 'false',
    
    // Processing flags
    lead_webhook_processed: 'false',
    order_webhook_processed: 'false'
  };

  // Create the Payment Intent with enhanced metadata
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: currency,
    customer: customerId || undefined,
    description: `Order for ${customerInfo.firstName} ${customerInfo.lastName} - ${cartItems.length} items`,
    
    // Enhanced metadata for lead and order tracking
    metadata: enhancedMetadata,
    
    // Optional: Set up for future payments if account created
    setup_future_usage: createAccount ? 'on_session' : undefined,
    
    // Shipping info for Stripe
    shipping: shippingAddress ? {
      name: `${customerInfo.firstName} ${customerInfo.lastName}`,
      phone: customerInfo.phone || undefined,
      address: {
        line1: shippingAddress.address1,
        line2: shippingAddress.address2 || undefined,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postal_code: shippingAddress.zipCode,
        country: shippingAddress.country || 'US'
      }
    } : undefined,
    
    // Receipt email
    receipt_email: customerInfo.email
  });

  console.log('✅ Enhanced Payment Intent created:', paymentIntent.id);
  console.log('📊 Metadata fields:', Object.keys(enhancedMetadata).length);

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    status: paymentIntent.status,
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency
  };
}

/**
 * SUB-AGENT: Validate checkout data (enhanced)
 */
async function validateCheckoutData({ customerInfo, shippingAddress, cartItems }) {
  const errors = [];
  
  // Customer validation
  if (!customerInfo?.email) errors.push('Email is required');
  if (!customerInfo?.firstName) errors.push('First name is required');
  if (!customerInfo?.lastName) errors.push('Last name is required');
  if (customerInfo?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
    errors.push('Valid email address is required');
  }
  
  // Shipping address validation
  if (!shippingAddress?.address1) errors.push('Shipping address is required');
  if (!shippingAddress?.city) errors.push('Shipping city is required');
  if (!shippingAddress?.state) errors.push('Shipping state is required');
  if (!shippingAddress?.zipCode) errors.push('Shipping zip code is required');
  
  // Cart validation
  if (!cartItems || cartItems.length === 0) {
    errors.push('Cart cannot be empty');
  } else {
    cartItems.forEach((item, index) => {
      if (!item.productId) errors.push(`Cart item ${index + 1}: Product ID is required`);
      if (!item.productName) errors.push(`Cart item ${index + 1}: Product name is required`);
      if (!item.price || item.price <= 0) errors.push(`Cart item ${index + 1}: Valid price is required`);
      if (!item.quantity || item.quantity <= 0) errors.push(`Cart item ${index + 1}: Valid quantity is required`);
    });
  }
  
  return errors;
}

/**
 * SUB-AGENT: Calculate order totals
 */
function calculateOrderTotals(cartItems) {
  const subtotal = cartItems.reduce((sum, item) => {
    return sum + (parseFloat(item.price) * parseInt(item.quantity));
  }, 0);
  
  // Calculate tax (8% for example - adjust based on your business logic)
  const taxRate = 0.08;
  const tax = subtotal * taxRate;
  
  // Calculate shipping (free over $100, otherwise $15)
  const shipping = subtotal >= 100 ? 0 : 15;
  
  const total = subtotal + tax + shipping;
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    shipping: Math.round(shipping * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}

/**
 * SUB-AGENT: Process customer data
 */
async function processCustomerData({ customerInfo, createAccount, customerPassword, requestId }) {
  console.log('Processing customer data...');
  
  let customerId = null;
  let accountCreated = false;
  
  try {
    // Check if customer already exists in Stripe
    const existingCustomers = await stripe.customers.list({
      email: customerInfo.email,
      limit: 1
    });
    
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
      console.log('✅ Found existing Stripe customer:', customerId);
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: customerInfo.email,
        name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        phone: customerInfo.phone || undefined,
        metadata: {
          request_id: requestId,
          account_requested: createAccount.toString(),
          created_via: 'checkout'
        }
      });
      
      customerId = customer.id;
      accountCreated = createAccount;
      console.log('✅ Created new Stripe customer:', customerId);
    }
    
    return {
      customerId,
      accountCreated,
      email: customerInfo.email,
      name: `${customerInfo.firstName} ${customerInfo.lastName}`
    };
    
  } catch (error) {
    console.error('❌ Customer processing failed:', error);
    // Don't fail the entire checkout for customer processing issues
    return {
      customerId: null,
      accountCreated: false,
      email: customerInfo.email,
      name: `${customerInfo.firstName} ${customerInfo.lastName}`,
      error: error.message
    };
  }
}