// src/pages/api/checkout/verify.js
/**
 * Checkout Verification API
 * 
 * Verifies payment completion and retrieves order details
 * for the success page
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { payment_intent, order_id, session_id } = req.body;

    console.log('Verifying checkout...', { payment_intent, order_id, session_id });

    let orderData = null;
    let paymentData = null;

    // Verify Stripe payment first
    if (payment_intent) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);
        
        if (paymentIntent.status !== 'succeeded') {
          return res.status(400).json({
            error: 'Payment not completed',
            status: paymentIntent.status
          });
        }

        paymentData = {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount / 100, // Convert from cents
          currency: paymentIntent.currency.toUpperCase(),
          status: paymentIntent.status,
          paymentMethod: 'Credit Card',
          last4: paymentIntent.charges?.data[0]?.payment_method_details?.card?.last4 || null
        };

        // Get order ID from payment metadata
        const orderIdFromPayment = paymentIntent.metadata?.orderId;
        if (orderIdFromPayment && !order_id) {
          order_id = orderIdFromPayment;
        }

      } catch (stripeError) {
        console.error('Stripe verification error:', stripeError);
        return res.status(400).json({
          error: 'Invalid payment intent',
          details: stripeError.message
        });
      }
    }

    // Get order details from Zoho
    if (order_id) {
      try {
        orderData = await getZohoOrderDetails(order_id);
      } catch (zohoError) {
        console.warn('Zoho order lookup failed:', zohoError.message);
        
        // If Zoho fails, create a basic order response from payment data
        if (paymentData) {
          orderData = createFallbackOrderData(paymentData, order_id);
        }
      }
    }

    // If no order data available, return error
    if (!orderData) {
      return res.status(404).json({
        error: 'Order not found',
        details: 'Unable to retrieve order details'
      });
    }

    // Success response
    const response = {
      success: true,
      order: orderData,
      payment: paymentData,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Checkout verification successful');
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Checkout verification failed:', error);
    
    return res.status(500).json({
      error: 'Verification failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * SUB-AGENT: Get order details from Zoho
 */
async function getZohoOrderDetails(orderId) {
  console.log('Sub-agent: Fetching Zoho order details...', orderId);

  try {
    const token = await getZohoAccessToken();
    
    // Try sales order first
    const salesOrderUrl = `https://www.zohoapis.com/inventory/v1/salesorders/${orderId}?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`;
    
    const response = await fetch(salesOrderUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Zoho API error: ${result.message || 'Unknown error'}`);
    }

    const salesOrder = result.salesorder;
    if (!salesOrder) {
      throw new Error('Sales order not found');
    }

    // Format order data for frontend
    const orderData = {
      orderId: salesOrder.salesorder_id,
      orderNumber: salesOrder.salesorder_number,
      status: salesOrder.status,
      total: parseFloat(salesOrder.total || 0),
      subtotal: parseFloat(salesOrder.sub_total || 0),
      taxAmount: parseFloat(salesOrder.tax_total || 0),
      shippingCost: parseFloat(salesOrder.shipping_charge || 0),
      currency: salesOrder.currency_code || 'USD',
      orderDate: salesOrder.date,
      
      // Customer information
      customer: {
        customerId: salesOrder.customer_id,
        email: salesOrder.email || salesOrder.contact_persons?.[0]?.email,
        name: salesOrder.customer_name,
        phone: salesOrder.contact_persons?.[0]?.phone
      },
      
      // Items
      items: salesOrder.line_items?.map(item => ({
        product_id: item.item_id,
        product_name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.rate || 0),
        total: parseFloat(item.quantity || 0) * parseFloat(item.rate || 0),
        product_images: ['/images/placeholder.jpg'] // Default image
      })) || [],
      
      // Addresses
      shippingAddress: salesOrder.shipping_address,
      billingAddress: salesOrder.billing_address,
      
      // Fulfillment info
      estimatedDelivery: calculateEstimatedDelivery(salesOrder.shipment_date),
      trackingNumber: salesOrder.tracking_number,
      shippingCarrier: salesOrder.carrier,
      
      // Additional info
      notes: salesOrder.notes,
      terms: salesOrder.terms
    };

    console.log('✅ Zoho order details retrieved');
    return orderData;

  } catch (error) {
    console.error('❌ Zoho order lookup failed:', error);
    throw error;
  }
}

/**
 * SUB-AGENT: Create fallback order data from payment info
 */
function createFallbackOrderData(paymentData, orderId) {
  console.log('Sub-agent: Creating fallback order data...');

  const orderNumber = `TDW-${orderId || Date.now()}`;
  
  return {
    orderId: orderId || 'unknown',
    orderNumber: orderNumber,
    status: 'confirmed',
    total: paymentData.amount,
    subtotal: paymentData.amount * 0.90, // Estimate
    taxAmount: paymentData.amount * 0.10, // Estimate
    shippingCost: 0,
    currency: paymentData.currency,
    orderDate: new Date().toISOString().split('T')[0],
    
    customer: {
      customerId: null,
      email: 'customer@email.com', // Placeholder
      name: 'Valued Customer',
      phone: null
    },
    
    items: [{
      product_id: 'unknown',
      product_name: 'Travel Data WiFi Product',
      quantity: 1,
      price: paymentData.amount,
      total: paymentData.amount,
      product_images: ['/images/placeholder.jpg']
    }],
    
    shippingAddress: null,
    billingAddress: null,
    
    estimatedDelivery: calculateEstimatedDelivery(),
    trackingNumber: null,
    shippingCarrier: null,
    
    notes: 'Order details retrieved from payment information',
    terms: 'Standard terms apply'
  };
}

/**
 * Calculate estimated delivery date
 */
function calculateEstimatedDelivery(shipmentDate = null) {
  const baseDate = shipmentDate ? new Date(shipmentDate) : new Date();
  const deliveryDate = new Date(baseDate.getTime() + (5 * 24 * 60 * 60 * 1000)); // 5 days
  
  return deliveryDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
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