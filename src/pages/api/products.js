// ===== src/pages/api/products.js ===== (FIXED WITH STOREFRONT API IMAGES)
import { zohoInventoryAPI } from '../../lib/zoho-api-inventory';
import { zohoAPI } from '../../lib/zoho-api.ts';
import { redis } from '../../lib/redis';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cacheKey = 'products:all';
    const forceRefresh = req.query.refresh === 'true';

    if (!forceRefresh) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log('🗃️ Returning cached products');
        return res.status(200).json(cached);
      }
    }

    console.log('🚀 Starting FIXED products API with Storefront images...');

    const startTime = Date.now();

    // Step 1: Get products from Inventory API (has custom fields)
    console.log('📦 Fetching products from Zoho Inventory API...');
    const inventoryProducts = await zohoInventoryAPI.getInventoryProducts();
    console.log(`✅ Retrieved ${inventoryProducts.length} total inventory products`);

    // Step 2: Get products from Commerce API with FIXED Storefront images
    console.log('🖼️ Fetching products from FIXED Zoho Commerce API (Storefront + Store)...');
    const commerceProducts = await zohoAPI.getProducts(); // Now uses both Store + Storefront APIs
    console.log(`✅ Retrieved ${commerceProducts.length} commerce products with fixed images`);

    // Step 3: Filter inventory products by cf_display_in_app custom field
    console.log('🔍 Filtering products by cf_display_in_app field...');
    const filteredProducts = filterProductsByDisplayInApp(inventoryProducts);
    console.log(`✅ Found ${filteredProducts.length} products with display_in_app=true`);

    // Step 4: Merge inventory products with commerce images (now using Storefront API)
    console.log('🔄 Merging inventory products with FIXED commerce images...');
    const mergedProducts = mergeInventoryWithCommerceImages(filteredProducts, commerceProducts);

    // Step 5: Transform to expected frontend format
    console.log('🎨 Transforming products to frontend format...');
    const transformedProducts = transformProducts(mergedProducts);

    // Step 6: Filter out inactive products
    const activeProducts = transformedProducts.filter(product => 
      product.status === 'active' || product.status === 'Active' || !product.status
    );

    const processingTime = Date.now() - startTime;
    console.log(`✅ FIXED Products API completed in ${processingTime}ms`);

    // Provide detailed statistics
    const imageStats = generateImageStatistics(activeProducts);

    const response = {
      products: activeProducts,
      meta: {
        total_inventory_products: inventoryProducts.length,
        display_in_app_products: filteredProducts.length,
        active_display_products: activeProducts.length,
        commerce_products_fetched: commerceProducts.length,
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
        api_version: '2.0_fixed_storefront_images',
        fix_applied: 'storefront_api_integration',
        ...imageStats
      }
    };

    await redis.set(cacheKey, response, { ex: 60 * 60 * 24 });

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ FIXED Products API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch products',
      details: error.message,
      timestamp: new Date().toISOString(),
      errorType: error.name,
      api_version: '2.0_fixed_storefront_images',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Filter products based on cf_display_in_app custom field
 */
function filterProductsByDisplayInApp(products) {
  console.log(`🔍 Filtering ${products.length} products for display_in_app=true`);
  
  return products.filter(product => {
    // Handle both formatted and unformatted custom field values
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
      console.log(`✅ Including ${product.item_id} (${product.name}) - cf_display_in_app: ${displayInAppString || displayInAppBoolean}`);
    }
    
    return isDisplayInApp;
  });
}

/**
 * Merge inventory products with FIXED commerce images using ID mapping
 */
