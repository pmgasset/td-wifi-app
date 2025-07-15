// ===== src/pages/api/guest-checkout-inventory.js ===== (COMPLETE FINAL FIXED VERSION)

/**
 * Complete guest checkout flow using Zoho Inventory with immediate payment redirect
 * Flow: Contact → Sales Order → Invoice → Immediate Payment Redirect
 * 
 * CRITICAL FIXES APPLIED:
 * - Fixed payment link API endpoint (POST vs GET, correct URL format)
 * - Removed custom email sending - Zoho handles automatic reminders
 * - Fixed payment_terms data type (number vs string)
 * - Added sub-agent pattern for payment handling
 * - Enhanced error handling with fallback mechanisms
 * - Token caching to prevent rate limits
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
    const total = Math.round((subtotal + tax + shipping) * 100) / 100;

    console.log('Order totals:', { subtotal, tax, shipping, total });

    // Track processing progress
    let contactInfo = null;
    let salesOrderId = null;
    let invoiceId = null;
    let invoiceNumber = null;
    let paymentUrl = null;

    try {
      // STEP 0: Map Commerce products to Inventory items
      console.log('Step 0: Mapping Commerce products to Inventory items...');
      
      const { lineItems, errors, warnings } = await mapCommerceItemsToInventory(cartItems);
      
      if (lineItems.length === 0) {
        throw new Error(`No valid inventory items found. Errors: ${JSON.stringify(errors)}`);
      }
      
      if (errors.length > 0) {
        console.warn('Some products could not be mapped to inventory:', errors);
      }

      if (warnings && warnings.length > 0) {
        console.warn('Product mapping warnings:', warnings);
      }
      
      console.log(`✓ Mapped ${lineItems.length} items to inventory`);

      // STEP 1: Create or find contact in Zoho Inventory
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

      // STEP 2: Create sales order
      console.log('Step 2: Creating sales order...');

      // Clean line items - remove debug fields before sending to API
      const cleanLineItems = lineItems.map(item => ({
        item_id: item.item_id,
        name: item.name,
        description: item.description,
        rate: item.rate,
        quantity: item.quantity,
        unit: item.unit || 'box',
        item_order: item.item_order || 0
      }));

      const salesOrderData = {
        customer_id: contactInfo.contact_id,
        billing_address_id: contactInfo.billing_address_id,
        shipping_address_id: contactInfo.shipping_address_id,
        date: new Date().toISOString().split('T')[0],
        shipment_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        
        // Clean line items without debug fields
        line_items: cleanLineItems,
        
        // Order details
        notes: orderNotes || 'Guest checkout order',
        terms: 'Payment due upon receipt. Thank you for your business!',
        sub_total: subtotal,
        tax_total: tax,
        shipping_charge: shipping,
        total: total,
        reference_number: requestId
      };

      console.log('Clean sales order payload:', JSON.stringify(salesOrderData, null, 2));

      const salesOrderResponse = await inventoryApiRequest('/salesorders', {
        method: 'POST',
        body: salesOrderData
      });

      salesOrderId = salesOrderResponse.salesorder.salesorder_id;
      console.log('✓ Sales order created:', salesOrderId);

      // STEP 3: Create invoice
      console.log('Step 3: Creating invoice...');
      
      const invoiceData = {
        customer_id: contactInfo.contact_id,
        billing_address_id: contactInfo.billing_address_id,
        shipping_address_id: contactInfo.shipping_address_id,
        date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        payment_terms: 0, // CRITICAL FIX: Must be number (0 = Due on Receipt)
        line_items: cleanLineItems,
        sub_total: subtotal,
        tax_total: tax,
        shipping_charge: shipping,
        total: total,
        notes: `Invoice for guest order ${requestId}`,
        terms: 'Thank you for your business with Travel Data WiFi!',
        salesorder_id: salesOrderId,
        reference_number: requestId,
        send_invoice: true // Let Zoho handle automatic invoice email with their built-in template
      };

      console.log('Invoice creation payload:', JSON.stringify(invoiceData, null, 2));

      const invoiceResponse = await inventoryApiRequest('/invoices', {
        method: 'POST',
        body: invoiceData
      });

      invoiceId = invoiceResponse.invoice.invoice_id;
      invoiceNumber = invoiceResponse.invoice.invoice_number;
      console.log('✓ Invoice created:', invoiceId, invoiceNumber);

      // STEP 4: Generate payment URL (SUB-AGENT)
      console.log('Step 4: Generating payment URL...');
      paymentUrl = await generatePaymentUrl(invoiceId, invoiceNumber, total, customerInfo, requestId);

      // STEP 5: Invoice created - Zoho will handle automatic reminders
      console.log('Step 5: Invoice created - Zoho will send automatic payment reminders if needed');

      console.log('✅ Guest checkout completed successfully via Zoho Inventory');

      // ===== SUCCESS RESPONSE WITH PAYMENT REDIRECT =====
      const successResponse = {
        success: true,
        type: 'guest_checkout_inventory',
        
        // CRITICAL: Payment redirect instructions
        checkout_url: paymentUrl,
        payment_url: paymentUrl,
        redirect_to_payment: true,
        immediate_redirect: true,
        
        // Order identifiers
        contact_id: contactInfo.contact_id,
        sales_order_id: salesOrderId,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        
        // Address identifiers
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
        
        // Payment info
        payment_status: 'pending',
        payment_method: 'stripe',
        
        // Enhanced payment instructions
        payment_instructions: {
          method: 'stripe',
          description: 'Redirecting to secure payment page',
          immediate_payment: true,
          email_sent: false, // Zoho handles automatic reminders
          action: 'redirect_immediately'
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
          'Customer redirected to payment page immediately',
          'Zoho will send automatic payment reminders if needed',
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
      
      const isRateLimited = inventoryError.message.includes('rate limited') || 
                           inventoryError.message.includes('too many requests') ||
                           inventoryError.message.includes('Rate limited');
      
      const errorResponse = {
        error: isRateLimited ? 'Rate limit exceeded' : 'Zoho Inventory checkout failed',
        details: inventoryError.message || 'Inventory API error occurred',
        type: isRateLimited ? 'RATE_LIMIT_ERROR' : 'INVENTORY_API_ERROR',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        
        ...(isRateLimited && {
          retry_after: 60,
          rate_limit_info: {
            suggestion: 'Please wait 60 seconds before retrying',
            cause: 'Too many authentication requests to Zoho',
            solution: 'The system now caches tokens to prevent this in future requests'
          }
        }),
        
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

// ===== SUB-AGENT FUNCTIONS =====

/**
 * SUB-AGENT: Generate payment URL with multiple fallback options
 * FIXED: Correct Zoho payment link API usage
 */
