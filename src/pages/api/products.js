// src/pages/api/products.js - Enhanced with improved caching and rate limiting
// CRITICAL IMPROVEMENTS: Centralized token management, intelligent caching, circuit breaker pattern

import { zohoInventoryAPI } from '../../lib/zoho-api-inventory';
import { zohoAPI } from '../../lib/zoho-api';
import { tokenManager } from '../../lib/enhanced-token-manager';

// Multi-level cache system
const cacheSystem = {
  // Level 1: Fast in-memory cache for immediate responses
  hotCache: {
    data: null,
    timestamp: 0,
    version: 0
  },
  
  // Level 2: Warm cache for background refresh
  warmCache: {
    inventoryData: null,
    commerceData: null,
    timestamp: 0,
    version: 0
  },
  
  // Level 3: Cold cache for emergency fallback
  coldCache: {
    data: null,
    timestamp: 0,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours max age
  }
};

// Cache configuration
const cacheConfig = {
  hotCacheDuration: process.env.NODE_ENV === 'development' ? 2 * 60 * 1000 : 10 * 60 * 1000, // 2min dev, 10min prod
  warmCacheDuration: 30 * 60 * 1000, // 30 minutes
  backgroundRefreshThreshold: 0.7, // Refresh when 70% of cache duration has passed
  maxStaleAge: 2 * 60 * 60 * 1000, // 2 hours maximum stale data
  enableBackgroundRefresh: true
};

// Circuit breaker for API reliability
const circuitBreaker = {
  isOpen: false,
  failureCount: 0,
  lastFailureTime: 0,
  threshold: 5, // Open after 5 consecutive failures
  timeout: 60000, // 1 minute timeout
  halfOpenMaxAttempts: 3
};

