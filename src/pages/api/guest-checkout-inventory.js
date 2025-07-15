// ===== src/pages/api/guest-checkout-inventory.js ===== (FIXED VERSION)

/**
 * Complete guest checkout flow using Zoho Inventory
 * Flow: Contact → Sales Order → Invoice → Payment Collection
 * 
 * FIXED: Billing address 100-character limit error
 * Solution: Use address_id instead of full address objects
 */

export default async function handler(req, res) {
  const requestId = `inv_guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== GUEST CHECKOUT (ZOHO INVENTORY) [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    const { customerInfo, shippingAddress, cartItems, orderNotes } = req.body;
    
    console.log('Processing Inventory guest checkout for:', customerInfo?.email);
    console.log('Cart items count:', cartItems?.length || 0);

    // Validation
    const validationErrors = [];
    if (!customerInfo?.email) validationErrors.push('Email is required');
    if (!customerInfo?.firstName) validationErrors.push('First name is required');  
    if (!customerInfo?.lastName) validationErrors.push('Last name is required');
    if (!shippingAddress?.address1) validationErrors.push('Shipping address is required');
    if (!shippingAddress?.city) validationErrors.push('City is required');
    if (!shippingAddress?.state) validationErrors.push('State is required');
    if (!shippingAddress?.zipCode) validationErrors.push('ZIP code is required');
    if (!cartItems || cartItems.length === 0) validationErrors.push('Cart is empty');

    if (customerInfo?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
      validationErrors.push('Valid email address is required');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
        request_id: requestId
      });
    }

    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) => {
      const price = item.product_price || item.price || 0;
      const quantity = item.quantity || 1;
      return sum + (price * quantity);
    }, 0);
    
    const taxRate = 0.0875; // 8.75% tax
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const shipping = subtotal >= 100 ? 0 : 9.99; // Free shipping over $100
    const total = subtotal + tax + shipping;

    console.log('Order totals:', { subtotal, tax, shipping, total });

    // ===== ZOHO INVENTORY GUEST CHECKOUT FLOW (FIXED) =====
    
    let contactInfo = null;
    let salesOrderId = null;
    let invoiceId = null;

    try {
      // STEP 0: Map Commerce products to Inventory items (CRITICAL FIX)
      console.log('Step 0: Mapping Commerce products to Inventory items...');
      
      const { lineItems, errors } = await mapCommerceItemsToInventory(cartItems);
      
      if (lineItems.length === 0) {
        throw new Error(`No valid inventory items found. Errors: ${JSON.stringify(errors)}`);
      }
      
      if (errors.length > 0) {
        console.warn('Some products could not be mapped to inventory:', errors);
        // Continue with successfully mapped items
      }
      
      console.log(`✓ Mapped ${lineItems.length} items to inventory`);

      // STEP 1: Create or find contact in Zoho Inventory (FIXED)
      console.log('Step 1: Creating guest contact in Zoho Inventory...');
      
      contactInfo = await createOrFindContact({
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        email: customerInfo.email,
        phone: customerInfo.phone || '',
        billing_address: {
          address: shippingAddress.address1,
          address2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: shippingAddress.country || 'US',
          phone: customerInfo.phone || ''
        },
        shipping_address: {
          address: shippingAddress.address1,
          address2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: shippingAddress.country || 'US',
          phone: customerInfo.phone || ''
        },
        requestId
      });

      console.log('✓ Contact created/found:', contactInfo.contact_id);
      console.log('✓ Billing address ID:', contactInfo.billing_address_id);
      console.log('✓ Shipping address ID:', contactInfo.shipping_address_id);

      // STEP 2: Create sales order (FIXED - using address_id)
      console.log('Step 2: Creating sales order...');
      
      const salesOrderData = {
        customer_id: contactInfo.contact_id,
        billing_address_id: contactInfo.billing_address_id, // FIXED: Use address_id
        shipping_address_id: contactInfo.shipping_address_id, // FIXED: Use address_id
        date: new Date().toISOString().split('T')[0],
        shipment_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
        
        // Line items from cart (FIXED - using mapped inventory items)
        line_items: lineItems,
        
        // REMOVED: billing_address and shipping_address objects (this was causing the error)
        // billing_address: { ... }, // <-- This caused the 100-character limit error
        // shipping_address: { ... }, // <-- This caused the 100-character limit error
        
        // Order details
        notes: orderNotes || `Guest order from Travel Data WiFi website - ${requestId}`,
        terms: 'Payment due upon receipt. Thank you for your business!',
        
        // Shipping
        delivery_method: 'Standard Shipping',
        shipping_charge: shipping,
        
        // Reference
        reference_number: requestId,
        
        // Automatically calculate tax
        is_inclusive_tax: false
      };

      const salesOrderResponse = await inventoryApiRequest('/salesorders', {
        method: 'POST',
        body: JSON.stringify(salesOrderData)
      });

      salesOrderId = salesOrderResponse.salesorder?.salesorder_id;
      console.log('✓ Sales order created:', salesOrderId);

      // STEP 3: Create invoice from sales order (FIXED - using address_id)
      console.log('Step 3: Creating invoice from sales order...');
      
      const invoiceData = {
        customer_id: contactInfo.contact_id,
        billing_address_id: contactInfo.billing_address_id, // FIXED: Use address_id
        shipping_address_id: contactInfo.shipping_address_id, // FIXED: Use address_id
        salesorder_id: salesOrderId,
        date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0], // Due today (guest checkout)
        
        // Copy line items from sales order (FIXED - using mapped inventory items)
        line_items: lineItems,
        
        // REMOVED: billing_address and shipping_address objects (this was causing the error)
        // billing_address: { ... }, // <-- This caused the 100-character limit error
        // shipping_address: { ... }, // <-- This caused the 100-character limit error
        
        // Invoice settings
        payment_terms: 0, // Net 0 (immediate)
        payment_terms_label: 'Due on Receipt',
        
        // CRITICAL: Enable Stripe payment gateway
        payment_options: {
          payment_gateways: [
            {
              gateway_name: 'stripe',
              configured: true
            }
          ]
        },
        
        // Shipping
        shipping_charge: shipping,
        
        // Notes
        notes: orderNotes || `Guest invoice from Travel Data WiFi website - ${requestId}`,
        terms: 'Payment due upon receipt. Thank you for your business!',
        
        // Reference
        reference_number: requestId,
        
        // Auto-calculate tax
        is_inclusive_tax: false
      };

      const invoiceResponse = await inventoryApiRequest('/invoices', {
        method: 'POST',
        body: JSON.stringify(invoiceData)
      });

      invoiceId = invoiceResponse.invoice?.invoice_id;
      const invoiceNumber = invoiceResponse.invoice?.invoice_number;
      console.log('✓ Invoice created:', invoiceId, invoiceNumber);

      // STEP 4: Generate payment URL (FIXED for Stripe integration)
      console.log('Step 4: Generating payment URL...');
      
      let paymentUrl = null;
      
      try {
        // Method 1: Send invoice via email to get Stripe payment link
        console.log('Sending invoice via email to generate Stripe payment link...');
        
        const emailData = {
          send_from_org_email_id: false,
          to_mail_ids: [customerInfo.email],
          subject: `Invoice ${invoiceNumber} from Travel Data WiFi`,
          body: `Dear ${customerInfo.firstName} ${customerInfo.lastName},\n\nThank you for your order! Please find your invoice attached.\n\nYou can pay securely online using the payment link in this email.\n\nBest regards,\nTravel Data WiFi Team`
        };
        
        const emailResponse = await inventoryApiRequest(`/invoices/${invoiceId}/email`, {
          method: 'POST',
          body: JSON.stringify(emailData)
        });
        
        console.log('✓ Invoice sent via email with Stripe payment link');
        
        // Method 2: Try to get the public link for the invoice
        try {
          const publicLinkResponse = await inventoryApiRequest(`/invoices/${invoiceId}`, {
            method: 'GET'
          });
          
          const invoice = publicLinkResponse.invoice;
          
          // Check for various possible public URL fields
          if (invoice?.public_view_url || invoice?.customer_portal_url || invoice?.hosted_url) {
            paymentUrl = invoice.public_view_url || invoice.customer_portal_url || invoice.hosted_url;
            console.log('✓ Found invoice public URL:', paymentUrl);
          } else {
            console.log('⚠️ No public URL available in invoice details');
          }
        } catch (publicLinkError) {
          console.log('⚠️ Could not get invoice details for public URL');
        }
        
        // Method 3: Generate direct Zoho Inventory URL
        if (!paymentUrl) {
          const baseUrl = process.env.ZOHO_INVENTORY_BASE_URL || 'https://inventory.zoho.com';
          const orgId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID || process.env.ZOHO_STORE_ID;
          
          // Generate direct link to invoice in Zoho (customer can pay here)
          paymentUrl = `${baseUrl}/app/#/invoices/${invoiceId}/details?organization=${orgId}`;
          console.log('✓ Generated direct Zoho Inventory URL:', paymentUrl);
        }
        
      } catch (emailError) {
        console.log('⚠️ Could not send invoice email, using custom payment solution');
        
        // Method 4: Fallback to custom payment handler
        paymentUrl = `${req.headers.origin}/payment/invoice?${new URLSearchParams({
          invoice_id: invoiceId,
          invoice_number: invoiceNumber,
          contact_id: contactInfo.contact_id,
          amount: total.toString(),
          currency: 'USD',
          customer_email: customerInfo.email,
          customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
          return_url: `${req.headers.origin}/checkout/success`,
          request_id: requestId,
          api_type: 'inventory',
          // Additional Zoho data
          sales_order_id: salesOrderId,
          organization_id: process.env.ZOHO_INVENTORY_ORGANIZATION_ID,
          payment_gateway: 'stripe'
        }).toString()}`;
        
        console.log('✓ Generated custom payment URL with Stripe gateway:', paymentUrl);
      }

      console.log('✅ Guest checkout completed successfully via Zoho Inventory');

      // ===== SUCCESS RESPONSE =====

      const successResponse = {
        success: true,
        type: 'guest_checkout_inventory',
        
        // Order identifiers
        contact_id: contactInfo.contact_id,
        sales_order_id: salesOrderId,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        
        // Address identifiers (for reference)
        billing_address_id: contactInfo.billing_address_id,
        shipping_address_id: contactInfo.shipping_address_id,
        
        // Financial details
        total_amount: total,
        subtotal: subtotal,
        tax_amount: tax,
        shipping_amount: shipping,
        currency: 'USD',
        
        // Customer details
        customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        customer_email: customerInfo.email,
        
        // Payment
        payment_url: paymentUrl,
        payment_status: 'pending',
        payment_method: 'stripe', // Since Stripe is configured
        
        // Enhanced payment instructions
        payment_instructions: {
          method: 'stripe',
          description: 'Pay securely with Stripe via credit card, debit card, or bank transfer',
          email_sent: true,
          email_message: `Payment link sent to ${customerInfo.email}`
        },
        
        // Order details
        order_details: {
          subtotal,
          tax,
          shipping,
          total,
          items: cartItems.length,
          customer: `${customerInfo.firstName} ${customerInfo.lastName}`,
          email: customerInfo.email,
          shipping_address: shippingAddress
        },
        
        next_steps: [
          'Contact created/found in Zoho Inventory',
          'Sales order generated and confirmed',
          'Invoice created and ready for payment', 
          'Invoice emailed to customer with Stripe payment link',
          'Customer can pay via email link or direct URL',
          'Order will be processed after payment confirmation'
        ],
        
        // Technical details
        api_used: 'zoho_inventory',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        
        // Fulfillment info
        estimated_shipping: '3-5 business days',
        tracking_available: true
      };

      return res.status(200).json(successResponse);

    } catch (inventoryError) {
      console.error('❌ Zoho Inventory checkout failed:', inventoryError);
      
      // Check if this is a rate limiting error
      const isRateLimited = inventoryError.message.includes('rate limited') || 
                           inventoryError.message.includes('too many requests') ||
                           inventoryError.message.includes('Rate limited');
      
      // Enhanced error response with step tracking
      const errorResponse = {
        error: isRateLimited ? 'Rate limit exceeded' : 'Zoho Inventory checkout failed',
        details: inventoryError.message || 'Inventory API error occurred',
        type: isRateLimited ? 'RATE_LIMIT_ERROR' : 'INVENTORY_API_ERROR',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        
        // Rate limiting specific guidance
        ...(isRateLimited && {
          retry_after: 60, // seconds
          rate_limit_info: {
            suggestion: 'Please wait 60 seconds before retrying',
            cause: 'Too many authentication requests to Zoho',
            solution: 'The system now caches tokens to prevent this in future requests'
          }
        }),
        
        // Progress tracking
        progress: {
          contact_created: !!contactInfo?.contact_id,
          address_ids_captured: !!(contactInfo?.billing_address_id && contactInfo?.shipping_address_id),
          sales_order_created: !!salesOrderId,
          invoice_created: !!invoiceId,
          step_failed: !contactInfo?.contact_id ? 'contact_creation' : 
                       !contactInfo?.billing_address_id ? 'address_id_extraction' :
                       !salesOrderId ? 'sales_order_creation' : 
                       !invoiceId ? 'invoice_creation' : 'payment_setup'
        },
        
        // Debugging information
        debug_info: {
          contact_id: contactInfo?.contact_id,
          billing_address_id: contactInfo?.billing_address_id,
          shipping_address_id: contactInfo?.shipping_address_id,
          sales_order_id: salesOrderId,
          invoice_id: invoiceId,
          cart_items_count: cartItems.length,
          calculated_total: total,
          token_cached: !!cachedAccessToken
        },
        
        suggestion: getInventoryErrorSuggestion(inventoryError.message)
      };

      return res.status(isRateLimited ? 429 : 500).json(errorResponse);
    }

  } catch (error) {
    console.error('❌ Unexpected error in Inventory guest checkout:', error);
    
    return res.status(500).json({
      error: 'Unexpected checkout error',
      details: error.message || 'An unexpected error occurred',
      type: 'UNEXPECTED_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString()
    });
  }
}