function mergeInventoryWithCommerceImages(inventoryProducts, commerceProducts) {
  console.log(`🔄 Merging ${inventoryProducts.length} inventory with ${commerceProducts.length} commerce products...`);
  
  // Create lookup map for commerce products by SKU and name
  const commerceLookup = new Map();
  
  commerceProducts.forEach(commerceProduct => {
    // Index by SKU (most reliable)
    if (commerceProduct.sku) {
      commerceLookup.set(`sku:${commerceProduct.sku.toLowerCase()}`, commerceProduct);
    }
    
    // Index by product name (secondary)
    if (commerceProduct.product_name || commerceProduct.name) {
      const name = (commerceProduct.product_name || commerceProduct.name).toLowerCase().trim();
      commerceLookup.set(`name:${name}`, commerceProduct);
    }
    
    // Index by product ID (if available)
    if (commerceProduct.product_id) {
      commerceLookup.set(`id:${commerceProduct.product_id}`, commerceProduct);
    }
  });

  const mergedProducts = inventoryProducts.map(inventoryProduct => {
    let matchedCommerceProduct = null;
    let matchType = 'no_match';

    // Try to find matching commerce product
    // 1. Match by SKU (most reliable)
    if (inventoryProduct.sku) {
      matchedCommerceProduct = commerceLookup.get(`sku:${inventoryProduct.sku.toLowerCase()}`);
      if (matchedCommerceProduct) matchType = 'sku_match';
    }

    // 2. Match by name if SKU match failed
    if (!matchedCommerceProduct && inventoryProduct.name) {
      const inventoryName = inventoryProduct.name.toLowerCase().trim();
      matchedCommerceProduct = commerceLookup.get(`name:${inventoryName}`);
      if (matchedCommerceProduct) matchType = 'name_match';
    }

    // Extract FIXED images from matched commerce product
    let commerceImages = [];
    if (matchedCommerceProduct && matchedCommerceProduct.product_images) {
      commerceImages = Array.isArray(matchedCommerceProduct.product_images) 
        ? matchedCommerceProduct.product_images.filter(img => img && typeof img === 'string' && img.trim() !== '')
        : [];
      
      if (commerceImages.length > 0) {
        console.log(`✅ Found ${commerceImages.length} FIXED images for ${inventoryProduct.name} (${matchType})`);
        console.log(`   Source: ${matchedCommerceProduct.image_source || 'unknown'}`);
        console.log(`   First image: ${commerceImages[0]}`);
      } else {
        console.log(`⚠️ No valid images for ${inventoryProduct.name} despite match (${matchType})`);
      }
    } else {
      console.log(`⚠️ No commerce match found for ${inventoryProduct.name}`);
    }

    return {
      ...inventoryProduct,
      // FIXED commerce image data
      commerce_images: commerceImages,
      commerce_match_type: matchType,
      has_commerce_match: !!matchedCommerceProduct,
      commerce_product_id: matchedCommerceProduct?.product_id || null,
      image_source: matchedCommerceProduct?.image_source || 'no_source'
    };
  });

  // Statistics
  const withImages = mergedProducts.filter(p => p.commerce_images.length > 0);
  const skuMatches = mergedProducts.filter(p => p.commerce_match_type === 'sku_match').length;
  const nameMatches = mergedProducts.filter(p => p.commerce_match_type === 'name_match').length;
  
  console.log(`🔄 Merge complete: ${withImages.length}/${mergedProducts.length} products have FIXED images`);
  console.log(`   📊 SKU matches: ${skuMatches}, Name matches: ${nameMatches}`);

  return mergedProducts;
}

/**
 * Transform merged products to expected frontend format with FIXED images
 */
function transformProducts(products) {
  return products.map(product => {
    // Use FIXED commerce images (full-size from Storefront API)
    let productImages = [];
    
    if (product.commerce_images && Array.isArray(product.commerce_images) && product.commerce_images.length > 0) {
      productImages = product.commerce_images; // Already processed by fixed Storefront API
      console.log(`✅ Using ${productImages.length} FIXED full-size images for ${product.name}`);
    } else {
      console.log(`⚠️ No FIXED images found for ${product.name}`);
    }
    
    return {
      // Use Inventory API field names as primary
      product_id: product.item_id,
      product_name: product.name,
      product_price: product.rate || 0,
      product_description: product.description || '',
      
      // Use the FIXED full-size images from Storefront API
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
      commerce_match_type: product.commerce_match_type,
      image_source: product.image_source || 'storefront_api_fixed'
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
  
  const parsed = typeof stockValue === 'string' ? 
    parseFloat(stockValue) : Number(stockValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Generate ENHANCED image statistics for the response
 */
function generateImageStatistics(products) {
  const productsWithImages = products.filter(p => p.has_commerce_images && p.product_images.length > 0);
  const totalImages = products.reduce((sum, p) => sum + (p.product_images?.length || 0), 0);
  
  // Analyze image sources
  const storefrontApiProducts = products.filter(p => p.image_source?.includes('storefront'));
  const storeApiProducts = products.filter(p => p.image_source?.includes('store_api'));
  
  // Analyze match types
  const skuMatches = products.filter(p => p.commerce_match_type === 'sku_match').length;
  const nameMatches = products.filter(p => p.commerce_match_type === 'name_match').length;

  return {
    products_with_images: productsWithImages.length,
    products_without_images: products.length - productsWithImages.length,
    total_images_found: totalImages,
    average_images_per_product: products.length > 0 ? (totalImages / products.length).toFixed(2) : 0,
    image_success_rate: products.length > 0 ? 
      ((productsWithImages.length / products.length) * 100).toFixed(1) + '%' : '0%',
    image_source_breakdown: {
      storefront_api: storefrontApiProducts.length,
      store_api_fallback: storeApiProducts.length,
      no_source: products.filter(p => !p.image_source || p.image_source === 'no_source').length
    },
    match_type_breakdown: {
      sku_matches: skuMatches,
      name_matches: nameMatches,
      no_matches: products.length - skuMatches - nameMatches
    },
    api_fix_status: 'storefront_integration_active'
  };
}