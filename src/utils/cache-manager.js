// src/utils/cache-manager.js
// Simple in-memory cache manager

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttls = new Map();
  }

  // Set cache item with TTL (time to live in seconds)
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
      activeItems: this.cache.size - expiredCount
    };
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Export the instance
module.exports = cacheManager;