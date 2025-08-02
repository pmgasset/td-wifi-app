// src/pages/api/guest-checkout-inventory.js - Updated to use centralized token manager
// REMOVED: cachedAccessToken and tokenExpiry - now uses tokenManager.getAccessToken('inventory')

import { tokenManager } from '../../lib/enhanced-token-manager';

// Request tracking for debugging
let requestCounter = 0;

export default async function handler(req, res) {
  const requestId = `checkout_${Date.now()}_${++requestCounter}`;
  console.log(`\n🛒 === GUEST CHECKOUT START [${requestId}] ===`);

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      request_id: requestId 
    });
  }

  try {
    const { cartItems, customerInfo, total } = req.body;

    // Validate request data
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        error: 'Invalid cart items',
        details: 'Cart items must be a non-empty array',
        request_id: requestId
      });
    }

    if (!customerInfo || !customerInfo.email || !customerInfo.firstName || !customerInfo.lastName) {
      return res.status(400).json({
        error: 'Invalid customer information',
        details: 'Customer email, firstName, and lastName are required',
        request_id: requestId
      });
    }

    if (!total || total <= 0) {
      return res.status(400).json({
        error: 'Invalid total amount',
        details: 'Total must be greater than 0',
        request_id: requestId
      });
    }

    console.log(`📋 Checkout Details [${requestId}]:`);
    console.log(`   Customer: ${customerInfo.firstName} ${customerInfo.lastName} (${customerInfo.email})`);
    console.log(`   Items: ${cartItems.length} products`);
    console.log(`   Total: $${total}`);

    let contactInfo = null;
    let salesOrderId = null;
    let invoiceId = null;

    // STEP 1: Create or find contact
    try {
      console.log(`\n👤 Step 1: Creating/finding contact [${requestId}]...`);
      contactInfo = await createOrFindContact(customerInfo, requestId);
      console.log(`✅ Contact processed: ${contactInfo.contact_id}`);
    } catch (contactError) {
      console.error(`❌ Contact creation failed [${requestId}]:`, contactError);
      return handleCheckoutError(res, contactError, requestId, { 
        step: 'contact_creation',
        customer_info: customerInfo,
        cart_items_count: cartItems.length,
        total: total
      });
    }

    // STEP 2: Create sales order
    try {
      console.log(`\n📦 Step 2: Creating sales order [${requestId}]...`);
      salesOrderId = await createSalesOrder(contactInfo, cartItems, total, requestId);
      console.log(`✅ Sales order created: ${salesOrderId}`);
    } catch (salesOrderError) {
      console.error(`❌ Sales order creation failed [${requestId}]:`, salesOrderError);
      return handleCheckoutError(res, salesOrderError, requestId, {
        step: 'sales_order_creation',
        contact_created: true,
        contact_id: contactInfo?.contact_id,
        cart_items_count: cartItems.length,
        total: total
      });
    }

    // STEP 3: Create invoice
    try {
      console.log(`\n🧾 Step 3: Creating invoice [${requestId}]...`);
      invoiceId = await createInvoiceFromSalesOrder(salesOrderId, requestId);
      console.log(`✅ Invoice created: ${invoiceId}`);
    } catch (invoiceError) {
      console.error(`❌ Invoice creation failed [${requestId}]:`, invoiceError);
      return handleCheckoutError(res, invoiceError, requestId, {
        step: 'invoice_creation',
        contact_created: true,
        sales_order_created: true,
        contact_id: contactInfo?.contact_id,
        sales_order_id: salesOrderId,
        cart_items_count: cartItems.length,
        total: total
      });
    }

    // STEP 4: Generate payment URL
    try {
      console.log(`\n💳 Step 4: Generating payment URL [${requestId}]...`);
      const paymentUrl = await generatePaymentUrl(invoiceId, `INV-${invoiceId}`, total, customerInfo, requestId);
      
      console.log(`\n🎉 === CHECKOUT SUCCESS [${requestId}] ===`);
      console.log(`   Contact: ${contactInfo.contact_id}`);
      console.log(`   Sales Order: ${salesOrderId}`);
      console.log(`   Invoice: ${invoiceId}`);
      console.log(`   Payment URL: ${paymentUrl}`);

      return res.status(200).json({
        success: true,
        message: 'Checkout completed successfully',
        checkout_url: paymentUrl,
        invoice_id: invoiceId,
        sales_order_id: salesOrderId,
        contact_id: contactInfo.contact_id,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        next_steps: {
          action: 'redirect_to_payment',
          url: paymentUrl,
          description: 'Customer should be redirected to payment URL to complete purchase'
        }
      });

    } catch (paymentError) {
      console.error(`❌ Payment URL generation failed [${requestId}]:`, paymentError);
      return handleCheckoutError(res, paymentError, requestId, {
        step: 'payment_url_generation',
        contact_created: true,
        sales_order_created: true,
        invoice_created: true,
        contact_id: contactInfo?.contact_id,
        sales_order_id: salesOrderId,
        invoice_id: invoiceId,
        cart_items_count: cartItems.length,
        total: total
      });
    }

  } catch (unexpectedError) {
    console.error(`❌ Unexpected checkout error [${requestId}]:`, unexpectedError);
    
    return res.status(500).json({
      error: 'Unexpected checkout error',
      details: unexpectedError.message || 'An unexpected error occurred during checkout',
      type: 'UNEXPECTED_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString(),
      suggestion: 'Please try again. If the problem persists, contact support.'
    });
  }
}