// Request tracking for intelligent rate limiting
const requestTracker = {
  activeRequests: 0,
  maxConcurrentRequests: 3,
  requestQueue: [],
  processingQueue: false
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 Products API request started [${requestId}]`);

  try {
    // Check circuit breaker
    if (circuitBreaker.isOpen) {
      if (Date.now() - circuitBreaker.lastFailureTime > circuitBreaker.timeout) {
        circuitBreaker.isOpen = false;
        circuitBreaker.failureCount = 0;
        console.log('🔄 Circuit breaker reset');
      } else {
        return await handleCircuitBreakerOpen(res, requestId);
      }
    }

    // Step 1: Try hot cache first (fastest response)
    const hotCacheResult = checkHotCache();
    if (hotCacheResult) {
      console.log(`⚡ Hot cache hit [${requestId}]`);
      return res.status(200).json(hotCacheResult);
    }

    // Step 2: Check if we should queue the request to avoid overwhelming APIs
    if (requestTracker.activeRequests >= requestTracker.maxConcurrentRequests) {
      console.log(`⏳ Request queued [${requestId}] - ${requestTracker.activeRequests} active requests`);
      return await queueRequest(req, res, requestId);
    }

    // Step 3: Increment active request counter
    requestTracker.activeRequests++;

    try {
      // Step 4: Try warm cache (may trigger background refresh)
      const warmCacheResult = await checkWarmCache(requestId);
      if (warmCacheResult) {
        console.log(`🔥 Warm cache hit [${requestId}]`);
        return res.status(200).json(warmCacheResult);
      }

      // Step 5: Full API fetch (last resort)
      console.log(`📡 Performing full API fetch [${requestId}]`);
      const freshData = await fetchFreshData(requestId);
      
      // Update all cache levels
      updateCacheSystem(freshData);
      
      // Reset circuit breaker on success
      circuitBreaker.failureCount = 0;
      
      console.log(`✅ Fresh data fetched and cached [${requestId}]`);
      return res.status(200).json(freshData);

    } finally {
      // Always decrement active request counter
      requestTracker.activeRequests--;
      processQueue();
    }

  } catch (error) {
    console.error(`❌ Products API Error [${requestId}]:`, {
      message: error.message,
      name: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    // Update circuit breaker
    updateCircuitBreaker(error);

    // Try to return cached data if available
    const fallbackData = getFallbackData();
    if (fallbackData) {
      console.log(`🔄 Returning fallback data [${requestId}]`);
      return res.status(200).json({
        ...fallbackData,
        meta: {
          ...fallbackData.meta,
          fallback: true,
          fallback_reason: error.message,
          fallback_age_minutes: Math.round((Date.now() - cacheSystem.coldCache.timestamp) / (60 * 1000)),
          request_id: requestId
        }
      });
    }

    // Determine error response based on error type
    const isRateLimit = error.message.includes('rate limit') || error.message.includes('too many requests');
    const status = isRateLimit ? 429 : 500;
    
    return res.status(status).json({
      error: 'Failed to fetch products',
      details: isRateLimit ? 'Rate limit exceeded. Using cached data when available.' : error.message,
      type: isRateLimit ? 'RATE_LIMIT_ERROR' : 'API_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString(),
      circuit_breaker_status: {
        is_open: circuitBreaker.isOpen,
        failure_count: circuitBreaker.failureCount
      },
      token_manager_status: tokenManager.getStatus()
    });
  }
}

/**
 * Check hot cache for immediate response
 */
function checkHotCache() {
  const now = Date.now();
  if (cacheSystem.hotCache.data && 
      (now - cacheSystem.hotCache.timestamp) < cacheConfig.hotCacheDuration) {
    return {
      ...cacheSystem.hotCache.data,
      meta: {
        ...cacheSystem.hotCache.data.meta,
        cached: true,
        cache_level: 'hot',
        cache_age_seconds: Math.round((now - cacheSystem.hotCache.timestamp) / 1000)
      }
    };
  }
  return null;
}

/**
 * Check warm cache and potentially trigger background refresh
 */
async function checkWarmCache(requestId) {
  const now = Date.now();
  const cacheAge = now - cacheSystem.warmCache.timestamp;
  
  if (cacheSystem.warmCache.inventoryData && cacheAge < cacheConfig.warmCacheDuration) {
    // Check if we should trigger background refresh
    if (cacheConfig.enableBackgroundRefresh && 
        cacheAge > (cacheConfig.warmCacheDuration * cacheConfig.backgroundRefreshThreshold)) {
      console.log(`🔄 Triggering background refresh [${requestId}]`);
      triggerBackgroundRefresh();
    }

    // Return merged data from warm cache
    const mergedData = mergeWarmCacheData();
    if (mergedData) {
      return {
        ...mergedData,
        meta: {
          ...mergedData.meta,
          cached: true,
          cache_level: 'warm',
          cache_age_minutes: Math.round(cacheAge / (60 * 1000)),
          background_refresh_triggered: cacheAge > (cacheConfig.warmCacheDuration * cacheConfig.backgroundRefreshThreshold)
        }
      };
    }
  }
  
  return null;
}

/**
 * Fetch fresh data from APIs with enhanced error handling
 */
async function fetchFreshData(requestId) {
  const startTime = Date.now();
  
  console.log(`📦 Fetching fresh data from APIs [${requestId}]...`);
  
  // Fetch inventory and commerce data with token manager
  const [inventoryData, commerceData] = await Promise.allSettled([
    fetchInventoryProductsWithRetry(requestId),
    fetchCommerceProductsWithRetry(requestId)
  ]);

  // Handle partial failures gracefully
  let inventoryProducts = [];
  let commerceProducts = [];

  if (inventoryData.status === 'fulfilled') {
    inventoryProducts = inventoryData.value;
    console.log(`✅ Inventory data fetched: ${inventoryProducts.length} products [${requestId}]`);
  } else {
    console.warn(`⚠️ Inventory fetch failed [${requestId}]:`, inventoryData.reason.message);
    // Try to use cached inventory data
    if (cacheSystem.warmCache.inventoryData) {
      inventoryProducts = cacheSystem.warmCache.inventoryData;
      console.log(`🔄 Using cached inventory data: ${inventoryProducts.length} products [${requestId}]`);
    }
  }

  if (commerceData.status === 'fulfilled') {
    commerceProducts = commerceData.value;
    console.log(`✅ Commerce data fetched: ${commerceProducts.length} products [${requestId}]`);
  } else {
    console.warn(`⚠️ Commerce fetch failed [${requestId}]:`, commerceData.reason.message);
    // Try to use cached commerce data
    if (cacheSystem.warmCache.commerceData) {
      commerceProducts = cacheSystem.warmCache.commerceData;
      console.log(`🔄 Using cached commerce data: ${commerceProducts.length} products [${requestId}]`);
    }
  }

  // Process and merge data
  const filteredProducts = filterProductsByDisplayInApp(inventoryProducts);
  const activeProducts = filterActiveProducts(filteredProducts);
  const mergedProducts = mergeInventoryWithCommerceImagesBySKU(activeProducts, commerceProducts);

  const processingTime = Date.now() - startTime;

  return {
    products: mergedProducts,
    meta: {
      total_inventory_products: inventoryProducts.length,
      display_in_app_products: filteredProducts.length,
      active_display_products: activeProducts.length,
      commerce_products_fetched: commerceProducts.length,
      products_with_images: mergedProducts.filter(p => p.product_images?.length > 0).length,
      timestamp: new Date().toISOString(),
      processing_time_ms: processingTime,
      api_approach: 'enhanced_multi_level_cache',
      partial_failure: inventoryData.status === 'rejected' || commerceData.status === 'rejected',
      data_sources: {
        inventory: inventoryData.status === 'fulfilled' ? 'fresh' : 'cached',
        commerce: commerceData.status === 'fulfilled' ? 'fresh' : 'cached'
      },
      request_id: requestId,
      cache_version: cacheSystem.hotCache.version + 1
    }
  };
}

/**
 * Enhanced inventory fetch with token manager
 */
async function fetchInventoryProductsWithRetry(requestId, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📦 Inventory API attempt ${attempt}/${maxRetries} [${requestId}]`);
      
      // Use the enhanced token manager
      await tokenManager.getAccessToken('inventory');
      
      if (zohoInventoryAPI) {
        return await zohoInventoryAPI.getInventoryProducts();
      } else {
        throw new Error('Zoho Inventory API not available');
      }
    } catch (error) {
      console.log(`❌ Inventory API attempt ${attempt} failed [${requestId}]:`, error.message);
      
      if (attempt === maxRetries || 
          error.message.includes('rate limit') || 
          error.message.includes('too many requests')) {
        throw error;
      }
      
      // Wait before retry with jitter to avoid thundering herd
      const baseDelay = Math.pow(2, attempt) * 1000;
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;
      
      console.log(`⏳ Waiting ${Math.round(delay)}ms before retry [${requestId}]...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Enhanced commerce fetch with token manager
 */
async function fetchCommerceProductsWithRetry(requestId, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🛒 Commerce API attempt ${attempt}/${maxRetries} [${requestId}]`);
      
      // Use the enhanced token manager
      await tokenManager.getAccessToken('commerce');
      
      if (zohoAPI) {
        return await zohoAPI.getProducts();
      } else {
        throw new Error('Zoho Commerce API not available');
      }
    } catch (error) {
      console.log(`❌ Commerce API attempt ${attempt} failed [${requestId}]:`, error.message);
      
      if (attempt === maxRetries || 
          error.message.includes('rate limit') || 
          error.message.includes('too many requests')) {
        throw error;
      }
      
      // Wait before retry with jitter
      const baseDelay = Math.pow(2, attempt) * 1000;
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;
      
      console.log(`⏳ Waiting ${Math.round(delay)}ms before retry [${requestId}]...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Update all cache levels with fresh data
 */
function updateCacheSystem(freshData) {
  const now = Date.now();
  const version = cacheSystem.hotCache.version + 1;
  
  // Update hot cache
  cacheSystem.hotCache = {
    data: freshData,
    timestamp: now,
    version: version
  };
  
  // Update warm cache (extract raw data for background processing)
  if (freshData.meta.data_sources?.inventory === 'fresh') {
    cacheSystem.warmCache.inventoryData = freshData.products; // Store the processed products
    cacheSystem.warmCache.timestamp = now;
    cacheSystem.warmCache.version = version;
  }
  
  if (freshData.meta.data_sources?.commerce === 'fresh') {
    cacheSystem.warmCache.commerceData = []; // We don't store raw commerce data in this implementation
  }
  
  // Update cold cache (emergency fallback)
  cacheSystem.coldCache = {
    data: freshData,
    timestamp: now
  };
  
  console.log(`💾 Cache system updated - version ${version}`);
}

/**
 * Background refresh to keep warm cache fresh
 */
function triggerBackgroundRefresh() {
  // Don't trigger multiple background refreshes
  if (requestTracker.processingQueue) return;
  
  // Use setTimeout to avoid blocking the current request
  setTimeout(async () => {
    try {
      console.log('🔄 Background refresh started');
      const requestId = `bg_${Date.now()}`;
      
      // Only refresh if we're not hitting rate limits
      const status = tokenManager.getStatus();
      if (status.activeRateLimits.some(limit => limit.backoffActive)) {
        console.log('⏸️ Background refresh skipped - rate limits active');
        return;
      }
      
      requestTracker.activeRequests++;
      
      try {
        const freshData = await fetchFreshData(requestId);
        updateCacheSystem(freshData);
        console.log('✅ Background refresh completed');
      } catch (error) {
        console.warn('⚠️ Background refresh failed:', error.message);
      } finally {
        requestTracker.activeRequests--;
      }
    } catch (error) {
      console.error('❌ Background refresh error:', error);
    }
  }, 100); // Small delay to not block current request
}

/**
 * Merge warm cache data if available
 */
function mergeWarmCacheData() {
  if (!cacheSystem.warmCache.inventoryData) return null;
  
  const inventoryProducts = cacheSystem.warmCache.inventoryData;
  const commerceProducts = cacheSystem.warmCache.commerceData || [];
  
  const filteredProducts = filterProductsByDisplayInApp(inventoryProducts);
  const activeProducts = filterActiveProducts(filteredProducts);
  const mergedProducts = mergeInventoryWithCommerceImagesBySKU(activeProducts, commerceProducts);
  
  return {
    products: mergedProducts,
    meta: {
      total_inventory_products: inventoryProducts.length,
      display_in_app_products: filteredProducts.length,
      active_display_products: activeProducts.length,
      commerce_products_fetched: commerceProducts.length,
      products_with_images: mergedProducts.filter(p => p.product_images?.length > 0).length,
      timestamp: new Date().toISOString(),
      api_approach: 'warm_cache_merge',
      cache_version: cacheSystem.warmCache.version
    }
  };
}

/**
 * Handle circuit breaker open state
 */
async function handleCircuitBreakerOpen(res, requestId) {
  console.log(`🚫 Circuit breaker OPEN [${requestId}] - using fallback data`);
  
  const fallbackData = getFallbackData();
  if (fallbackData) {
    return res.status(200).json({
      ...fallbackData,
      meta: {
        ...fallbackData.meta,
        circuit_breaker_fallback: true,
        circuit_breaker_status: 'open',
        request_id: requestId
      }
    });
  }
  
  return res.status(503).json({
    error: 'Service temporarily unavailable',
    message: 'APIs are experiencing issues. Please try again in a few minutes.',
    circuit_breaker_status: 'open',
    retry_after: Math.ceil(circuitBreaker.timeout / 1000),
    request_id: requestId
  });
}

/**
 * Queue request when too many concurrent requests
 */
async function queueRequest(req, res, requestId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout in queue'));
    }, 30000); // 30 second timeout
    
    requestTracker.requestQueue.push({
      req,
      res,
      requestId,
      resolve,
      reject,
      timeout,
      timestamp: Date.now()
    });
    
    processQueue();
  });
}

/**
 * Process queued requests
 */
function processQueue() {
  if (requestTracker.processingQueue || 
      requestTracker.activeRequests >= requestTracker.maxConcurrentRequests ||
      requestTracker.requestQueue.length === 0) {
    return;
  }
  
  requestTracker.processingQueue = true;
  
  // Process next request in queue
  const queuedRequest = requestTracker.requestQueue.shift();
  if (queuedRequest) {
    clearTimeout(queuedRequest.timeout);
    
    // Check if request is too old (stale)
    if (Date.now() - queuedRequest.timestamp > 20000) { // 20 seconds max queue time
      queuedRequest.reject(new Error('Request too old in queue'));
      requestTracker.processingQueue = false;
      setImmediate(processQueue); // Process next item
      return;
    }
    
    // Execute the queued request
    handler(queuedRequest.req, queuedRequest.res)
      .then(queuedRequest.resolve)
      .catch(queuedRequest.reject)
      .finally(() => {
        requestTracker.processingQueue = false;
        setImmediate(processQueue); // Process next item
      });
  } else {
    requestTracker.processingQueue = false;
  }
}

/**
 * Update circuit breaker state based on error
 */
function updateCircuitBreaker(error) {
  // Only count certain types of failures
  if (error.message.includes('rate limit') || 
      error.message.includes('too many requests') ||
      error.message.includes('Authentication failed') ||
      error.message.includes('Token refresh failed')) {
    
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = Date.now();
    
    if (circuitBreaker.failureCount >= circuitBreaker.threshold) {
      circuitBreaker.isOpen = true;
      console.warn(`🚫 Circuit breaker OPENED after ${circuitBreaker.failureCount} failures`);
    }
  }
}

/**
 * Get fallback data from any available cache
 */
function getFallbackData() {
  const now = Date.now();
  
  // Try hot cache first (even if expired)
  if (cacheSystem.hotCache.data && 
      (now - cacheSystem.hotCache.timestamp) < cacheConfig.maxStaleAge) {
    return cacheSystem.hotCache.data;
  }
  
  // Try cold cache (up to 24 hours old)
  if (cacheSystem.coldCache.data && 
      (now - cacheSystem.coldCache.timestamp) < cacheSystem.coldCache.maxAge) {
    return cacheSystem.coldCache.data;
  }
  
  return null;
}

/**
 * Filter products based on cf_display_in_app custom field
 */
function filterProductsByDisplayInApp(products) {
  if (!Array.isArray(products)) return [];
  
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
    
    return isDisplayInApp;
  });
}

/**
 * Filter active products
 */
function filterActiveProducts(products) {
  if (!Array.isArray(products)) return [];
  
  return products.filter(product => 
    product.status === 'active' || 
    product.status === 'Active' ||
    product.status === 'ACTIVE'
  );
}

/**
 * Merge inventory products with commerce images using SKU matching
 */
function mergeInventoryWithCommerceImagesBySKU(inventoryProducts, commerceProducts) {
  if (!Array.isArray(inventoryProducts)) return [];
  if (!Array.isArray(commerceProducts)) commerceProducts = [];
  
  console.log(`🔗 Merging ${inventoryProducts.length} inventory products with ${commerceProducts.length} commerce products`);
  
  // Create SKU lookup map for commerce products
  const commerceMap = new Map();
  commerceProducts.forEach(product => {
    if (product.sku) {
      commerceMap.set(product.sku, product);
    }
  });
  
  return inventoryProducts.map(product => {
    const commerceProduct = commerceMap.get(product.sku);
    
    return {
      product_id: product.item_id,
      product_name: product.name,
      sku: product.sku,
      product_price: parseFloat(product.rate || 0),
      product_description: product.description || '',
      status: product.status,
      cf_display_in_app: product.cf_display_in_app,
      cf_display_in_app_unformatted: product.cf_display_in_app_unformatted,
      product_images: commerceProduct?.product_images || [],
      inventory_data: {
        stock_on_hand: product.stock_on_hand || 0,
        available_stock: product.available_stock || 0,
        reserved_stock: product.reserved_stock || 0
      },
      custom_fields: product.custom_fields || [],
      last_updated: product.last_modified_time || new Date().toISOString()
    };
  });
}

/**
 * Health check endpoint for monitoring
 */
export async function healthCheck() {
  const status = tokenManager.getStatus();
  
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    cache_system: {
      hot_cache_age: cacheSystem.hotCache.timestamp ? Date.now() - cacheSystem.hotCache.timestamp : null,
      warm_cache_age: cacheSystem.warmCache.timestamp ? Date.now() - cacheSystem.warmCache.timestamp : null,
      cold_cache_age: cacheSystem.coldCache.timestamp ? Date.now() - cacheSystem.coldCache.timestamp : null
    },
    circuit_breaker: {
      is_open: circuitBreaker.isOpen,
      failure_count: circuitBreaker.failureCount,
      last_failure: circuitBreaker.lastFailureTime
    },
    request_tracker: {
      active_requests: requestTracker.activeRequests,
      queued_requests: requestTracker.requestQueue.length
    },
    token_manager: status
  };
}