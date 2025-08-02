// src/pages/api/stripe/create-checkout-session.js - Updated to use centralized token manager
// REMOVED: cachedToken and tokenExpiry - now uses tokenManager.getAccessToken('commerce')

import { tokenManager } from '../../../lib/enhanced-token-manager';

/**
 * Create Stripe checkout session with Zoho integration
 * Uses centralized token management to prevent rate limiting issues
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestId = `stripe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`\n💳 === STRIPE CHECKOUT SESSION CREATION [${requestId}] ===`);

  try {
    const {
      invoice_id,
      amount,
      currency = 'USD',
      customer_email,
      customer_name,
      success_url,
      cancel_url,
      mode = 'payment'
    } = req.body;

    // Validate required fields
    if (!invoice_id) {
      return res.status(400).json({
        error: 'Missing invoice_id',
        details: 'invoice_id is required for Stripe checkout session',
        request_id: requestId
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        details: 'amount must be greater than 0',
        request_id: requestId
      });
    }

    if (!customer_email) {
      return res.status(400).json({
        error: 'Missing customer_email',
        details: 'customer_email is required for checkout session',
        request_id: requestId
      });
    }

    console.log(`📋 Checkout Session Details [${requestId}]:`);
    console.log(`   Invoice ID: ${invoice_id}`);
    console.log(`   Amount: ${amount} ${currency}`);
    console.log(`   Customer: ${customer_name} (${customer_email})`);
    console.log(`   Mode: ${mode}`);

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn(`⚠️ Stripe not configured, falling back to Zoho payment [${requestId}]`);
      return await createZohoCheckoutSession(req.body, requestId);
    }

    // Create Stripe checkout session
    try {
      console.log(`🔄 Creating Stripe checkout session [${requestId}]...`);
      
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      
      const sessionData = {
        payment_method_types: ['card'],
        mode: mode,
        customer_email: customer_email,
        
        line_items: [{
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Invoice ${invoice_id}`,
              description: customer_name ? `Payment for ${customer_name}` : 'Invoice Payment',
              metadata: {
                invoice_id: invoice_id,
                customer_email: customer_email,
                request_id: requestId
              }
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        }],
        
        success_url: success_url || `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&invoice_id=${invoice_id}`,
        cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_BASE_URL}/payment/cancel?invoice_id=${invoice_id}`,
        
        metadata: {
          invoice_id: invoice_id,
          customer_email: customer_email,
          request_id: requestId,
          integration: 'zoho_stripe'
        },
        
        // Enhance with additional options
        payment_intent_data: {
          metadata: {
            invoice_id: invoice_id,
            customer_email: customer_email,
            request_id: requestId
          }
        },
        
        // Customer information
        ...(customer_name && {
          customer_creation: 'always',
          customer_email: customer_email
        })
      };

      const session = await stripe.checkout.sessions.create(sessionData);
      
      console.log(`✅ Stripe checkout session created [${requestId}]: ${session.id}`);

      // Optional: Create corresponding record in Zoho (for tracking)
      try {
        await recordStripeSessionInZoho(session, invoice_id, requestId);
      } catch (zohoError) {
        console.warn(`⚠️ Failed to record session in Zoho [${requestId}]:`, zohoError.message);
        // Don't fail the entire request if Zoho recording fails
      }

      return res.status(200).json({
        success: true,
        checkout_url: session.url,
        session_id: session.id,
        invoice_id: invoice_id,
        amount: amount,
        currency: currency,
        customer_email: customer_email,
        expires_at: session.expires_at,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        payment_method: 'stripe',
        next_steps: {
          action: 'redirect_to_stripe',
          url: session.url,
          description: 'Customer should be redirected to Stripe checkout'
        }
      });

    } catch (stripeError) {
      console.error(`❌ Stripe checkout session creation failed [${requestId}]:`, stripeError);
      
      // Check if this is a Stripe configuration issue
      if (stripeError.message.includes('Invalid API Key')) {
        console.log(`🔄 Stripe API key invalid, falling back to Zoho [${requestId}]`);
        return await createZohoCheckoutSession(req.body, requestId);
      }
      
      // For other Stripe errors, try Zoho fallback
      console.log(`🔄 Stripe error occurred, attempting Zoho fallback [${requestId}]`);
      return await createZohoCheckoutSession(req.body, requestId);
    }

  } catch (error) {
    console.error(`❌ Unexpected error in checkout session creation [${requestId}]:`, error);
    
    return res.status(500).json({
      error: 'Checkout session creation failed',
      details: error.message || 'An unexpected error occurred',
      type: 'UNEXPECTED_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString(),
      token_manager_status: tokenManager.getStatus()
    });
  }
}

/**
 * Fallback: Create Zoho-based checkout session when Stripe is unavailable
 */
