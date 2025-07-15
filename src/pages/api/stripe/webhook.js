// src/pages/api/stripe/webhook.js - COMPLETE WEBHOOK HANDLER

/**
 * Stripe webhook handler to update Zoho when payments succeed
 * This automatically records payments in Zoho Inventory when customers pay
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  console.log('\n=== STRIPE WEBHOOK RECEIVED ===');
  
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('✅ Webhook signature verified');
    console.log('📧 Event type:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful payment
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const { invoice_id, invoice_number, customer_email } = paymentIntent.metadata;

    console.log('✅ Payment succeeded!');
    console.log('💰 Amount:', paymentIntent.amount_received / 100);
    console.log('📄 Invoice ID:', invoice_id);
    console.log('📧 Customer:', customer_email);

    try {
      // Record payment in Zoho Inventory
      await recordZohoPayment(invoice_id, paymentIntent);
      console.log('✅ Payment recorded in Zoho successfully');
    } catch (error) {
      console.error('❌ Failed to record payment in Zoho:', error);
      // Don't fail the webhook - payment still succeeded
    }
  }

  // Handle failed payment
  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    console.log('❌ Payment failed for invoice:', paymentIntent.metadata.invoice_id);
    console.log('❌ Failure reason:', paymentIntent.last_payment_error?.message);
  }

  res.status(200).json({ received: true });
}

/**
 * Record payment in Zoho Inventory
 */
async function recordZohoPayment(invoiceId, paymentIntent) {
  try {
    console.log('🔄 Recording payment in Zoho Inventory...');
    
    // Get Zoho access token
    const token = await getZohoAccessToken();
    const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID;

    // Get invoice details first to get customer ID
    const invoiceResponse = await fetch(`https://www.zohoapis.com/inventory/v1/invoices/${invoiceId}?organization_id=${organizationId}`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`
      }
    });

    if (!invoiceResponse.ok) {
      throw new Error(`Failed to get invoice details: ${invoiceResponse.status}`);
    }

    const invoiceData = await invoiceResponse.json();
    const customerId = invoiceData.invoice.customer_id;

    console.log('📄 Invoice customer ID:', customerId);

    // Create payment record in Zoho
    const paymentData = {
      customer_id: customerId,
      payment_mode: 'creditcard',
      amount: paymentIntent.amount_received / 100, // Convert cents to dollars
      date: new Date().toISOString().split('T')[0],
      reference_number: paymentIntent.id,
      description: `Stripe payment for invoice ${paymentIntent.metadata.invoice_number || invoiceId}`,
      invoices: [
        {
          invoice_id: invoiceId,
          amount_applied: paymentIntent.amount_received / 100
        }
      ]
    };

    console.log('📤 Payment data:', JSON.stringify(paymentData, null, 2));

    const paymentResponse = await fetch(`https://www.zohoapis.com/inventory/v1/customerpayments?organization_id=${organizationId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      console.error('❌ Zoho payment API error:', errorText);
      throw new Error(`Zoho payment recording failed: ${paymentResponse.status} ${errorText}`);
    }

    const paymentResult = await paymentResponse.json();
    console.log('✅ Payment recorded successfully:', paymentResult.payment?.payment_id);

    return paymentResult;

  } catch (error) {
    console.error('❌ Error recording Zoho payment:', error);
    throw error;
  }
}

/**
 * Get Zoho access token (reuse from existing code)
 */
let cachedAccessToken = null;
let tokenExpiryTime = 0;

async function getZohoAccessToken() {
  // Check cache first
  if (cachedAccessToken && Date.now() < tokenExpiryTime) {
    console.log('✓ Using cached Zoho access token');
    return cachedAccessToken;
  }

  console.log('🔄 Requesting new Zoho access token...');

  if (!process.env.ZOHO_REFRESH_TOKEN || !process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
    throw new Error('Missing required Zoho OAuth environment variables');
  }

  try {
    const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token refresh failed: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error(`No access token in response: ${JSON.stringify(tokenData)}`);
    }

    // Cache token for 50 minutes (expires in 1 hour)
    cachedAccessToken = tokenData.access_token;
    tokenExpiryTime = Date.now() + (50 * 60 * 1000);

    console.log('✓ New Zoho access token obtained and cached');
    return tokenData.access_token;

  } catch (error) {
    console.error('❌ Zoho token refresh failed:', error);
    throw new Error(`Failed to get Zoho access token: ${error.message}`);
  }
}

/**
 * IMPORTANT: Next.js config for webhooks
 * Add this to your next.config.js or create it if it doesn't exist:
 * 
 * module.exports = {
 *   api: {
 *     bodyParser: {
 *       sizeLimit: '1mb',
 *     },
 *   },
 *   experimental: {
 *     // Disable body parsing for webhook endpoint
 *     api: {
 *       bodyParser: false,
 *     },
 *   },
 * }
 * 
 * OR create a specific config file: src/pages/api/stripe/webhook.js.config.js
 * export const config = {
 *   api: {
 *     bodyParser: false,
 *   },
 * }
 */

// Disable body parser for webhook (raw body needed for signature verification)
export const config = {
  api: {
    bodyParser: false,
  },
}

/**
 * STRIPE WEBHOOK SETUP INSTRUCTIONS:
 * 
 * 1. Go to Stripe Dashboard → Developers → Webhooks
 * 2. Click "Add endpoint"
 * 3. Set endpoint URL: https://traveldatawifi.com/api/stripe/webhook
 * 4. Select events: payment_intent.succeeded, payment_intent.payment_failed
 * 5. Copy the webhook signing secret to STRIPE_WEBHOOK_SECRET env var
 * 
 * ENVIRONMENT VARIABLES NEEDED:
 * STRIPE_WEBHOOK_SECRET=whsec_...
 * 
 * TESTING WEBHOOKS LOCALLY:
 * 1. Install Stripe CLI: stripe listen --forward-to localhost:3000/api/stripe/webhook
 * 2. Use the webhook secret from CLI output
 * 3. Test payments to see webhook logs
 * 
 * EXPECTED WEBHOOK FLOW:
 * 1. Customer pays on /pay/[invoice_id] page
 * 2. Stripe processes payment
 * 3. Stripe sends webhook to this endpoint
 * 4. Webhook records payment in Zoho Inventory
 * 5. Invoice status automatically updates to "Paid"
 * 
 * WEBHOOK LOGS TO EXPECT:
 * === STRIPE WEBHOOK RECEIVED ===
 * ✅ Webhook signature verified
 * 📧 Event type: payment_intent.succeeded
 * ✅ Payment succeeded!
 * 💰 Amount: 145.73
 * 📄 Invoice ID: 2948665000038305141
 * 🔄 Recording payment in Zoho Inventory...
 * 📄 Invoice customer ID: 2948665000002822575
 * ✅ Payment recorded successfully: [payment_id]
 */