// src/pages/api/stripe/webhook.js - COMPLETE FIX with Proper Address Handling
/**
 * Stripe Webhook Handler - Creates Zoho Order AFTER Successful Payment
 * FIXED: Proper contact creation with addresses, then sales order with address IDs
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Helper function to get raw body - FIXED for Next.js
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    
    req.on('error', (error) => {
      reject(error);
    });
  });
}

export default async function handler(req, res) {
  // CRITICAL: Always set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log(`❌ Webhook received ${req.method} request, expected POST`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log(`\n=== STRIPE WEBHOOK RECEIVED ===`);
  console.log('Has signature:', !!sig);
  console.log('Has webhook secret:', !!endpointSecret);

  if (!endpointSecret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ 
      error: 'Webhook secret not configured'
    });
  }

  if (!sig) {
    console.error('❌ No stripe-signature header found');
    return res.status(400).json({ error: 'No stripe-signature header' });
  }

  let event;

  try {
    // Get the raw body properly - FIXED
    const rawBody = await getRawBody(req);
    console.log('Raw body length:', rawBody.length);
    
    // Verify webhook signature with raw body
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    console.log('✅ Webhook signature verified');
    console.log('Event type:', event.type);
    
  } catch (err) {
    console.error(`❌ Webhook signature verification failed:`, err.message);
    return res.status(400).json({ 
      error: 'Webhook signature verification failed',
      details: err.message
    });
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log(`\n=== PAYMENT SUCCEEDED WEBHOOK [${paymentIntent.id}] ===`);
    
    try {
      // Check if order was already created
      if (paymentIntent.metadata?.webhook_processed === 'true') {
        console.log('⚠️ Order already processed, skipping');
        return res.json({ received: true, status: 'already_processed' });
      }

      // Debug: Log all metadata
      console.log('🔍 Payment Intent metadata:', JSON.stringify(paymentIntent.metadata, null, 2));

      // Extract order data from metadata
      const orderData = extractOrderDataFromMetadata(paymentIntent.metadata);
      console.log('📋 Order data extracted from Payment Intent metadata');
      console.log('🔍 Extracted order data:', JSON.stringify(orderData, null, 2));
      
      // Create order in Zoho now that payment is confirmed
      const zohoOrder = await createZohoOrderAfterPayment(orderData, paymentIntent);
      
      // Update Payment Intent with order information
      await stripe.paymentIntents.update(paymentIntent.id, {
        metadata: {
          ...paymentIntent.metadata,
          zoho_order_id: zohoOrder.orderId,
          zoho_order_number: zohoOrder.orderNumber,
          order_created_at: new Date().toISOString(),
          webhook_processed: 'true'
        }
      });
      
      console.log('✅ Post-payment order creation completed successfully');
      console.log(`📦 Zoho Order: ${zohoOrder.orderNumber} (ID: ${zohoOrder.orderId})`);
      
      return res.json({ 
        received: true, 
        status: 'order_created',
        order_id: zohoOrder.orderId,
        order_number: zohoOrder.orderNumber
      });
      
    } catch (error) {
      console.error('❌ Post-payment order creation failed:', error);
      console.error('Error stack:', error.stack);
      
      // Update Payment Intent with error info
      try {
        await stripe.paymentIntents.update(paymentIntent.id, {
          metadata: {
            ...paymentIntent.metadata,
            order_creation_error: error.message.substring(0, 499),
            webhook_processed: 'error',
            error_timestamp: new Date().toISOString()
          }
        });
      } catch (updateError) {
        console.error('Failed to update Payment Intent with error:', updateError);
      }
      
      // Return success to Stripe (payment was successful)
      return res.json({ 
        received: true, 
        status: 'error',
        error: error.message
      });
    }
  } else {
    console.log(`ℹ️ Unhandled event type: ${event.type}`);
  }

  // Return 200 to acknowledge receipt of the event
  res.json({ received: true, event_type: event.type });
}

function extractOrderDataFromMetadata(metadata) {
  console.log('🔍 Extracting order data from metadata keys:', Object.keys(metadata));
  
  let cartItems = [];
  try {
    if (metadata.cart_items) {
      console.log('🔍 Found cart_items in metadata:', metadata.cart_items);
      const parsedItems = JSON.parse(metadata.cart_items);
      cartItems = parsedItems.map(item => ({
        product_id: item.id || item.product_id || 'unknown',
        product_name: item.name || item.product_name || 'Unknown Product',
        product_price: parseFloat(item.price || item.product_price || 0),
        quantity: parseInt(item.qty || item.quantity || 1)
      }));
      console.log('✅ Parsed cart items:', cartItems);
    } else {
      console.log('⚠️ No cart_items found in metadata, creating fallback item');
      // Create fallback item from available data
      const itemCount = parseInt(metadata.item_count || '1');
      const subtotal = parseFloat(metadata.subtotal || metadata.total || '0');
      const price = itemCount > 0 ? subtotal / itemCount : subtotal;
      
      cartItems = [{
        product_id: 'fallback-item',
        product_name: 'Travel Data WiFi Product',
        product_price: price,
        quantity: itemCount
      }];
      console.log('✅ Created fallback cart items:', cartItems);
    }
  } catch (parseError) {
    console.error('❌ Could not parse cart items from metadata:', parseError);
    console.log('🔍 Metadata cart_items value:', metadata.cart_items);
    
    // Emergency fallback
    cartItems = [{
      product_id: 'emergency-fallback',
      product_name: 'Travel Data WiFi Product',
      product_price: parseFloat(metadata.total || '5.00'),
      quantity: 1
    }];
    console.log('⚠️ Using emergency fallback cart items:', cartItems);
  }
  
  // Extract customer info with better fallback handling
  const customerName = metadata.customer_name || 'Guest Customer';
  const nameParts = customerName.split(' ');
  const firstName = nameParts[0] || 'Guest';
  const lastName = nameParts.slice(1).join(' ') || 'Customer';
  
  const orderData = {
    customerInfo: {
      firstName: firstName,
      lastName: lastName,
      email: metadata.customer_email || metadata.email || '',
      phone: metadata.customer_phone || metadata.phone || ''
    },
    shippingAddress: {
      address1: metadata.shipping_address1 || metadata.address1 || '',
      address2: metadata.shipping_address2 || metadata.address2 || '',
      city: metadata.shipping_city || metadata.city || '',
      state: metadata.shipping_state || metadata.state || '',
      zipCode: metadata.shipping_zip || metadata.zip || metadata.postal_code || '',
      country: metadata.shipping_country || metadata.country || 'US'
    },
    cartItems: cartItems,
    orderTotals: {
      subtotal: parseFloat(metadata.subtotal || '0'),
      tax: parseFloat(metadata.tax || '0'),
      shipping: parseFloat(metadata.shipping || '0'),
      total: parseFloat(metadata.total || '0')
    },
    customerId: metadata.customer_id || null,
    orderNotes: metadata.order_notes || '',
    requestId: metadata.request_id || ''
  };
  
  console.log('🔍 Final extracted order data:', JSON.stringify(orderData, null, 2));
  return orderData;
}

async function createZohoOrderAfterPayment(orderData, paymentIntent) {
  console.log('🔄 Creating Zoho order after payment confirmation...');
  
  const token = await getZohoAccessToken();
  
  // STEP 1: Create contact with addresses in one API call
  console.log('👤 Creating contact with addresses in Zoho...');
  
  // Validate we have required data
  if (!orderData.customerInfo.email) {
    throw new Error('Customer email is required but missing from order data');
  }
  
  if (orderData.cartItems.length === 0) {
    throw new Error('Cart items are required but missing from order data');
  }
  
  // Prepare address data (ensure under 100 characters for each field)
  const addressData = {
    attention: `${orderData.customerInfo.firstName} ${orderData.customerInfo.lastName}`.substring(0, 99),
    address: orderData.shippingAddress.address1.substring(0, 99),
    street2: (orderData.shippingAddress.address2 || '').substring(0, 99),
    city: orderData.shippingAddress.city.substring(0, 49),
    state: orderData.shippingAddress.state.substring(0, 49),
    zip: orderData.shippingAddress.zipCode.substring(0, 19),
    country: orderData.shippingAddress.country.substring(0, 49),
    phone: orderData.customerInfo.phone.substring(0, 19)
  };
  
  // Create contact with addresses in one call
  const contactData = {
    contact_name: `${orderData.customerInfo.firstName} ${orderData.customerInfo.lastName}`.substring(0, 199),
    contact_type: 'customer',
    contact_persons: [{
      first_name: orderData.customerInfo.firstName.substring(0, 99),
      last_name: orderData.customerInfo.lastName.substring(0, 99),
      email: orderData.customerInfo.email,
      phone: orderData.customerInfo.phone.substring(0, 19),
      is_primary_contact: true
    }],
    // Add billing and shipping addresses directly in contact creation
    billing_address: addressData,
    shipping_address: addressData
  };
  
  console.log('Creating contact with data:', JSON.stringify(contactData, null, 2));
  
  const contactResponse = await fetch(
    `https://www.zohoapis.com/inventory/v1/contacts?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactData)
    }
  );
  
  const contactResult = await contactResponse.json();
  console.log('Contact creation response:', JSON.stringify(contactResult, null, 2));
  
  if (!contactResult.contact?.contact_id) {
    throw new Error(`Contact creation failed: ${contactResult.message || 'Unknown error'}`);
  }
  
  const customerId = contactResult.contact.contact_id;
  const billingAddressId = contactResult.contact.billing_address?.address_id;
  const shippingAddressId = contactResult.contact.shipping_address?.address_id;
  
  console.log('✅ Contact created successfully:', {
    customerId,
    billingAddressId,
    shippingAddressId
  });
  
  // STEP 2: Prepare line items (validate all required fields)
  const lineItems = orderData.cartItems.map((item, index) => ({
    item_id: item.product_id,
    name: item.product_name,
    rate: parseFloat(item.product_price),
    quantity: parseInt(item.quantity),
    unit: 'qty',
    item_order: index + 1
  }));
  
  console.log('📦 Prepared line items:', JSON.stringify(lineItems, null, 2));
  
  // STEP 3: Create sales order using address IDs
  const salesOrderData = {
    customer_id: customerId,
    date: new Date().toISOString().split('T')[0],
    shipment_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    line_items: lineItems,
    notes: `Payment completed via Stripe. Payment Intent: ${paymentIntent.id}. Request ID: ${orderData.requestId}`,
    terms: 'Paid via Stripe',
    status: 'confirmed'  // Create confirmed sales order instead of draft
  };
  
  // Use address IDs if available, otherwise fallback to address object
  if (billingAddressId && shippingAddressId) {
    salesOrderData.billing_address_id = billingAddressId;
    salesOrderData.shipping_address_id = shippingAddressId;
    console.log('✅ Using address IDs for sales order');
  } else {
    // Fallback to address object (but this should not happen with proper contact creation)
    salesOrderData.shipping_address = {
      address: orderData.shippingAddress.address1.substring(0, 99),
      city: orderData.shippingAddress.city,
      state: orderData.shippingAddress.state,
      zip: orderData.shippingAddress.zipCode,
      country: orderData.shippingAddress.country
    };
    console.log('⚠️ Using address object fallback for sales order');
  }
  
  // Add notes with payment tracking info instead of custom fields
  salesOrderData.notes = `Payment completed via Stripe. Payment Intent: ${paymentIntent.id}. Request ID: ${orderData.requestId}`;
  
  console.log('📦 Creating sales order in Zoho...');
  console.log('📋 Sales order data:', JSON.stringify(salesOrderData, null, 2));
  
  const response = await fetch(
    `https://www.zohoapis.com/inventory/v1/salesorders?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(salesOrderData)
    }
  );
  
  const result = await response.json();
  console.log('Sales order creation response:', JSON.stringify(result, null, 2));
  
  if (!response.ok || !result.salesorder) {
    console.error('❌ Zoho order creation failed. Full response:', result);
    throw new Error(`Zoho order creation failed: ${result.message || JSON.stringify(result)}`);
  }
  
  const orderId = result.salesorder.salesorder_id;
  const orderNumber = result.salesorder.salesorder_number;
  
  console.log('✅ Zoho order created after payment:', { orderId, orderNumber });
  
  // STEP 4: Confirm the sales order (changes status from draft to confirmed)
  console.log('📋 Confirming sales order...');
  
  const confirmResponse = await fetch(
    `https://www.zohoapis.com/inventory/v1/salesorders/${orderId}/status/confirmed?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const confirmResult = await confirmResponse.json();
  console.log('Sales order confirmation response:', JSON.stringify(confirmResult, null, 2));
  
  if (!confirmResponse.ok) {
    console.warn('⚠️ Sales order confirmation failed:', confirmResult.message);
    // Don't throw error - order was created successfully, just not confirmed
  } else {
    console.log('✅ Sales order confirmed successfully');
  }
  
  return { orderId, orderNumber };
}

async function getZohoAccessToken() {
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
  
  return data.access_token;
}

// CRITICAL: Disable body parser for raw body handling
export const config = {
  api: {
    bodyParser: false,
  },
}