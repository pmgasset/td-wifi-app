// src/pages/api/products.js - Inventory for custom fields + Commerce for images (matched by SKU)

// Import both API clients
let zohoAPI, zohoInventoryAPI;
try {
  // Import Commerce API (for images)
  const commerceModule = await import('../../lib/zoho-api');
  zohoAPI = commerceModule.zohoAPI;
} catch {
  console.log('Commerce API not available');
}

try {
  // Import Inventory API (for custom fields)  
  const inventoryModule = await import('../../lib/zoho-api-inventory');
  zohoInventoryAPI = inventoryModule.zohoInventoryAPI;
} catch {
  console.log('Inventory API not available - using fallback');
}

export default async function handler(req, res) {
  console.log('Products API called - Method:', req.method);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported',
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log('Fetching products using Inventory (custom fields) + Commerce (images) approach...');
    
    // Step 1: Get products from Inventory API (for custom fields)
    const inventoryProducts = await fetchInventoryProducts();
    console.log(`Fetched ${inventoryProducts.length} products from Inventory API`);
    
    // Step 2: Filter based on cf_display_in_app
    const filteredProducts = filterProductsByDisplayInApp(inventoryProducts);
    console.log(`Filtered to ${filteredProducts.length} products with display_in_app=true`);
    
    // Step 3: Get products from Commerce API (for images)
    let commerceProducts = [];
    if (zohoAPI) {
      try {
        console.log('Fetching images from Commerce API...');
        commerceProducts = await zohoAPI.getProducts();
        console.log(`Fetched ${commerceProducts.length} products from Commerce API`);
      } catch (commerceError) {
        console.warn('Failed to fetch from Commerce API:', commerceError.message);
        // Continue without images rather than failing
      }
    }
    
    // Step 4: Merge inventory products with commerce images by SKU
    const enrichedProducts = mergeInventoryWithCommerceImagesBySKU(filteredProducts, commerceProducts);
    
    // Step 5: Transform to expected format
    const transformedProducts = transformProducts(enrichedProducts);
    
    // Step 6: Filter for active products only
    const activeProducts = transformedProducts.filter(product => {
      const status = product.status || product.product_status;
      return status === 'active';
    });
    
    console.log(`Final result: ${activeProducts.length} active products with display_in_app=true`);
    
    // Add debug info for the first few products
    if (activeProducts.length > 0) {
      console.log('Sample product structure:', {
        id: activeProducts[0].product_id,
        name: activeProducts[0].product_name,
        sku: activeProducts[0].sku,
        price: activeProducts[0].product_price,
        hasImages: (activeProducts[0].product_images?.length || 0) > 0,
        imageCount: activeProducts[0].product_images?.length || 0,
        cf_display_in_app: activeProducts[0].cf_display_in_app,
        status: activeProducts[0].status
      });
    }
    
    res.status(200).json({ 
      products: activeProducts,
      meta: {
        total_inventory_products: inventoryProducts.length,
        display_in_app_products: filteredProducts.length,
        active_display_products: activeProducts.length,
        commerce_products_fetched: commerceProducts.length,
        products_with_images: activeProducts.filter(p => p.product_images?.length > 0).length,
        timestamp: new Date().toISOString(),
        api_approach: 'inventory_commerce_hybrid',
        custom_field_filter: 'cf_display_in_app = true',
        matching_strategy: 'SKU'
      }
    });
  } catch (error) {
    console.error('Products API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch products',
      details: error.message,
      timestamp: new Date().toISOString(),
      errorType: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Fetch products from Zoho Inventory API
 */
async function fetchInventoryProducts() {
  if (zohoInventoryAPI) {
    return await zohoInventoryAPI.getInventoryProducts();
  }
  
  // Fallback to direct API call if inventory client not available
  return await makeDirectInventoryCall();
}

/**
 * Direct API call to Inventory (fallback)
 */
async function makeDirectInventoryCall() {
  const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID;
  if (!organizationId) {
    throw new Error('ZOHO_INVENTORY_ORGANIZATION_ID environment variable is required');
  }
  
  // Get access token
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
    throw new Error(`Token refresh failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  
  // Call Inventory API
  const url = `https://www.zohoapis.com/inventory/v1/items?organization_id=${organizationId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Zoho-oauthtoken ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Inventory API failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.items || [];
}

/**
 * Filter products based on cf_display_in_app custom field
 * Custom fields are direct properties in Inventory API response
 */
function filterProductsByDisplayInApp(products) {
  console.log(`Filtering ${products.length} products for display_in_app=true`);
  
  return products.filter(product => {
    const displayInAppString = product.cf_display_in_app;
    const displayInAppBoolean = product.cf_display_in_app_unformatted;
    
    const isDisplayInApp = 
      displayInAppBoolean === true ||
      displayInAppString === 'true' ||
      displayInAppString === 'True' ||
      displayInAppString === 'TRUE' ||
      displayInAppString === '1' ||
      displayInAppString === 1;
    
    if (isDisplayInApp) {
      console.log(`✓ Including ${product.item_id} (${product.name}) - SKU: ${product.sku}`);
    }
    
    return isDisplayInApp;
  });
}

/**
 * Merge inventory products with commerce images by SKU matching
 * This is the critical function for matching products between the two APIs
 */
function mergeInventoryWithCommerceImagesBySKU(inventoryProducts, commerceProducts) {
  console.log(`Merging ${inventoryProducts.length} inventory products with ${commerceProducts.length} commerce products by SKU`);
  
  // Create a SKU lookup map for commerce products
  const commerceBySKU = new Map();
  commerceProducts.forEach(commerceProduct => {
    if (commerceProduct.sku && commerceProduct.sku.trim() !== '') {
      commerceBySKU.set(commerceProduct.sku.trim().toLowerCase(), commerceProduct);
    }
  });
  
  console.log(`Created commerce SKU map with ${commerceBySKU.size} entries`);
  
  return inventoryProducts.map(inventoryProduct => {
    let matchingCommerceProduct = null;
    
    // Try to find matching commerce product by SKU
    if (inventoryProduct.sku && inventoryProduct.sku.trim() !== '') {
      const skuKey = inventoryProduct.sku.trim().toLowerCase();
      matchingCommerceProduct = commerceBySKU.get(skuKey);
      
      if (matchingCommerceProduct) {
        console.log(`✓ SKU match found: ${inventoryProduct.sku} -> Commerce product ${matchingCommerceProduct.product_id}`);
      } else {
        console.log(`⚠️ No SKU match for: ${inventoryProduct.sku} (${inventoryProduct.name})`);
      }
    } else {
      console.log(`⚠️ Inventory product ${inventoryProduct.item_id} has no SKU`);
    }
    
    // Merge the products
    const mergedProduct = {
      ...inventoryProduct,
      // Add images from commerce product if found
      commerce_images: matchingCommerceProduct?.product_images || [],
      // Keep track of matching info
      has_commerce_match: !!matchingCommerceProduct,
      commerce_product_id: matchingCommerceProduct?.product_id || null,
      matching_sku: inventoryProduct.sku
    };
    
    return mergedProduct;
  });
}

/**
 * Transform merged products to expected frontend format
 */
function transformProducts(products) {
  return products.map(product => {
    // Use commerce images if available, otherwise empty array
    const productImages = product.commerce_images && product.commerce_images.length > 0 
      ? product.commerce_images 
      : [];
    
    return {
      // Use Inventory API field names as primary
      product_id: product.item_id,
      product_name: product.name,
      product_price: product.rate || 0,
      product_description: product.description || '',
      
      // Use commerce images
      product_images: productImages,
      
      // Stock/inventory information from Inventory API
      inventory_count: parseStock(product.stock_on_hand || product.available_stock),
      
      // Category information
      product_category: product.category_name || product.group_name || '',
      category_id: product.category_id || product.group_id,
      
      // Product status and visibility
      status: product.status,
      
      // SEO and URL
      seo_url: product.sku || product.item_id,
      
      // Custom fields (the whole reason we're using Inventory API)
      cf_display_in_app: product.cf_display_in_app_unformatted || product.cf_display_in_app,
      
      // Additional fields
      sku: product.sku,
      item_type: product.item_type,
      product_type: product.product_type,
      show_in_storefront: product.show_in_storefront,
      
      // Pricing details
      rate: product.rate,
      purchase_rate: product.purchase_rate,
      
      // Stock details
      stock_on_hand: product.stock_on_hand,
      available_stock: product.available_stock,
      reorder_level: product.reorder_level,
      
      // Timestamps
      created_time: product.created_time,
      last_modified_time: product.last_modified_time,
      
      // Debug info (helpful for troubleshooting)
      has_commerce_images: productImages.length > 0,
      has_commerce_match: product.has_commerce_match,
      commerce_product_id: product.commerce_product_id,
      matching_sku: product.matching_sku
    };
  });
}

/**
 * Parse stock information consistently
 */
function parseStock(stockValue) {
  if (stockValue === null || stockValue === undefined || stockValue === '') {
    return 0;
  }
  
  const parsed = typeof stockValue === 'string' ? parseFloat(stockValue) : Number(stockValue);
  return isNaN(parsed) ? 0 : parsed;
}