async function generatePaymentUrl(invoiceId, invoiceNumber, total, customerInfo, requestId) {
  console.log('🔄 Sub-agent: Generating payment URL...');
  
  // Option 1: Try Stripe checkout
  try {
    console.log('Attempting Stripe checkout session...');
    const stripeResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://traveldatawifi.com'}/api/create-stripe-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: invoiceId,
        amount: total,
        currency: 'USD',
        customer_email: customerInfo.email,
        customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://traveldatawifi.com'}/checkout/success?invoice_id=${invoiceId}`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://traveldatawifi.com'}/checkout/cancel`,
        metadata: {
          invoice_number: invoiceNumber,
          request_id: requestId
        }
      })
    });

    if (stripeResponse.ok) {
      const stripeData = await stripeResponse.json();
      if (stripeData.checkout_url) {
        console.log('✓ Generated Stripe checkout URL');
        return stripeData.checkout_url;
      }
    }
  } catch (stripeError) {
    console.warn('Could not create Stripe session:', stripeError.message);
  }

  // Option 2: Try Zoho payment link (FIXED API ENDPOINT)
  try {
    console.log('Attempting Zoho payment link...');
    
    // CRITICAL FIX: Use correct Zoho payment link API
    // Try different API approaches based on Zoho documentation
    const paymentLinkResponse = await inventoryApiRequest(`/invoices/${invoiceId}/paymentlink`, {
      method: 'POST', // FIXED: Should be POST, not GET
      body: {
        // Include required parameters for payment link generation
        payment_gateways: ['paypal', 'stripe'], // Optional: specify gateways
      }
    });

    if (paymentLinkResponse.payment_link?.payment_link_url) {
      console.log('✓ Found Zoho payment URL:', paymentLinkResponse.payment_link.payment_link_url);
      return paymentLinkResponse.payment_link.payment_link_url;
    }
  } catch (paymentLinkError) {
    console.warn('⚠️ Could not get Zoho payment link:', paymentLinkError.message);
    
    // Try alternative Zoho payment link endpoint
    try {
      const altPaymentResponse = await inventoryApiRequest(`/invoices/${invoiceId}/paymentlinks`, {
        method: 'GET'
      });
      
      if (altPaymentResponse.payment_links && altPaymentResponse.payment_links.length > 0) {
        const paymentLink = altPaymentResponse.payment_links[0].payment_link_url;
        console.log('✓ Found alternative Zoho payment URL:', paymentLink);
        return paymentLink;
      }
    } catch (altError) {
      console.warn('⚠️ Alternative payment link also failed:', altError.message);
    }
  }

  // Option 3: Fallback to custom payment page
  const fallbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://traveldatawifi.com'}/payment/invoice/${invoiceId}?` + 
    new URLSearchParams({
      amount: total.toString(),
      currency: 'USD',
      customer_email: customerInfo.email,
      invoice_number: invoiceNumber,
      request_id: requestId
    }).toString();
  
  console.log('✓ Generated fallback payment URL:', fallbackUrl);
  return fallbackUrl;
}

