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
 * Merge inventory products with commerce images using multiple matching strategies
 * Based on debug findings: Product IDs actually DO match, but Commerce API has no images
 */
function mergeInventoryWithCommerceImagesBySKU(inventoryProducts, commerceProducts) {
  console.log(`Merging ${inventoryProducts.length} inventory products with ${commerceProducts.length} commerce products`);
  
  // Debug: Check what fields commerce products actually have
  if (commerceProducts.length > 0) {
    console.log('Commerce product sample:', {
      product_id: commerceProducts[0].product_id,
      product_name: commerceProducts[0].product_name,
      has_images: !!(commerceProducts[0].product_images?.length),
      image_count: commerceProducts[0].product_images?.length || 0,
      all_fields: Object.keys(commerceProducts[0])
    });
  }
  
  // Create lookup maps for different matching strategies
  const commerceByProductId = new Map();
  const commerceByName = new Map();
  let totalCommerceImagesFound = 0;
  
  commerceProducts.forEach(commerceProduct => {
    // Strategy 1: Match by product ID (appears to be the same between APIs)
    if (commerceProduct.product_id) {
      commerceByProductId.set(commerceProduct.product_id, commerceProduct);
    }
    
    // Strategy 2: Match by name (backup)
    if (commerceProduct.product_name && commerceProduct.product_name.trim() !== '') {
      const nameKey = commerceProduct.product_name.trim().toLowerCase();
      commerceByName.set(nameKey, commerceProduct);
    }
    
    // Count images
    if (commerceProduct.product_images && commerceProduct.product_images.length > 0) {
      totalCommerceImagesFound += commerceProduct.product_images.length;
    }
  });
  
  console.log(`Created lookup maps:`);
  console.log(`  Product ID map: ${commerceByProductId.size} entries`);
  console.log(`  Name map: ${commerceByName.size} entries`);
  console.log(`  Total commerce images found: ${totalCommerceImagesFound}`);
  
  let productIdMatches = 0;
  let nameMatches = 0;
  let noMatches = 0;
  let totalImagesAdded = 0;
  
  return inventoryProducts.map(inventoryProduct => {
    let matchingCommerceProduct = null;
    let matchStrategy = 'none';
    
    // Strategy 1: Match by product ID (most reliable since they appear to be the same)
    if (inventoryProduct.item_id) {
      matchingCommerceProduct = commerceByProductId.get(inventoryProduct.item_id);
      if (matchingCommerceProduct) {
        matchStrategy = 'product_id';
        productIdMatches++;
        console.log(`✓ Product ID match: ${inventoryProduct.item_id} -> ${matchingCommerceProduct.product_name}`);
      }
    }
    
    // Strategy 2: Try name matching if product ID didn't work
    if (!matchingCommerceProduct && inventoryProduct.name && inventoryProduct.name.trim() !== '') {
      const nameKey = inventoryProduct.name.trim().toLowerCase();
      matchingCommerceProduct = commerceByName.get(nameKey);
      if (matchingCommerceProduct) {
        matchStrategy = 'name';
        nameMatches++;
        console.log(`✓ Name match: "${inventoryProduct.name}" -> ${matchingCommerceProduct.product_id}`);
      }
    }
    
    if (!matchingCommerceProduct) {
      noMatches++;
      console.log(`⚠️ No match found for: ID="${inventoryProduct.item_id}" Name="${inventoryProduct.name}"`);
    }
    
    // Check for images
    const commerceImages = matchingCommerceProduct?.product_images || [];
    if (commerceImages.length > 0) {
      totalImagesAdded += commerceImages.length;
      console.log(`✓ Found ${commerceImages.length} images for ${inventoryProduct.name}`);
    } else if (matchingCommerceProduct) {
      console.log(`⚠️ Matched product has no images: ${inventoryProduct.name}`);
    }
    
    // Merge the products
    const mergedProduct = {
      ...inventoryProduct,
      // Add images from commerce product if found
      commerce_images: commerceImages,
      // Keep track of matching info
      has_commerce_match: !!matchingCommerceProduct,
      commerce_product_id: matchingCommerceProduct?.product_id || null,
      commerce_product_name: matchingCommerceProduct?.product_name || null,
      match_strategy: matchStrategy,
      matching_sku: inventoryProduct.sku || 'no_sku'
    };
    
    return mergedProduct;
  });
  
  console.log(`\n=== MATCHING SUMMARY ===`);
  console.log(`Product ID matches: ${productIdMatches}`);
  console.log(`Name matches: ${nameMatches}`);
  console.log(`No matches: ${noMatches}`);
  console.log(`Total images added: ${totalImagesAdded}`);
}

