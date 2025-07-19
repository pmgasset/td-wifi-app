// src/pages/api/products.js - FIXED IMAGE URL CONSTRUCTION
// The issue was using inventory product IDs instead of commerce document IDs

import { zohoInventoryAPI } from '../../lib/zoho-api-inventory';
import { zohoAPI } from '../../lib/zoho-api';

// In-memory cache for products API responses
let productsCache = {
  data: null,
  timestamp: 0,
  inventoryData: null,
  commerceData: null
};

// Cache duration: 5 minutes for development, 15 minutes for production
const CACHE_DURATION = process.env.NODE_ENV === 'development' ? 5 * 60 * 1000 : 15 * 60 * 1000;

// Rate limiting: Track API calls
let apiCallTracker = {
  lastCall: 0,
  callCount: 0,
  windowStart: 0
};

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const MAX_CALLS_PER_WINDOW = 10; // Max 10 calls per minute

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 Starting products API with FIXED image URL construction...');
    
    // Check rate limiting
    const now = Date.now();
    if (now - apiCallTracker.windowStart > RATE_LIMIT_WINDOW) {
      // Reset window
      apiCallTracker.windowStart = now;
      apiCallTracker.callCount = 0;
    }
    
    apiCallTracker.callCount++;
    apiCallTracker.lastCall = now;
    
    if (apiCallTracker.callCount > MAX_CALLS_PER_WINDOW) {
      console.log('⚠️ Rate limit exceeded, using cache if available');
      if (productsCache.data && now - productsCache.timestamp < CACHE_DURATION * 2) {
        console.log('✅ Returning extended cached data due to rate limit');
        return res.status(200).json({
          ...productsCache.data,
          meta: {
            ...productsCache.data.meta,
            cached: true,
            cache_extended_due_to_rate_limit: true,
            cache_age_minutes: Math.round((now - productsCache.timestamp) / (60 * 1000))
          }
        });
      } else {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many API calls. Please wait before retrying.',
          retry_after: Math.ceil((RATE_LIMIT_WINDOW - (now - apiCallTracker.windowStart)) / 1000),
          timestamp: new Date().toISOString()
        });
      }
    }

    // Check cache first
    if (productsCache.data && now - productsCache.timestamp < CACHE_DURATION) {
      console.log(`✅ Returning cached products data (${Math.round((now - productsCache.timestamp) / 1000)}s old)`);
      return res.status(200).json({
        ...productsCache.data,
        meta: {
          ...productsCache.data.meta,
          cached: true,
          cache_age_seconds: Math.round((now - productsCache.timestamp) / 1000)
        }
      });
    }

    const startTime = Date.now();

    // Step 1: Get products from Inventory API (has custom fields)
    console.log('📦 Fetching products from Zoho Inventory API...');
    let inventoryProducts;
    try {
      inventoryProducts = await fetchInventoryProductsWithRetry();
      console.log(`✅ Retrieved ${inventoryProducts.length} total inventory products`);
    } catch (error) {
      console.error('❌ Inventory API failed:', error.message);
      if (productsCache.inventoryData) {
        console.log('⚠️ Using cached inventory data due to API failure');
        inventoryProducts = productsCache.inventoryData;
      } else {
        throw new Error(`Inventory API failed: ${error.message}`);
      }
    }

    // Step 2: Get products from Commerce API (has images) with retry
    console.log('🖼️ Fetching products from Zoho Commerce API for images...');
    let commerceProducts;
    try {
      commerceProducts = await fetchCommerceProductsWithRetry();
      console.log(`✅ Retrieved ${commerceProducts.length} commerce products`);
    } catch (error) {
      console.error('❌ Commerce API failed:', error.message);
      if (productsCache.commerceData) {
        console.log('⚠️ Using cached commerce data due to API failure');
        commerceProducts = productsCache.commerceData;
      } else {
        console.log('⚠️ Continuing without commerce images due to API failure');
        commerceProducts = [];
      }
    }

    // Cache the raw API responses
    productsCache.inventoryData = inventoryProducts;
    productsCache.commerceData = commerceProducts;

    // Step 3: Filter inventory products by cf_display_in_app custom field
    console.log('🔍 Filtering products by cf_display_in_app field...');
    const filteredProducts = filterProductsByDisplayInApp(inventoryProducts);
    console.log(`✅ Found ${filteredProducts.length} products with display_in_app=true`);

    // Step 4: Merge inventory products with commerce images
    console.log('🔄 Merging inventory products with commerce images...');
    const mergedProducts = mergeInventoryWithCommerceImagesBySKU(filteredProducts, commerceProducts);

    // Step 5: Transform to expected frontend format
    console.log('🎨 Transforming products to frontend format...');
    const transformedProducts = transformProducts(mergedProducts);

    // Step 6: Filter out inactive products
    const activeProducts = transformedProducts.filter(product => 
      product.status === 'active' || product.status === 'Active' || !product.status
    );

    const processingTime = Date.now() - startTime;
    console.log(`✅ Products API completed in ${processingTime}ms`);
    console.log(`Final result: ${activeProducts.length} active products with display_in_app=true`);
    
    const responseData = {
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
        matching_strategy: 'SKU',
        image_mode: 'fixed_document_ids',
        processing_time_ms: processingTime,
        cached: false,
        rate_limit_status: {
          calls_this_window: apiCallTracker.callCount,
          window_resets_in_seconds: Math.ceil((RATE_LIMIT_WINDOW - (now - apiCallTracker.windowStart)) / 1000)
        }
      }
    };

    // Cache the final response
    productsCache.data = responseData;
    productsCache.timestamp = now;
    
    // Add debug info for the first few products
    if (activeProducts.length > 0) {
      console.log('Sample product structure:', {
        id: activeProducts[0].product_id,
        name: activeProducts[0].product_name,
        sku: activeProducts[0].sku,
        price: activeProducts[0].product_price,
        hasImages: (activeProducts[0].product_images?.length || 0) > 0,
        imageCount: activeProducts[0].product_images?.length || 0,
        sampleImageUrl: activeProducts[0].product_images?.[0],
        cf_display_in_app: activeProducts[0].cf_display_in_app,
        status: activeProducts[0].status
      });
    }
    
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Products API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // If we have cached data and this is a rate limit error, return cached data
    if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
      if (productsCache.data) {
        console.log('⚠️ Rate limited, returning cached data');
        return res.status(200).json({
          ...productsCache.data,
          meta: {
            ...productsCache.data.meta,
            cached: true,
            cache_fallback_reason: 'rate_limited',
            cache_age_minutes: Math.round((Date.now() - productsCache.timestamp) / (60 * 1000))
          }
        });
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch products',
      details: error.message,
      timestamp: new Date().toISOString(),
      errorType: error.name,
      isRateLimited: error.message.includes('rate limit') || error.message.includes('too many requests'),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Fetch inventory products with retry logic
 */
async function fetchInventoryProductsWithRetry(maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (zohoInventoryAPI) {
        return await zohoInventoryAPI.getInventoryProducts();
      } else {
        throw new Error('Zoho Inventory API not available');
      }
    } catch (error) {
      console.log(`❌ Inventory API attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries || error.message.includes('rate limit')) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Fetch commerce products with retry logic and rate limit handling
 */
async function fetchCommerceProductsWithRetry(maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (zohoAPI) {
        return await zohoAPI.getProducts();
      } else {
        throw new Error('Zoho Commerce API not available');
      }
    } catch (error) {
      console.log(`❌ Commerce API attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries || error.message.includes('rate limit') || error.message.includes('too many requests')) {
        throw error;
      }
      
      // Wait before retry with longer delays for rate limits
      const isRateLimit = error.message.includes('rate limit') || error.message.includes('too many requests');
      const delay = isRateLimit ? 30000 + (attempt * 10000) : Math.pow(2, attempt) * 1000;
      console.log(`⏳ Waiting ${delay}ms before retry (rate limit: ${isRateLimit})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Filter products based on cf_display_in_app custom field
 */
function filterProductsByDisplayInApp(products) {
  console.log(`🔍 Filtering ${products.length} products for display_in_app=true`);
  
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
      console.log(`✅ Including ${product.item_id} (${product.name}) - cf_display_in_app: ${displayInAppString || displayInAppBoolean}`);
    }
    
    return isDisplayInApp;
  });
}

/**
 * Merge inventory products with commerce images using multiple matching strategies
 */
function mergeInventoryWithCommerceImagesBySKU(inventoryProducts, commerceProducts) {
  console.log(`🔗 Merging ${inventoryProducts.length} inventory products with ${commerceProducts.length} commerce products`);
  
  // Create lookup maps for different matching strategies
  const commerceByProductId = new Map();
  const commerceByName = new Map();
  let totalCommerceImagesFound = 0;
  
  commerceProducts.forEach(commerceProduct => {
    // Strategy 1: Match by product ID
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
  console.log(`- Commerce by Product ID: ${commerceByProductId.size} entries`);
  console.log(`- Commerce by Name: ${commerceByName.size} entries`);
  console.log(`- Total commerce images found: ${totalCommerceImagesFound}`);
  
  // Merge inventory with commerce data
  const mergedProducts = inventoryProducts.map(inventoryProduct => {
    let commerceMatch = null;
    let matchingStrategy = 'none';
    
    // Try matching by product ID first
    if (inventoryProduct.item_id && commerceByProductId.has(inventoryProduct.item_id)) {
      commerceMatch = commerceByProductId.get(inventoryProduct.item_id);
      matchingStrategy = 'product_id';
    }
    
    // Fall back to name matching if no product ID match
    if (!commerceMatch && inventoryProduct.name) {
      const nameKey = inventoryProduct.name.trim().toLowerCase();
      if (commerceByName.has(nameKey)) {
        commerceMatch = commerceByName.get(nameKey);
        matchingStrategy = 'name';
      }
    }
    
    // Extract images from commerce match
    let commerceImages = [];
    if (commerceMatch) {
      console.log(`🔍 Extracting images for product ${inventoryProduct.item_id} (${inventoryProduct.name})`);
      commerceImages = extractCommerceImages(commerceMatch);
    }
    
    return {
      ...inventoryProduct,
      commerce_images: commerceImages,
      has_commerce_match: !!commerceMatch,
      commerce_product_id: commerceMatch?.product_id,
      matching_strategy: matchingStrategy,
      matching_sku: commerceMatch?.sku || commerceMatch?.product_name
    };
  });
  
  const withImages = mergedProducts.filter(p => p.commerce_images?.length > 0);
  console.log(`✅ Merger complete: ${withImages.length}/${mergedProducts.length} products have images`);
  
  return mergedProducts;
}

/**
 * 🎯 CRITICAL FIX: Extract images using the CORRECT document IDs
 * The problem was using inventory product IDs instead of commerce document IDs
 */
function extractCommerceImages(product) {
  const images = [];
  
  console.log(`🔍 Extracting images for commerce product ${product.product_id} (${product.product_name})`);
  
  // Check for documents array which contains the ACTUAL document IDs for CDN
  if (product.documents && Array.isArray(product.documents)) {
    console.log(`Found ${product.documents.length} documents`);
    product.documents.forEach(doc => {
      // 🎯 CRITICAL FIX: Use "file_name" not "document_name"
      if (doc.file_name && isImageFile(doc.file_name)) {
        const documentId = doc.document_id || doc.id;
        if (documentId) {
          const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${documentId}/1200x1200?storefront_domain=www.traveldatawifi.com`;
          images.push(imageUrl);
          console.log(`✅ Constructed WORKING CDN image: ${imageUrl}`);
        } else {
          console.log(`⚠️ Document ${doc.file_name} missing document_id:`, doc);
        }
      } else {
        console.log(`⚠️ Skipping non-image file: ${doc.file_name || doc.document_name || 'unknown'}`);
      }
    });
  }
  
  // Check for variants with documents
  if (product.variants && Array.isArray(product.variants)) {
    product.variants.forEach(variant => {
      if (variant.documents && Array.isArray(variant.documents)) {
        variant.documents.forEach(doc => {
          // 🎯 CRITICAL FIX: Use "file_name" not "document_name"
          if (doc.file_name && isImageFile(doc.file_name)) {
            const documentId = doc.document_id || doc.id;
            if (documentId) {
              const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${documentId}/1200x1200?storefront_domain=www.traveldatawifi.com`;
              images.push(imageUrl);
              console.log(`✅ Constructed WORKING variant CDN image: ${imageUrl}`);
            } else {
              console.log(`⚠️ Variant document ${doc.file_name} missing document_id:`, doc);
            }
          }
        });
      }
    });
  }
  
  // If no images found, provide detailed debugging info
  if (images.length === 0 && product.product_id) {
    console.log(`⚠️ No image files found for product ${product.product_id} (${product.product_name || product.name})`);
    
    const availableFields = Object.keys(product).filter(key => 
      key.toLowerCase().includes('image') || 
      key.toLowerCase().includes('document') || 
      key.toLowerCase().includes('file')
    );
    console.log(`Available image/document fields: ${availableFields.join(', ')}`);
    
    if (product.documents && product.documents.length > 0) {
      console.log(`Sample document fields:`, Object.keys(product.documents[0]));
      console.log(`First document:`, product.documents[0]);
        }
  }
  
  return [...new Set(images)]; // Remove duplicates
}
/**
 * Transform merged products to expected frontend format
 */
function transformProducts(products) {
  return products.map(product => {
    // Get high-quality images
    let productImages = [];
    
    if (product.commerce_images && Array.isArray(product.commerce_images) && product.commerce_images.length > 0) {
      productImages = product.commerce_images;
      console.log(`✅ Using ${productImages.length} FIXED images for ${product.name}`);
    } else {
      console.log(`⚠️ No commerce images found for ${product.name}`);
    }
    
    return {
      // Use Inventory API field names as primary
      product_id: product.item_id,
      product_name: product.name,
      product_price: product.rate || 0,
      product_description: product.description || '',
      
      // Use the fixed images
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
      
      // Custom fields
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
      
      // Debug info
      has_commerce_images: productImages.length > 0,
      has_commerce_match: product.has_commerce_match,
      commerce_product_id: product.commerce_product_id,
      matching_sku: product.matching_sku,
      image_source: 'fixed_document_ids'
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
 * Check if filename is an image file
 */
function isImageFile(filename) {
  if (!filename || typeof filename !== 'string') return false;
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const lowerFilename = filename.toLowerCase();
  
  return imageExtensions.some(ext => lowerFilename.endsWith(ext));
}