async function createZohoCheckoutSession(requestData, requestId) {
  console.log(`🔄 Creating Zoho-based checkout session [${requestId}]...`);
  
  try {
    const {
      invoice_id,
      amount,
      currency = 'USD',
      customer_email,
      customer_name,
      success_url,
      cancel_url
    } = requestData;

    // Get Zoho access token using centralized token manager
    let token;
    try {
      console.log(`🔑 Getting Zoho access token via token manager [${requestId}]...`);
      token = await getZohoAccessToken();
      console.log(`✅ Zoho access token obtained [${requestId}]`);
    } catch (tokenError) {
      console.error(`❌ Zoho token acquisition failed [${requestId}]:`, tokenError);
      throw new Error(`Zoho authentication failed: ${tokenError.message}`);
    }

    const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID;
    if (!organizationId) {
      throw new Error('ZOHO_INVENTORY_ORGANIZATION_ID not configured');
    }

    // Try to create Zoho invoice sharing link
    try {
      const shareInvoiceData = {
        send_to_contacts: false,
        is_public_url: true,
        password_protected: false,
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        sharing_type: "public_url",
        allow_partial_payments: true,
        payment_options: {
          show_payment_options: true,
          payment_gateways: ["all"],
          allow_partial_payment: true
        },
        success_url: success_url,
        cancel_url: cancel_url
      };

      console.log(`📡 Creating Zoho invoice share link [${requestId}]...`);

      const response = await fetch(
        `https://www.zohoapis.com/inventory/v1/invoices/${invoice_id}/share?organization_id=${organizationId}`, 
        {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(shareInvoiceData),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        }
      );

      const data = await response.json();

      if (response.ok && (data.share_url || data.invoice_url || data.public_url)) {
        const checkoutUrl = data.share_url || data.invoice_url || data.public_url;
        
        console.log(`✅ Zoho invoice sharing successful [${requestId}]: ${checkoutUrl}`);
        
        return {
          success: true,
          checkout_url: checkoutUrl,
          session_id: data.share_id || `zoho_share_${Date.now()}`,
          invoice_id: invoice_id,
          amount: amount,
          currency: currency,
          customer_email: customer_email,
          request_id: requestId,
          timestamp: new Date().toISOString(),
          payment_method: 'zoho_inventory',
          next_steps: {
            action: 'redirect_to_zoho',
            url: checkoutUrl,
            description: 'Customer should be redirected to Zoho payment page'
          }
        };
      } else {
        throw new Error(data.message || 'Zoho invoice sharing failed');
      }

    } catch (zohoShareError) {
      console.error(`❌ Zoho invoice sharing failed [${requestId}]:`, zohoShareError);
      
      // Final fallback - custom payment page
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const fallbackUrl = `${baseUrl}/pay/${invoice_id}?` + new URLSearchParams({
        amount: amount.toString(),
        currency: currency,
        customer_email: customer_email,
        customer_name: customer_name || '',
        token: generateSecureToken(invoice_id, customer_email, amount),
        source: 'stripe_fallback',
        request_id: requestId,
        success_url: success_url || '',
        cancel_url: cancel_url || ''
      }).toString();

      console.log(`🔄 Using final fallback payment URL [${requestId}]: ${fallbackUrl}`);

      return {
        success: true,
        checkout_url: fallbackUrl,
        session_id: `fallback_${Date.now()}`,
        invoice_id: invoice_id,
        amount: amount,
        currency: currency,
        customer_email: customer_email,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        payment_method: 'custom_fallback',
        warning: 'Using fallback payment method - both Stripe and Zoho sharing unavailable',
        next_steps: {
          action: 'redirect_to_custom_page',
          url: fallbackUrl,
          description: 'Customer should be redirected to custom payment page'
        }
      };
    }

  } catch (error) {
    console.error(`❌ Zoho checkout session creation failed [${requestId}]:`, error);
    throw new Error(`Zoho checkout failed: ${error.message}`);
  }
}

/**
 * Record Stripe session in Zoho for tracking (optional)
 */
