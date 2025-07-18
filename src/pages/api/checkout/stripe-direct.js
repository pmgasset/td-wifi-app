// src/pages/api/checkout/stripe-direct.js
/**
 * Direct Stripe Checkout Integration - Payment First Approach
 * 
 * NEW FLOW:
 * 1. Validate customer data and cart
 * 2. Create Stripe Payment Intent (no Zoho order yet)
 * 3. Customer completes payment on frontend
 * 4. AFTER payment success → Create order in Zoho via webhook/success handler
 * 
 * This prevents creating abandoned orders in Zoho for failed payments!
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const requestId = `stripe_checkout_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== DIRECT STRIPE CHECKOUT [${requestId}] ===`);
  
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
      customerPassword = null 
    } = req.body;

    console.log('Processing direct Stripe checkout for:', customerInfo?.email);
    console.log('Cart items:', cartItems?.length || 0);
    console.log('Create account:', createAccount);

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

    // NEW APPROACH: Only check if customer exists (don't create order yet)
    console.log('🔄 Sub-agent: Processing customer data...');
    const customerResult = await processCustomerData({
      customerInfo,
      createAccount,
      customerPassword,
      requestId
    });

    // Create Stripe Payment Intent with order data in metadata (no Zoho order yet)
    console.log('🔄 Sub-agent: Creating Stripe Payment Intent...');
    const paymentResult = await createStripePaymentIntent({
      amount: orderTotals.total,
      currency: 'usd',
      customerEmail: customerInfo.email,
      customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
      orderData: {
        // Store all order data in Stripe metadata for later Zoho creation
        customerInfo,
        shippingAddress,
        cartItems,
        orderNotes,
        createAccount,
        customerPassword,
        customerId: customerResult.customerId,
        accountCreated: customerResult.accountCreated,
        orderTotals,
        requestId
      }
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
      
      // Instructions for frontend
      note: 'Payment Intent created. Order will be created in Zoho after successful payment.',
      
      timestamp: new Date().toISOString()
    };

    console.log('✅ Stripe Payment Intent created successfully');
    console.log('Payment Intent ID:', paymentResult.paymentIntentId);
    console.log('💡 Order will be created in Zoho AFTER payment confirmation');
    
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Direct Stripe checkout failed:', error);
    
    return res.status(500).json({
      error: 'Checkout processing failed',
      details: error.message,
      type: 'STRIPE_CHECKOUT_ERROR', 
      requestId,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * SUB-AGENT: Validate checkout data
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
  
  // Address validation
  if (!shippingAddress?.address1) errors.push('Street address is required');
  if (!shippingAddress?.city) errors.push('City is required');
  if (!shippingAddress?.state) errors.push('State is required');
  if (!shippingAddress?.zipCode) errors.push('ZIP code is required');
  if (!shippingAddress?.country) errors.push('Country is required');
  
  // Cart validation
  if (!cartItems || cartItems.length === 0) errors.push('Cart is empty');
  
  // Individual item validation
  cartItems?.forEach((item, index) => {
    if (!item.product_id) errors.push(`Item ${index + 1}: Product ID is required`);
    if (!item.quantity || item.quantity < 1) errors.push(`Item ${index + 1}: Valid quantity is required`);
    if (!item.product_price || item.product_price < 0) errors.push(`Item ${index + 1}: Valid price is required`);
  });
  
  return errors;
}

/**
 * SUB-AGENT: Calculate order totals
 */
function calculateOrderTotals(cartItems) {
  const subtotal = cartItems.reduce((sum, item) => {
    const price = parseFloat(item.product_price || item.price || 0);
    const quantity = parseInt(item.quantity || 1);
    return sum + (price * quantity);
  }, 0);
  
  const taxRate = 0.0875; // 8.75% tax rate
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  
  // Free shipping over $100
  const shipping = subtotal >= 100 ? 0 : 9.99;
  
  const total = Math.round((subtotal + tax + shipping) * 100) / 100;
  
  return { subtotal, tax, shipping, total };
}

/**
 * SUB-AGENT: Process customer data (check existence, don't create order)
 */
