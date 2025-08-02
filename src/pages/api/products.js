// src/pages/api/products.js - RESTORED: Working image URL construction with centralized token management
// CRITICAL: This restores the working image logic while keeping centralized token management

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
    console.log('🚀 Starting products API with RESTORED working image URLs...');
    
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
          retryAfter: Math.ceil((RATE_LIMIT_WINDOW - (now - apiCallTracker.windowStart)) / 1000)
        });
      }
    }

    // Check cache first
    if (productsCache.data && now - productsCache.timestamp < CACHE_DURATION) {
      console.log('✅ Returning cached products data');
      return res.status(200).json({
        ...productsCache.data,
        meta: {
          ...productsCache.data.meta,
          cached: true,
          cache_age_minutes: Math.round((now - productsCache.timestamp) / (60 * 1000))
        }
      });
    }

    const startTime = Date.now();

    // Fetch data from both APIs (with improved token management)
    console.log('📦 Fetching products from Zoho Inventory API...');
    const [inventoryProducts, commerceProducts] = await Promise.allSettled([
      fetchInventoryProductsWithRetry(),
      fetchCommerceProductsWithRetry()
    ]);

    // Handle results
    let inventoryData = [];
    let commerceData = [];

    if (inventoryProducts.status === 'fulfilled') {
      inventoryData = inventoryProducts.value;
      console.log(`✅ Retrieved ${inventoryData.length} inventory products`);
    } else {
      console.error('❌ Inventory API failed:', inventoryProducts.reason);
    }

    if (commerceProducts.status === 'fulfilled') {
      commerceData = commerceProducts.value;
      console.log(`✅ Retrieved ${commerceData.length} commerce products`);
    } else {
      console.error('❌ Commerce API failed:', commerceProducts.reason);
    }

    if (inventoryData.length === 0) {
      throw new Error('No inventory products found - check Zoho Inventory API configuration');
    }

    // Filter products based on cf_display_in_app custom field
    const filteredProducts = filterProductsByDisplayInApp(inventoryData);
    console.log(`🔍 Filtered to ${filteredProducts.length} products with display_in_app=true`);

    // Filter active products only
    const activeProducts = filterActiveProducts(filteredProducts);
    console.log(`✅ ${activeProducts.length} active products for display`);

    // CRITICAL: Use the WORKING image merger that was tested and confirmed
    const mergedProducts = mergeInventoryWithCommerceImagesBySKU(activeProducts, commerceData);
    console.log(`🔗 Merged ${mergedProducts.length} products with commerce data`);

    const processingTime = Date.now() - startTime;

    console.log(`Final result: ${activeProducts.length} active products with display_in_app=true`);
    
    const responseData = {
      products: mergedProducts,
      meta: {
        total_inventory_products: inventoryData.length,
        display_in_app_products: filteredProducts.length,
        active_display_products: activeProducts.length,
        commerce_products_fetched: commerceData.length,
        products_with_images: mergedProducts.filter(p => p.product_images?.length > 0).length,
        timestamp: new Date().toISOString(),
        api_approach: 'inventory_commerce_hybrid_restored',
        custom_field_filter: 'cf_display_in_app = true',
        matching_strategy: 'SKU',
        image_mode: 'fixed_document_ids_restored',
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
    if (mergedProducts.length > 0) {
      console.log('Sample product structure:', {
        id: mergedProducts[0].product_id,
        name: mergedProducts[0].product_name,
        sku: mergedProducts[0].sku,
        price: mergedProducts[0].product_price,
        hasImages: (mergedProducts[0].product_images?.length || 0) > 0,
        imageCount: mergedProducts[0].product_images?.length || 0,
        sampleImageUrl: mergedProducts[0].product_images?.[0],
        cf_display_in_app: mergedProducts[0].cf_display_in_app,
        status: mergedProducts[0].status
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
 * Fetch inventory products with retry logic and centralized token management
 */
async function fetchInventoryProductsWithRetry(maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (zohoInventoryAPI) {
        // The updated zohoInventoryAPI now uses centralized token management
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
 * Fetch commerce products with retry logic and centralized token management
 */
async function fetchCommerceProductsWithRetry(maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (zohoAPI) {
        // The zohoAPI should also use centralized token management
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
 * Filter active products only
 */
function filterActiveProducts(products) {
  return products.filter(product => 
    product.status === 'active' || 
    product.status === 'Active' ||
    product.status === 'ACTIVE'
  );
}

/**
 * CRITICAL: RESTORED working image merger that was confirmed working
 * This merges inventory products with commerce images using multiple matching strategies
 */
function mergeInventoryWithCommerceImagesBySKU(inventoryProducts, commerceProducts) {
  console.log(`🔗 Merging ${inventoryProducts.length} inventory products with ${commerceProducts.length} commerce products`);
  
  // Create lookup maps for different matching strategies
  const commerceByProductId = new Map();
  const commerceByName = new Map();
  const commerceBySku = new Map();
  let totalCommerceImagesFound = 0;
  
  commerceProducts.forEach(commerceProduct => {
    // Strategy 1: Match by product ID (most reliable)
    if (commerceProduct.product_id) {
      commerceByProductId.set(commerceProduct.product_id, commerceProduct);
    }
    
    // Strategy 2: Match by SKU
    if (commerceProduct.sku && commerceProduct.sku.trim() !== '') {
      commerceBySku.set(commerceProduct.sku.trim(), commerceProduct);
    }
    
    // Strategy 3: Match by name (backup)
    if (commerceProduct.product_name && commerceProduct.product_name.trim() !== '') {
      const nameKey = commerceProduct.product_name.trim().toLowerCase();
      commerceByName.set(nameKey, commerceProduct);
    }
    
    // Count total images for debugging
    const extractedImages = extractCommerceImages(commerceProduct);
    if (extractedImages.length > 0) {
      totalCommerceImagesFound += extractedImages.length;
    }
  });
  
  console.log(`Created lookup maps:`);
  console.log(`- Commerce by Product ID: ${commerceByProductId.size} entries`);
  console.log(`- Commerce by SKU: ${commerceBySku.size} entries`);
  console.log(`- Commerce by Name: ${commerceByName.size} entries`);
  console.log(`- Total commerce images found: ${totalCommerceImagesFound}`);
  
  // Merge inventory with commerce data using multiple strategies
  let productIdMatches = 0;
  let skuMatches = 0;
  let nameMatches = 0;
  let totalImagesAdded = 0;
  
  const mergedProducts = inventoryProducts.map(inventoryProduct => {
    let commerceMatch = null;
    let matchingStrategy = 'none';
    
    // Strategy 1: Try matching by product ID first (most reliable)
    if (inventoryProduct.item_id && commerceByProductId.has(inventoryProduct.item_id)) {
      commerceMatch = commerceByProductId.get(inventoryProduct.item_id);
      matchingStrategy = 'product_id';
      productIdMatches++;
    }
    
    // Strategy 2: Try matching by SKU if no product ID match
    if (!commerceMatch && inventoryProduct.sku && commerceBySku.has(inventoryProduct.sku.trim())) {
      commerceMatch = commerceBySku.get(inventoryProduct.sku.trim());
      matchingStrategy = 'sku';
      skuMatches++;
    }
    
    // Strategy 3: Fall back to name matching
    if (!commerceMatch && inventoryProduct.name) {
      const nameKey = inventoryProduct.name.trim().toLowerCase();
      if (commerceByName.has(nameKey)) {
        commerceMatch = commerceByName.get(nameKey);
        matchingStrategy = 'name';
        nameMatches++;
      }
    }
    
    // Extract images from commerce match using the WORKING pattern
    let productImages = [];
    if (commerceMatch) {
      const extractedImages = extractCommerceImages(commerceMatch);
      if (extractedImages.length > 0) {
        // Transform to full-size images (remove size restrictions)
        productImages = transformCommerceImages(extractedImages);
        totalImagesAdded += productImages.length;
        console.log(`✅ ${matchingStrategy} match for ${inventoryProduct.item_id}: ${productImages.length} images`);
      } else {
        console.log(`⚠️ No images extracted for ${inventoryProduct.item_id} despite commerce match`);
      }
    }
    
    // Transform to frontend format
    return {
      // Use Inventory API field names as primary
      product_id: inventoryProduct.item_id,
      product_name: inventoryProduct.name,
      product_price: parseFloat(inventoryProduct.rate || 0),
      product_description: inventoryProduct.description || '',
      
      // Use the extracted and transformed images
      product_images: productImages,
      
      // Stock/inventory information from Inventory API
      inventory_count: parseStock(inventoryProduct.stock_on_hand || inventoryProduct.available_stock),
      
      // Category information
      product_category: inventoryProduct.category_name || inventoryProduct.group_name || '',
      category_id: inventoryProduct.category_id || inventoryProduct.group_id,
      
      // Product status and visibility
      status: inventoryProduct.status,
      
      // SEO and URL
      seo_url: inventoryProduct.sku || inventoryProduct.item_id,
      
      // Custom fields (the whole reason we're using Inventory API)
      cf_display_in_app: inventoryProduct.cf_display_in_app_unformatted || inventoryProduct.cf_display_in_app,
      
      // Additional fields
      sku: inventoryProduct.sku,
      item_type: inventoryProduct.item_type,
      product_type: inventoryProduct.product_type || 'physical',
      
      // Pricing details
      rate: inventoryProduct.rate,
      purchase_rate: inventoryProduct.purchase_rate,
      
      // Stock details
      stock_on_hand: inventoryProduct.stock_on_hand,
      available_stock: inventoryProduct.available_stock,
      reorder_level: inventoryProduct.reorder_level,
      
      // Timestamps
      created_time: inventoryProduct.created_time,
      last_modified_time: inventoryProduct.last_modified_time,
      
      // Debug info (helpful for troubleshooting)
      has_commerce_images: productImages.length > 0,
      has_commerce_match: !!commerceMatch,
      commerce_product_id: commerceMatch?.product_id || null,
      matching_strategy: matchingStrategy,
      image_source: 'commerce_documents_restored'
    };
  });
  
  console.log(`\n=== MATCHING SUMMARY ===`);
  console.log(`Product ID matches: ${productIdMatches}`);
  console.log(`SKU matches: ${skuMatches}`);
  console.log(`Name matches: ${nameMatches}`);
  console.log(`Total images added: ${totalImagesAdded}`);
  console.log(`Products with images: ${mergedProducts.filter(p => p.product_images.length > 0).length}`);
  
  return mergedProducts;
}

/**
 * CRITICAL: RESTORED working image extraction from commerce products
 * Based on your project knowledge - images are in documents array, NOT product_images
 */
function extractCommerceImages(product) {
  const images = [];
  
  console.log(`🔍 Extracting images for commerce product ${product.product_id} (${product.product_name || product.name})`);
  
  // CRITICAL: Check documents array which contains the ACTUAL document IDs for CDN
  if (product.documents && Array.isArray(product.documents)) {
    console.log(`Found ${product.documents.length} documents`);
    product.documents.forEach(doc => {
      // Use "file_name" not "document_name" as confirmed in project knowledge
      if (doc.file_name && isImageFile(doc.file_name)) {
        const documentId = doc.document_id || doc.id;
        if (documentId) {
          // Use the WORKING CDN pattern from your project
          const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${documentId}/1200x1200?storefront_domain=www.traveldatawifi.com`;
          images.push(imageUrl);
          console.log(`✅ Constructed CDN image: ${imageUrl}`);
        } else {
          console.log(`⚠️ Document ${doc.file_name} missing document_id:`, doc);
        }
      }
    });
  }
  
  // Check variants with documents (additional images)
  if (product.variants && Array.isArray(product.variants)) {
    product.variants.forEach(variant => {
      if (variant.documents && Array.isArray(variant.documents)) {
        variant.documents.forEach(doc => {
          if (doc.file_name && isImageFile(doc.file_name)) {
            const documentId = doc.document_id || doc.id;
            if (documentId) {
              const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${documentId}/1200x1200?storefront_domain=www.traveldatawifi.com`;
              images.push(imageUrl);
              console.log(`✅ Constructed variant CDN image: ${imageUrl}`);
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
 * Transform commerce images to remove size restrictions (get full-size images)
 */
function transformCommerceImages(images) {
  return images.map(imageUrl => {
    // Check if it's a Zoho CDN URL with size restrictions
    if (imageUrl.includes('zohocommercecdn.com') && imageUrl.includes('/1200x1200')) {
      // Remove the size restriction to get full-size image
      const fullSizeUrl = imageUrl.replace(/\/\d+x\d+/, '');
      console.log(`🎨 Converted to full-size: ${imageUrl} -> ${fullSizeUrl}`);
      return fullSizeUrl;
    } else {
      // Return as-is if not a sized Zoho CDN URL
      return imageUrl;
    }
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
 * Check if filename is an image file
 */
function isImageFile(filename) {
  if (!filename || typeof filename !== 'string') return false;
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const lowerFilename = filename.toLowerCase();
  
  return imageExtensions.some(ext => lowerFilename.endsWith(ext));
}