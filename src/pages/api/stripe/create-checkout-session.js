// ===== src/pages/api/stripe/create-checkout-session.js =====

/**
 * Creates a Stripe Checkout session for Zoho Inventory invoice payments
 * Integrates with your existing Stripe configuration in Zoho
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      invoice_id,
      amount,
      currency = 'USD',
      customer_email,
      customer_name,
      success_url,
      cancel_url,
      metadata = {}
    } = req.body;

    // Validation
    if (!invoice_id || !amount || !customer_email) {
      return res.status(400).json({
        error: 'Missing required fields: invoice_id, amount, and customer_email are required'
      });
    }

    console.log(`Creating Stripe checkout session for invoice: ${invoice_id}`);

    // Method 1: Try to use Zoho's Stripe integration directly
    try {
      console.log('Attempting to create payment through Zoho Inventory Stripe integration...');
      
      const zohoStripeResponse = await createZohoStripePayment({
        invoice_id,
        amount,
        currency,
        customer_email,
        success_url,
        cancel_url
      });

      if (zohoStripeResponse.success) {
        return res.status(200).json({
          success: true,
          checkout_url: zohoStripeResponse.checkout_url,
          session_id: zohoStripeResponse.session_id,
          method: 'zoho_stripe_integration'
        });
      }
    } catch (zohoStripeError) {
      console.log('Zoho Stripe integration failed, trying direct Stripe API...');
    }

    // Method 2: Use direct Stripe API (requires Stripe keys)
    if (process.env.STRIPE_SECRET_KEY) {
      console.log('Creating Stripe session using direct API...');
      
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: customer_email,
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `Invoice ${metadata.invoice_number || invoice_id}`,
                description: `Payment for Travel Data WiFi invoice`,
                metadata: {
                  invoice_id: invoice_id,
                  contact_id: metadata.contact_id || '',
                  sales_order_id: metadata.sales_order_id || ''
                }
              },
              unit_amount: Math.round(amount * 100), // Stripe expects cents
            },
            quantity: 1,
          },
        ],
        success_url: success_url + '?session_id={CHECKOUT_SESSION_ID}&payment_status=completed',
        cancel_url: cancel_url || `${req.headers.origin}/checkout?error=payment_cancelled`,
        metadata: {
          invoice_id: invoice_id,
          invoice_number: metadata.invoice_number || '',
          contact_id: metadata.contact_id || '',
          sales_order_id: metadata.sales_order_id || '',
          organization_id: metadata.organization_id || '',
          request_id: metadata.request_id || '',
          integration_type: 'zoho_inventory'
        }
      });

      console.log('✓ Stripe session created:', session.id);

      return res.status(200).json({
        success: true,
        checkout_url: session.url,
        session_id: session.id,
        method: 'direct_stripe_api'
      });
    }

    // Method 3: Fallback to custom payment form
    console.log('No Stripe keys available, using custom payment form...');
    
    const customPaymentUrl = `${req.headers.origin}/payment/custom-stripe?${new URLSearchParams({
      invoice_id,
      amount: amount.toString(),
      currency,
      customer_email,
      customer_name,
      success_url,
      cancel_url,
      ...metadata
    }).toString()}`;

    return res.status(200).json({
      success: true,
      checkout_url: customPaymentUrl,
      session_id: `custom_${Date.now()}`,
      method: 'custom_payment_form'
    });

  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    
    return res.status(500).json({
      error: 'Failed to create payment session',
      details: error.message,
      suggestion: 'Check Stripe configuration and try again'
    });
  }
}

/**
 * Attempt to create payment through Zoho's Stripe integration
 */
async function createZohoStripePayment({ invoice_id, amount, currency, customer_email, success_url, cancel_url }) {
  try {
    // Get Zoho access token
    const token = await getZohoAccessToken();
    const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID;

    // Try Zoho's payment link creation
    const paymentLinkData = {
      invoice_id: invoice_id,
      payment_mode: 'stripe',
      success_url: success_url,
      cancel_url: cancel_url,
      customer_email: customer_email
    };

    const response = await fetch(`https://www.zohoapis.com/inventory/v1/invoices/${invoice_id}/paymentlink?organization_id=${organizationId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentLinkData)
    });

    const data = await response.json();

    if (response.ok && data.payment_url) {
      return {
        success: true,
        checkout_url: data.payment_url,
        session_id: data.payment_id || `zoho_${Date.now()}`
      };
    } else {
      throw new Error(data.message || 'Zoho payment link creation failed');
    }

  } catch (error) {
    console.error('Zoho Stripe integration error:', error);
    throw error;
  }
}

/**
 * Get Zoho access token (reuse from your existing implementation)
 */
async function getZohoAccessToken() {
  if (!process.env.ZOHO_REFRESH_TOKEN || !process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
    throw new Error('Missing Zoho OAuth credentials');
  }

  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
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

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error('Failed to get Zoho access token');
  }

  return data.access_token;
}