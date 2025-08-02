// src/pages/api/products.js - RESTORED: Exact working logic from Restore Working Products API.txt
// CRITICAL: This uses the EXACT patterns that were confirmed working in your project

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
    console.log('🚀 Starting products API with RESTORED working image extraction...');
    
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

    // Fetch data from both APIs with improved error handling
    console.log('📦 Fetching products from Zoho Inventory API...');
    const inventoryProducts = await fetchInventoryProductsWithRetry();
    
    console.log('🛒 Fetching products from Zoho Commerce API...');
    let commerceProducts = [];
    try {
      commerceProducts = await fetchCommerceProductsWithRetry();
      console.log(`✅ Retrieved ${commerceProducts.length} commerce products`);
    } catch (commerceError) {
      console.warn('⚠️ Commerce API failed, continuing with inventory only:', commerceError.message);
      // Continue without commerce data - images will be empty but products will work
    }

    if (inventoryProducts.length === 0) {
      throw new Error('No inventory products found - check Zoho Inventory API configuration');
    }

    console.log(`✅ Retrieved ${inventoryProducts.length} inventory products`);

    // Filter products based on cf_display_in_app custom field
    const filteredProducts = filterProductsByDisplayInApp(inventoryProducts);
    console.log(`🔍 Filtered to ${filteredProducts.length} products with display_in_app=true`);

    // Filter active products only
    const activeProducts = filterActiveProducts(filteredProducts);
    console.log(`✅ ${activeProducts.length} active products for display`);

    // CRITICAL: Use the EXACT working merger from Restore Working Products API.txt
    const mergedProducts = mergeInventoryWithCommerceImages(activeProducts, commerceProducts);
    console.log(`🔗 Merged ${mergedProducts.length} products with commerce data`);

    // Transform to frontend format using EXACT working pattern
    const transformedProducts = transformProducts(mergedProducts);

    const processingTime = Date.now() - startTime;

    console.log(`Final result: ${transformedProducts.length} products processed`);
    
    // Generate image statistics using EXACT pattern from restore file
    const imageStats = generateImageStatistics(transformedProducts);
    
    const responseData = {
      products: transformedProducts,
      meta: {
        total_inventory_products: inventoryProducts.length,
        display_in_app_products: filteredProducts.length,
        active_display_products: activeProducts.length,
        commerce_products_fetched: commerceProducts.length,
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
        api_version: '1.0_restored_working',
        cached: false,
        rate_limit_status: {
          calls_this_window: apiCallTracker.callCount,
          window_resets_in_seconds: Math.ceil((RATE_LIMIT_WINDOW - (now - apiCallTracker.windowStart)) / 1000)
        },
        ...imageStats
      }
    };

    // Cache the final response
    productsCache.data = responseData;
    productsCache.timestamp = now;
    
    console.log(`Products API completed in ${processingTime}ms`);
    
    res.status(200).json(responseData);
  } catch (error) {
    console.error('❌ Products API Error:', {
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
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Fetch commerce products with retry logic - handles rate limits gracefully
 */
async function fetchCommerceProductsWithRetry(maxRetries = 1) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (zohoAPI) {
        return await zohoAPI.getProducts();
      } else {
        throw new Error('Zoho Commerce API not available');
      }
    } catch (error) {
      console.log(`❌ Commerce API attempt ${attempt} failed:`, error.message);
      
      // For commerce API, fail fast on rate limits to avoid breaking the whole request
      if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
        throw new Error('Commerce API rate limited - images will be unavailable');
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Filter products based on cf_display_in_app custom field
 * EXACT pattern from Restore Working Products API.txt
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
 * EXACT merger from Restore Working Products API.txt
 * Merge inventory products with commerce images using product_id matching
 */
function mergeInventoryWithCommerceImages(inventoryProducts, commerceProducts) {
  console.log(`🔗 Merging ${inventoryProducts.length} inventory products with ${commerceProducts.length} commerce products`);
  
  // Create lookup map for commerce products by product_id
  const commerceByProductId = new Map();
  let totalCommerceImagesFound = 0;
  
  commerceProducts.forEach(commerceProduct => {
    if (commerceProduct.product_id) {
      commerceByProductId.set(commerceProduct.product_id, commerceProduct);
      
      // Count images by checking both product_images and documents
      const extractedImages = extractCommerceImages(commerceProduct);
      if (extractedImages.length > 0) {
        totalCommerceImagesFound += extractedImages.length;
      }
    }
  });
  
  console.log(`📊 Commerce products mapped: ${commerceByProductId.size}, Total images: ${totalCommerceImagesFound}`);
  
  // Merge products
  let productIdMatches = 0;
  let totalImagesAdded = 0;
  
  const mergedProducts = inventoryProducts.map(inventoryProduct => {
    const matchingCommerceProduct = commerceByProductId.get(inventoryProduct.item_id);
    
    let commerce_images = [];
    let matchStrategy = 'no_match';
    
    if (matchingCommerceProduct) {
      productIdMatches++;
      matchStrategy = 'product_id';
      
      // Extract images using the working pattern from your project knowledge
      commerce_images = extractCommerceImages(matchingCommerceProduct);
      if (commerce_images.length > 0) {
        // Remove size restrictions to prevent cropping
        commerce_images = transformCommerceImages(commerce_images);
        totalImagesAdded += commerce_images.length;
        console.log(`✅ Matched ${inventoryProduct.item_id}: ${commerce_images.length} images`);
      } else {
        console.log(`⚠️ No images extracted for ${inventoryProduct.item_id}`);
      }
    }
    
    const mergedProduct = {
      ...inventoryProduct,
      commerce_images,
      has_commerce_match: !!matchingCommerceProduct,
      commerce_product_id: matchingCommerceProduct?.product_id || null,
      match_strategy: matchStrategy
    };
    
    return mergedProduct;
  });
  
  console.log(`\n=== MATCHING SUMMARY ===`);
  console.log(`Product ID matches: ${productIdMatches}`);
  console.log(`Total images added: ${totalImagesAdded}`);
  
  return mergedProducts;
}

/**
 * EXACT extractCommerceImages from Restore Working Products API.txt
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
 * Check if filename is an image file
 * EXACT pattern from Restore Working Products API.txt
 */
function isImageFile(filename) {
  if (!filename || typeof filename !== 'string') return false;
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const lowerFilename = filename.toLowerCase();
  
  return imageExtensions.some(ext => lowerFilename.endsWith(ext));
}

/**
 * Transform Commerce API images to provide full-size images
 * EXACT pattern from Restore Working Products API.txt
 * Removes size restrictions to prevent cropping - THIS FIXES YOUR CROPPING ISSUE
 */
function transformCommerceImages(commerceImages) {
  if (!commerceImages || !Array.isArray(commerceImages)) {
    return [];
  }

  return commerceImages.map(imageUrl => {
    if (typeof imageUrl !== 'string') return imageUrl;
    
    // Check if it's a Zoho Commerce CDN URL that has size parameters
    if (imageUrl.includes('zohocommercecdn.com') && imageUrl.includes('/1200x1200')) {
      // Remove the size parameter to get full-size image
      const fullSizeUrl = imageUrl.replace('/1200x1200', '');
      console.log(`🎨 Converted to full-size: ${imageUrl} -> ${fullSizeUrl}`);
      return fullSizeUrl;
    } else if (imageUrl.includes('zohocommercecdn.com') && /\/\d+x\d+/.test(imageUrl)) {
      // Remove any size parameter (e.g., /300x300, /600x600, etc.)
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
 * Transform merged products to expected frontend format
 * EXACT pattern from Restore Working Products API.txt
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
      product_price: parseFloat(product.rate || 0),
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
 * Generate image statistics - EXACT pattern from Restore Working Products API.txt
 */
function generateImageStatistics(products) {
  const totalProducts = products.length;
  const productsWithImages = products.filter(p => p.product_images && p.product_images.length > 0);
  const totalImages = products.reduce((sum, p) => sum + (p.product_images?.length || 0), 0);
  
  return {
    products_with_images: productsWithImages.length,
    products_without_images: totalProducts - productsWithImages.length,
    total_images: totalImages,
    image_coverage_percentage: totalProducts > 0 ? Math.round((productsWithImages.length / totalProducts) * 100) : 0,
    average_images_per_product: totalProducts > 0 ? Math.round(totalImages / totalProducts * 100) / 100 : 0
  };
}