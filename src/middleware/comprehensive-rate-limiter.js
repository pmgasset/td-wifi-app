// src/middleware/comprehensive-rate-limiter.js - Advanced rate limiting for Zoho APIs
// CRITICAL: This prevents the "too many requests" errors you're experiencing

class ComprehensiveRateLimiter {
  constructor() {
    // Per-endpoint rate limiting
    this.endpointLimits = new Map();
    
    // Global rate limiting
    this.globalLimit = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30, // Conservative limit for Zoho APIs
      requests: new Map() // IP -> { count, resetTime }
    };
    
    // Token refresh specific limiting (most critical)
    this.tokenRefreshLimit = {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 15, // Very conservative for token refresh
      requests: new Map(), // key -> { count, resetTime }
      backoffTime: 5 * 60 * 1000 // 5 minute backoff after limit
    };
    
    // API-specific limits based on Zoho documentation
    this.apiLimits = {
      'inventory': {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 20, // Conservative for inventory API
        requests: new Map()
      },
      'commerce': {
        windowMs: 60 * 1000, // 1 minute  
        maxRequests: 25, // Slightly higher for commerce
        requests: new Map()
      },
      'checkout': {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10, // Very conservative for checkout operations
        requests: new Map()
      }
    };
    
    // Cleanup interval
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Main middleware function
   */
  middleware(options = {}) {
    const {
      apiType = 'general', // 'inventory', 'commerce', 'checkout', 'token_refresh'
      skipIf = null, // Function to skip rate limiting
      keyGenerator = this.defaultKeyGenerator.bind(this),
      customLimits = null
    } = options;

    return async (req, res, next) => {
      try {
        // Skip rate limiting if condition is met
        if (skipIf && skipIf(req)) {
          return next();
        }

        const clientKey = keyGenerator(req);
        const now = Date.now();

        // Check token refresh limits first (most critical)
        if (apiType === 'token_refresh') {
          const tokenResult = this.checkTokenRefreshLimit(clientKey, now);
          if (!tokenResult.allowed) {
            return this.sendRateLimitResponse(res, tokenResult, 'token_refresh');
          }
        }

        // Check API-specific limits
        const apiResult = this.checkApiLimit(apiType, clientKey, now, customLimits);
        if (!apiResult.allowed) {
          return this.sendRateLimitResponse(res, apiResult, apiType);
        }

        // Check global limits
        const globalResult = this.checkGlobalLimit(clientKey, now);
        if (!globalResult.allowed) {
          return this.sendRateLimitResponse(res, globalResult, 'global');
        }

        // Add rate limit headers
        this.addRateLimitHeaders(res, apiResult, globalResult);

        // Proceed with request
        next();

      } catch (error) {
        console.error('Rate limiter error:', error);
        // Fail open - don't block requests if rate limiter has issues
        next();
      }
    };
  }

  /**
   * Check token refresh specific limits (most important)
   */
  checkTokenRefreshLimit(key, now) {
    const limit = this.tokenRefreshLimit;
    const windowStart = Math.floor(now / limit.windowMs) * limit.windowMs;
    const requestKey = `${key}:${windowStart}`;
    
    const current = limit.requests.get(requestKey) || { 
      count: 0, 
      resetTime: windowStart + limit.windowMs,
      firstRequest: now
    };

    if (current.count >= limit.maxRequests) {
      // Check if we're in backoff period
      const backoffEnd = current.firstRequest + limit.backoffTime;
      const inBackoff = now < backoffEnd;
      
      return {
        allowed: false,
        count: current.count,
        limit: limit.maxRequests,
        resetTime: current.resetTime,
        retryAfter: inBackoff ? Math.ceil((backoffEnd - now) / 1000) : Math.ceil((current.resetTime - now) / 1000),
        reason: inBackoff ? 'Token refresh backoff period' : 'Token refresh rate limit exceeded'
      };
    }

    // Increment counter
    current.count++;
    if (current.count === 1) {
      current.firstRequest = now;
    }
    limit.requests.set(requestKey, current);

    return {
      allowed: true,
      count: current.count,
      limit: limit.maxRequests,
      resetTime: current.resetTime,
      remaining: limit.maxRequests - current.count
    };
  }

