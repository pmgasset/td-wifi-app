// src/pages/api/stripe/checkout-lead-webhook.js
/**
 * Stripe Checkout Lead Webhook Handler with Deduplication
 * 
 * Captures checkout data from Stripe payment_intent.created webhooks
 * and creates or updates leads in Zoho CRM for marketing/sales follow-up
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('\n=== STRIPE CHECKOUT LEAD WEBHOOK ===');

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!sig) {
    console.error('❌ No stripe-signature header found');
    return res.status(400).json({ error: 'No stripe-signature header' });
  }

  let event;

  try {
    // Get raw body for signature verification
    const rawBody = await getRawBody(req);
    
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    console.log('✅ Webhook signature verified');
    console.log('Event type:', event.type);
    
  } catch (err) {
    console.error(`❌ Webhook signature verification failed:`, err.message);
    return res.status(400).json({ 
      error: 'Webhook signature verification failed',
      details: err.message
    });
  }

  // Handle payment_intent.created event for lead capture
  if (event.type === 'payment_intent.created') {
    const paymentIntent = event.data.object;
    console.log(`\n=== PAYMENT INTENT CREATED [${paymentIntent.id}] ===`);
    
    try {
      // Extract checkout data from payment intent metadata
      const leadData = extractLeadDataFromPaymentIntent(paymentIntent);
      
      if (!leadData) {
        console.log('⚠️ No lead data found in payment intent metadata, skipping');
        return res.json({ received: true, status: 'no_lead_data' });
      }

      // Create or update lead in Zoho CRM using sub-agent
      console.log('🔄 Sub-agent: Creating/updating lead in Zoho CRM...');
      const crmResult = await createZohoCRMLead(leadData);
      
      console.log('✅ Lead operation completed successfully in Zoho CRM');
      console.log(`📋 Lead ID: ${crmResult.leadId}, Status: ${crmResult.status}`);
      
      // Update payment intent with lead tracking
      await stripe.paymentIntents.update(paymentIntent.id, {
        metadata: {
          ...paymentIntent.metadata,
          zoho_crm_lead_id: crmResult.leadId,
          lead_created_at: new Date().toISOString(),
          lead_webhook_processed: 'true',
          lead_operation: crmResult.status // 'created' or 'updated'
        }
      });
      
      return res.json({ 
        received: true, 
        status: crmResult.status,
        lead_id: crmResult.leadId,
        payment_intent_id: paymentIntent.id,
        is_update: crmResult.isUpdate || false
      });
      
    } catch (error) {
      console.error('❌ Lead operation failed:', error);
      
      // Update payment intent with error info
      try {
        await stripe.paymentIntents.update(paymentIntent.id, {
          metadata: {
            ...paymentIntent.metadata,
            lead_creation_error: error.message.substring(0, 499),
            lead_webhook_processed: 'error',
            error_timestamp: new Date().toISOString()
          }
        });
      } catch (updateError) {
        console.error('❌ Failed to update payment intent with error:', updateError);
      }
      
      return res.status(500).json({
        error: 'Lead operation failed',
        details: error.message,
        payment_intent_id: paymentIntent.id
      });
    }
  }

  // Handle other relevant events
  else if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(`\n=== CHECKOUT SESSION COMPLETED [${session.id}] ===`);
    
    try {
      // Get the payment intent for this session
      const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
      
      // Update lead status if it exists
      if (paymentIntent.metadata?.zoho_crm_lead_id) {
        console.log('🔄 Sub-agent: Updating lead status to "Payment Completed"...');
        
        await updateZohoCRMLeadStatus(
          paymentIntent.metadata.zoho_crm_lead_id,
          'Payment Completed',
          `Checkout completed. Session: ${session.id}, Amount: ${(session.amount_total / 100).toFixed(2)}`
        );
        
        console.log('✅ Lead status updated to Payment Completed');
      }
      
      return res.json({ 
        received: true, 
        status: 'lead_updated',
        session_id: session.id
      });
      
    } catch (error) {
      console.error('❌ Lead status update failed:', error);
      return res.status(500).json({
        error: 'Lead update failed',
        details: error.message
      });
    }
  }

  // Handle payment_intent.succeeded for lead status updates
  else if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log(`\n=== PAYMENT INTENT SUCCEEDED [${paymentIntent.id}] ===`);
    
    try {
      // Update lead status if it exists
      if (paymentIntent.metadata?.zoho_crm_lead_id) {
        console.log('🔄 Sub-agent: Updating lead status to "Payment Completed"...');
        
        await updateZohoCRMLeadStatus(
          paymentIntent.metadata.zoho_crm_lead_id,
          'Payment Completed',
          `Payment succeeded. Amount: ${(paymentIntent.amount / 100).toFixed(2)}, Payment Intent: ${paymentIntent.id}`
        );
        
        console.log('✅ Lead status updated to Payment Completed');
      }
      
      return res.json({ 
        received: true, 
        status: 'lead_updated',
        payment_intent_id: paymentIntent.id
      });
      
    } catch (error) {
      console.error('❌ Lead status update failed:', error);
      return res.status(500).json({
        error: 'Lead update failed',
        details: error.message
      });
    }
  }

  // Unhandled event type
  else {
    console.log(`⚠️ Unhandled event type: ${event.type}`);
    return res.json({ received: true, status: 'unhandled_event' });
  }
}

/**
 * SUB-AGENT: Extract lead data from Stripe Payment Intent
 */