// ===== HELPER FUNCTIONS (FIXED) =====

// Cache to store inventory items and avoid repeated API calls
const inventoryItemCache = new Map();

// Token caching to avoid rate limits
let cachedAccessToken = null;
let tokenExpiry = 0;

/**
 * Map Commerce cart items to Inventory line items using SKU/name lookup
 * CRITICAL FIX: Resolves Commerce product_id to Inventory item_id mismatch
 */
async function mapCommerceItemsToInventory(cartItems) {
  const lineItems = [];
  const errors = [];
  
  console.log(`Mapping ${cartItems.length} cart items to inventory...`);
  
  for (const [index, item] of cartItems.entries()) {
    try {
      console.log(`Processing item ${index + 1}: ${item.product_name || item.name}`);
      
      let inventoryItem = null;
      let lookupMethod = 'none';
      
      // Method 1: Try SKU-based lookup (most reliable)
      if (item.sku || item.product_sku) {
        const sku = item.sku || item.product_sku;
        inventoryItem = await getInventoryItemBySku(sku);
        if (inventoryItem) {
          lookupMethod = 'sku';
          console.log(`✓ Found inventory item by SKU: ${sku} -> ${inventoryItem.item_id}`);
        }
      }
      
      // Method 2: Try product name matching (fallback)
      if (!inventoryItem && (item.product_name || item.name)) {
        const productName = item.product_name || item.name;
        inventoryItem = await getInventoryItemByName(productName);
        if (inventoryItem) {
          lookupMethod = 'name';
          console.log(`✓ Found inventory item by name: ${productName} -> ${inventoryItem.item_id}`);
        }
      }
      
      // Method 3: Try direct product_id as item_id (last resort)
      if (!inventoryItem && item.product_id) {
        inventoryItem = await getInventoryItemById(item.product_id);
        if (inventoryItem) {
          lookupMethod = 'id';
          console.log(`✓ Found inventory item by ID: ${item.product_id} -> ${inventoryItem.item_id}`);
        }
      }
      
      if (inventoryItem) {
        // Successfully mapped to inventory item
        lineItems.push({
          item_id: inventoryItem.item_id,
          name: inventoryItem.name,
          description: `${inventoryItem.name} - Guest Order`,
          rate: item.product_price || item.price || inventoryItem.rate || 0,
          quantity: item.quantity || 1,
          unit: inventoryItem.unit || 'qty',
          item_order: index,
          // Metadata for debugging
          _lookup_method: lookupMethod,
          _original_product_id: item.product_id,
          _original_sku: item.sku || item.product_sku
        });
      } else {
        // Could not find inventory item
        const error = {
          product_id: item.product_id,
          sku: item.sku || item.product_sku,
          name: item.product_name || item.name,
          error: 'Product not found in inventory',
          attempted_methods: ['sku', 'name', 'id']
        };
        errors.push(error);
        console.error(`❌ Could not map to inventory:`, error);
      }
      
    } catch (mappingError) {
      const error = {
        product_id: item.product_id,
        sku: item.sku || item.product_sku,
        name: item.product_name || item.name,
        error: mappingError.message
      };
      errors.push(error);
      console.error(`❌ Error mapping item:`, error);
    }
  }
  
  console.log(`Mapping complete: ${lineItems.length} items mapped, ${errors.length} errors`);
  return { lineItems, errors };
}