  /**
   * Check API-specific rate limits
   */
  checkApiLimit(apiType, key, now, customLimits = null) {
    const limit = customLimits || this.apiLimits[apiType] || this.apiLimits['inventory']; // Default to inventory
    const windowStart = Math.floor(now / limit.windowMs) * limit.windowMs;
    const requestKey = `${key}:${windowStart}`;
    
    const current = limit.requests.get(requestKey) || { 
      count: 0, 
      resetTime: windowStart + limit.windowMs 
    };

    if (current.count >= limit.maxRequests) {
      return {
        allowed: false,
        count: current.count,
        limit: limit.maxRequests,
        resetTime: current.resetTime,
        retryAfter: Math.ceil((current.resetTime - now) / 1000),
        reason: `${apiType} API rate limit exceeded`
      };
    }

    // Increment counter
    current.count++;
    limit.requests.set(requestKey, current);

    return {
      allowed: true,
      count: current.count,
      limit: limit.maxRequests,
      resetTime: current.resetTime,
      remaining: limit.maxRequests - current.count
    };
  }

  /**
   * Check global rate limits
   */
  checkGlobalLimit(key, now) {
    const limit = this.globalLimit;
    const windowStart = Math.floor(now / limit.windowMs) * limit.windowMs;
    const requestKey = `${key}:${windowStart}`;
    
    const current = limit.requests.get(requestKey) || { 
      count: 0, 
      resetTime: windowStart + limit.windowMs 
    };

    if (current.count >= limit.maxRequests) {
      return {
        allowed: false,
        count: current.count,
        limit: limit.maxRequests,
        resetTime: current.resetTime,
        retryAfter: Math.ceil((current.resetTime - now) / 1000),
        reason: 'Global rate limit exceeded'
      };
    }

    // Increment counter
    current.count++;
    limit.requests.set(requestKey, current);

    return {
      allowed: true,
      count: current.count,
      limit: limit.maxRequests,
      resetTime: current.resetTime,
      remaining: limit.maxRequests - current.count
    };
  }

  /**
   * Default key generator (IP + User Agent)
   */
  defaultKeyGenerator(req) {
    const ip = req.ip || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress ||
               req.headers['x-forwarded-for']?.split(',')[0] ||
               'unknown';
    
    const userAgent = req.headers['user-agent'] || 'unknown';
    const userHash = this.hashString(userAgent);
    
    return `${ip}:${userHash}`;
  }

  /**
   * Hash string for consistent key generation
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Send rate limit response
   */
  sendRateLimitResponse(res, result, limitType) {
    const headers = {
      'X-RateLimit-Limit': result.limit,
      'X-RateLimit-Remaining': result.remaining || 0,
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      'Retry-After': result.retryAfter,
      'X-RateLimit-Type': limitType
    };

    // Set headers
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    const response = {
      error: 'Rate limit exceeded',
      message: result.reason || `Too many requests. Please try again in ${result.retryAfter} seconds.`,
      type: 'RATE_LIMIT_ERROR',
      details: {
        limit_type: limitType,
        current_count: result.count,
        limit: result.limit,
        window_reset: new Date(result.resetTime).toISOString(),
        retry_after_seconds: result.retryAfter
      },
      suggestion: this.getRateLimitSuggestion(limitType),
      timestamp: new Date().toISOString()
    };

    return res.status(429).json(response);
  }