function extractLeadDataFromPaymentIntent(paymentIntent) {
  const metadata = paymentIntent.metadata || {};
  
  // Check if we have customer data in metadata
  if (!metadata.customer_email) {
    console.log('⚠️ No customer email found in payment intent metadata');
    return null;
  }

  // Extract lead information
  const leadData = {
    // Customer info (required)
    email: metadata.customer_email,
    firstName: metadata.customer_first_name || '',
    lastName: metadata.customer_last_name || '',
    phone: metadata.customer_phone || null,
    
    // Payment/order info
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount / 100, // Convert from cents
    currency: paymentIntent.currency.toUpperCase(),
    
    // Address info
    shippingAddress: {
      address1: metadata.shipping_address1 || '',
      address2: metadata.shipping_address2 || '',
      city: metadata.shipping_city || '',
      state: metadata.shipping_state || '',
      zipCode: metadata.shipping_zip || '',
      country: metadata.shipping_country || 'US'
    },
    
    // Cart/product info
    cartItems: parseCartItemsFromMetadata(metadata),
    
    // Additional context
    requestId: metadata.request_id || null,
    orderNotes: metadata.order_notes || '',
    createAccount: metadata.create_account === 'true',
    
    // Timestamps
    createdAt: new Date(paymentIntent.created * 1000),
    
    // Lead source tracking
    leadSource: 'Stripe Checkout',
    campaign: metadata.utm_campaign || 'Direct Checkout',
    medium: metadata.utm_medium || 'website',
    source: metadata.utm_source || 'checkout-page'
  };

  console.log('📋 Extracted lead data:', {
    email: leadData.email,
    name: `${leadData.firstName} ${leadData.lastName}`,
    amount: leadData.amount,
    itemCount: leadData.cartItems?.length || 0
  });

  return leadData;
}

/**
 * SUB-AGENT: Parse cart items from metadata
 */
function parseCartItemsFromMetadata(metadata) {
  try {
    const cartItemsJson = metadata.cart_items;
    if (!cartItemsJson) return [];
    
    const cartItems = JSON.parse(cartItemsJson);
    
    return cartItems.map(item => ({
      productId: item.product_id,
      productName: item.product_name || item.name,
      price: parseFloat(item.product_price || item.price || 0),
      quantity: parseInt(item.quantity || 1),
      total: parseFloat(item.product_price || item.price || 0) * parseInt(item.quantity || 1)
    }));
    
  } catch (error) {
    console.warn('⚠️ Failed to parse cart items from metadata:', error);
    return [];
  }
}

/**
 * SUB-AGENT: Create or update lead in Zoho CRM (with deduplication)
 */
async function createZohoCRMLead(leadData) {
  // Get Zoho CRM access token
  const accessToken = await getZohoCRMAccessToken();
  
  // Determine lead priority based on cart value and items
  const leadRating = determineLeadRatingFromCart(leadData.amount, leadData.cartItems);
  const industry = determineIndustryFromProducts(leadData.cartItems);
  
  // STEP 1: Check if lead already exists by email
  console.log('🔍 Checking for existing lead with email:', leadData.email);
  const existingLead = await findExistingLeadByEmail(leadData.email, accessToken);
  
  if (existingLead) {
    console.log('📝 Existing lead found, updating instead of creating new one');
    console.log('Existing Lead ID:', existingLead.id);
    return await updateExistingLead(existingLead, leadData, leadRating, industry, accessToken);
  } else {
    console.log('🆕 No existing lead found, creating new lead');
    return await createNewLead(leadData, leadRating, industry, accessToken);
  }
}

/**
 * SUB-AGENT: Find existing lead by email address
 */
async function findExistingLeadByEmail(email, accessToken) {
  try {
    console.log('🔍 Searching for existing lead with email:', email);
    
    // Search for leads with matching email
    const searchResponse = await fetch(
      `https://www.zohoapis.com/crm/v3/Leads/search?criteria=(Email:equals:${encodeURIComponent(email)})`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!searchResponse.ok) {
      if (searchResponse.status === 204) {
        // No leads found (204 No Content is normal response)
        console.log('✅ No existing lead found for email:', email);
        return null;
      }
      
      const errorData = await searchResponse.text();
      console.warn('⚠️ Lead search failed:', searchResponse.status, errorData);
      return null; // Continue with creation if search fails
    }

    const searchResult = await searchResponse.json();
    
    if (searchResult.data && searchResult.data.length > 0) {
      const existingLead = searchResult.data[0]; // Take the first match
      console.log('✅ Found existing lead:', {
        id: existingLead.id,
        email: existingLead.Email,
        name: `${existingLead.First_Name || ''} ${existingLead.Last_Name || ''}`.trim(),
        status: existingLead.Lead_Status,
        rating: existingLead.Rating
      });
      return existingLead;
    }
    
    console.log('✅ No existing lead found for email:', email);
    return null;
    
  } catch (error) {
    console.error('❌ Error searching for existing lead:', error);
    // Don't throw - continue with creation if search fails
    return null;
  }
}

/**
 * SUB-AGENT: Update existing lead with new checkout data
 */