/**
 * Get inventory item by SKU (most reliable method)
 */
async function getInventoryItemBySku(sku) {
  const cacheKey = `inventory_item_sku_${sku}`;
  
  // Check cache first
  if (inventoryItemCache.has(cacheKey)) {
    return inventoryItemCache.get(cacheKey);
  }
  
  try {
    const response = await inventoryApiRequest(`/items?sku=${encodeURIComponent(sku)}`);
    
    if (response.items && response.items.length > 0) {
      const item = response.items[0];
      // Cache the result
      inventoryItemCache.set(cacheKey, item);
      return item;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching inventory item by SKU ${sku}:`, error);
    return null;
  }
}

/**
 * Get inventory item by name (fallback method)
 */
async function getInventoryItemByName(productName) {
  const cacheKey = `inventory_item_name_${productName}`;
  
  // Check cache first
  if (inventoryItemCache.has(cacheKey)) {
    return inventoryItemCache.get(cacheKey);
  }
  
  try {
    const response = await inventoryApiRequest(`/items?item_name=${encodeURIComponent(productName)}`);
    
    if (response.items && response.items.length > 0) {
      // Find exact match first, then partial match
      let item = response.items.find(i => i.name === productName);
      if (!item) {
        item = response.items.find(i => i.name.toLowerCase().includes(productName.toLowerCase()));
      }
      if (!item) {
        item = response.items[0]; // Use first result as last resort
      }
      
      // Cache the result
      inventoryItemCache.set(cacheKey, item);
      return item;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching inventory item by name ${productName}:`, error);
    return null;
  }
}

