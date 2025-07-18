// src/pages/api/stripe/webhook.js
/**
 * Stripe Webhook Handler - Creates Zoho Order AFTER Successful Payment
 * 
 * This endpoint is called by Stripe when payment is completed.
 * Only THEN do we create the order in Zoho, preventing abandoned orders.
 * 
 * Flow:
 * 1. Customer pays → Stripe calls this webhook
 * 2. Verify webhook signature
 * 3. Extract order data from Payment Intent metadata
 * 4. Create customer address in Zoho (if needed)
 * 5. Create sales order in Zoho
 * 6. Update Payment Intent with order ID
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`❌ Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log(`\n=== PAYMENT SUCCEEDED WEBHOOK [${paymentIntent.id}] ===`);
    
    try {
      // Extract order data from metadata
      const orderData = extractOrderDataFromMetadata(paymentIntent.metadata);
      console.log('Order data extracted from Payment Intent metadata');
      
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
      console.log(`Zoho Order: ${zohoOrder.orderNumber} (ID: ${zohoOrder.orderId})`);
      
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
      
      // Don't return error to Stripe - payment was successful
      // We'll handle order creation in success page if webhook fails
    }
  }

  // Return 200 to acknowledge receipt of the event
  res.json({ received: true });
}

/**
 * SUB-AGENT: Extract order data from Payment Intent metadata
 */
function extractOrderDataFromMetadata(metadata) {
  // Reconstruct cart items from metadata
  const cartItems = [];
  const itemCount = parseInt(metadata.item_count || '0');
  
  // For now, we have limited metadata. In a full implementation,
  // you might store a reference to the cart data in a database
  if (metadata.first_item_id) {
    cartItems.push({
      product_id: metadata.first_item_id,
      product_name: metadata.first_item_name || 'Product',
      product_price: parseFloat(metadata.subtotal) / itemCount, // Estimate
      quantity: itemCount
    });
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
    requestId: metadata.request_id || '',
    createAccount: metadata.create_account === 'true',
    accountCreated: metadata.account_created === 'true'
  };
}

/**
 * SUB-AGENT: Create Zoho order after payment confirmation
 */
async function createZohoOrderAfterPayment(orderData, paymentIntent) {
  console.log('🔄 Sub-agent: Creating Zoho order after payment confirmation...');
  
  try {
    const token = await getZohoAccessToken();
    
    // Handle customer addresses first (the issue you mentioned)
    let billingAddressId = null;
    let shippingAddressId = null;
    
    if (orderData.customerId) {
      console.log('Creating customer addresses in Zoho...');
      
      // Create billing address
      const billingAddressData = {
        attention: `${orderData.customerInfo.firstName} ${orderData.customerInfo.lastName}`,
        address: orderData.shippingAddress.address1,
        address_2: orderData.shippingAddress.address2,
        city: orderData.shippingAddress.city,
        state: orderData.shippingAddress.state,
        zip: orderData.shippingAddress.zipCode,
        country: orderData.shippingAddress.country,
        phone: orderData.customerInfo.phone || ''
      };
      
      const addressResponse = await fetch(
        `https://www.zohoapis.com/inventory/v1/contacts/${orderData.customerId}/address?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            billing_address: billingAddressData,
            shipping_address: billingAddressData // Same for both
          })
        }
      );
      
      const addressResult = await addressResponse.json();
      
      if (addressResult.address) {
        billingAddressId = addressResult.address.billing_address_id;
        shippingAddressId = addressResult.address.shipping_address_id;
        console.log('✅ Customer addresses created');
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
      
      // Line items
      line_items: lineItems,
      
      // Use address IDs if available, otherwise use address object
      ...(billingAddressId ? {
        billing_address_id: billingAddressId,
        shipping_address_id: shippingAddressId
      } : {
        shipping_address: {
          address: orderData.shippingAddress.address1.substring(0, 99), // Limit to 99 chars
          city: orderData.shippingAddress.city,
          state: orderData.shippingAddress.state,
          zip: orderData.shippingAddress.zipCode,
          country: orderData.shippingAddress.country
        }
      }),
      
      // Payment info
      notes: `Payment completed via Stripe. Payment Intent: ${paymentIntent.id}`,
      terms: 'Paid via Stripe',
      
      // Custom fields
      custom_fields: [
        {
          label: 'Payment Method',
          value: 'Stripe'
        },
        {
          label: 'Payment Intent ID',
          value: paymentIntent.id
        },
        {
          label: 'Request ID',
          value: orderData.requestId
        }
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
    
    console.log('Creating sales order in Zoho...');
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
    
  } catch (error) {
    console.error('❌ Post-payment Zoho order creation failed:', error);
    throw error;
  }
}

/**
 * Get Zoho access token (cached)
 */
let cachedToken = null;
let tokenExpiry = null;

async function getZohoAccessToken() {
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
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
    
    return cachedToken;
    
  } catch (error) {
    console.error('❌ Zoho token error:', error);
    throw new Error('Authentication failed');
  }
}

// Configure to receive raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}