async function updateExistingLead(existingLead, leadData, leadRating, industry, accessToken) {
  try {
    console.log('📝 Updating existing lead with new checkout data...');
    
    // Determine if this is a higher value interaction
    const existingAmount = parseFloat(existingLead.Checkout_Amount || 0);
    const isHigherValue = leadData.amount > existingAmount;
    const shouldUpgradeRating = shouldUpgradeLeadRating(existingLead.Rating, leadRating);
    
    // Prepare update data - only update specific fields, preserve others
    const updateData = {
      data: [{
        id: existingLead.id,
        
        // Always update these checkout-specific fields
        Checkout_Amount: Math.max(leadData.amount, existingAmount), // Keep highest amount
        Payment_Intent_ID: leadData.paymentIntentId, // Always update to latest
        Cart_Items_Count: leadData.cartItems?.length || 0,
        Product_Interest: formatProductInterest(leadData.cartItems),
        
        // Update contact info if new data is more complete
        Phone: leadData.phone || existingLead.Phone,
        
        // Update address if provided and not already set
        Street: leadData.shippingAddress.address1 && !existingLead.Street ? 
          `${leadData.shippingAddress.address1} ${leadData.shippingAddress.address2}`.trim() : 
          existingLead.Street,
        City: leadData.shippingAddress.city || existingLead.City,
        State: leadData.shippingAddress.state || existingLead.State,
        Zip_Code: leadData.shippingAddress.zipCode || existingLead.Zip_Code,
        Country: leadData.shippingAddress.country || existingLead.Country,
        
        // Upgrade rating if this is a higher value interaction
        Rating: shouldUpgradeRating ? leadRating : existingLead.Rating,
        
        // Update status to show recent activity
        Lead_Status: determineUpdatedLeadStatus(existingLead.Lead_Status),
        
        // Update campaign data if provided
        UTM_Source: leadData.source || existingLead.UTM_Source,
        UTM_Medium: leadData.medium || existingLead.UTM_Medium,
        UTM_Campaign: leadData.campaign || existingLead.UTM_Campaign,
        
        // Account creation intent
        Account_Creation_Intent: leadData.createAccount ? 'Yes' : (existingLead.Account_Creation_Intent || 'No'),
        
        // Append to description with new checkout info
        Description: appendToLeadDescription(existingLead.Description, leadData, isHigherValue)
      }]
    };

    console.log('📤 Updating lead in Zoho CRM:', {
      leadId: existingLead.id,
      email: leadData.email,
      previousAmount: existingAmount,
      newAmount: leadData.amount,
      isHigherValue,
      shouldUpgradeRating
    });

    // Update the lead
    const updateResponse = await fetch('https://www.zohoapis.com/crm/v3/Leads', {
      method: 'PUT',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const updateResult = await updateResponse.json();
    console.log('Zoho CRM Update Response:', {
      status: updateResponse.status,
      success: updateResponse.ok,
      data: updateResult
    });

    if (!updateResponse.ok) {
      throw new Error(`Zoho CRM lead update failed: ${updateResult.message || 'Unknown error'}`);
    }

    // Check if update was successful
    if (updateResult.data && updateResult.data[0] && updateResult.data[0].status === 'success') {
      console.log('✅ Lead updated successfully:', existingLead.id);

      // Send notification about updated lead
      await sendCheckoutLeadNotification({
        ...leadData,
        isUpdate: true,
        previousAmount: existingAmount,
        previousRating: existingLead.Rating
      }, existingLead.id);

      return {
        leadId: existingLead.id,
        status: 'updated',
        rating: shouldUpgradeRating ? leadRating : existingLead.Rating,
        amount: Math.max(leadData.amount, existingAmount),
        isUpdate: true,
        previousAmount: existingAmount
      };
    } else {
      throw new Error('Lead update failed - no success status returned');
    }
    
  } catch (error) {
    console.error('❌ Error updating existing lead:', error);
    throw error;
  }
}

/**
 * SUB-AGENT: Create new lead in Zoho CRM
 */
async function createNewLead(leadData, leadRating, industry, accessToken) {
  // Format lead data for Zoho CRM
  const crmLeadData = {
    data: [{
      // Basic contact info
      Last_Name: leadData.lastName || 'Checkout User',
      First_Name: leadData.firstName || '',
      Email: leadData.email,
      Phone: leadData.phone || null,
      Company: `${leadData.firstName} ${leadData.lastName}`.trim() || 'Checkout Customer',
      
      // Lead categorization
      Lead_Source: leadData.leadSource,
      Lead_Status: 'Checkout Started',
      Rating: leadRating,
      Industry: industry,
      
      // Address information
      Street: `${leadData.shippingAddress.address1} ${leadData.shippingAddress.address2}`.trim(),
      City: leadData.shippingAddress.city,
      State: leadData.shippingAddress.state,
      Zip_Code: leadData.shippingAddress.zipCode,
      Country: leadData.shippingAddress.country,
      
      // Purchase intent data
      Annual_Revenue: leadData.amount * 12, // Estimate annual value
      No_of_Employees: determineCompanySizeFromCart(leadData.cartItems),
      
      // Custom fields for checkout data
      Checkout_Amount: leadData.amount,
      Payment_Intent_ID: leadData.paymentIntentId,
      Cart_Items_Count: leadData.cartItems?.length || 0,
      Product_Interest: formatProductInterest(leadData.cartItems),
      
      // Campaign tracking
      Lead_Campaign: leadData.campaign,
      UTM_Source: leadData.source,
      UTM_Medium: leadData.medium,
      UTM_Campaign: leadData.campaign,
      
      // Notes with detailed context
      Description: formatLeadDescription(leadData),
      
      // Additional tracking
      Account_Creation_Intent: leadData.createAccount ? 'Yes' : 'No',
      Order_Notes: leadData.orderNotes || null
    }]
  };

  console.log('📤 Creating new lead in Zoho CRM:', {
    email: leadData.email,
    name: `${leadData.firstName} ${leadData.lastName}`,
    amount: leadData.amount,
    rating: leadRating
  });

  // Submit to Zoho CRM
  const crmResponse = await fetch('https://www.zohoapis.com/crm/v3/Leads', {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(crmLeadData)
  });

  const crmResult = await crmResponse.json();
  console.log('Zoho CRM Response:', {
    status: crmResponse.status,
    success: crmResponse.ok,
    data: crmResult
  });

  if (!crmResponse.ok) {
    throw new Error(`Zoho CRM API error: ${crmResult.message || 'Unknown error'}`);
  }

  // Check if lead was created successfully
  if (crmResult.data && crmResult.data[0] && crmResult.data[0].status === 'success') {
    const leadId = crmResult.data[0].details.id;
    
    console.log('✅ New lead created successfully:', leadId);

    // Send internal notification (optional)
    await sendCheckoutLeadNotification({
      ...leadData,
      isUpdate: false
    }, leadId);

    return {
      leadId,
      status: 'created',
      rating: leadRating,
      amount: leadData.amount,
      isUpdate: false
    };
  } else {
    throw new Error('Lead creation failed - no success status returned');
  }
}

/**
 * SUB-AGENT: Update lead status in Zoho CRM
 */
async function updateZohoCRMLeadStatus(leadId, status, notes) {
  const accessToken = await getZohoCRMAccessToken();
  
  const updateData = {
    data: [{
      id: leadId,
      Lead_Status: status,
      Description: notes
    }]
  };

  const response = await fetch(`https://www.zohoapis.com/crm/v3/Leads`, {
    method: 'PUT',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to update lead status: ${error.message || 'Unknown error'}`);
  }

  return await response.json();
}

/**
 * Get Zoho CRM access token (reuse from coverage-lead.js)
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
 * Utility functions for lead scoring and categorization
 */
function determineLeadRatingFromCart(amount, cartItems) {
  // High-value purchases
  if (amount >= 500) return 'Hot';
  if (amount >= 200) return 'Warm';
  
  // Multiple items indicate serious interest
  if (cartItems && cartItems.length >= 3) return 'Warm';
  
  return 'Cold';
}

function determineIndustryFromProducts(cartItems) {
  if (!cartItems || cartItems.length === 0) return 'Technology';
  
  // Analyze product names to determine industry
  const productNames = cartItems.map(item => 
    (item.productName || '').toLowerCase()
  ).join(' ');
  
  if (productNames.includes('router') || productNames.includes('hotspot')) {
    return 'Telecommunications';
  }
  if (productNames.includes('mobile') || productNames.includes('data')) {
    return 'Mobile Technology';
  }
  
  return 'Technology';
}

function determineCompanySizeFromCart(cartItems) {
  if (!cartItems || cartItems.length === 0) return 1;
  
  // Estimate company size based on quantities
  const totalQuantity = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  
  if (totalQuantity >= 10) return 50;
  if (totalQuantity >= 5) return 25;
  if (totalQuantity >= 2) return 10;
  
  return 1;
}

function formatProductInterest(cartItems) {
  if (!cartItems || cartItems.length === 0) return 'General Interest';
  
  return cartItems
    .map(item => item.productName)
    .filter(Boolean)
    .join(', ')
    .substring(0, 255); // CRM field limit
}

function formatLeadDescription(leadData) {
  const lines = [
    `Checkout initiated for ${leadData.amount.toFixed(2)} via Stripe`,
    `Payment Intent: ${leadData.paymentIntentId}`,
    ''
  ];
  
  if (leadData.cartItems && leadData.cartItems.length > 0) {
    lines.push('Cart Items:');
    leadData.cartItems.forEach(item => {
      lines.push(`- ${item.productName}: ${item.quantity}x ${item.price.toFixed(2)}`);
    });
    lines.push('');
  }
  
  if (leadData.orderNotes) {
    lines.push(`Notes: ${leadData.orderNotes}`);
    lines.push('');
  }
  
  lines.push(`Checkout started: ${leadData.createdAt.toISOString()}`);
  
  return lines.join('\n').substring(0, 2000); // CRM field limit
}

/**
 * Utility function to determine if lead rating should be upgraded
 */
function shouldUpgradeLeadRating(currentRating, newRating) {
  const ratingPriority = { 'Hot': 3, 'Warm': 2, 'Cold': 1 };
  
  const currentPriority = ratingPriority[currentRating] || 0;
  const newPriority = ratingPriority[newRating] || 0;
  
  return newPriority > currentPriority;
}

/**
 * Determine updated lead status based on current status
 */
function determineUpdatedLeadStatus(currentStatus) {
  // Don't downgrade certain statuses
  const preserveStatuses = [
    'Payment Completed',
    'Customer',
    'Converted',
    'Qualified',
    'Contacted'
  ];
  
  if (preserveStatuses.includes(currentStatus)) {
    return currentStatus;
  }
  
  // Update to show recent activity
  return 'Checkout Started';
}

/**
 * Append new checkout information to existing lead description
 */
function appendToLeadDescription(existingDescription, leadData, isHigherValue) {
  const newEntry = [
    `\n--- Additional Checkout Activity (${new Date().toISOString()}) ---`,
    `New checkout for ${leadData.amount.toFixed(2)} via Stripe`,
    `Payment Intent: ${leadData.paymentIntentId}`,
  ];
  
  if (isHigherValue) {
    newEntry.push('⭐ HIGHER VALUE INTERACTION');
  }
  
  if (leadData.cartItems && leadData.cartItems.length > 0) {
    newEntry.push('Cart Items:');
    leadData.cartItems.forEach(item => {
      newEntry.push(`- ${item.productName}: ${item.quantity}x ${item.price.toFixed(2)}`);
    });
  }
  
  if (leadData.orderNotes) {
    newEntry.push(`Notes: ${leadData.orderNotes}`);
  }
  
  const appendText = newEntry.join('\n');
  const combinedDescription = (existingDescription || '') + appendText;
  
  // Truncate if too long (CRM field limit)
  return combinedDescription.substring(0, 2000);
}

/**
 * Send internal notification about new or updated checkout lead
 */
async function sendCheckoutLeadNotification(leadData, leadId) {
  try {
    console.log('📧 Sending checkout lead notification...');
    
    const notificationData = {
      leadId,
      email: leadData.email,
      amount: leadData.amount,
      items: leadData.cartItems?.length || 0,
      timestamp: new Date().toISOString(),
      isUpdate: leadData.isUpdate || false
    };
    
    if (leadData.isUpdate) {
      // Enhanced notification for updated leads
      console.log('🔔 Checkout Lead Updated:', {
        ...notificationData,
        previousAmount: leadData.previousAmount,
        previousRating: leadData.previousRating,
        amountIncrease: leadData.amount - (leadData.previousAmount || 0),
        isHigherValue: leadData.amount > (leadData.previousAmount || 0)
      });
      
      // TODO: Send enhanced notification for updated leads
      // This could trigger different workflows for returning customers
      // await sendSlackNotification({
      //   type: 'lead_updated',
      //   message: `🔄 Returning customer ${leadData.email} started new checkout for ${leadData.amount} (previous: ${leadData.previousAmount})`
      // });
      
    } else {
      // Standard notification for new leads
      console.log('🔔 New Checkout Lead Created:', notificationData);
      
      // TODO: Send standard new lead notification
      // await sendSlackNotification({
      //   type: 'lead_created',
      //   message: `🆕 New checkout lead: ${leadData.email} - ${leadData.amount} (${leadData.cartItems?.length || 0} items)`
      // });
    }
    
  } catch (error) {
    console.warn('⚠️ Failed to send checkout lead notification:', error);
    // Don't throw - notification failure shouldn't break the main flow
  }
}

/**
 * Helper function to get raw body for webhook signature verification
 */
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Configure Next.js to provide raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};// src/pages/api/stripe/checkout-lead-webhook.js
/**
 * Stripe Checkout Lead Webhook Handler
 * 
 * Captures checkout data from Stripe payment_intent.created webhooks
 * and creates leads in Zoho CRM for marketing/sales follow-up
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('\n=== STRIPE CHECKOUT LEAD WEBHOOK ===');

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!sig) {
    console.error('❌ No stripe-signature header found');
    return res.status(400).json({ error: 'No stripe-signature header' });
  }

  let event;

  try {
    // Get raw body for signature verification
    const rawBody = await getRawBody(req);
    
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    console.log('✅ Webhook signature verified');
    console.log('Event type:', event.type);
    
  } catch (err) {
    console.error(`❌ Webhook signature verification failed:`, err.message);
    return res.status(400).json({ 
      error: 'Webhook signature verification failed',
      details: err.message
    });
  }

  // Handle payment_intent.created event for lead capture
  if (event.type === 'payment_intent.created') {
    const paymentIntent = event.data.object;
    console.log(`\n=== PAYMENT INTENT CREATED [${paymentIntent.id}] ===`);
    
    try {
      // Extract checkout data from payment intent metadata
      const leadData = extractLeadDataFromPaymentIntent(paymentIntent);
      
      if (!leadData) {
        console.log('⚠️ No lead data found in payment intent metadata, skipping');
        return res.json({ received: true, status: 'no_lead_data' });
      }

      // Create lead in Zoho CRM using sub-agent
      console.log('🔄 Sub-agent: Creating lead in Zoho CRM...');
      const crmResult = await createZohoCRMLead(leadData);
      
      console.log('✅ Lead created successfully in Zoho CRM');
      console.log(`📋 Lead ID: ${crmResult.leadId}`);
      
      // Optionally update payment intent with lead tracking
      await stripe.paymentIntents.update(paymentIntent.id, {
        metadata: {
          ...paymentIntent.metadata,
          zoho_crm_lead_id: crmResult.leadId,
          lead_created_at: new Date().toISOString(),
          lead_webhook_processed: 'true'
        }
      });
      
      return res.json({ 
        received: true, 
        status: 'lead_created',
        lead_id: crmResult.leadId,
        payment_intent_id: paymentIntent.id
      });
      
    } catch (error) {
      console.error('❌ Lead creation failed:', error);
      
      // Update payment intent with error info
      try {
        await stripe.paymentIntents.update(paymentIntent.id, {
          metadata: {
            ...paymentIntent.metadata,
            lead_creation_error: error.message.substring(0, 499),
            lead_webhook_processed: 'error',
            error_timestamp: new Date().toISOString()
          }
        });
      } catch (updateError) {
        console.error('❌ Failed to update payment intent with error:', updateError);
      }
      
      return res.status(500).json({
        error: 'Lead creation failed',
        details: error.message,
        payment_intent_id: paymentIntent.id
      });
    }
  }

  // Handle other relevant events
  else if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(`\n=== CHECKOUT SESSION COMPLETED [${session.id}] ===`);
    
    try {
      // Get the payment intent for this session
      const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
      
      // Update lead status if it exists
      if (paymentIntent.metadata?.zoho_crm_lead_id) {
        console.log('🔄 Sub-agent: Updating lead status to "Payment Completed"...');
        
        await updateZohoCRMLeadStatus(
          paymentIntent.metadata.zoho_crm_lead_id,
          'Payment Completed',
          `Checkout completed. Session: ${session.id}, Amount: $${(session.amount_total / 100).toFixed(2)}`
        );
        
        console.log('✅ Lead status updated to Payment Completed');
      }
      
      return res.json({ 
        received: true, 
        status: 'lead_updated',
        session_id: session.id
      });
      
    } catch (error) {
      console.error('❌ Lead status update failed:', error);
      return res.status(500).json({
        error: 'Lead update failed',
        details: error.message
      });
    }
  }

  // Unhandled event type
  else {
    console.log(`⚠️ Unhandled event type: ${event.type}`);
    return res.json({ received: true, status: 'unhandled_event' });
  }
}

/**
 * SUB-AGENT: Extract lead data from Stripe Payment Intent
 */
function extractLeadDataFromPaymentIntent(paymentIntent) {
  const metadata = paymentIntent.metadata || {};
  
  // Check if we have customer data in metadata
  if (!metadata.customer_email) {
    console.log('⚠️ No customer email found in payment intent metadata');
    return null;
  }

  // Extract lead information
  const leadData = {
    // Customer info (required)
    email: metadata.customer_email,
    firstName: metadata.customer_first_name || '',
    lastName: metadata.customer_last_name || '',
    phone: metadata.customer_phone || null,
    
    // Payment/order info
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount / 100, // Convert from cents
    currency: paymentIntent.currency.toUpperCase(),
    
    // Address info
    shippingAddress: {
      address1: metadata.shipping_address1 || '',
      address2: metadata.shipping_address2 || '',
      city: metadata.shipping_city || '',
      state: metadata.shipping_state || '',
      zipCode: metadata.shipping_zip || '',
      country: metadata.shipping_country || 'US'
    },
    
    // Cart/product info
    cartItems: parseCartItemsFromMetadata(metadata),
    
    // Additional context
    requestId: metadata.request_id || null,
    orderNotes: metadata.order_notes || '',
    createAccount: metadata.create_account === 'true',
    
    // Timestamps
    createdAt: new Date(paymentIntent.created * 1000),
    
    // Lead source tracking
    leadSource: 'Stripe Checkout',
    campaign: metadata.utm_campaign || 'Direct Checkout',
    medium: metadata.utm_medium || 'website',
    source: metadata.utm_source || 'checkout-page'
  };

  console.log('📋 Extracted lead data:', {
    email: leadData.email,
    name: `${leadData.firstName} ${leadData.lastName}`,
    amount: leadData.amount,
    itemCount: leadData.cartItems?.length || 0
  });

  return leadData;
}

/**
 * SUB-AGENT: Parse cart items from metadata
 */
function parseCartItemsFromMetadata(metadata) {
  try {
    const cartItemsJson = metadata.cart_items;
    if (!cartItemsJson) return [];
    
    const cartItems = JSON.parse(cartItemsJson);
    
    return cartItems.map(item => ({
      productId: item.product_id,
      productName: item.product_name || item.name,
      price: parseFloat(item.product_price || item.price || 0),
      quantity: parseInt(item.quantity || 1),
      total: parseFloat(item.product_price || item.price || 0) * parseInt(item.quantity || 1)
    }));
    
  } catch (error) {
    console.warn('⚠️ Failed to parse cart items from metadata:', error);
    return [];
  }
}

/**
 * SUB-AGENT: Create or update lead in Zoho CRM (with deduplication)
 */
async function createZohoCRMLead(leadData) {
  // Get Zoho CRM access token (reuse from existing coverage-lead.js)
  const accessToken = await getZohoCRMAccessToken();
  
  // Determine lead priority based on cart value and items
  const leadRating = determineLeadRatingFromCart(leadData.amount, leadData.cartItems);
  const industry = determineIndustryFromProducts(leadData.cartItems);
  
  // STEP 1: Check if lead already exists by email
  console.log('🔍 Checking for existing lead with email:', leadData.email);
  const existingLead = await findExistingLeadByEmail(leadData.email, accessToken);
  
  if (existingLead) {
    console.log('📝 Existing lead found, updating instead of creating new one');
    console.log('Existing Lead ID:', existingLead.id);
    return await updateExistingLead(existingLead, leadData, leadRating, industry, accessToken);
  } else {
    console.log('🆕 No existing lead found, creating new lead');
    return await createNewLead(leadData, leadRating, industry, accessToken);
  }
}

/**
 * SUB-AGENT: Find existing lead by email address
 */
async function findExistingLeadByEmail(email, accessToken) {
  try {
    console.log('🔍 Searching for existing lead with email:', email);
    
    // Search for leads with matching email
    const searchResponse = await fetch(
      `https://www.zohoapis.com/crm/v3/Leads/search?criteria=(Email:equals:${encodeURIComponent(email)})`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!searchResponse.ok) {
      if (searchResponse.status === 204) {
        // No leads found (204 No Content is normal response)
        console.log('✅ No existing lead found for email:', email);
        return null;
      }
      
      const errorData = await searchResponse.text();
      console.warn('⚠️ Lead search failed:', searchResponse.status, errorData);
      return null; // Continue with creation if search fails
    }

    const searchResult = await searchResponse.json();
    
    if (searchResult.data && searchResult.data.length > 0) {
      const existingLead = searchResult.data[0]; // Take the first match
      console.log('✅ Found existing lead:', {
        id: existingLead.id,
        email: existingLead.Email,
        name: `${existingLead.First_Name || ''} ${existingLead.Last_Name || ''}`.trim(),
        status: existingLead.Lead_Status,
        rating: existingLead.Rating
      });
      return existingLead;
    }
    
    console.log('✅ No existing lead found for email:', email);
    return null;
    
  } catch (error) {
    console.error('❌ Error searching for existing lead:', error);
    // Don't throw - continue with creation if search fails
    return null;
  }
}

/**
 * SUB-AGENT: Update existing lead with new checkout data
 */
async function updateExistingLead(existingLead, leadData, leadRating, industry, accessToken) {
  try {
    console.log('📝 Updating existing lead with new checkout data...');
    
    // Determine if this is a higher value interaction
    const existingAmount = parseFloat(existingLead.Checkout_Amount || 0);
    const isHigherValue = leadData.amount > existingAmount;
    const shouldUpgradeRating = shouldUpgradeLeadRating(existingLead.Rating, leadRating);
    
    // Prepare update data - only update specific fields, preserve others
    const updateData = {
      data: [{
        id: existingLead.id,
        
        // Always update these checkout-specific fields
        Checkout_Amount: Math.max(leadData.amount, existingAmount), // Keep highest amount
        Payment_Intent_ID: leadData.paymentIntentId, // Always update to latest
        Cart_Items_Count: leadData.cartItems?.length || 0,
        Product_Interest: formatProductInterest(leadData.cartItems),
        
        // Update contact info if new data is more complete
        Phone: leadData.phone || existingLead.Phone,
        
        // Update address if provided and not already set
        Street: leadData.shippingAddress.address1 && !existingLead.Street ? 
          `${leadData.shippingAddress.address1} ${leadData.shippingAddress.address2}`.trim() : 
          existingLead.Street,
        City: leadData.shippingAddress.city || existingLead.City,
        State: leadData.shippingAddress.state || existingLead.State,
        Zip_Code: leadData.shippingAddress.zipCode || existingLead.Zip_Code,
        Country: leadData.shippingAddress.country || existingLead.Country,
        
        // Upgrade rating if this is a higher value interaction
        Rating: shouldUpgradeRating ? leadRating : existingLead.Rating,
        
        // Update status to show recent activity
        Lead_Status: determineUpdatedLeadStatus(existingLead.Lead_Status),
        
        // Update campaign data if provided
        UTM_Source: leadData.source || existingLead.UTM_Source,
        UTM_Medium: leadData.medium || existingLead.UTM_Medium,
        UTM_Campaign: leadData.campaign || existingLead.UTM_Campaign,
        
        // Account creation intent
        Account_Creation_Intent: leadData.createAccount ? 'Yes' : (existingLead.Account_Creation_Intent || 'No'),
        
        // Append to description with new checkout info
        Description: appendToLeadDescription(existingLead.Description, leadData, isHigherValue)
      }]
    };

    console.log('📤 Updating lead in Zoho CRM:', {
      leadId: existingLead.id,
      email: leadData.email,
      previousAmount: existingAmount,
      newAmount: leadData.amount,
      isHigherValue,
      shouldUpgradeRating
    });

    // Update the lead
    const updateResponse = await fetch('https://www.zohoapis.com/crm/v3/Leads', {
      method: 'PUT',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const updateResult = await updateResponse.json();
    console.log('Zoho CRM Update Response:', {
      status: updateResponse.status,
      success: updateResponse.ok,
      data: updateResult
    });

    if (!updateResponse.ok) {
      throw new Error(`Zoho CRM lead update failed: ${updateResult.message || 'Unknown error'}`);
    }

    // Check if update was successful
    if (updateResult.data && updateResult.data[0] && updateResult.data[0].status === 'success') {
      console.log('✅ Lead updated successfully:', existingLead.id);

      // Send notification about updated lead
      await sendCheckoutLeadNotification({
        ...leadData,
        isUpdate: true,
        previousAmount: existingAmount,
        previousRating: existingLead.Rating
      }, existingLead.id);

      return {
        leadId: existingLead.id,
        status: 'updated',
        rating: shouldUpgradeRating ? leadRating : existingLead.Rating,
        amount: Math.max(leadData.amount, existingAmount),
        isUpdate: true,
        previousAmount: existingAmount
      };
    } else {
      throw new Error('Lead update failed - no success status returned');
    }
    
  } catch (error) {
    console.error('❌ Error updating existing lead:', error);
    throw error;
  }
}

/**
 * SUB-AGENT: Create new lead in Zoho CRM
 */
async function createNewLead(leadData, leadRating, industry, accessToken) {
/**
 * SUB-AGENT: Create new lead in Zoho CRM
 */
async function createNewLead(leadData, leadRating, industry, accessToken) {
  // Format lead data for Zoho CRM
  const crmLeadData = {
    data: [{
      // Basic contact info
      Last_Name: leadData.lastName || 'Checkout User',
      First_Name: leadData.firstName || '',
      Email: leadData.email,
      Phone: leadData.phone || null,
      Company: `${leadData.firstName} ${leadData.lastName}`.trim() || 'Checkout Customer',
      
      // Lead categorization
      Lead_Source: leadData.leadSource,
      Lead_Status: 'Checkout Started',
      Rating: leadRating,
      Industry: industry,
      
      // Address information
      Street: `${leadData.shippingAddress.address1} ${leadData.shippingAddress.address2}`.trim(),
      City: leadData.shippingAddress.city,
      State: leadData.shippingAddress.state,
      Zip_Code: leadData.shippingAddress.zipCode,
      Country: leadData.shippingAddress.country,
      
      // Purchase intent data
      Annual_Revenue: leadData.amount * 12, // Estimate annual value
      No_of_Employees: determineCompanySizeFromCart(leadData.cartItems),
      
      // Custom fields for checkout data
      Checkout_Amount: leadData.amount,
      Payment_Intent_ID: leadData.paymentIntentId,
      Cart_Items_Count: leadData.cartItems?.length || 0,
      Product_Interest: formatProductInterest(leadData.cartItems),
      
      // Campaign tracking
      Lead_Campaign: leadData.campaign,
      UTM_Source: leadData.source,
      UTM_Medium: leadData.medium,
      UTM_Campaign: leadData.campaign,
      
      // Notes with detailed context
      Description: formatLeadDescription(leadData),
      
      // Additional tracking
      Account_Creation_Intent: leadData.createAccount ? 'Yes' : 'No',
      Order_Notes: leadData.orderNotes || null
    }]
  };

  console.log('📤 Creating new lead in Zoho CRM:', {
    email: leadData.email,
    name: `${leadData.firstName} ${leadData.lastName}`,
    amount: leadData.amount,
    rating: leadRating
  });

  // Submit to Zoho CRM
  const crmResponse = await fetch('https://www.zohoapis.com/crm/v3/Leads', {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(crmLeadData)
  });

  const crmResult = await crmResponse.json();
  console.log('Zoho CRM Response:', {
    status: crmResponse.status,
    success: crmResponse.ok,
    data: crmResult
  });

  if (!crmResponse.ok) {
    throw new Error(`Zoho CRM API error: ${crmResult.message || 'Unknown error'}`);
  }

  // Check if lead was created successfully
  if (crmResult.data && crmResult.data[0] && crmResult.data[0].status === 'success') {
    const leadId = crmResult.data[0].details.id;
    
    console.log('✅ New lead created successfully:', leadId);

    // Send internal notification (optional)
    await sendCheckoutLeadNotification({
      ...leadData,
      isUpdate: false
    }, leadId);

    return {
      leadId,
      status: 'created',
      rating: leadRating,
      amount: leadData.amount,
      isUpdate: false
    };
  } else {
    throw new Error('Lead creation failed - no success status returned');
  }
}

/**
 * Utility function to determine if lead rating should be upgraded
 */
function shouldUpgradeLeadRating(currentRating, newRating) {
  const ratingPriority = { 'Hot': 3, 'Warm': 2, 'Cold': 1 };
  
  const currentPriority = ratingPriority[currentRating] || 0;
  const newPriority = ratingPriority[newRating] || 0;
  
  return newPriority > currentPriority;
}

/**
 * Determine updated lead status based on current status
 */
function determineUpdatedLeadStatus(currentStatus) {
  // Don't downgrade certain statuses
  const preserveStatuses = [
    'Payment Completed',
    'Customer',
    'Converted',
    'Qualified',
    'Contacted'
  ];
  
  if (preserveStatuses.includes(currentStatus)) {
    return currentStatus;
  }
  
  // Update to show recent activity
  return 'Checkout Started';
}

/**
 * Append new checkout information to existing lead description
 */
function appendToLeadDescription(existingDescription, leadData, isHigherValue) {
  const newEntry = [
    `\n--- Additional Checkout Activity (${new Date().toISOString()}) ---`,
    `New checkout for ${leadData.amount.toFixed(2)} via Stripe`,
    `Payment Intent: ${leadData.paymentIntentId}`,
  ];
  
  if (isHigherValue) {
    newEntry.push('⭐ HIGHER VALUE INTERACTION');
  }
  
  if (leadData.cartItems && leadData.cartItems.length > 0) {
    newEntry.push('Cart Items:');
    leadData.cartItems.forEach(item => {
      newEntry.push(`- ${item.productName}: ${item.quantity}x ${item.price.toFixed(2)}`);
    });
  }
  
  if (leadData.orderNotes) {
    newEntry.push(`Notes: ${leadData.orderNotes}`);
  }
  
  const appendText = newEntry.join('\n');
  const combinedDescription = (existingDescription || '') + appendText;
  
  // Truncate if too long (CRM field limit)
  return combinedDescription.substring(0, 2000);
}

/**
 * SUB-AGENT: Update lead status in Zoho CRM
 */
async function updateZohoCRMLeadStatus(leadId, status, notes) {
  const accessToken = await getZohoCRMAccessToken();
  
  const updateData = {
    data: [{
      id: leadId,
      Lead_Status: status,
      Description: notes
    }]
  };

  const response = await fetch(`https://www.zohoapis.com/crm/v3/Leads`, {
    method: 'PUT',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to update lead status: ${error.message || 'Unknown error'}`);
  }

  return await response.json();
}

/**
 * Get Zoho CRM access token (reuse from coverage-lead.js)
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
 * Utility functions for lead scoring and categorization
 */
function determineLeadRatingFromCart(amount, cartItems) {
  // High-value purchases
  if (amount >= 500) return 'Hot';
  if (amount >= 200) return 'Warm';
  
  // Multiple items indicate serious interest
  if (cartItems && cartItems.length >= 3) return 'Warm';
  
  return 'Cold';
}

function determineIndustryFromProducts(cartItems) {
  if (!cartItems || cartItems.length === 0) return 'Technology';
  
  // Analyze product names to determine industry
  const productNames = cartItems.map(item => 
    (item.productName || '').toLowerCase()
  ).join(' ');
  
  if (productNames.includes('router') || productNames.includes('hotspot')) {
    return 'Telecommunications';
  }
  if (productNames.includes('mobile') || productNames.includes('data')) {
    return 'Mobile Technology';
  }
  
  return 'Technology';
}

function determineCompanySizeFromCart(cartItems) {
  if (!cartItems || cartItems.length === 0) return 1;
  
  // Estimate company size based on quantities
  const totalQuantity = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  
  if (totalQuantity >= 10) return 50;
  if (totalQuantity >= 5) return 25;
  if (totalQuantity >= 2) return 10;
  
  return 1;
}

function formatProductInterest(cartItems) {
  if (!cartItems || cartItems.length === 0) return 'General Interest';
  
  return cartItems
    .map(item => item.productName)
    .filter(Boolean)
    .join(', ')
    .substring(0, 255); // CRM field limit
}

function formatLeadDescription(leadData) {
  const lines = [
    `Checkout initiated for $${leadData.amount.toFixed(2)} via Stripe`,
    `Payment Intent: ${leadData.paymentIntentId}`,
    ''
  ];
  
  if (leadData.cartItems && leadData.cartItems.length > 0) {
    lines.push('Cart Items:');
    leadData.cartItems.forEach(item => {
      lines.push(`- ${item.productName}: ${item.quantity}x $${item.price.toFixed(2)}`);
    });
    lines.push('');
  }
  
  if (leadData.orderNotes) {
    lines.push(`Notes: ${leadData.orderNotes}`);
    lines.push('');
  }
  
  lines.push(`Checkout started: ${leadData.createdAt.toISOString()}`);
  
  return lines.join('\n').substring(0, 2000); // CRM field limit
}

/**
 * Send internal notification about new or updated checkout lead
 */
async function sendCheckoutLeadNotification(leadData, leadId) {
  try {
    console.log('📧 Sending checkout lead notification...');
    
    const notificationData = {
      leadId,
      email: leadData.email,
      amount: leadData.amount,
      items: leadData.cartItems?.length || 0,
      timestamp: new Date().toISOString(),
      isUpdate: leadData.isUpdate || false
    };
    
    if (leadData.isUpdate) {
      // Enhanced notification for updated leads
      console.log('🔔 Checkout Lead Updated:', {
        ...notificationData,
        previousAmount: leadData.previousAmount,
        previousRating: leadData.previousRating,
        amountIncrease: leadData.amount - (leadData.previousAmount || 0),
        isHigherValue: leadData.amount > (leadData.previousAmount || 0)
      });
      
      // TODO: Send enhanced notification for updated leads
      // This could trigger different workflows for returning customers
      // await sendSlackNotification({
      //   type: 'lead_updated',
      //   message: `🔄 Returning customer ${leadData.email} started new checkout for ${leadData.amount} (previous: ${leadData.previousAmount})`
      // });
      
    } else {
      // Standard notification for new leads
      console.log('🔔 New Checkout Lead Created:', notificationData);
      
      // TODO: Send standard new lead notification
      // await sendSlackNotification({
      //   type: 'lead_created',
      //   message: `🆕 New checkout lead: ${leadData.email} - ${leadData.amount} (${leadData.cartItems?.length || 0} items)`
      // });
    }
    
  } catch (error) {
    console.warn('⚠️ Failed to send checkout lead notification:', error);
    // Don't throw - notification failure shouldn't break the main flow
  }
}

/**
 * Helper function to get raw body for webhook signature verification
 */
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Configure Next.js to provide raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}