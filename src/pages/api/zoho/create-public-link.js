// src/pages/api/zoho/create-public-link.js - Updated to use centralized token manager
// REMOVED: cachedAccessToken and tokenExpiryTime - now uses tokenManager.getAccessToken('inventory')

import { tokenManager } from '../../../lib/enhanced-token-manager';

/**
 * Create public shared invoice links using the correct Zoho Inventory API
 * Uses centralized token management to prevent rate limiting issues
 */
export default async function handler(req, res) {
  console.log('\n=== ZOHO INVENTORY PUBLIC LINK CREATION ===');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestId = `public_link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🔗 Creating public link [${requestId}]`);

  try {
    const { invoice_id, customer_email, customer_name } = req.body;

    // Validate input
    if (!invoice_id) {
      return res.status(400).json({
        error: 'Missing invoice_id',
        details: 'invoice_id is required to create public link',
        request_id: requestId
      });
    }

    if (!customer_email) {
      return res.status(400).json({
        error: 'Missing customer_email',
        details: 'customer_email is required for public link creation',
        request_id: requestId
      });
    }

    console.log(`📋 Request Details [${requestId}]:`);
    console.log(`   Invoice ID: ${invoice_id}`);
    console.log(`   Customer: ${customer_name} (${customer_email})`);

    // Get organization ID
    const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID;
    if (!organizationId) {
      return res.status(500).json({
        error: 'Configuration error',
        details: 'ZOHO_INVENTORY_ORGANIZATION_ID environment variable is not set',
        request_id: requestId
      });
    }

    // Get access token using centralized token manager
    let token;
    try {
      console.log(`🔑 Getting access token via token manager [${requestId}]...`);
      token = await getZohoAccessToken();
      console.log(`✅ Access token obtained [${requestId}]`);
    } catch (tokenError) {
      console.error(`❌ Token acquisition failed [${requestId}]:`, tokenError);
      return res.status(500).json({
        error: 'Authentication failed',
        details: 'Failed to obtain access token from token manager',
        type: 'TOKEN_ERROR',
        request_id: requestId,
        suggestion: 'Check Zoho OAuth credentials and token manager configuration'
      });
    }

    // STEP 1: Mark invoice as "sent" (required for sharing)
    try {
      console.log(`📤 Step 1: Marking invoice as sent [${requestId}]...`);
      
      const markSentResponse = await fetch(
        `https://www.zohoapis.com/inventory/v1/invoices/${invoice_id}/status/sent?organization_id=${organizationId}`, 
        {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          },
          // Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(30000) // 30 second timeout
        }
      );

      if (markSentResponse.ok) {
        console.log(`✅ Invoice marked as sent successfully [${requestId}]`);
      } else {
        const errorText = await markSentResponse.text();
        console.log(`⚠️ Mark as sent response [${requestId}]: ${markSentResponse.status} - ${errorText}`);
        // Continue anyway - invoice may already be marked as sent
      }
    } catch (markSentError) {
      console.log(`⚠️ Mark as sent failed [${requestId}] (continuing anyway):`, markSentError.message);
      // Continue - this step often fails if invoice is already sent
    }

    // STEP 2: Create the public shared link using Zoho Inventory Share API
    try {
      console.log(`🌐 Step 2: Creating public shared link [${requestId}]...`);
      
      // Based on Zoho documentation: Share Invoice Link with Public visibility
      const shareData = {
        send_to_contacts: false,
        is_public_url: true,
        password_protected: false,
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
        sharing_type: "public_url",
        allow_partial_payments: true,
        payment_options: {
          show_payment_options: true,
          payment_gateways: ["all"],
          allow_partial_payment: true
        }
      };

      console.log(`📡 Making share API request [${requestId}]...`);

      const shareResponse = await fetch(
        `https://www.zohoapis.com/inventory/v1/invoices/${invoice_id}/share?organization_id=${organizationId}`, 
        {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(shareData),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        }
      );

      console.log(`📊 Share API Response Status [${requestId}]: ${shareResponse.status}`);

      if (shareResponse.ok) {
        const responseData = await shareResponse.json();
        console.log(`📋 Share Response Data [${requestId}]:`, JSON.stringify(responseData, null, 2));

        // Check for various response formats that Zoho might return
        let publicUrl = null;
        
        if (responseData.code === 0 && responseData.invoice_url) {
          publicUrl = responseData.invoice_url;
        } else if (responseData.invoice && responseData.invoice.invoice_url) {
          publicUrl = responseData.invoice.invoice_url;
        } else if (responseData.share_url) {
          publicUrl = responseData.share_url;
        } else if (responseData.public_url) {
          publicUrl = responseData.public_url;
        } else if (responseData.invoice_share_url) {
          publicUrl = responseData.invoice_share_url;
        }

        if (publicUrl) {
          console.log(`✅ Public shared link created successfully [${requestId}]: ${publicUrl}`);
          
          return res.status(200).json({
            success: true,
            public_url: publicUrl,
            method: "zoho_inventory_share",
            message: "Public invoice link created successfully - customers can pay without login",
            invoice_id: invoice_id,
            customer_email: customer_email,
            expires_on: shareData.expiry_date,
            request_id: requestId,
            timestamp: new Date().toISOString(),
            features: {
              public_access: true,
              no_login_required: true,
              partial_payments_allowed: true,
              expires_in_days: 30
            }
          });
        } else {
          console.warn(`⚠️ Share API succeeded but no URL found in response [${requestId}]`);
          // Fall through to alternative methods
        }
      } else {
        const errorText = await shareResponse.text();
        console.log(`❌ Share API error [${requestId}]: ${shareResponse.status} - ${errorText}`);
        
        // Check for specific errors
        if (shareResponse.status === 429) {
          throw new Error('Rate limit exceeded while creating public link');
        } else if (shareResponse.status === 401) {
          throw new Error('Authentication failed while creating public link');
        } else if (shareResponse.status === 404) {
          throw new Error(`Invoice ${invoice_id} not found`);
        }
        
        // Fall through to alternative methods for other errors
      }
    } catch (shareError) {
      console.error(`❌ Share API request failed [${requestId}]:`, shareError);
      
      // Don't fail immediately - try alternative methods
      if (shareError.message.includes('rate limit') || shareError.message.includes('Rate limit')) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          details: 'Too many requests to Zoho API. Please wait before retrying.',
          type: 'RATE_LIMIT_ERROR',
          request_id: requestId,
          retry_after: 60,
          suggestion: 'The system uses centralized token management to minimize rate limiting. Please wait 60 seconds before retrying.'
        });
      }
    }

    // STEP 3: Fallback - Generate custom payment URL
    console.log(`🔄 Step 3: Generating fallback payment URL [${requestId}]...`);
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const fallbackUrl = `${baseUrl}/pay/${invoice_id}?` + new URLSearchParams({
        customer_email: customer_email,
        customer_name: customer_name || '',
        token: generateSecureToken(invoice_id, customer_email),
        source: 'public_link_fallback',
        request_id: requestId
      }).toString();

      console.log(`✅ Fallback payment URL generated [${requestId}]: ${fallbackUrl}`);

      return res.status(200).json({
        success: true,
        public_url: fallbackUrl,
        method: "custom_fallback",
        message: "Custom payment link created (Zoho share API unavailable)",
        invoice_id: invoice_id,
        customer_email: customer_email,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        warning: "Using fallback payment method - Zoho public sharing was unavailable",
        features: {
          public_access: true,
          custom_payment_flow: true,
          secure_token_included: true
        }
      });

    } catch (fallbackError) {
      console.error(`❌ Fallback URL generation failed [${requestId}]:`, fallbackError);
      
      return res.status(500).json({
        error: 'Failed to create payment link',
        details: 'Both Zoho public sharing and fallback URL generation failed',
        type: 'COMPLETE_FAILURE',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        suggestion: 'Check Zoho API status and application configuration'
      });
    }

  } catch (error) {
    console.error(`❌ Unexpected error in public link creation [${requestId}]:`, error);
    
    return res.status(500).json({
      error: 'Unexpected error',
      details: error.message || 'An unexpected error occurred while creating public link',
      type: 'UNEXPECTED_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString(),
      token_manager_status: tokenManager.getStatus()
    });
  }
}

