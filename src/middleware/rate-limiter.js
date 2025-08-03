// middleware/rate-limiter.js
// Rate limiting middleware to prevent API abuse

const { kv } = require('@vercel/kv');

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.maxRequests = options.maxRequests || 100; // Max requests per window
    this.message = options.message || 'Too many requests from this IP, please try again later';
    this.headers = options.headers !== false; // Include rate limit headers
    this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
    this.skipFailedRequests = options.skipFailedRequests || false;

    // Use Vercel KV if environment variables are configured
    this.useKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

    // Fallback in-memory store
    this.requests = this.useKv ? null : new Map();

    // Cleanup expired entries every 5 minutes for in-memory store
    if (!this.useKv) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 5 * 60 * 1000);
    }
  }

  // Get client identifier (IP address with optional user ID)
  getClientId(req) {
    const ip = req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null);
    
    // Include user ID if authenticated
    const userId = req.user?.id || req.headers['x-user-id'];
    
    return userId ? `${ip}:${userId}` : ip;
  }

  // Get current window start time
  getWindowStart() {
    return Math.floor(Date.now() / this.windowMs) * this.windowMs;
  }

  // Increment request count for client
  async incrementRequests(key, windowStart) {
    if (this.useKv) {
      const count = await kv.incr(key);
      if (count === 1) {
        await kv.expire(key, Math.ceil(this.windowMs / 1000));
      }
      return { count, resetTime: windowStart + this.windowMs };
    }

    const current = this.requests.get(key) || { count: 0, resetTime: windowStart + this.windowMs };
    current.count++;
    this.requests.set(key, current);
    return current;
  }

  // Get current request count for client
  async getRequestCount(key, windowStart) {
    if (this.useKv) {
      const count = await kv.get(key);
      return { count: count || 0, resetTime: windowStart + this.windowMs };
    }

    return this.requests.get(key) || { count: 0, resetTime: windowStart + this.windowMs };
  }

  // Clean up expired entries (only for in-memory store)
  cleanup() {
    if (this.useKv) return;

    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, data] of this.requests) {
      if (now > data.resetTime) {
        this.requests.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Rate limiter cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  // Main middleware function
  middleware() {
    return async (req, res, next) => {
      const clientId = this.getClientId(req);
      const windowStart = this.getWindowStart();
      const key = `rl:${clientId}:${windowStart}`;

      const current = await this.getRequestCount(key, windowStart);
      
      // Check if limit exceeded
      if (current.count >= this.maxRequests) {
        const retryAfter = Math.ceil((current.resetTime - Date.now()) / 1000);
        
        if (this.headers) {
          res.set({
            'X-RateLimit-Limit': this.maxRequests,
            'X-RateLimit-Remaining': 0,
            'X-RateLimit-Reset': new Date(current.resetTime).toISOString(),
            'Retry-After': retryAfter
          });
        }
        
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: this.message,
          retryAfter
        });
      }
      
      // Increment request count
      const updated = await this.incrementRequests(key, windowStart);
      
      // Set rate limit headers
      if (this.headers) {
        res.set({
          'X-RateLimit-Limit': this.maxRequests,
          'X-RateLimit-Remaining': Math.max(0, this.maxRequests - updated.count),
          'X-RateLimit-Reset': new Date(updated.resetTime).toISOString()
        });
      }
      
      // Handle response tracking
      const originalSend = res.send;
      res.send = function(body) {
        const statusCode = res.statusCode;

        // Optionally skip counting successful/failed requests
        if ((this.skipSuccessfulRequests && statusCode < 400) ||
            (this.skipFailedRequests && statusCode >= 400)) {
          if (this.useKv) {
            kv.decr(key).catch(() => {});
          } else {
            updated.count--;
            this.requests.set(key, updated);
          }
        }

        return originalSend.call(this, body);
      }.bind(this);
      
      next();
    };
  }

  // Get statistics
  getStats() {
    if (this.useKv) {
      return {
        activeWindows: null,
        totalRequests: null,
        expiredEntries: null,
        totalEntries: null,
        windowMs: this.windowMs,
        maxRequests: this.maxRequests,
        storage: 'kv'
      };
    }

    const now = Date.now();
    let activeWindows = 0;
    let totalRequests = 0;
    let expiredEntries = 0;

    for (const [key, data] of this.requests) {
      totalRequests += data.count;

      if (now > data.resetTime) {
        expiredEntries++;
      } else {
        activeWindows++;
      }
    }

    return {
      activeWindows,
      totalRequests,
      expiredEntries,
      totalEntries: this.requests.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
      storage: 'memory'
    };
  }

  // Reset all rate limits (for testing or emergency)
  reset() {
    if (this.useKv) return;
    this.requests.clear();
  }

  // Destroy rate limiter
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.reset();
  }
}

// Create different rate limiters for different endpoints
const rateLimiters = {
  // General API rate limiter
  general: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many API requests, please try again later'
  }),
  
  // Search endpoint rate limiter (more restrictive)
  search: new RateLimiter({
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 50,
    message: 'Too many search requests, please try again later'
  }),
  
  // Sync endpoint rate limiter (very restrictive)
  sync: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    message: 'Too many sync requests, please try again later'
  })
};

// Export middleware functions
module.exports = {
  // Default rate limiter
  default: rateLimiters.general.middleware(),
  
  // Specific rate limiters
  general: rateLimiters.general.middleware(),
  search: rateLimiters.search.middleware(),
  sync: rateLimiters.sync.middleware(),
  
  // Custom rate limiter creator
  create: (options) => new RateLimiter(options).middleware(),
  
  // Get stats from all rate limiters
  getStats: () => ({
    general: rateLimiters.general.getStats(),
    search: rateLimiters.search.getStats(),
    sync: rateLimiters.sync.getStats()
  }),
  
  // Reset all rate limiters
  resetAll: () => {
    Object.values(rateLimiters).forEach(limiter => limiter.reset());
  },
  
  // Cleanup function
  destroy: () => {
    Object.values(rateLimiters).forEach(limiter => limiter.destroy());
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down rate limiters...');
  module.exports.destroy();
});

process.on('SIGTERM', () => {
  console.log('Shutting down rate limiters...');
  module.exports.destroy();
});