// src/pages/api/stripe/create-payment-intent.js

/**
 * Create Stripe Payment Intent for public payment page
 * This endpoint creates a payment intent for processing payments
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      amount,
      currency = 'USD',
      customer_email,
      metadata = {}
    } = req.body;

    // Validation
    if (!amount || !customer_email) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'amount and customer_email are required'
      });
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: 'Stripe not configured',
        details: 'STRIPE_SECRET_KEY environment variable is missing'
      });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(amount) * 100), // Convert to cents
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: customer_email,
      metadata: {
        ...metadata,
        integration_type: 'travel_data_wifi'
      }
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    return res.status(200).json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: amount,
      currency: currency
    });

  } catch (error) {
    console.error('❌ Error creating payment intent:', error);
    
    return res.status(500).json({
      error: 'Failed to create payment intent',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}