  /**
   * Add rate limit headers to successful responses
   */
  addRateLimitHeaders(res, apiResult, globalResult) {
    const headers = {
      'X-RateLimit-Limit-API': apiResult.limit,
      'X-RateLimit-Remaining-API': apiResult.remaining,
      'X-RateLimit-Reset-API': new Date(apiResult.resetTime).toISOString(),
      'X-RateLimit-Limit-Global': globalResult.limit,
      'X-RateLimit-Remaining-Global': globalResult.remaining,
      'X-RateLimit-Reset-Global': new Date(globalResult.resetTime).toISOString()
    };

    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  /**
   * Get helpful suggestions based on limit type
   */
  getRateLimitSuggestion(limitType) {
    const suggestions = {
      'token_refresh': 'Token refresh limit exceeded. The system now caches tokens for 50 minutes to prevent this. If you continue to see this error, there may be multiple server instances or aggressive polling.',
      'inventory': 'Inventory API limit exceeded. Consider implementing client-side caching and reducing page refresh frequency.',
      'commerce': 'Commerce API limit exceeded. Enable caching on the client side and implement request debouncing.',
      'checkout': 'Checkout API limit exceeded. This is very conservative to prevent issues. Please wait before retrying.',
      'global': 'Global API limit exceeded. Reduce overall API usage frequency across all endpoints.'
    };

    return suggestions[limitType] || 'Please reduce request frequency and implement proper caching.';
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean token refresh limits - compatible with older targets
    this.tokenRefreshLimit.requests.forEach((data, key) => {
      if (now > data.resetTime) {
        this.tokenRefreshLimit.requests.delete(key);
        cleanedCount++;
      }
    });

    // Clean API limits - compatible with older targets
    Object.values(this.apiLimits).forEach(limit => {
      limit.requests.forEach((data, key) => {
        if (now > data.resetTime) {
          limit.requests.delete(key);
          cleanedCount++;
        }
      });
    });

    // Clean global limits - compatible with older targets
    this.globalLimit.requests.forEach((data, key) => {
      if (now > data.resetTime) {
        this.globalLimit.requests.delete(key);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      console.log(`Rate limiter cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Get current status for monitoring
   */
  getStatus() {
    const now = Date.now();
    
    // Convert API limits to compatible format
    const apiLimitsStatus = Object.entries(this.apiLimits).map(([type, limit]) => ({
      type,
      active_windows: limit.requests.size,
      max_requests_per_minute: limit.maxRequests
    }));
    
    return {
      timestamp: now,
      token_refresh: {
        active_windows: this.tokenRefreshLimit.requests.size,
        max_requests_per_hour: this.tokenRefreshLimit.maxRequests
      },
      api_limits: apiLimitsStatus,
      global_limit: {
        active_windows: this.globalLimit.requests.size,
        max_requests_per_minute: this.globalLimit.maxRequests
      }
    };
  }

  /**
   * Reset limits for testing (use carefully)
   */
  resetLimits(limitType = null) {
    if (limitType === 'token_refresh' || !limitType) {
      this.tokenRefreshLimit.requests.clear();
    }
    
    if (limitType === 'global' || !limitType) {
      this.globalLimit.requests.clear();
    }
    
    if (!limitType) {
      Object.values(this.apiLimits).forEach(limit => {
        limit.requests.clear();
      });
    } else if (this.apiLimits[limitType]) {
      this.apiLimits[limitType].requests.clear();
    }
    
    console.log(`Rate limits reset: ${limitType || 'all'}`);
  }
}

// Create singleton instance
const rateLimiter = new ComprehensiveRateLimiter();

// Export middleware functions for different API types
export const tokenRefreshLimiter = rateLimiter.middleware({ 
  apiType: 'token_refresh',
  keyGenerator: (req) => 'token_refresh_global' // Global limit for token refresh
});

export const inventoryApiLimiter = rateLimiter.middleware({ 
  apiType: 'inventory' 
});

export const commerceApiLimiter = rateLimiter.middleware({ 
  apiType: 'commerce' 
});

export const checkoutApiLimiter = rateLimiter.middleware({ 
  apiType: 'checkout' 
});

export const generalApiLimiter = rateLimiter.middleware({ 
  apiType: 'general' 
});

// Export the main class and instance
export { ComprehensiveRateLimiter, rateLimiter };

// Helper function to create custom limiters
export function createCustomLimiter(options) {
  return rateLimiter.middleware(options);
}

// Status endpoint helper
export function getRateLimiterStatus() {
  return rateLimiter.getStatus();
}