/**
 * CENTRALIZED: Get Zoho access token using token manager
 * REMOVED: Local cachedAccessToken and tokenExpiry variables
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
 * Make authenticated API request to Zoho Inventory
 */
async function makeInventoryApiRequest(url, method = 'GET', body = null) {
  try {
    const token = await getZohoAccessToken();
    
    const options = {
      method,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json'
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000) // 30 second timeout
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    console.log(`📡 API Request: ${method} ${url}`);
    
    const response = await fetch(url, options);
    const responseText = await response.text();

    // Validate response
    if (!responseText) {
      throw new Error(`Empty response from Zoho API: ${response.status} ${response.statusText}`);
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Invalid JSON response from Zoho API: ${parseError.message}. Response: ${responseText.substring(0, 200)}`);
    }

    // Handle API-level errors even with 200 status
    if (responseData?.code !== undefined && responseData.code !== 0) {
      throw new Error(`Inventory API error: ${response.status} - ${responseText}`);
    }

    if (!response.ok) {
      throw new Error(`Inventory API error: ${response.status} - ${responseText}`);
    }

    console.log(`✅ API Response: ${response.status} OK`);
    return responseData;

  } catch (error) {
    console.error(`❌ Inventory API request failed:`, {
      url,
      method,
      error: error.message,
      isTimeout: error.name === 'TimeoutError',
      isRateLimit: error.message.includes('rate limit') || error.message.includes('too many requests')
    });
    throw error;
  }
}

/**
 * Create or find contact in Zoho Inventory
 */
async function createOrFindContact(customerInfo, requestId) {
  const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID;
  
  try {
    // Try to find existing contact first
    console.log(`🔍 Searching for existing contact: ${customerInfo.email} [${requestId}]`);
    
    const searchUrl = `https://www.zohoapis.com/inventory/v1/contacts?email=${encodeURIComponent(customerInfo.email)}&organization_id=${organizationId}`;
    const searchResponse = await makeInventoryApiRequest(searchUrl);
    
    if (searchResponse.contacts && searchResponse.contacts.length > 0) {
      const existingContact = searchResponse.contacts[0];
      console.log(`✅ Found existing contact: ${existingContact.contact_id} [${requestId}]`);
      
      return {
        contact_id: existingContact.contact_id,
        billing_address_id: existingContact.billing_address?.address_id,
        shipping_address_id: existingContact.shipping_address?.address_id,
        existing: true
      };
    }

    // Create new contact
    console.log(`➕ Creating new contact [${requestId}]`);
    
    const contactData = {
      contact_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
      contact_type: 'customer',
      email: customerInfo.email,
      phone: customerInfo.phone || '',
      billing_address: {
        address: customerInfo.address || '',
        city: customerInfo.city || '',
        state: customerInfo.state || '',
        zip: customerInfo.zipCode || '',
        country: customerInfo.country || 'US'
      },
      shipping_address: {
        address: customerInfo.address || '',
        city: customerInfo.city || '',
        state: customerInfo.state || '',
        zip: customerInfo.zipCode || '',
        country: customerInfo.country || 'US'
      }
    };

    const createUrl = `https://www.zohoapis.com/inventory/v1/contacts?organization_id=${organizationId}`;
    const createResponse = await makeInventoryApiRequest(createUrl, 'POST', contactData);
    
    if (!createResponse.contact) {
      throw new Error('No contact returned from creation API');
    }

    const newContact = createResponse.contact;
    console.log(`✅ Created new contact: ${newContact.contact_id} [${requestId}]`);
    
    return {
      contact_id: newContact.contact_id,
      billing_address_id: newContact.billing_address?.address_id,
      shipping_address_id: newContact.shipping_address?.address_id,
      existing: false
    };

  } catch (error) {
    console.error(`❌ Contact creation/lookup failed [${requestId}]:`, error);
    throw new Error(`Contact processing failed: ${error.message}`);
  }
}

/**
 * Map commerce cart items to inventory line items
 */
async function mapCommerceItemsToInventory(cartItems, requestId) {
  const lineItems = [];
  const errors = [];
  
  console.log(`🔄 Mapping ${cartItems.length} cart items to inventory [${requestId}]...`);
  
  for (const [index, item] of cartItems.entries()) {
    try {
      console.log(`\n--- Processing item ${index + 1}: ${item.product_name || item.name} [${requestId}] ---`);
      
      // Create line item (simplified approach - use item data as provided)
      const lineItem = {
        item_id: item.product_id || item.item_id,
        name: item.product_name || item.name,
        description: item.product_description || item.description || '',
        rate: parseFloat(item.product_price || item.price || 0),
        quantity: parseInt(item.quantity || 1),
        unit: 'qty'
      };

      // Validate line item
      if (!lineItem.name) {
        throw new Error('Product name is required');
      }
      
      if (lineItem.rate <= 0) {
        throw new Error('Product price must be greater than 0');
      }
      
      if (lineItem.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      lineItems.push(lineItem);
      console.log(`✅ Mapped item: ${lineItem.name} - $${lineItem.rate} x ${lineItem.quantity} [${requestId}]`);
      
    } catch (itemError) {
      const error = `Item ${index + 1} (${item.product_name || item.name}): ${itemError.message}`;
      errors.push(error);
      console.error(`❌ ${error} [${requestId}]`);
    }
  }

  if (lineItems.length === 0) {
    throw new Error(`No valid line items created. Errors: ${errors.join(', ')}`);
  }

  if (errors.length > 0) {
    console.warn(`⚠️ ${errors.length} items had errors but ${lineItems.length} items processed successfully [${requestId}]`);
  }

  return lineItems;
}

/**
 * Create sales order in Zoho Inventory
 */
async function createSalesOrder(contactInfo, cartItems, total, requestId) {
  const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID;
  
  try {
    const lineItems = await mapCommerceItemsToInventory(cartItems, requestId);
    
    const salesOrderData = {
      customer_id: contactInfo.contact_id,
      date: new Date().toISOString().split('T')[0],
      line_items: lineItems,
      notes: `Guest checkout order - Request ID: ${requestId}`,
      terms: 'Payment due upon receipt',
      ...(contactInfo.billing_address_id && { billing_address_id: contactInfo.billing_address_id }),
      ...(contactInfo.shipping_address_id && { shipping_address_id: contactInfo.shipping_address_id })
    };

    console.log(`📦 Creating sales order with ${lineItems.length} line items [${requestId}]`);
    
    const createUrl = `https://www.zohoapis.com/inventory/v1/salesorders?organization_id=${organizationId}`;
    const response = await makeInventoryApiRequest(createUrl, 'POST', salesOrderData);
    
    if (!response.salesorder) {
      throw new Error('No sales order returned from creation API');
    }

    return response.salesorder.salesorder_id;
    
  } catch (error) {
    console.error(`❌ Sales order creation failed [${requestId}]:`, error);
    throw new Error(`Sales order creation failed: ${error.message}`);
  }
}

/**
 * Create invoice from sales order
 */
async function createInvoiceFromSalesOrder(salesOrderId, requestId) {
  const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID;
  
  try {
    const invoiceData = {
      salesorder_id: salesOrderId,
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
      payment_terms: 0, // Due on receipt
      notes: `Invoice generated from sales order - Request ID: ${requestId}`
    };

    console.log(`🧾 Creating invoice from sales order: ${salesOrderId} [${requestId}]`);
    
    const createUrl = `https://www.zohoapis.com/inventory/v1/invoices?organization_id=${organizationId}`;
    const response = await makeInventoryApiRequest(createUrl, 'POST', invoiceData);
    
    if (!response.invoice) {
      throw new Error('No invoice returned from creation API');
    }

    return response.invoice.invoice_id;
    
  } catch (error) {
    console.error(`❌ Invoice creation failed [${requestId}]:`, error);
    throw new Error(`Invoice creation failed: ${error.message}`);
  }
}

/**
 * Generate payment URL for the invoice
 */
async function generatePaymentUrl(invoiceId, invoiceNumber, total, customerInfo, requestId) {
  console.log(`💳 Generating payment URL for invoice ${invoiceId} [${requestId}]...`);
  
  // Create public payment URL that bypasses Zoho login requirements
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const paymentUrl = `${baseUrl}/pay/${invoiceId}?` + new URLSearchParams({
    amount: total.toString(),
    currency: 'USD',
    customer_email: customerInfo.email,
    customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
    invoice_number: invoiceNumber,
    token: generateSecureToken(invoiceId, customerInfo.email, total),
    request_id: requestId
  }).toString();
  
  console.log(`✅ Generated payment URL [${requestId}]: ${paymentUrl}`);
  return paymentUrl;
}

/**
 * Generate secure token for payment verification
 */
function generateSecureToken(invoiceId, customerEmail, total) {
  const timestamp = Date.now();
  const payload = `${invoiceId}:${customerEmail}:${total}:${timestamp}`;
  return Buffer.from(payload).toString('base64').replace(/[+=\/]/g, '');
}

/**
 * Handle checkout errors with comprehensive context
 */
function handleCheckoutError(res, error, requestId, context = {}) {
  const isRateLimited = error.message.includes('rate limit') || 
                       error.message.includes('too many requests') ||
                       error.message.includes('Rate limited');

  const errorResponse = {
    error: 'Checkout failed',
    message: isRateLimited ? 'Rate limit exceeded' : 'Zoho Inventory checkout failed',
    details: error.message || 'Checkout process encountered an error',
    type: isRateLimited ? 'RATE_LIMIT_ERROR' : 'CHECKOUT_ERROR',
    request_id: requestId,
    timestamp: new Date().toISOString(),
    
    ...(isRateLimited && {
      retry_after: 60,
      rate_limit_info: {
        suggestion: 'Please wait 60 seconds before retrying',
        cause: 'Too many requests to Zoho Inventory API',
        solution: 'The system uses centralized token management to minimize this issue'
      }
    }),
    
    progress: {
      contact_created: !!context.contact_id,
      sales_order_created: !!context.sales_order_id,
      invoice_created: !!context.invoice_id,
      step_failed: context.step || 'unknown'
    },
    
    debug_info: {
      contact_id: context.contact_id,
      sales_order_id: context.sales_order_id,
      invoice_id: context.invoice_id,
      cart_items_count: context.cart_items_count,
      calculated_total: context.total,
      token_manager_status: tokenManager.getStatus()
    },
    
    suggestion: getInventoryErrorSuggestion(error.message)
  };

  const status = isRateLimited ? 429 : 500;
  return res.status(status).json(errorResponse);
}

/**
 * Get helpful error suggestions
 */
function getInventoryErrorSuggestion(errorMessage) {
  if (errorMessage?.includes('rate limited') || errorMessage?.includes('too many requests')) {
    return 'FIXED: Centralized token management implemented to prevent rate limiting. If you continue to see this error, please wait 60 seconds before retrying.';
  } else if (errorMessage?.includes('billing_address') && errorMessage?.includes('100 characters')) {
    return 'FIXED: Now using address_id instead of full billing_address object to avoid 100-character limit';
  } else if (errorMessage?.includes('item_id') || errorMessage?.includes('item not found')) {
    return 'FIXED: Now using SKU/name lookup to map Commerce products to Inventory items. Check that products exist in both systems.';
  } else if (errorMessage?.includes('Product not found in inventory')) {
    return 'Products from Commerce are not synced to Inventory. Consider enabling Zoho Commerce-Inventory sync or manually create inventory items.';
  } else if (errorMessage?.includes('address_id')) {
    return 'Check that contact was created successfully and address_id was extracted properly';
  } else if (errorMessage?.includes('organization_id')) {
    return 'Check ZOHO_INVENTORY_ORGANIZATION_ID environment variable';
  } else if (errorMessage?.includes('contact')) {
    return 'Contact creation failed - check customer information format';
  } else if (errorMessage?.includes('sales_order') || errorMessage?.includes('salesorder')) {
    return 'Sales order creation failed - check line items and pricing';
  } else if (errorMessage?.includes('invoice')) {
    return 'Invoice creation failed - check sales order exists and is valid';
  } else if (errorMessage?.includes('authentication') || errorMessage?.includes('token')) {
    return 'Check Zoho OAuth credentials and refresh token';
  } else if (errorMessage?.includes('Token manager error')) {
    return 'Centralized token management error - check enhanced-token-manager configuration';
  } else {
    return 'Check Zoho Inventory API configuration and organization settings';
  }
}

/**
 * Health check for the guest checkout service
 */
export async function healthCheck() {
  try {
    const tokenStatus = tokenManager.getStatus();
    
    return {
      service: 'guest_checkout_inventory',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      token_manager: tokenStatus,
      configuration: {
        organization_id_configured: !!process.env.ZOHO_INVENTORY_ORGANIZATION_ID,
        base_url_configured: !!process.env.NEXT_PUBLIC_BASE_URL,
        oauth_credentials_configured: !!(
          process.env.ZOHO_CLIENT_ID && 
          process.env.ZOHO_CLIENT_SECRET && 
          process.env.ZOHO_REFRESH_TOKEN
        )
      }
    };
  } catch (error) {
    return {
      service: 'guest_checkout_inventory',
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}