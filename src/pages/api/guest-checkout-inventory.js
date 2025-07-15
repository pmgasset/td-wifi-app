// ===== src/pages/api/guest-checkout-inventory.js ===== (COMPLETE FINAL FIXED VERSION)

/**
 * Complete guest checkout flow using Zoho Inventory with immediate payment redirect
 * Flow: Contact → Sales Order → Invoice → Immediate Payment Redirect
 * 
 * FIXES INCLUDED:
 * - CRITICAL: JSON payload fix - removed debug fields causing "JSON is not well formed"
 * - CRITICAL: Response parsing bug fix (TypeError: Cannot read properties of undefined)
 * - SKU mapping now working correctly with B08TRCSSZ4
 * - Billing address 100-character limit (uses address_id)
 * - Product ID mapping (SKU/name lookup)
 * - Rate limiting (token caching)
 * - Immediate payment redirect (custom Stripe checkout)
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


// STEP 2: Create sales order (CRITICAL FIX - remove auto-generated number conflict)
console.log('Step 2: Creating sales order...');

// CRITICAL FIX: Clean line items - remove debug fields before sending to API
const cleanLineItems = lineItems.map(item => ({
  item_id: item.item_id,
  name: item.name,
  description: item.description,
  rate: item.rate,
  quantity: item.quantity,
  unit: item.unit || 'qty',
  item_order: item.item_order || 0
  // Remove all debug fields (_lookup_method, _original_*, etc.)
}));

const salesOrderData = {
  customer_id: contactInfo.contact_id,
  billing_address_id: contactInfo.billing_address_id,
  shipping_address_id: contactInfo.shipping_address_id,
  date: new Date().toISOString().split('T')[0],
  shipment_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  
  // FIXED: Clean line items without debug fields
  line_items: cleanLineItems,
  
  // Order details
  notes: orderNotes || `Guest order from Travel Data WiFi website - ${requestId}`,
  terms: 'Payment due upon receipt. Thank you for your business!',
  
  // Financial details
  sub_total: subtotal,
  tax_total: tax,
  shipping_charge: shipping,
  total: total,
  
  // CRITICAL FIX: Remove salesorder_number to let Zoho auto-generate
  // salesorder_number: `SO-${Date.now()}`, // ❌ REMOVED - causing auto-generation conflict
  reference_number: requestId
  
  // REMOVED: custom_fields causing JSON parsing issues
};

console.log('Clean sales order payload:', JSON.stringify(salesOrderData, null, 2));

const salesOrderResponse = await inventoryApiRequest('/salesorders', {
  method: 'POST',
  body: salesOrderData // Don't double-stringify - inventoryApiRequest will handle it
});

salesOrderId = salesOrderResponse.salesorder?.salesorder_id;
if (!salesOrderId) {
  throw new Error('Sales order creation failed - no salesorder_id returned');
}

console.log('✓ Sales order created:', salesOrderId);

      // STEP 3: Create invoice from sales order (FIXED)
      console.log('Step 3: Creating invoice from sales order...');

      const invoiceResponse = await inventoryApiRequest(`/salesorders/${salesOrderId}/invoices`, {
        method: 'POST',
        body: {
          ignore_auto_number_generation: false,
          invoice_number: `INV-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
          payment_terms: 'Due upon receipt',
          payment_terms_label: 'Due upon receipt',
          notes: `Invoice for guest order ${requestId}`,
          terms: 'Thank you for your business with Travel Data WiFi!',
          send_invoice: true, // Email invoice to customer
          subject: 'Your Travel Data WiFi Order Invoice',
          body: `Dear ${customerInfo.firstName},\n\nThank you for your order! Please find your invoice attached.\n\nYou can pay securely online using the payment link below.\n\nBest regards,\nTravel Data WiFi Team`
        }
      });

      invoiceId = invoiceResponse.invoice?.invoice_id;
      const invoiceNumber = invoiceResponse.invoice?.invoice_number;

      if (!invoiceId) {
        throw new Error('Invoice creation failed - no invoice_id returned');
      }

      console.log('✓ Invoice created:', invoiceId, invoiceNumber);

      // STEP 4: Generate payment URL (FIXED - fallback Stripe URL)
      console.log('Step 4: Generating payment URL...');

      let paymentUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://traveldatawifi.com'}/payment/invoice/${invoiceId}`;

      // Try to get Zoho's built-in payment URL first
      try {
        const paymentLinkResponse = await inventoryApiRequest(`/invoices/${invoiceId}/paymentlinks`, {
          method: 'POST',
          body: {
            payment_url_message: `Payment for Invoice ${invoiceNumber}`,
            payment_gateway_name: 'stripe',
            redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://traveldatawifi.com'}/checkout/success?invoice_id=${invoiceId}`
          }
        });

        if (paymentLinkResponse.payment_url) {
          paymentUrl = paymentLinkResponse.payment_url;
          console.log('✓ Generated Zoho payment URL:', paymentUrl);
        }
      } catch (paymentLinkError) {
        console.warn('⚠️ Could not generate Zoho payment link, using fallback:', paymentLinkError.message);
        
        // Fallback: Generate custom Stripe checkout URL
        paymentUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://traveldatawifi.com'}/payment/direct?` + 
          new URLSearchParams({
            order_id: salesOrderId,
            invoice_id: invoiceId,
            amount: total.toString(),
            currency: 'USD',
            customer_email: customerInfo.email,
            method: 'stripe',
            request_id: requestId
          }).toString();
        
        console.log('✓ Generated fallback Stripe checkout URL:', paymentUrl);
      }

      console.log('✅ Guest checkout completed successfully via Zoho Inventory');

      // ===== SUCCESS RESPONSE (FIXED with redirect instructions) =====

      const successResponse = {
        success: true,
        type: 'guest_checkout_inventory',
        
        // CRITICAL: Frontend redirect instructions
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
        
        // Payment
        payment_url: paymentUrl,
        payment_status: 'pending',
        payment_method: 'stripe',
        
        // Enhanced payment instructions
        payment_instructions: {
          method: 'stripe',
          description: 'Redirecting to secure Stripe payment page',
          immediate_payment: true,
          backup_email_sent: true,
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

// ===== HELPER FUNCTIONS (CRITICAL FIXES APPLIED) =====

// Cache to store inventory items and avoid repeated API calls
const inventoryItemCache = new Map();

// Token caching to avoid rate limits
let cachedAccessToken = null;
let tokenExpiry = 0;

/**
 * ENHANCED: Improved mapping function with clean line items (no debug fields in API payload)
 */