async function processCustomerData({ 
  customerInfo, 
  createAccount, 
  customerPassword, 
  requestId 
}) {
  console.log('Sub-agent: Processing customer data...');
  
  let customerId = null;
  let accountCreated = false;
  
  // Always check if customer exists first
  try {
    const token = await getZohoAccessToken();
    const searchUrl = `https://www.zohoapis.com/inventory/v1/contacts?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}&email=${encodeURIComponent(customerInfo.email)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.contacts && result.contacts.length > 0) {
      customerId = result.contacts[0].contact_id;
      console.log('✅ Existing customer found:', customerId);
    }
    
  } catch (error) {
    console.warn('⚠️ Customer lookup failed:', error.message);
  }

  // If creating account and customer doesn't exist, create it
  if (createAccount && customerPassword && !customerId) {
    try {
      // Create customer account in Zoho
      const customerData = {
        display_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        salutation: customerInfo.title || '',
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        email: customerInfo.email,
        phone: customerInfo.phone || '',
        company_name: customerInfo.company || '',
        
        // Contact person details
        contact_persons: [{
          salutation: customerInfo.title || '',
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          email: customerInfo.email,
          phone: customerInfo.phone || '',
          is_primary_contact: true
        }]
      };
      
      const token = await getZohoAccessToken();
      const response = await fetch(
        `https://www.zohoapis.com/inventory/v1/contacts?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(customerData)
        }
      );
      
      const result = await response.json();
      
      if (result.contact?.contact_id) {
        customerId = result.contact.contact_id;
        accountCreated = true;
        console.log('✅ Customer account created:', customerId);
      } else {
        console.log('⚠️ Customer creation failed, will proceed as guest');
      }
      
    } catch (error) {
      console.warn('⚠️ Customer creation error, will proceed as guest:', error.message);
    }
  }
  
  return { customerId, accountCreated };
}

/**
 * SUB-AGENT: Create Stripe Payment Intent with order data in metadata
 */
async function createStripePaymentIntent({
  amount,
  currency,
  customerEmail,
  customerName,
  orderData
}) {
  console.log('Sub-agent: Creating Stripe Payment Intent...');
  
  try {
    // Convert amount to cents
    const amountInCents = Math.round(amount * 100);
    
    // Store order data in metadata (Stripe limit: 500 chars per key, 50 keys)
    // We'll store essential data and reconstruct cart items from a summary
    const metadata = {
      customer_email: customerEmail,
      customer_name: customerName,
      customer_id: orderData.customerId || '',
      create_account: orderData.createAccount.toString(),
      account_created: orderData.accountCreated.toString(),
      
      // Order totals
      subtotal: orderData.orderTotals.subtotal.toString(),
      tax: orderData.orderTotals.tax.toString(),
      shipping: orderData.orderTotals.shipping.toString(),
      total: orderData.orderTotals.total.toString(),
      
      // Address (truncated if needed to fit Stripe limits)
      shipping_address1: orderData.shippingAddress.address1.substring(0, 499),
      shipping_address2: (orderData.shippingAddress.address2 || '').substring(0, 499),
      shipping_city: orderData.shippingAddress.city,
      shipping_state: orderData.shippingAddress.state,
      shipping_zip: orderData.shippingAddress.zipCode,
      shipping_country: orderData.shippingAddress.country,
      
      // Cart items summary (we'll store full data in a more robust way for production)
      item_count: orderData.cartItems.length.toString(),
      
      // Store cart items as JSON (compressed if needed)
      cart_items: JSON.stringify(orderData.cartItems.map(item => ({
        id: item.product_id,
        name: item.product_name.substring(0, 50), // Truncate for metadata limits
        price: item.product_price,
        qty: item.quantity
      }))).substring(0, 499), // Stripe metadata limit
      
      // Processing info
      request_id: orderData.requestId,
      integration: 'direct_stripe_checkout',
      order_notes: (orderData.orderNotes || '').substring(0, 499)
    };
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency,
      receipt_email: customerEmail,
      description: `Travel Data WiFi Order - ${customerEmail}`,
      
      metadata: metadata,
      
      // Automatic payment methods
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    console.log('✅ Stripe Payment Intent created:', paymentIntent.id);
    console.log('💡 Order data stored in Payment Intent metadata for post-payment processing');
    
    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
    
  } catch (error) {
    console.error('❌ Stripe Payment Intent creation failed:', error);
    throw new Error(`Payment setup failed: ${error.message}`);
  }
}

/**
 * Get Zoho access token (cached)
 */
let cachedToken = null;
let tokenExpiry = null;

async function getZohoAccessToken() {
  // Return cached token if valid
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  
  try {
    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
      })
    });
    
    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('Failed to get Zoho access token');
    }
    
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer
    
    return cachedToken;
    
  } catch (error) {
    console.error('❌ Zoho token error:', error);
    throw new Error('Authentication failed');
  }
}