// ===== HELPER FUNCTIONS =====

// Cache to store inventory items and avoid repeated API calls
const inventoryItemCache = new Map();

// Token caching to avoid rate limits
let cachedAccessToken = null;
let tokenExpiry = 0;

/**
 * Map Commerce items to Inventory items
 */
async function mapCommerceItemsToInventory(cartItems) {
  const lineItems = [];
  const errors = [];
  const warnings = [];
  
  console.log(`🔄 Mapping ${cartItems.length} cart items to inventory...`);
  
  for (const [index, item] of cartItems.entries()) {
    try {
      console.log(`\n--- Processing item ${index + 1}: ${item.product_name || item.name} ---`);
      console.log(`SKU: ${item.sku || item.product_sku || 'N/A'}`);
      console.log(`ID: ${item.product_id || 'N/A'}`);
      console.log(`Price: $${item.product_price || item.price || 0}`);
      
      let inventoryItem = null;
      let lookupMethod = 'none';
      const attemptedMethods = [];
      
      // Method 1: Try SKU-based lookup (most reliable)
      if (item.sku || item.product_sku) {
        const sku = item.sku || item.product_sku;
        attemptedMethods.push('sku');
        console.log(`🔍 Attempting SKU lookup: ${sku}`);
        
        try {
          inventoryItem = await getInventoryItemBySku(sku);
          if (inventoryItem) {
            lookupMethod = 'sku';
            console.log(`✅ SUCCESS: Found by SKU`);
          } else {
            console.log(`❌ SKU lookup failed: No match found`);
          }
        } catch (skuError) {
          console.log(`❌ SKU lookup error: ${skuError.message}`);
        }
      }
      
      // Method 2: Try name-based search if SKU failed
      if (!inventoryItem && (item.product_name || item.name)) {
        const productName = item.product_name || item.name;
        attemptedMethods.push('name');
        console.log(`🔍 Attempting name search: ${productName}`);
        
        try {
          inventoryItem = await getInventoryItemByName(productName);
          if (inventoryItem) {
            lookupMethod = 'name';
            console.log(`✅ SUCCESS: Found by name`);
          } else {
            console.log(`❌ Name lookup failed: No match found`);
          }
        } catch (nameError) {
          console.log(`❌ Name lookup error: ${nameError.message}`);
        }
      }
      
      // Method 3: Try ID-based lookup if others failed
      if (!inventoryItem && item.product_id) {
        const productId = item.product_id;
        attemptedMethods.push('id');
        console.log(`🔍 Attempting ID lookup: ${productId}`);
        
        try {
          inventoryItem = await getInventoryItemById(productId);
          if (inventoryItem) {
            lookupMethod = 'id';
            console.log(`✅ SUCCESS: Found by ID`);
          } else {
            console.log(`❌ ID lookup failed: No match found`);
          }
        } catch (idError) {
          console.log(`❌ ID lookup error: ${idError.message}`);
        }
      }
      
      if (inventoryItem) {
        const lineItem = {
          item_id: inventoryItem.item_id,
          name: inventoryItem.name,
          description: `${inventoryItem.name} - Guest Order`,
          rate: item.product_price || item.price || inventoryItem.rate,
          quantity: item.quantity || 1,
          unit: inventoryItem.unit || 'box',
          item_order: index,
          
          // Debug info (removed before API calls)
          debug_info: {
            lookup_method: lookupMethod,
            original_product_id: item.product_id,
            original_sku: item.sku || item.product_sku,
            original_name: item.product_name || item.name,
            attempted_methods: attemptedMethods,
            found_item_id: inventoryItem.item_id
          }
        };
        
        lineItems.push(lineItem);
        console.log(`✅ MAPPED: ${item.product_name || item.name} -> ${inventoryItem.name} (${inventoryItem.item_id})`);
        
        // Log debug info
        console.log('📝 Debug info:', lineItem.debug_info);
      } else {
        const errorMsg = `Product "${item.product_name || item.name}" not found in inventory using methods: ${attemptedMethods.join(', ')}`;
        errors.push(errorMsg);
        console.log(`❌ FAILED: ${errorMsg}`);
      }
      
    } catch (error) {
      const errorMsg = `Error mapping "${item.product_name || item.name}": ${error.message}`;
      errors.push(errorMsg);
      console.log(`❌ ERROR: ${errorMsg}`);
    }
  }
  
  console.log('=== MAPPING SUMMARY ===');
  console.log(`✅ Successfully mapped: ${lineItems.length} items`);
  console.log(`❌ Failed to map: ${errors.length} items`);
  console.log(`⚠️ Warnings: ${warnings.length} items`);
  
  return { lineItems, errors, warnings };
}