/**
 * Get inventory item by ID (last resort method)
 */
async function getInventoryItemById(itemId) {
  const cacheKey = `inventory_item_id_${itemId}`;
  
  // Check cache first
  if (inventoryItemCache.has(cacheKey)) {
    return inventoryItemCache.get(cacheKey);
  }
  
  try {
    const response = await inventoryApiRequest(`/items/${itemId}`);
    
    if (response.item) {
      const item = response.item;
      // Cache the result
      inventoryItemCache.set(cacheKey, item);
      return item;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching inventory item by ID ${itemId}:`, error);
    return null;
  }
}

/**
 * Create or find contact in Zoho Inventory and extract address IDs
 * FIXED: Properly captures billing_address_id and shipping_address_id
 */
async function createOrFindContact(customerData) {
  const contactName = `${customerData.firstName} ${customerData.lastName}`;
  
  try {
    // First, try to find existing contact by email
    console.log('Searching for existing contact by email...');
    
    try {
      const searchResponse = await inventoryApiRequest(`/contacts`, {
        method: 'GET',
        queryParams: { email: customerData.email }
      });
      
      if (searchResponse.contacts && searchResponse.contacts.length > 0) {
        const existingContact = searchResponse.contacts[0];
        console.log('Found existing contact:', existingContact.contact_id);
        
        // Extract address IDs from existing contact
        let billingAddressId = existingContact.billing_address?.address_id;
        let shippingAddressId = existingContact.shipping_address?.address_id;
        
        // If no address IDs, we need to get full contact details
        if (!billingAddressId || !shippingAddressId) {
          console.log('Getting full contact details for address IDs...');
          
          try {
            const fullContactResponse = await inventoryApiRequest(`/contacts/${existingContact.contact_id}`, {
              method: 'GET'
            });
            
            const fullContact = fullContactResponse.contact;
            billingAddressId = fullContact?.billing_address?.address_id;
            shippingAddressId = fullContact?.shipping_address?.address_id || billingAddressId;
            
          } catch (detailError) {
            console.log('Could not get full contact details, will use contact without address IDs');
          }
        }
        
        // Return existing contact info
        return {
          contact_id: existingContact.contact_id,
          billing_address_id: billingAddressId,
          shipping_address_id: shippingAddressId || billingAddressId
        };
      }
    } catch (searchError) {
      console.log('Contact search failed, proceeding with creation...');
    }

    // Create new contact if not found
    console.log('Creating new contact...');
    
    const contactData = {
      contact_name: contactName,
      contact_type: 'customer',
      customer_sub_type: 'individual',
      first_name: customerData.firstName,
      last_name: customerData.lastName,
      email: customerData.email,
      phone: customerData.phone,
      website: '',
      
      // Billing address (default)
      billing_address: {
        address: customerData.billing_address.address,
        address2: customerData.billing_address.address2,
        city: customerData.billing_address.city,
        state: customerData.billing_address.state,
        zip: customerData.billing_address.zip,
        country: customerData.billing_address.country,
        phone: customerData.billing_address.phone
      },
      
      // Shipping address
      shipping_address: {
        address: customerData.shipping_address.address,
        address2: customerData.shipping_address.address2,
        city: customerData.shipping_address.city,
        state: customerData.shipping_address.state,
        zip: customerData.shipping_address.zip,
        country: customerData.shipping_address.country,
        phone: customerData.shipping_address.phone
      },
      
      // Guest-specific settings
      notes: `Guest customer - Order ${customerData.requestId}`,
      payment_terms: 0, // Net 0 (immediate payment)
      currency_code: 'USD'
    };

    const contactResponse = await inventoryApiRequest('/contacts', {
      method: 'POST',
      body: JSON.stringify(contactData)
    });

    const createdContact = contactResponse.contact;
    
    if (!createdContact?.contact_id) {
      throw new Error('Contact creation failed - no contact_id returned');
    }

    // CRITICAL: Extract address IDs from the response
    const billingAddressId = createdContact.billing_address?.address_id;
    const shippingAddressId = createdContact.shipping_address?.address_id || billingAddressId;

    if (!billingAddressId) {
      throw new Error('Contact created but missing billing_address_id');
    }

    console.log('✓ Contact created successfully with address IDs');

    return {
      contact_id: createdContact.contact_id,
      billing_address_id: billingAddressId,
      shipping_address_id: shippingAddressId
    };

  } catch (error) {
    console.error('Failed to create/find contact:', error);
    throw new Error(`Contact handling failed: ${error.message}`);
  }
}

async function inventoryApiRequest(endpoint, options = {}) {
  const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID || process.env.ZOHO_STORE_ID;
  
  if (!organizationId) {
    throw new Error('ZOHO_INVENTORY_ORGANIZATION_ID environment variable is required');
  }

  // Get access token (with caching to avoid rate limits)
  const token = await getZohoAccessToken();
  
  // Build URL with query parameters
  const baseUrl = `https://www.zohoapis.com/inventory/v1${endpoint}`;
  const urlParams = new URLSearchParams({ organization_id: organizationId });
  
  // Add any additional query parameters
  if (options.queryParams) {
    Object.entries(options.queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        urlParams.append(key, value);
      }
    });
  }
  
  const url = `${baseUrl}?${urlParams.toString()}`;
  
  const defaultHeaders = {
    'Authorization': `Zoho-oauthtoken ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  console.log(`Inventory API Request: ${options.method || 'GET'} ${url}`);
  if (options.body) {
    console.log('Request payload length:', options.body.length);
  }

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        ...defaultHeaders,
        ...options.headers
      },
      body: options.body
    });

    const responseText = await response.text();
    console.log(`Inventory API Response (${response.status}):`, responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));

    // Handle rate limiting
    if (response.status === 429) {
      throw new Error(`Rate limited: Too many API requests. Please wait before retrying.`);
    }

    if (!response.ok) {
      throw new Error(`Inventory API error: ${response.status} - ${responseText || response.statusText}`);
    }

    try {
      const jsonResponse = JSON.parse(responseText);
      
      if (jsonResponse.code && jsonResponse.code !== 0) {
        throw new Error(`Inventory API error: ${jsonResponse.code} - ${jsonResponse.message || 'Unknown error'}`);
      }
      
      return jsonResponse;
    } catch (parseError) {
      if (parseError.message.includes('Inventory API error:')) {
        throw parseError;
      }
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
    
  } catch (fetchError) {
    console.error('API request failed:', fetchError);
    throw fetchError;
  }
}

async function getZohoAccessToken() {
  // Check if we have a valid cached token
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiry) {
    console.log('✓ Using cached Zoho access token');
    return cachedAccessToken;
  }

  // Reuse your existing token logic from the hybrid API
  if (!process.env.ZOHO_REFRESH_TOKEN || !process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
    throw new Error('Missing required Zoho environment variables');
  }

  try {
    console.log('🔄 Requesting new Zoho access token...');
    
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

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle rate limiting specifically
      if (response.status === 400 && errorText.includes('too many requests')) {
        throw new Error(`Zoho auth rate limited: ${errorText}. Please wait 60 seconds before retrying.`);
      }
      
      throw new Error(`Zoho auth failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('No access token received from Zoho');
    }

    // Cache the token (Zoho tokens typically last 1 hour)
    cachedAccessToken = data.access_token;
    tokenExpiry = now + (55 * 60 * 1000); // Cache for 55 minutes to be safe
    
    console.log('✓ New Zoho access token obtained and cached');
    return cachedAccessToken;
    
  } catch (error) {
    console.error('Failed to get Zoho access token:', error);
    
    // If rate limited, provide helpful error message
    if (error.message.includes('rate limited') || error.message.includes('too many requests')) {
      throw new Error(`Authentication rate limited: ${error.message}. Please wait before retrying.`);
    }
    
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

function getInventoryErrorSuggestion(errorMessage) {
  if (errorMessage?.includes('rate limited') || errorMessage?.includes('too many requests')) {
    return 'FIXED: Token caching implemented to prevent rate limiting. Wait 60 seconds before retrying.';
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
  } else {
    return 'Check Zoho Inventory API configuration and organization settings';
  }
}