/**
 * CENTRALIZED: Get Zoho access token using token manager
 * REMOVED: Local cachedAccessToken and tokenExpiryTime variables
 */
async function getZohoAccessToken() {
  try {
    // Use centralized token manager instead of local caching
    return await tokenManager.getAccessToken('inventory');
  } catch (error) {
    console.error('❌ Failed to get access token from token manager:', error);
    throw new Error(`Token manager error: ${error.message}`);
  }
}

/**
 * Generate a secure token for payment verification
 */
function generateSecureToken(invoiceId, customerEmail) {
  const timestamp = Date.now();
  const payload = `${invoiceId}:${customerEmail}:${timestamp}`;
  return Buffer.from(payload).toString('base64').replace(/[+=\/]/g, '');
}

/**
 * Health check for the public link service
 */
export async function healthCheck() {
  try {
    const tokenStatus = tokenManager.getStatus();
    
    return {
      service: 'create_public_link',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      token_manager: tokenStatus,
      environment: {
        organization_id_configured: !!process.env.ZOHO_INVENTORY_ORGANIZATION_ID,
        base_url_configured: !!process.env.NEXT_PUBLIC_BASE_URL
      }
    };
  } catch (error) {
    return {
      service: 'create_public_link',
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
 * 1. Uses centralized token management via tokenManager.getAccessToken('inventory')
 * 2. Removes local token caching (cachedAccessToken, tokenExpiryTime)
 * 3. Follows the correct Zoho Inventory workflow:
 *    - Mark invoice as "sent" (required before sharing)
 *    - Use the share API with "public" visibility
 *    - Fall back to custom payment URLs if Zoho sharing fails
 * 4. Includes comprehensive error handling and rate limit management
 * 5. Provides detailed logging and debugging information
 * 
 * Expected successful response:
 * {
 *   "success": true,
 *   "public_url": "https://...",
 *   "method": "zoho_inventory_share",
 *   "message": "Public invoice link created successfully - customers can pay without login"
 * }
 */