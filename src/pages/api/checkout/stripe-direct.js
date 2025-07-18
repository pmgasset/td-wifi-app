// src/pages/api/checkout/stripe-direct.js
/**
 * Direct Stripe Checkout Integration
 * 
 * This endpoint handles the complete checkout flow:
 * 1. Creates/updates customer in Zoho
 * 2. Creates order in Zoho  
 * 3. Creates Stripe Payment Intent
 * 4. Returns client secret for frontend payment
 * 
 * Customer never leaves the website during payment!
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

    // Step 1: Handle customer creation/lookup in Zoho (sub-agent)
    console.log('🔄 Sub-agent: Processing customer...');
    const customerResult = await processCustomerForStripe({
      customerInfo,
      createAccount,
      customerPassword,
      requestId
    });

    // Step 2: Create order in Zoho (sub-agent)  
    console.log('🔄 Sub-agent: Creating order...');
    const orderResult = await createZohoOrderForStripe({
      customerInfo,
      shippingAddress,
      cartItems,
      orderTotals,
      customerId: customerResult.customerId,
      orderNotes,
      requestId
    });

    // Step 3: Create Stripe Payment Intent (sub-agent)
    console.log('🔄 Sub-agent: Creating Stripe Payment Intent...');
    const paymentResult = await createStripePaymentIntent({
      amount: orderTotals.total,
      currency: 'usd',
      customerEmail: customerInfo.email,
      customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
      orderId: orderResult.orderId,
      orderNumber: orderResult.orderNumber,
      requestId
    });

    // Success response with client secret for frontend
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
      
      // Order details  
      order: {
        orderId: orderResult.orderId,
        orderNumber: orderResult.orderNumber,
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
      
      timestamp: new Date().toISOString()
    };

    console.log('✅ Direct Stripe checkout prepared successfully');
    console.log('Payment Intent ID:', paymentResult.paymentIntentId);
    
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
 * SUB-AGENT: Process customer for Stripe checkout
 */
async function processCustomerForStripe({ 
  customerInfo, 
  createAccount, 
  customerPassword, 
  requestId 
}) {
  console.log('Sub-agent: Processing customer for Stripe...');
  
  let customerId = null;
  let accountCreated = false;
  
  if (createAccount && customerPassword) {
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
        console.log('⚠️ Customer creation failed, proceeding as guest');
      }
      
    } catch (error) {
      console.warn('⚠️ Customer creation error, proceeding as guest:', error.message);
    }
  } else {
    // Check if customer already exists
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
      console.warn('⚠️ Customer lookup failed, proceeding as guest:', error.message);
    }
  }
  
  return { customerId, accountCreated };
}

/**
 * SUB-AGENT: Create Zoho order for Stripe checkout
 */
async function createZohoOrderForStripe({
  customerInfo,
  shippingAddress, 
  cartItems,
  orderTotals,
  customerId,
  orderNotes,
  requestId
}) {
  console.log('Sub-agent: Creating Zoho order for Stripe...');
  
  try {
    const token = await getZohoAccessToken();
    
    // Prepare line items
    const lineItems = cartItems.map(item => ({
      item_id: item.product_id,
      name: item.product_name || item.name,
      rate: parseFloat(item.product_price || item.price),
      quantity: parseInt(item.quantity),
      unit: 'qty'
    }));
    
    // Prepare order data
    const orderData = {
      customer_id: customerId || undefined, // Omit if guest
      date: new Date().toISOString().split('T')[0],
      shipment_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
      
      // Line items
      line_items: lineItems,
      
      // Shipping address
      shipping_address: {
        address: shippingAddress.address1,
        address_2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zipCode,
        country: shippingAddress.country || 'US',
        fax: shippingAddress.phone || ''
      },
      
      // Notes
      notes: orderNotes || '',
      terms: 'Payment via Stripe',
      
      // Custom fields for tracking
      custom_fields: [
        {
          label: 'Payment Method',
          value: 'Stripe'
        },
        {
          label: 'Request ID', 
          value: requestId
        }
      ]
    };
    
    // If no customer ID, add customer info to the order
    if (!customerId) {
      orderData.customer_name = `${customerInfo.firstName} ${customerInfo.lastName}`;
      orderData.contact_persons = [{
        name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        email: customerInfo.email,
        phone: customerInfo.phone || ''
      }];
    }
    
    console.log('Creating sales order with Zoho...');
    const response = await fetch(
      `https://www.zohoapis.com/inventory/v1/salesorders?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      }
    );
    
    const result = await response.json();
    
    if (!response.ok || !result.salesorder) {
      throw new Error(`Zoho order creation failed: ${result.message || 'Unknown error'}`);
    }
    
    const orderId = result.salesorder.salesorder_id;
    const orderNumber = result.salesorder.salesorder_number;
    
    console.log('✅ Zoho order created:', { orderId, orderNumber });
    
    return { orderId, orderNumber };
    
  } catch (error) {
    console.error('❌ Zoho order creation failed:', error);
    throw new Error(`Order creation failed: ${error.message}`);
  }
}

/**
 * SUB-AGENT: Create Stripe Payment Intent
 */
async function createStripePaymentIntent({
  amount,
  currency,
  customerEmail,
  customerName,
  orderId,
  orderNumber,
  requestId
}) {
  console.log('Sub-agent: Creating Stripe Payment Intent...');
  
  try {
    // Convert amount to cents
    const amountInCents = Math.round(amount * 100);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency,
      receipt_email: customerEmail,
      description: `Travel Data WiFi Order ${orderNumber}`,
      
      metadata: {
        orderId: orderId.toString(),
        orderNumber: orderNumber,
        customerEmail: customerEmail,
        customerName: customerName,
        requestId: requestId,
        integration: 'direct_stripe_checkout'
      },
      
      // Automatic payment methods
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    console.log('✅ Stripe Payment Intent created:', paymentIntent.id);
    
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