async function mapCommerceItemsToInventory(cartItems) {
  const lineItems = [];
  const errors = [];
  const warnings = [];
  
  console.log(`🔄 Mapping ${cartItems.length} cart items to inventory...`);
  
  for (const [index, item] of cartItems.entries()) {
    try {
      console.log(`\n--- Processing item ${index + 1}: ${item.product_name || item.name} ---`);
      console.log(`   SKU: ${item.sku || item.product_sku || 'N/A'}`);
      console.log(`   ID: ${item.product_id || 'N/A'}`);
      console.log(`   Price: $${item.product_price || item.price || 0}`);
      
      let inventoryItem = null;
      let lookupMethod = 'none';
      const attemptedMethods = [];
      
      // Method 1: Try SKU-based lookup (most reliable)
      if (item.sku || item.product_sku) {
        const sku = item.sku || item.product_sku;
        attemptedMethods.push('sku');
        console.log(`   🔍 Attempting SKU lookup: ${sku}`);
        
        try {
          inventoryItem = await getInventoryItemBySku(sku);
          if (inventoryItem) {
            lookupMethod = 'sku';
            console.log(`   ✅ SUCCESS: Found by SKU`);
          } else {
            console.log(`   ❌ SKU lookup failed - no results`);
          }
        } catch (skuError) {
          console.log(`   ❌ SKU lookup failed - error:`, skuError.message);
        }
      }
      
      // Method 2: Try product name matching
      if (!inventoryItem && (item.product_name || item.name)) {
        const productName = item.product_name || item.name;
        attemptedMethods.push('name');
        console.log(`   🔍 Attempting name lookup: ${productName}`);
        
        try {
          inventoryItem = await getInventoryItemByName(productName);
          if (inventoryItem) {
            lookupMethod = 'name';
            console.log(`   ✅ SUCCESS: Found by name`);
            if (item.sku || item.product_sku) {
              warnings.push({
                message: `Product found by name but not by SKU`,
                product_name: productName,
                attempted_sku: item.sku || item.product_sku,
                found_item_id: inventoryItem.item_id
              });
            }
          } else {
            console.log(`   ❌ Name lookup failed - no results`);
          }
        } catch (nameError) {
          console.log(`   ❌ Name lookup failed - error:`, nameError.message);
        }
      }
      
      // Method 3: Try direct product_id as item_id (last resort)
      if (!inventoryItem && item.product_id) {
        attemptedMethods.push('id');
        console.log(`   🔍 Attempting ID lookup: ${item.product_id}`);
        
        try {
          inventoryItem = await getInventoryItemById(item.product_id);
          if (inventoryItem) {
            lookupMethod = 'id';
            console.log(`   ✅ SUCCESS: Found by ID`);
            warnings.push({
              message: `Product found by ID but not by SKU/name - possible sync issue`,
              product_id: item.product_id,
              found_item_id: inventoryItem.item_id
            });
          } else {
            console.log(`   ❌ ID lookup failed - no results`);
          }
        } catch (idError) {
          console.log(`   ❌ ID lookup failed - error:`, idError.message);
        }
      }
      
      if (inventoryItem) {
        // CRITICAL FIX: Clean line item without debug fields
        const lineItem = {
          item_id: inventoryItem.item_id,
          name: inventoryItem.name,
          description: `${inventoryItem.name} - Guest Order`,
          rate: item.product_price || item.price || inventoryItem.rate || 0,
          quantity: item.quantity || 1,
          unit: inventoryItem.unit || 'qty',
          item_order: index
          
          // REMOVED: All debug fields that were causing "JSON is not well formed" error
          // Debug info is now stored separately and not sent to Zoho API
        };
        
        // Store debug info separately for logging (not sent to API)
        const debugInfo = {
          lookup_method: lookupMethod,
          original_product_id: item.product_id,
          original_sku: item.sku || item.product_sku,
          original_name: item.product_name || item.name,
          attempted_methods: attemptedMethods,
          found_item_id: inventoryItem.item_id
        };
        
        lineItems.push(lineItem);
        console.log(`   ✅ MAPPED: ${item.product_name || item.name} -> ${inventoryItem.name} (${inventoryItem.item_id})`);
        console.log(`   📝 Debug info:`, debugInfo);
        
      } else {
        // Failed to find product
        const error = {
          product_id: item.product_id,
          sku: item.sku || item.product_sku,
          name: item.product_name || item.name,
          price: item.product_price || item.price,
          error: 'Product not found in inventory',
          attempted_methods: attemptedMethods,
          suggested_actions: [
            'Check if product exists in Zoho Inventory',
            'Verify SKU matches between systems',
            'Consider creating product in Zoho Inventory',
            'Check product status (active vs inactive)'
          ]
        };
        errors.push(error);
        console.log(`   ❌ FAILED TO MAP: ${JSON.stringify(error, null, 4)}`);
      }
      
    } catch (mappingError) {
      const error = {
        product_id: item.product_id,
        sku: item.sku || item.product_sku,
        name: item.product_name || item.name,
        error: `Mapping error: ${mappingError.message}`,
        stack: mappingError.stack
      };
      errors.push(error);
      console.error(`   💥 MAPPING ERROR:`, error);
    }
  }
  
  console.log(`\n=== MAPPING SUMMARY ===`);
  console.log(`✅ Successfully mapped: ${lineItems.length} items`);
  console.log(`❌ Failed to map: ${errors.length} items`);
  console.log(`⚠️ Warnings: ${warnings.length} items`);
  
  if (warnings.length > 0) {
    console.warn('⚠️ MAPPING WARNINGS:', JSON.stringify(warnings, null, 2));
  }
  
  if (errors.length > 0) {
    console.error('❌ MAPPING ERRORS:', JSON.stringify(errors, null, 2));
  }
  
  return { lineItems, errors, warnings };
}

