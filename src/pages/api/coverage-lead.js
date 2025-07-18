// src/pages/api/coverage-lead.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('=== COVERAGE LEAD SUBMISSION ===');

  const { address, email, name, phone, primaryUse, currentProvider, dataUsage } = req.body;

  // Validate required fields
  if (!address || !email || !name || !primaryUse || !dataUsage) {
    return res.status(400).json({ 
      error: 'Missing required fields: address, email, name, primaryUse, and dataUsage are required' 
    });
  }

  try {
    // Get Zoho CRM access token
    const accessToken = await getZohoCRMAccessToken();
    
    // Format lead data for Zoho CRM
    const leadData = {
      data: [{
        Last_Name: name.split(' ').pop() || name,
        First_Name: name.split(' ').slice(0, -1).join(' ') || name,
        Email: email,
        Phone: phone || null,
        Company: 'Coverage Request', // Default company name
        Lead_Source: 'Coverage Map',
        Lead_Status: 'Coverage Analysis Requested',
        
        // Custom fields for coverage request
        Street: address,
        Coverage_Request_Type: primaryUse,
        Current_Provider: currentProvider || 'Not specified',
        Expected_Data_Usage: dataUsage,
        
        // Lead scoring and categorization
        Rating: determineLeadRating(primaryUse, dataUsage),
        Industry: mapPrimaryUseToIndustry(primaryUse),
        
        // Additional tracking
        Description: `Coverage analysis requested for ${address}. Primary use: ${primaryUse}. Expected usage: ${dataUsage}. Current provider: ${currentProvider || 'None specified'}.`,
        
        // Campaign tracking
        Lead_Campaign: 'Coverage Map 2025',
        UTM_Source: 'coverage-page',
        UTM_Medium: 'website',
        UTM_Campaign: 'coverage-analysis'
      }]
    };

    console.log('Submitting lead to Zoho CRM:', {
      email,
      name,
      primaryUse,
      address: address.substring(0, 50) + '...'
    });

    // Submit to Zoho CRM
    const crmResponse = await fetch('https://www.zohoapis.com/crm/v3/Leads', {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(leadData)
    });

    const crmData = await crmResponse.json();
    console.log('Zoho CRM Response:', {
      status: crmResponse.status,
      success: crmResponse.ok,
      data: crmData
    });

    if (!crmResponse.ok) {
      throw new Error(`Zoho CRM API error: ${crmData.message || 'Unknown error'}`);
    }

    // Check if lead was created successfully
    if (crmData.data && crmData.data[0] && crmData.data[0].status === 'success') {
      const leadId = crmData.data[0].details.id;
      
      console.log('✅ Lead created successfully:', leadId);

      // Optional: Send internal notification
      await sendInternalNotification({
        leadId,
        name,
        email,
        address,
        primaryUse,
        dataUsage
      });

      return res.status(200).json({
        success: true,
        message: 'Coverage request submitted successfully',
        leadId,
        estimatedResponseTime: '24 hours',
        nextSteps: [
          'Our team is analyzing coverage at your location',
          'You will receive a call within 24 hours',
          'Get personalized router and plan recommendations',
          'Free consultation with no obligation'
        ]
      });
    } else {
      throw new Error('Lead creation failed - no success status returned');
    }

  } catch (error) {
    console.error('❌ Coverage lead submission failed:', error);
    
    // Log the error but don't expose internal details
    return res.status(500).json({
      error: 'Failed to submit coverage request',
      message: 'We encountered an issue submitting your request. Please try again or contact support directly.',
      supportContact: {
        phone: '1-800-943-4781',
        email: 'coverage@traveldatawifi.com'
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get Zoho CRM access token with caching
 */
let crmTokenCache = null;
let crmTokenExpiry = 0;

async function getZohoCRMAccessToken() {
  // Check cache first
  if (crmTokenCache && Date.now() < crmTokenExpiry) {
    return crmTokenCache;
  }

  const requiredEnvVars = {
    ZOHO_CRM_CLIENT_ID: process.env.ZOHO_CRM_CLIENT_ID,
    ZOHO_CRM_CLIENT_SECRET: process.env.ZOHO_CRM_CLIENT_SECRET,
    ZOHO_CRM_REFRESH_TOKEN: process.env.ZOHO_CRM_REFRESH_TOKEN
  };

  // Check for missing environment variables
  const missingVars = Object.entries(requiredEnvVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(`Missing Zoho CRM environment variables: ${missingVars.join(', ')}`);
  }

  try {
    console.log('🔄 Refreshing Zoho CRM access token...');
    
    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: requiredEnvVars.ZOHO_CRM_REFRESH_TOKEN,
        client_id: requiredEnvVars.ZOHO_CRM_CLIENT_ID,
        client_secret: requiredEnvVars.ZOHO_CRM_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      throw new Error(`Zoho CRM token refresh failed: ${data.error || 'Unknown error'}`);
    }

    // Cache token for 50 minutes (expires in 1 hour)
    crmTokenCache = data.access_token;
    crmTokenExpiry = Date.now() + (50 * 60 * 1000);

    console.log('✅ Zoho CRM access token refreshed successfully');
    return data.access_token;

  } catch (error) {
    console.error('❌ Zoho CRM token refresh failed:', error);
    throw error;
  }
}

/**
 * Determine lead rating based on use case and data usage
 */
function determineLeadRating(primaryUse, dataUsage) {
  // High-value use cases
  const highValueUses = ['remote-work', 'digital-nomad'];
  const highValueData = ['heavy', 'unlimited'];
  
  if (highValueUses.includes(primaryUse) || highValueData.includes(dataUsage)) {
    return 'Hot';
  }
  
  if (primaryUse === 'rv-travel' || dataUsage === 'moderate') {
    return 'Warm';
  }
  
  return 'Cold';
}

/**
 * Map primary use case to industry for CRM categorization
 */
function mapPrimaryUseToIndustry(primaryUse) {
  const industryMap = {
    'rv-travel': 'Recreation/Travel',
    'remote-work': 'Technology/Remote Work',
    'digital-nomad': 'Technology/Remote Work',
    'home-backup': 'Residential',
    'rural-internet': 'Residential',
    'other': 'Other'
  };
  
  return industryMap[primaryUse] || 'Other';
}

/**
 * Send internal notification about new coverage lead
 */
async function sendInternalNotification(leadInfo) {
  try {
    // You could integrate with Slack, email, or other notification systems here
    console.log('📧 New coverage lead notification:', {
      name: leadInfo.name,
      email: leadInfo.email,
      location: leadInfo.address.substring(0, 50) + '...',
      useCase: leadInfo.primaryUse,
      priority: determineLeadRating(leadInfo.primaryUse, leadInfo.dataUsage)
    });
    
    // Example: Send to Slack webhook (optional)
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🗺️ New Coverage Lead: ${leadInfo.name} (${leadInfo.primaryUse}) - ${leadInfo.address}`
        })
      });
    }
  } catch (error) {
    console.error('Internal notification failed:', error);
    // Don't throw - this is non-critical
  }
}