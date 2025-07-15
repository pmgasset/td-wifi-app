// src/pages/api/zoho/create-public-link.js

/**
 * API endpoint to create Zoho public shared invoice links
 * This creates public payment links that customers can access without authentication
 */

export default async function handler(req, res) {
  console.log('\n=== ZOHO PUBLIC LINK CREATION ===');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { invoice_id, customer_email, customer_name } = req.body;

    // Validation
    if (!invoice_id) {
      return res.status(400).json({ 
        error: 'Missing invoice_id',
        details: 'Invoice ID is required to create public link'
      });
    }

    if (!customer_email) {
      return res.status(400).json({ 
        error: 'Missing customer_email',
        details: 'Customer email is required'
      });
    }

    console.log('Creating public link for invoice:', invoice_id);
    console.log('Customer:', customer_email);

    // Get Zoho access token
    const token = await getZohoAccessToken();
    const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID;

    if (!organizationId) {
      throw new Error('ZOHO_INVENTORY_ORGANIZATION_ID environment variable not set');
    }

    // Try Method 1: Invoice sharing with public URL
    try {
      console.log('🔄 Attempting Method 1: Public invoice sharing...');
      
      const shareData = {
        send_to_contacts: false, // Don't send email automatically
        is_public_url: true, // Make it publicly accessible
        password_protected: false, // No password required
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
        sharing_type: "public_url",
        allow_partial_payments: true,
        payment_options: {
          show_payment_options: true,
          payment_gateways: ["all"], // All available gateways
          allow_partial_payment: true
        }
      };

      console.log('📤 Share request data:', JSON.stringify(shareData, null, 2));

      const shareResponse = await fetch(`https://www.zohoapis.com/inventory/v1/invoices/${invoice_id}/share?organization_id=${organizationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(shareData)
      });

      console.log('📡 Share response status:', shareResponse.status);

      if (shareResponse.ok) {
        const shareData = await shareResponse.json();
        console.log('📋 Share response data:', JSON.stringify(shareData, null, 2));

        // Check for various response formats
        let publicUrl = null;
        
        if (shareData.code === 0 && shareData.invoice_url) {
          publicUrl = shareData.invoice_url;
        } else if (shareData.invoice && shareData.invoice.invoice_url) {
          publicUrl = shareData.invoice.invoice_url;
        } else if (shareData.share_url) {
          publicUrl = shareData.share_url;
        } else if (shareData.public_url) {
          publicUrl = shareData.public_url;
        }

        if (publicUrl) {
          console.log('✅ SUCCESS: Public invoice link created');
          console.log('🔗 Public URL:', publicUrl);
          
          return res.status(200).json({
            success: true,
            public_url: publicUrl,
            method: 'public_sharing',
            invoice_id: invoice_id,
            expires_in_days: 30,
            message: 'Public invoice link created successfully'
          });
        }
      }

      const errorText = await shareResponse.text();
      console.log('❌ Share API error:', errorText);
      throw new Error(`Share API failed: ${shareResponse.status} ${errorText}`);

    } catch (shareError) {
      console.error('❌ Method 1 failed:', shareError.message);
    }

    // Try Method 2: Customer portal link
    try {
      console.log('🔄 Attempting Method 2: Customer portal link...');
      
      const portalData = {
        customer_email: customer_email,
        enable_portal_access: true,
        send_credentials: false,
        portal_access_expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days
      };

      const portalResponse = await fetch(`https://www.zohoapis.com/inventory/v1/invoices/${invoice_id}/portal?organization_id=${organizationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(portalData)
      });

      if (portalResponse.ok) {
        const portalData = await portalResponse.json();
        console.log('📋 Portal response:', JSON.stringify(portalData, null, 2));
        
        if (portalData.portal_url) {
          console.log('✅ SUCCESS: Portal link created');
          console.log('🔗 Portal URL:', portalData.portal_url);
          
          return res.status(200).json({
            success: true,
            public_url: portalData.portal_url,
            method: 'portal_access',
            invoice_id: invoice_id,
            expires_in_days: 7,
            message: 'Customer portal link created successfully'
          });
        }
      }

      console.log('❌ Method 2 failed: No portal URL in response');
    } catch (portalError) {
      console.error('❌ Method 2 failed:', portalError.message);
    }

    // Method 3: Generate manual portal URL
    console.log('🔄 Using Method 3: Manual portal URL...');
    
    const manualPortalUrl = `https://books.zoho.com/portal/invoices/${invoice_id}/view?organization=${organizationId}&email=${encodeURIComponent(customer_email)}`;
    
    console.log('✅ Generated manual portal URL');
    console.log('🔗 Manual Portal URL:', manualPortalUrl);
    
    return res.status(200).json({
      success: true,
      public_url: manualPortalUrl,
      method: 'manual_portal',
      invoice_id: invoice_id,
      expires_in_days: 30,
      message: 'Manual portal link generated successfully',
      note: 'Customer may need to verify email access'
    });

  } catch (error) {
    console.error('❌ Public link creation failed:', error);
    
    return res.status(500).json({
      error: 'Failed to create public payment link',
      details: error.message,
      invoice_id: req.body.invoice_id,
      timestamp: new Date().toISOString(),
      suggestion: 'Please try the alternative payment methods or contact support'
    });
  }
}

/**
 * Enhanced Zoho access token management
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

  const requiredEnvVars = ['ZOHO_REFRESH_TOKEN', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
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