/**
 * Get inventory item by SKU
 */
async function getInventoryItemBySku(sku) {
  console.log(`🔍 Searching inventory by SKU: ${sku}`);
  
  const cacheKey = `sku:${sku}`;
  if (inventoryItemCache.has(cacheKey)) {
    console.log(`✅ Cache hit for SKU: ${sku}`);
    return inventoryItemCache.get(cacheKey);
  }
  
  try {
    const response = await inventoryApiRequest('/items', {
      queryParams: { sku: sku }
    });
    
    console.log('📋 Response structure check:', {
      hasResponse: !!response,
      responseType: typeof response,
      hasItems: response && 'items' in response,
      itemsType: response?.items ? typeof response.items : 'undefined',
      itemsLength: response?.items ? response.items.length : 0
    });
    
    if (response?.items && Array.isArray(response.items) && response.items.length > 0) {
      const item = response.items[0];
      console.log(`✅ Found inventory item by SKU: ${sku} -> ${item.item_id} (${item.name})`);
      console.log('📝 Item details:', {
        item_id: item.item_id,
        name: item.name,
        sku: item.sku,
        rate: item.rate,
        status: item.status,
        group_id: item.group_id
      });
      
      inventoryItemCache.set(cacheKey, item);
      return item;
    } else {
      console.log(`❌ No inventory item found for SKU: ${sku}`);
      inventoryItemCache.set(cacheKey, null);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error searching inventory by SKU ${sku}:`, {
      message: error.message,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Get inventory item by name search
 */
async function getInventoryItemByName(name) {
  console.log(`🔍 Searching inventory by name: ${name}`);
  
  const cacheKey = `name:${name.toLowerCase()}`;
  if (inventoryItemCache.has(cacheKey)) {
    console.log(`✅ Cache hit for name: ${name}`);
    return inventoryItemCache.get(cacheKey);
  }
  
  try {
    const response = await inventoryApiRequest('/items', {
      queryParams: { 
        search_text: name,
        filter_by: 'Status.Active'
      }
    });
    
    if (response?.items && Array.isArray(response.items) && response.items.length > 0) {
      // Try to find exact match first
      const exactMatch = response.items.find(item => 
        item.name.toLowerCase().trim() === name.toLowerCase().trim()
      );
      
      const selectedItem = exactMatch || response.items[0];
      console.log(`✅ Found inventory item by name: ${name} -> ${selectedItem.item_id} (${selectedItem.name})`);
      
      inventoryItemCache.set(cacheKey, selectedItem);
      return selectedItem;
    } else {
      console.log(`❌ No inventory item found for name: ${name}`);
      inventoryItemCache.set(cacheKey, null);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error searching inventory by name ${name}:`, {
      message: error.message,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Get inventory item by ID
 */
async function getInventoryItemById(itemId) {
  console.log(`🔍 Fetching inventory item by ID: ${itemId}`);
  
  const cacheKey = `id:${itemId}`;
  if (inventoryItemCache.has(cacheKey)) {
    console.log(`✅ Cache hit for ID: ${itemId}`);
    return inventoryItemCache.get(cacheKey);
  }
  
  try {
    const response = await inventoryApiRequest(`/items/${itemId}`);
    
    console.log('📋 Response structure check:', {
      hasResponse: !!response,
      hasItem: response && 'item' in response,
      hasItems: response && 'items' in response,
      responseKeys: response ? Object.keys(response) : []
    });
    
    let item = null;
    
    if (response?.item) {
      // Single item response structure
      item = response.item;
      console.log(`✅ Found item using 'item' property`);
    } else if (response?.items && Array.isArray(response.items) && response.items.length > 0) {
      // List response structure
      item = response.items[0];
      console.log(`✅ Found item using 'items' array`);
    } else {
      console.log(`❌ No inventory item found for ID: ${itemId}`);
      inventoryItemCache.set(cacheKey, null);
      return null;
    }
    
    console.log(`✅ Found inventory item by ID: ${itemId} -> ${item.item_id} (${item.name})`);
    inventoryItemCache.set(cacheKey, item);
    return item;
    
  } catch (error) {
    // Handle 404 errors gracefully
    if (error.message?.includes('404') || error.message?.includes('not available')) {
      console.log(`❌ Inventory item not found (404) for ID: ${itemId}`);
      inventoryItemCache.set(cacheKey, null);
      return null;
    }
    
    console.error(`❌ Error fetching inventory item by ID ${itemId}:`, {
      message: error.message,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Create or find contact in Zoho Inventory
 */
async function createOrFindContact(customerData) {
  const contactName = `${customerData.firstName} ${customerData.lastName}`;
  
  try {
    console.log('Searching for existing contact by email...');
    
    try {
      const searchResponse = await inventoryApiRequest(`/contacts`, {
        method: 'GET',
        queryParams: { email: customerData.email }
      });
      
      if (searchResponse.contacts && searchResponse.contacts.length > 0) {
        const existingContact = searchResponse.contacts[0];
        console.log('Found existing contact:', existingContact.contact_id);
        
        // Get full contact details for address IDs
        console.log('Getting full contact details for address IDs...');
        const contactDetailsResponse = await inventoryApiRequest(`/contacts/${existingContact.contact_id}`);
        const contactDetails = contactDetailsResponse.contact;
        
        // Extract address IDs from the contact details
        let billingAddressId = null;
        let shippingAddressId = null;
        
        // Method 1: Check direct address properties
        if (contactDetails.billing_address?.address_id) {
          billingAddressId = contactDetails.billing_address.address_id;
        }
        if (contactDetails.shipping_address?.address_id) {
          shippingAddressId = contactDetails.shipping_address.address_id;
        }
        
        // Method 2: Check addresses array
        if (contactDetails.addresses && Array.isArray(contactDetails.addresses)) {
          for (const addr of contactDetails.addresses) {
            if (addr.is_billing && !billingAddressId) {
              billingAddressId = addr.address_id;
            }
            if (addr.is_shipping && !shippingAddressId) {
              shippingAddressId = addr.address_id;
            }
          }
        }
        
        // Fallback: Use billing address for shipping if no shipping address found
        if (billingAddressId && !shippingAddressId) {
          shippingAddressId = billingAddressId;
        }
        
        return {
          contact_id: existingContact.contact_id,
          billing_address_id: billingAddressId,
          shipping_address_id: shippingAddressId
        };
      }
    } catch (searchError) {
      console.log('Contact search failed, will create new contact:', searchError.message);
    }
    
    // Create new contact if not found
    console.log('Creating new contact...');
    const newContactData = {
      contact_name: contactName,
      contact_type: 'customer',
      first_name: customerData.firstName,
      last_name: customerData.lastName,
      email: customerData.email,
      phone: customerData.phone,
      billing_address: {
        attention: contactName,
        address: customerData.billing_address.address,
        street2: customerData.billing_address.address2,
        city: customerData.billing_address.city,
        state: customerData.billing_address.state,
        zip: customerData.billing_address.zip,
        country: customerData.billing_address.country,
        phone: customerData.billing_address.phone
      },
      shipping_address: {
        attention: contactName,
        address: customerData.shipping_address.address,
        street2: customerData.shipping_address.address2,
        city: customerData.shipping_address.city,
        state: customerData.shipping_address.state,
        zip: customerData.shipping_address.zip,
        country: customerData.shipping_address.country,
        phone: customerData.shipping_address.phone
      }
    };
    
    const createResponse = await inventoryApiRequest('/contacts', {
      method: 'POST',
      body: newContactData
    });
    
    const newContact = createResponse.contact;
    
    return {
      contact_id: newContact.contact_id,
      billing_address_id: newContact.billing_address.address_id,
      shipping_address_id: newContact.shipping_address.address_id
    };
    
  } catch (error) {
    console.error('Failed to create/find contact:', error);
    throw new Error(`Contact handling failed: ${error.message}`);
  }
}

/**
 * Make authenticated request to Zoho Inventory API
 */
async function inventoryApiRequest(endpoint, options = {}) {
  const { method = 'GET', body, queryParams } = options;
  
  // Build URL with query parameters
  let url = `https://www.zohoapis.com/inventory/v1${endpoint}`;
  if (queryParams) {
    const params = new URLSearchParams();
    params.append('organization_id', process.env.ZOHO_INVENTORY_ORGANIZATION_ID);
    
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    url += `?${params.toString()}`;
  } else {
    url += `?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`;
  }
  
  // Get access token
  const accessToken = await getZohoAccessToken();
  
  const requestOptions = {
    method,
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };
  
  // Handle body properly - don't double stringify
  if (body) {
    if (typeof body === 'string') {
      requestOptions.body = body;
    } else {
      requestOptions.body = JSON.stringify(body);
    }
  }
  
  console.log(`🌐 Inventory API Request: ${method} ${url}`);
  if (body) {
    console.log(`📤 Request body length: ${requestOptions.body.length} characters`);
    // Log first part of body for debugging
    const bodyPreview = requestOptions.body.substring(0, 200);
    console.log(`📤 Request body preview: ${bodyPreview}${requestOptions.body.length > 200 ? '...' : ''}`);
  }
  
  try {
    const response = await fetch(url, requestOptions);
    
    // Always parse response as text first
    const responseText = await response.text();
    console.log(`📡 Inventory API Response (${response.status}): ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`);
    
    // Validate response before parsing JSON
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
    
    // Return validated response object
    return responseData;
    
  } catch (error) {
    console.error(`❌ Inventory API request failed:`, {
      url,
      method,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Get Zoho access token with caching to prevent rate limits
 */
async function getZohoAccessToken() {
  // Check if we have a cached token that's still valid
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    console.log('✓ Using cached Zoho access token');
    return cachedAccessToken;
  }

  console.log('🔄 Requesting new Zoho access token...');

  try {
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
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      throw new Error(`No access token in response: ${JSON.stringify(data)}`);
    }

    // Cache the token (expires in 1 hour, cache for 50 minutes to be safe)
    cachedAccessToken = data.access_token;
    tokenExpiry = Date.now() + (50 * 60 * 1000);

    console.log('✓ New Zoho access token obtained and cached');
    return cachedAccessToken;

  } catch (error) {
    console.error('❌ Failed to get Zoho access token:', error);
    
    // Clear cached token on error
    cachedAccessToken = null;
    tokenExpiry = 0;
    
    if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
      throw new Error(`Rate limited: Please wait before retrying.`);
    }
    
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

/**
 * Get helpful error suggestions
 */
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
  } else if (errorMessage?.includes('JSON is not well formed')) {
    return 'FIXED: Removed debug fields and custom_fields from API payload. Clean JSON structure now used.';
  } else if (errorMessage?.includes('Invalid value passed for Payment Terms')) {
    return 'FIXED: Changed payment_terms from string to number (0 = Due on Receipt) and removed invalid payment_terms_label field.';
  } else if (errorMessage?.includes('Invalid value passed for to_mail_ids')) {
    return 'REMOVED: Email sending removed - Zoho handles automatic payment reminders.';
  } else if (errorMessage?.includes('Invalid URL Passed')) {
    return 'FIXED: Updated payment link API endpoint and method (POST vs GET).';
  } else {
    return 'Check Zoho Inventory API configuration and organization settings';
  }
}

// Export for testing
export { mapCommerceItemsToInventory, createOrFindContact };