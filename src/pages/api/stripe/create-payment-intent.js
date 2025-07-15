/ src/pages/api/stripe/create-payment-intent.js

/**
 * Create Stripe Payment Intent for public payment page
 * This handles secure payments without requiring Zoho login
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency, invoice_id, customer_email, invoice_number } = req.body;

    // Validation
    if (!amount || !invoice_id || !customer_email) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['amount', 'invoice_id', 'customer_email']
      });
    }

    console.log('🔄 Creating Stripe payment intent...');
    console.log('Amount:', amount, 'cents');
    console.log('Invoice:', invoice_number);
    console.log('Customer:', customer_email);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Amount in cents
      currency: currency || 'usd',
      customer_email: customer_email,
      metadata: {
        invoice_id: invoice_id,
        invoice_number: invoice_number || '',
        customer_email: customer_email,
        source: 'public_payment_page'
      },
      description: `Payment for invoice ${invoice_number || invoice_id}`,
      receipt_email: customer_email,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    res.status(200).json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    });

  } catch (error) {
    console.error('❌ Stripe payment intent creation failed:', error);
    
    res.status(500).json({
      error: 'Failed to create payment intent',
      details: error.message
    });
  }
}