/**
 * Transform merged products to expected frontend format
 */
function transformProducts(products) {
  return products.map(product => {
    // Extract images using Zoho Commerce CDN pattern
    let productImages = [];
    
    if (product.has_commerce_match && product.commerce_product_id) {
      // Use the matched commerce product to construct CDN URLs
      const commerceProduct = {
        product_id: product.commerce_product_id,
        product_name: product.commerce_product_name,
        documents: product.documents || [], // This might be in the commerce match
        document_name: product.document_name // Single document field
      };
      productImages = extractCommerceImages(commerceProduct);
    }
    
    // If no commerce images, try using inventory product data
    if (productImages.length === 0) {
      // Try to construct CDN URLs using inventory product ID
      const inventoryAsCommerce = {
        product_id: product.item_id,
        product_name: product.name,
        documents: product.documents || [],
        document_name: product.image_name // Use inventory image_name as document_name
      };
      productImages = extractCommerceImages(inventoryAsCommerce);
    }
    
    return {
      // Use Inventory API field names as primary
      product_id: product.item_id,
      product_name: product.name,
      product_price: product.rate || 0,
      product_description: product.description || '',
      
      // Use constructed CDN images
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
      matching_sku: product.matching_sku,
      image_source: 'zoho_commerce_cdn'
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

/**
 * Extract images using Zoho Commerce CDN pattern
 * Based on live site analysis: images are served from us.zohocommercecdn.com
 */
function extractCommerceImages(product) {
  const images = [];
  
  // Check for documents array which may contain image filenames
  if (product.documents && Array.isArray(product.documents)) {
    product.documents.forEach(doc => {
      if (doc.document_name && isImageFile(doc.document_name)) {
        // Construct Zoho Commerce CDN URL
        const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.document_name}/${product.product_id}/400x400?storefront_domain=www.traveldatawifi.com`;
        images.push(imageUrl);
        console.log(`✓ Constructed CDN image: ${imageUrl}`);
      }
    });
  }
  
  // Check for document_name field (single image)
  if (product.document_name && isImageFile(product.document_name)) {
    const imageUrl = `https://us.zohocommercecdn.com/product-images/${product.document_name}/${product.product_id}/400x400?storefront_domain=www.traveldatawifi.com`;
    images.push(imageUrl);
    console.log(`✓ Constructed single CDN image: ${imageUrl}`);
  }
  
  // Try alternative image fields that might exist
  const imageFields = ['image_name', 'image_file', 'image_filename'];
  imageFields.forEach(field => {
    if (product[field] && isImageFile(product[field])) {
      const imageUrl = `https://us.zohocommercecdn.com/product-images/${product[field]}/${product.product_id}/400x400?storefront_domain=www.traveldatawifi.com`;
      images.push(imageUrl);
      console.log(`✓ Constructed CDN image from ${field}: ${imageUrl}`);
    }
  });
  
  // If no images found but we have a product_id, try some common patterns
  if (images.length === 0 && product.product_id) {
    console.log(`⚠️ No image files found for product ${product.product_id} (${product.product_name || product.name})`);
    
    // Log what fields are available for debugging
    const availableFields = Object.keys(product).filter(key => 
      key.toLowerCase().includes('image') || 
      key.toLowerCase().includes('document') || 
      key.toLowerCase().includes('file')
    );
    console.log(`Available image/document fields: ${availableFields.join(', ')}`);
  }
  
  return [...new Set(images)]; // Remove duplicates
}

/**
 * Check if filename is an image file
 */
function isImageFile(filename) {
  if (!filename || typeof filename !== 'string') return false;
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const lowerFilename = filename.toLowerCase();
  
  return imageExtensions.some(ext => lowerFilename.endsWith(ext));
}