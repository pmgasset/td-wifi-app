// src/pages/api/stripe/webhook.js
/**
 * Stripe Webhook Handler - Creates Zoho Order AFTER Successful Payment
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Helper function to get raw body
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
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
    // Get the raw body properly
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

      // Extract order data from metadata
      const orderData = extractOrderDataFromMetadata(paymentIntent.metadata);
      console.log('📋 Order data extracted from Payment Intent metadata');
      
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
  let cartItems = [];
  try {
    if (metadata.cart_items) {
      const parsedItems = JSON.parse(metadata.cart_items);
      cartItems = parsedItems.map(item => ({
        product_id: item.id,
        product_name: item.name,
        product_price: item.price,
        quantity: item.qty
      }));
    }
  } catch (parseError) {
    console.warn('Could not parse cart items from metadata:', parseError);
    cartItems = [{
      product_id: 'unknown',
      product_name: 'Travel Data WiFi Product',
      product_price: parseFloat(metadata.subtotal || '0') / parseInt(metadata.item_count || '1'),
      quantity: parseInt(metadata.item_count || '1')
    }];
  }
  
  return {
    customerInfo: {
      firstName: metadata.customer_name?.split(' ')[0] || 'Customer',
      lastName: metadata.customer_name?.split(' ').slice(1).join(' ') || '',
      email: metadata.customer_email,
      phone: ''
    },
    shippingAddress: {
      address1: metadata.shipping_address1 || '',
      address2: metadata.shipping_address2 || '',
      city: metadata.shipping_city || '',
      state: metadata.shipping_state || '',
      zipCode: metadata.shipping_zip || '',
      country: metadata.shipping_country || 'US'
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
}

async function createZohoOrderAfterPayment(orderData, paymentIntent) {
  console.log('🔄 Creating Zoho order after payment confirmation...');
  
  const token = await getZohoAccessToken();
  
  // Handle customer addresses
  let billingAddressId = null;
  let shippingAddressId = null;
  
  if (orderData.customerId) {
    console.log('📍 Creating customer addresses in Zoho...');
    
    const addressData = {
      attention: `${orderData.customerInfo.firstName} ${orderData.customerInfo.lastName}`,
      address: orderData.shippingAddress.address1.substring(0, 99),
      address_2: orderData.shippingAddress.address2?.substring(0, 99) || '',
      city: orderData.shippingAddress.city,
      state: orderData.shippingAddress.state,
      zip: orderData.shippingAddress.zipCode,
      country: orderData.shippingAddress.country,
      phone: orderData.customerInfo.phone || ''
    };
    
    try {
      const addressResponse = await fetch(
        `https://www.zohoapis.com/inventory/v1/contacts/${orderData.customerId}/address?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            billing_address: addressData,
            shipping_address: addressData
          })
        }
      );
      
      const addressResult = await addressResponse.json();
      
      if (addressResult.address) {
        billingAddressId = addressResult.address.billing_address_id;
        shippingAddressId = addressResult.address.shipping_address_id;
        console.log('✅ Customer addresses created');
      }
    } catch (addressError) {
      console.warn('⚠️ Address creation failed:', addressError.message);
    }
  }
  
  // Prepare line items
  const lineItems = orderData.cartItems.map(item => ({
    item_id: item.product_id,
    name: item.product_name,
    rate: parseFloat(item.product_price),
    quantity: parseInt(item.quantity),
    unit: 'qty'
  }));
  
  // Prepare order data
  const salesOrderData = {
    customer_id: orderData.customerId || undefined,
    date: new Date().toISOString().split('T')[0],
    shipment_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    line_items: lineItems,
    
    ...(billingAddressId ? {
      billing_address_id: billingAddressId,
      shipping_address_id: shippingAddressId
    } : {
      shipping_address: {
        address: orderData.shippingAddress.address1.substring(0, 99),
        city: orderData.shippingAddress.city,
        state: orderData.shippingAddress.state,
        zip: orderData.shippingAddress.zipCode,
        country: orderData.shippingAddress.country
      }
    }),
    
    notes: `Payment completed via Stripe. Payment Intent: ${paymentIntent.id}`,
    terms: 'Paid via Stripe',
    
    custom_fields: [
      { label: 'Payment Method', value: 'Stripe' },
      { label: 'Payment Intent ID', value: paymentIntent.id },
      { label: 'Request ID', value: orderData.requestId }
    ]
  };
  
  // If no customer ID, add customer info directly
  if (!orderData.customerId) {
    salesOrderData.customer_name = `${orderData.customerInfo.firstName} ${orderData.customerInfo.lastName}`;
    salesOrderData.contact_persons = [{
      name: `${orderData.customerInfo.firstName} ${orderData.customerInfo.lastName}`,
      email: orderData.customerInfo.email,
      phone: orderData.customerInfo.phone || ''
    }];
  }
  
  console.log('📦 Creating sales order in Zoho...');
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
  
  if (!response.ok || !result.salesorder) {
    throw new Error(`Zoho order creation failed: ${result.message || JSON.stringify(result)}`);
  }
  
  const orderId = result.salesorder.salesorder_id;
  const orderNumber = result.salesorder.salesorder_number;
  
  console.log('✅ Zoho order created after payment:', { orderId, orderNumber });
  
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

// Disable body parser for raw body
export const config = {
  api: {
    bodyParser: false,
  },
}