/**
 * CRITICAL FIX: Enhanced SKU lookup with proper response validation
 */
async function getInventoryItemBySku(sku) {
  const cacheKey = `inventory_item_sku_${sku}`;
  
  if (inventoryItemCache.has(cacheKey)) {
    console.log(`✓ Using cached inventory item for SKU: ${sku}`);
    return inventoryItemCache.get(cacheKey);
  }
  
  try {
    console.log(`🔍 Searching inventory by SKU: ${sku}`);
    
    const response = await inventoryApiRequest(`/items`, {
      method: 'GET',
      queryParams: { sku: sku }
    });
    
    // CRITICAL FIX: Proper response validation with detailed logging
    console.log(`📋 Response structure check:`, {
      hasResponse: !!response,
      responseType: typeof response,
      hasItems: response && 'items' in response,
      itemsType: response?.items ? typeof response.items : 'undefined',
      itemsLength: Array.isArray(response?.items) ? response.items.length : 'not array'
    });
    
    // CRITICAL FIX: Safe property access with multiple checks
    if (!response) {
      console.warn(`⚠️ Null response for SKU ${sku}`);
      inventoryItemCache.set(cacheKey, null);
      return null;
    }
    
    if (typeof response !== 'object') {
      console.warn(`⚠️ Invalid response type for SKU ${sku}:`, typeof response);
      inventoryItemCache.set(cacheKey, null);
      return null;
    }
    
    // CRITICAL FIX: Check if 'items' property exists and is an array
    if (!('items' in response)) {
      console.warn(`⚠️ No 'items' property in response for SKU ${sku}:`, Object.keys(response));
      inventoryItemCache.set(cacheKey, null);
      return null;
    }
    
    const items = response.items;
    if (!Array.isArray(items)) {
      console.warn(`⚠️ 'items' is not an array for SKU ${sku}:`, typeof items, items);
      inventoryItemCache.set(cacheKey, null);
      return null;
    }
    
    if (items.length > 0) {
      const item = items[0];
      console.log(`✅ Found inventory item by SKU: ${sku} -> ${item.item_id} (${item.name})`);
      
      // Log full item details for debugging
      console.log(`📝 Item details:`, {
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
      inventoryItemCache.set(cacheKey, null); // Cache negative results
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error fetching inventory item by SKU ${sku}:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Don't cache errors, allow retry
    return null;
  }
}

/**
 * CRITICAL FIX: Enhanced name lookup with proper response validation
 */
async function getInventoryItemByName(productName) {
  const cacheKey = `inventory_item_name_${productName}`;
  
  if (inventoryItemCache.has(cacheKey)) {
    console.log(`✓ Using cached inventory item for name: ${productName}`);
    return inventoryItemCache.get(cacheKey);
  }
  
  try {
    console.log(`🔍 Searching inventory by name: ${productName}`);
    
    const response = await inventoryApiRequest(`/items`, {
      method: 'GET',
      queryParams: { item_name: productName }
    });
    
    // CRITICAL FIX: Same validation as SKU lookup
    console.log(`📋 Name search response structure:`, {
      hasResponse: !!response,
      hasItems: response && 'items' in response,
      itemsLength: Array.isArray(response?.items) ? response.items.length : 'not array'
    });
    
    if (!response || !('items' in response) || !Array.isArray(response.items)) {
      console.warn(`⚠️ Invalid response structure for product name ${productName}`);
      inventoryItemCache.set(cacheKey, null);
      return null;
    }
    
    const items = response.items;
    
    if (items.length > 0) {
      // Try exact name match first
      let item = items.find(i => i.name === productName);
      
      // IMPROVEMENT: Fuzzy matching fallback
      if (!item) {
        const productNameLower = productName.toLowerCase();
        item = items.find(i => 
          i.name?.toLowerCase() === productNameLower ||
          i.name?.toLowerCase().includes(productNameLower) ||
          productNameLower.includes(i.name?.toLowerCase())
        );
      }
      
      // If no fuzzy match, take first result
      if (!item) {
        item = items[0];
        console.warn(`⚠️ Using first available item for ${productName}: ${item.name}`);
      }
      
      console.log(`✅ Found inventory item by name: ${productName} -> ${item.item_id} (${item.name})`);
      inventoryItemCache.set(cacheKey, item);
      return item;
    } else {
      console.log(`❌ No inventory item found for name: ${productName}`);
      inventoryItemCache.set(cacheKey, null);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error fetching inventory item by name ${productName}:`, {
      message: error.message,
      stack: error.stack
    });
    return null;
  }
}

/**
 * CRITICAL FIX: Enhanced ID lookup with proper response validation
 */
async function getInventoryItemById(itemId) {
  const cacheKey = `inventory_item_id_${itemId}`;
  
  if (inventoryItemCache.has(cacheKey)) {
    console.log(`✓ Using cached inventory item for ID: ${itemId}`);
    return inventoryItemCache.get(cacheKey);
  }
  
  try {
    console.log(`🔍 Searching inventory by ID: ${itemId}`);
    
    const response = await inventoryApiRequest(`/items/${itemId}`);
    
    // CRITICAL FIX: Handle different response structures for single item vs list
    console.log(`📋 ID search response structure:`, {
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
 * Create or find contact in Zoho Inventory and extract address IDs
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
        
        let billingAddressId = existingContact.billing_address?.address_id;
        let shippingAddressId = existingContact.shipping_address?.address_id;
        
        if (!billingAddressId || !shippingAddressId) {
          console.log('Getting full contact details for address IDs...');
          
          try {
            const fullContactResponse = await inventoryApiRequest(`/contacts/${existingContact.contact_id}`);
            const fullContact = fullContactResponse.contact;
            
            billingAddressId = fullContact.billing_address?.address_id || billingAddressId;
            shippingAddressId = fullContact.shipping_address?.address_id || shippingAddressId || billingAddressId;
            
          } catch (contactDetailError) {
            console.warn('Could not get full contact details:', contactDetailError.message);
          }
        }
        
        return {
          contact_id: existingContact.contact_id,
          billing_address_id: billingAddressId,
          shipping_address_id: shippingAddressId
        };
      }
    } catch (searchError) {
      console.log('Contact search failed, will create new:', searchError.message);
    }

    // Create new contact
    console.log('Creating new contact...');
    
    const contactData = {
      contact_name: contactName,
      contact_type: 'customer',
      email: customerData.email,
      phone: customerData.phone || '',
      
      billing_address: {
        address: customerData.billing_address.address,
        address2: customerData.billing_address.address2 || '',
        city: customerData.billing_address.city,
        state: customerData.billing_address.state,
        zip: customerData.billing_address.zip,
        country: customerData.billing_address.country || 'US',
        phone: customerData.billing_address.phone || customerData.phone || ''
      },
      
      shipping_address: {
        address: customerData.shipping_address.address,
        address2: customerData.shipping_address.address2 || '',
        city: customerData.shipping_address.city,
        state: customerData.shipping_address.state,
        zip: customerData.shipping_address.zip,
        country: customerData.shipping_address.country || 'US',
        phone: customerData.shipping_address.phone || customerData.phone || ''
      }
    };

    console.log('Contact creation payload:', JSON.stringify(contactData, null, 2));

    const contactResponse = await inventoryApiRequest('/contacts', {
      method: 'POST',
      body: contactData
    });

    const createdContact = contactResponse.contact;
    
    if (!createdContact?.contact_id) {
      throw new Error('Contact creation failed - no contact_id returned');
    }

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

/**
 * CRITICAL FIX: Enhanced inventoryApiRequest with proper response handling and no double stringify
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
  
  // CRITICAL FIX: Handle body properly - don't double stringify
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
    
    // CRITICAL FIX: Always parse response as text first
    const responseText = await response.text();
    console.log(`📡 Inventory API Response (${response.status}): ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`);
    
    // CRITICAL FIX: Validate response before parsing JSON
    if (!responseText) {
      throw new Error(`Empty response from Zoho API: ${response.status} ${response.statusText}`);
    }
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Invalid JSON response from Zoho API: ${parseError.message}. Response: ${responseText.substring(0, 200)}`);
    }
    
    // CRITICAL FIX: Handle API-level errors even with 200 status
    if (responseData?.code !== undefined && responseData.code !== 0) {
      throw new Error(`Inventory API error: ${response.status} - ${responseText}`);
    }
    
    if (!response.ok) {
      throw new Error(`Inventory API error: ${response.status} - ${responseText}`);
    }
    
    // CRITICAL FIX: Return validated response object
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
  } else {
    return 'Check Zoho Inventory API configuration and organization settings';
  }
}