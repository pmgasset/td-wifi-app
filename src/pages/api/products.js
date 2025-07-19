// src/pages/api/products.js - Updated with cf_display_in_app filtering

// Import the appropriate Zoho API client
// We need to use Inventory API for custom fields, so let's check both
let zohoAPI;
try {
  // Try importing the Inventory API client first
  const inventoryModule = await import('../../lib/zoho-api-inventory');
  zohoAPI = inventoryModule.zohoInventoryAPI || inventoryModule.zohoAPI;
} catch {
  try {
    // Fallback to the existing API client
    const existingModule = await import('../../lib/zoho-api');
    zohoAPI = existingModule.zohoAPI;
  } catch (importError) {
    console.error('Failed to import Zoho API:', importError);
  }
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

  // Validate that we have an API client
  if (!zohoAPI) {
    console.error('Zoho API client not available');
    return res.status(500).json({
      error: 'API configuration error',
      message: 'Zoho API client could not be initialized',
      availableMethods: 'Unable to determine',
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log('Fetching products from Zoho Inventory with custom field filtering...');
    
    // Step 1: Get all products from Inventory API (includes custom fields)
    const inventoryProducts = await fetchInventoryProducts();
    console.log(`Fetched ${inventoryProducts.length} products from Inventory`);
    
    // Step 2: Filter products based on cf_display_in_app custom field
    const filteredProducts = filterProductsByDisplayInApp(inventoryProducts);
    console.log(`Filtered to ${filteredProducts.length} products with display_in_app=true`);
    
    // Step 3: Transform to expected format for frontend
    const transformedProducts = transformProducts(filteredProducts);
    console.log(`Transformed ${transformedProducts.length} products for API response`);
    
    // Step 4: Additional filtering for active/storefront products
    const activeProducts = transformedProducts.filter(product => {
      const status = product.status || product.product_status;
      const isActive = status === 'active';
      // Only include active products in the public API
      return isActive;
    });
    
    console.log(`Final result: ${activeProducts.length} active products with display_in_app=true`);
    
    // Add debug info for the first few products
    if (activeProducts.length > 0) {
      console.log('Sample product structure:', {
        id: activeProducts[0].product_id,
        name: activeProducts[0].product_name || activeProducts[0].name,
        price: activeProducts[0].product_price || activeProducts[0].rate,
        hasCustomFields: !!(activeProducts[0].custom_fields?.length),
        displayInApp: activeProducts[0].cf_display_in_app,
        status: activeProducts[0].status
      });
    }
    
    res.status(200).json({ 
      products: activeProducts,
      meta: {
        total_inventory_products: inventoryProducts.length,
        display_in_app_products: filteredProducts.length,
        active_display_products: activeProducts.length,
        timestamp: new Date().toISOString(),
        api_client: zohoAPI.constructor.name || 'Zoho Inventory API',
        custom_field_filter: 'cf_display_in_app = true'
      }
    });
  } catch (error) {
    console.error('Products API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch products from Zoho Inventory',
      details: error.message,
      timestamp: new Date().toISOString(),
      errorType: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      suggestion: 'Ensure ZOHO_INVENTORY_ORGANIZATION_ID and custom field cf_display_in_app are configured'
    });
  }
}

/**
 * Fetch products from Zoho Inventory API
 * This API includes custom fields unlike Commerce API
 */
async function fetchInventoryProducts() {
  try {
    // Try different approaches based on available API methods
    let products = [];
    
    if (zohoAPI.getInventoryProducts) {
      // Use inventory-specific method if available
      products = await zohoAPI.getInventoryProducts();
    } else if (zohoAPI.getProducts) {
      // Use general products method
      products = await zohoAPI.getProducts();
    } else {
      // Fallback to direct API request
      const response = await makeInventoryAPIRequest('/items');
      products = response.items || [];
    }
    
    console.log(`Retrieved ${products.length} products from inventory`);
    return products;
  } catch (error) {
    console.error('Failed to fetch inventory products:', error);
    
    // Provide helpful error messages
    if (error.message.includes('organization_id')) {
      throw new Error('ZOHO_INVENTORY_ORGANIZATION_ID environment variable not configured. Please set this in your environment variables.');
    } else if (error.message.includes('401') || error.message.includes('authentication')) {
      throw new Error('Zoho Inventory API authentication failed. Please check your OAuth credentials.');
    } else {
      throw error;
    }
  }
}

/**
 * Filter products based on cf_display_in_app custom field
 * FIXED: Custom fields are direct properties, not in a custom_fields array
 */
function filterProductsByDisplayInApp(products) {
  console.log(`Starting filter with ${products.length} products`);
  
  return products.filter(product => {
    // Check for the custom field directly on the product object
    // Based on debug data, the field appears as both:
    // - cf_display_in_app (string "true"/"false") 
    // - cf_display_in_app_unformatted (boolean true/false)
    
    const displayInAppString = product.cf_display_in_app;
    const displayInAppBoolean = product.cf_display_in_app_unformatted;
    
    console.log(`Product ${product.item_id} (${product.name}):`);
    console.log(`  cf_display_in_app: ${displayInAppString} (${typeof displayInAppString})`);
    console.log(`  cf_display_in_app_unformatted: ${displayInAppBoolean} (${typeof displayInAppBoolean})`);
    
    // Check if either field indicates the product should be displayed
    const isDisplayInApp = 
      displayInAppBoolean === true ||                    // Boolean true
      displayInAppString === 'true' ||                  // String "true"
      displayInAppString === 'True' ||                  // String "True"
      displayInAppString === 'TRUE' ||                  // String "TRUE"
      displayInAppString === '1' ||                     // String "1"
      displayInAppString === 1;                         // Number 1
    
    if (!isDisplayInApp) {
      console.log(`  → EXCLUDING (display_in_app is falsy)`);
      return false;
    }
    
    console.log(`  → INCLUDING (display_in_app is true)`);
    return true;
  });
}

/**
 * Transform Inventory API products to expected frontend format
 * FIXED: Handle custom fields as direct properties
 */
function transformProducts(products) {
  return products.map(product => {
    return {
      // Use Inventory API field names
      product_id: product.item_id || product.product_id,
      product_name: product.name || product.product_name,
      product_price: product.rate || product.min_rate || product.product_price || 0,
      product_description: product.description || '',
      
      // Image handling for Inventory API
      product_images: extractInventoryImages(product),
      
      // Stock/inventory information
      inventory_count: parseStock(product.stock_on_hand || product.available_stock || product.overall_stock),
      
      // Category information
      product_category: product.category_name || product.group_name || '',
      category_id: product.category_id || product.group_id,
      
      // Product status and visibility
      status: product.status || 'active',
      
      // SEO and URL
      seo_url: product.sku || product.item_id || product.product_id,
      
      // Custom fields - now direct properties
      cf_display_in_app: product.cf_display_in_app_unformatted || product.cf_display_in_app || false,
      
      // Additional Inventory-specific fields
      sku: product.sku,
      item_type: product.item_type,
      product_type: product.product_type,
      tax_name: product.tax_name,
      tax_percentage: product.tax_percentage,
      
      // Pricing details
      min_rate: product.rate || product.min_rate,
      max_rate: product.rate || product.max_rate,
      purchase_rate: product.purchase_rate,
      
      // Stock details
      stock_on_hand: product.stock_on_hand,
      available_stock: product.available_stock,
      reorder_level: product.reorder_level,
      
      // Timestamps
      created_time: product.created_time,
      last_modified_time: product.last_modified_time,
      
      // Storefront visibility
      show_in_storefront: product.show_in_storefront
    };
  });
}

/**
 * Extract images from Inventory API product
 * Inventory API has different image structure than Commerce API
 */
function extractInventoryImages(product) {
  const images = [];
  
  // Check for image_name and image_id (common in Inventory API)
  if (product.image_name && product.image_id) {
    // Construct image URL - this might need adjustment based on your Zoho setup
    const imageUrl = `https://www.zohoapis.com/inventory/v1/items/${product.item_id}/image`;
    images.push(imageUrl);
  }
  
  // Check for documents array (can contain images)
  if (product.documents && Array.isArray(product.documents)) {
    product.documents.forEach(doc => {
      if (doc.file_type && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(doc.file_type.toLowerCase())) {
        images.push(doc.file_url || doc.download_url);
      }
    });
  }
  
  // Fallback: if no images found, return empty array
  return images;
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

/**
 * Make direct API request to Zoho Inventory
 * Fallback method if zohoAPI doesn't have the right methods
 */
async function makeInventoryAPIRequest(endpoint) {
  const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID;
  if (!organizationId) {
    throw new Error('ZOHO_INVENTORY_ORGANIZATION_ID environment variable is required');
  }
  
  // Get access token (this method varies by implementation)
  let accessToken;
  if (zohoAPI.getAccessToken) {
    accessToken = await zohoAPI.getAccessToken();
  } else {
    throw new Error('Unable to get access token - zohoAPI.getAccessToken method not available');
  }
  
  const url = `https://www.zohoapis.com/inventory/v1${endpoint}?organization_id=${organizationId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Inventory API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (data.code && data.code !== 0) {
    throw new Error(`Inventory API error: ${data.message} (Code: ${data.code})`);
  }
  
  return data;
}