// utils/cache-manager.js
// Simple in-memory cache with TTL support for Zoho Desk API responses

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttls = new Map();
    
    // Clean up expired items every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  // Set cache item with optional TTL (time to live in seconds)
  async set(key, value, ttlSeconds = 300) {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    
    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt
    });
    
    this.ttls.set(key, expiresAt);
    
    return true;
  }

  // Get cache item
  async get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Check if item has expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.ttls.delete(key);
      return null;
    }
    
    return item.value;
  }

  // Delete specific cache item
  async delete(key) {
    this.cache.delete(key);
    this.ttls.delete(key);
    return true;
  }

  // Clear all cache
  async clear() {
    this.cache.clear();
    this.ttls.clear();
    return true;
  }

  // Clear cache items matching pattern
  async clearPattern(pattern) {
    const regex = new RegExp(pattern);
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.ttls.delete(key);
    });
    
    return keysToDelete.length;
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, expiresAt] of this.ttls) {
      if (now > expiresAt) {
        expiredCount++;
      }
    }
    
    return {
      totalItems: this.cache.size,
      expiredItems: expiredCount,
      activeItems: this.cache.size - expiredCount,
      memoryUsage: this.getMemoryUsage()
    };
  }

  // Estimate memory usage (rough calculation)
  getMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, item] of this.cache) {
      totalSize += JSON.stringify({ key, ...item }).length * 2; // Rough UTF-16 estimation
    }
    
    return {
      bytes: totalSize,
      kb: Math.round(totalSize / 1024 * 100) / 100,
      mb: Math.round(totalSize / (1024 * 1024) * 100) / 100
    };
  }

  // Clean up expired items
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, expiresAt] of this.ttls) {
      if (now > expiresAt) {
        this.cache.delete(key);
        this.ttls.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cache cleanup: removed ${cleanedCount} expired items`);
    }
    
    return cleanedCount;
  }

  // Check if key exists and is not expired
  async has(key) {
    const item = await this.get(key);
    return item !== null;
  }

  // Get remaining TTL for a key (in seconds)
  getTTL(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return -1; // Key doesn't exist
    }
    
    const remaining = Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000));
    return remaining;
  }

  // Extend TTL for existing key
  async extendTTL(key, additionalSeconds) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }
    
    const newExpiresAt = item.expiresAt + (additionalSeconds * 1000);
    item.expiresAt = newExpiresAt;
    this.ttls.set(key, newExpiresAt);
    
    return true;
  }

  // Get all keys (including expired ones)
  keys() {
    return Array.from(this.cache.keys());
  }

  // Get all active (non-expired) keys
  activeKeys() {
    const now = Date.now();
    return Array.from(this.cache.keys()).filter(key => {
      const item = this.cache.get(key);
      return item && now <= item.expiresAt;
    });
  }

  // Destroy cache manager and cleanup interval
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down cache manager...');
  cacheManager.destroy();
});

process.on('SIGTERM', () => {
  console.log('Shutting down cache manager...');
  cacheManager.destroy();
});

module.exports = cacheManager;