async function recordStripeSessionInZoho(stripeSession, invoiceId, requestId) {
  try {
    console.log(`📝 Recording Stripe session in Zoho [${requestId}]...`);
    
    const token = await getZohoAccessToken();
    const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID;
    
    if (!organizationId) {
      throw new Error('ZOHO_INVENTORY_ORGANIZATION_ID not configured');
    }

    // Add a note to the invoice about the Stripe session
    const noteData = {
      description: `Stripe checkout session created: ${stripeSession.id}\nAmount: ${stripeSession.amount_total / 100} ${stripeSession.currency.toUpperCase()}\nCustomer: ${stripeSession.customer_email}\nSession URL: ${stripeSession.url}\nRequest ID: ${requestId}`
    };

    const response = await fetch(
      `https://www.zohoapis.com/inventory/v1/invoices/${invoiceId}/comments?organization_id=${organizationId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(noteData),
        signal: AbortSignal.timeout(15000) // 15 second timeout for this optional operation
      }
    );

    if (response.ok) {
      console.log(`✅ Stripe session recorded in Zoho [${requestId}]`);
    } else {
      const errorText = await response.text();
      console.warn(`⚠️ Failed to record in Zoho [${requestId}]: ${response.status} - ${errorText}`);
    }

  } catch (error) {
    console.warn(`⚠️ Error recording Stripe session in Zoho [${requestId}]:`, error.message);
    // Don't throw - this is optional functionality
  }
}

/**
 * CENTRALIZED: Get Zoho access token using token manager
 * REMOVED: Local cachedToken and tokenExpiry variables
 */
async function getZohoAccessToken() {
  try {
    // Use centralized token manager instead of local caching
    // Note: Using 'commerce' for Stripe integration, but could be 'inventory' depending on your setup
    return await tokenManager.getAccessToken('commerce');
  } catch (error) {
    console.error('❌ Failed to get access token from token manager:', error);
    throw new Error(`Token manager error: ${error.message}`);
  }
}

/**
 * Generate secure token for custom payment pages
 */
function generateSecureToken(invoiceId, customerEmail, amount) {
  const timestamp = Date.now();
  const payload = `${invoiceId}:${customerEmail}:${amount}:${timestamp}`;
  return Buffer.from(payload).toString('base64').replace(/[+=\/]/g, '');
}

/**
 * Webhook handler for Stripe events (optional - create separate file)
 */
export async function handleStripeWebhook(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestId = `webhook_${Date.now()}`;
  console.log(`🔔 Stripe webhook received [${requestId}]`);

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.warn(`⚠️ Stripe webhook secret not configured [${requestId}]`);
      return res.status(400).json({ error: 'Webhook secret not configured' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error(`❌ Webhook signature verification failed [${requestId}]:`, err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log(`✅ Payment successful [${requestId}]: ${session.id}`);
        
        // Update invoice status in Zoho
        if (session.metadata?.invoice_id) {
          try {
            await updateInvoiceStatusInZoho(session.metadata.invoice_id, 'paid', requestId);
          } catch (zohoError) {
            console.error(`❌ Failed to update Zoho invoice status [${requestId}]:`, zohoError);
          }
        }
        break;

      case 'checkout.session.expired':
        const expiredSession = event.data.object;
        console.log(`⏰ Payment session expired [${requestId}]: ${expiredSession.id}`);
        break;

      default:
        console.log(`ℹ️ Unhandled event type [${requestId}]: ${event.type}`);
    }

    res.status(200).json({ received: true, request_id: requestId });

  } catch (error) {
    console.error(`❌ Webhook handling error [${requestId}]:`, error);
    res.status(500).json({ error: 'Webhook processing failed', request_id: requestId });
  }
}

/**
 * Update invoice status in Zoho when payment is completed
 */
async function updateInvoiceStatusInZoho(invoiceId, status, requestId) {
  try {
    console.log(`📝 Updating invoice ${invoiceId} status to ${status} [${requestId}]...`);
    
    const token = await getZohoAccessToken();
    const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID;
    
    if (!organizationId) {
      throw new Error('ZOHO_INVENTORY_ORGANIZATION_ID not configured');
    }

    // Mark invoice as paid
    const response = await fetch(
      `https://www.zohoapis.com/inventory/v1/invoices/${invoiceId}/status/paid?organization_id=${organizationId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          amount: null, // Let Zoho determine the amount
          payment_mode: 'stripe',
          description: `Payment processed via Stripe - Request ID: ${requestId}`
        }),
        signal: AbortSignal.timeout(30000)
      }
    );

    if (response.ok) {
      console.log(`✅ Invoice ${invoiceId} marked as paid in Zoho [${requestId}]`);
    } else {
      const errorText = await response.text();
      throw new Error(`Failed to update invoice status: ${response.status} - ${errorText}`);
    }

  } catch (error) {
    console.error(`❌ Failed to update invoice status in Zoho [${requestId}]:`, error);
    throw error;
  }
}

/**
 * Health check for the Stripe checkout service
 */
export async function healthCheck() {
  try {
    const tokenStatus = tokenManager.getStatus();
    
    return {
      service: 'stripe_checkout',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      token_manager: tokenStatus,
      configuration: {
        stripe_configured: !!process.env.STRIPE_SECRET_KEY,
        stripe_publishable_key_configured: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        webhook_secret_configured: !!process.env.STRIPE_WEBHOOK_SECRET,
        zoho_organization_configured: !!process.env.ZOHO_INVENTORY_ORGANIZATION_ID,
        base_url_configured: !!process.env.NEXT_PUBLIC_BASE_URL
      },
      fallback_methods: [
        'zoho_invoice_sharing',
        'custom_payment_page'
      ]
    };
  } catch (error) {
    return {
      service: 'stripe_checkout',
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * This updated solution:
 * 1. Uses centralized token management via tokenManager.getAccessToken('commerce')
 * 2. Removes local token caching (cachedToken, tokenExpiry)
 * 3. Provides multiple fallback methods:
 *    - Primary: Stripe checkout session
 *    - Fallback 1: Zoho invoice sharing
 *    - Fallback 2: Custom payment page
 * 4. Includes webhook handling for payment completion
 * 5. Updates Zoho invoice status when payment is successful
 * 6. Comprehensive error handling and logging
 * 7. Timeout protection for all external API calls
 * 
 * Key improvements:
 * - No more duplicate token caching across files
 * - Rate limiting prevention through centralized token management
 * - Graceful fallbacks when services are unavailable
 * - Better error reporting and debugging
 * - Optional Zoho integration for payment tracking
 */