// src/utils/cache-manager.js
// Simple in-memory cache manager for serverless environments

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttls = new Map();
    
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  // Get value from cache
  async get(key) {
    // Check if key exists and hasn't expired
    if (this.cache.has(key)) {
      const ttl = this.ttls.get(key);
      
      if (!ttl || Date.now() < ttl) {
        const value = this.cache.get(key);
        console.log(`📦 Cache HIT: ${key}`);
        return value;
      } else {
        // Entry has expired, remove it
        this.delete(key);
        console.log(`⏰ Cache EXPIRED: ${key}`);
      }
    }
    
    console.log(`❌ Cache MISS: ${key}`);
    return null;
  }

  // Set value in cache with optional TTL (time to live in seconds)
  async set(key, value, ttlSeconds = 3600) {
    try {
      // Store the value
      this.cache.set(key, value);
      
      // Set expiration time
      if (ttlSeconds > 0) {
        const expiryTime = Date.now() + (ttlSeconds * 1000);
        this.ttls.set(key, expiryTime);
      }
      
      console.log(`💾 Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      console.error(`Failed to set cache for key ${key}:`, error);
      return false;
    }
  }

  // Delete specific key from cache
  async delete(key) {
    const deleted = this.cache.delete(key);
    this.ttls.delete(key);
    
    if (deleted) {
      console.log(`🗑️ Cache DELETE: ${key}`);
    }
    
    return deleted;
  }

  // Clear all cache entries
  async clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.ttls.clear();
    
    console.log(`🧹 Cache CLEARED: ${size} entries removed`);
    return true;
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let activeEntries = 0;
    let expiredEntries = 0;

    for (const [key, ttl] of this.ttls.entries()) {
      if (ttl && now >= ttl) {
        expiredEntries++;
      } else {
        activeEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      activeEntries,
      expiredEntries,
      memoryUsage: this.getMemoryUsage()
    };
  }

  // Estimate memory usage (rough calculation)
  getMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, value] of this.cache.entries()) {
      // Rough estimate of memory usage
      totalSize += key.length * 2; // 2 bytes per character for strings
      totalSize += JSON.stringify(value).length * 2;
    }
    
    return {
      bytes: totalSize,
      kb: Math.round(totalSize / 1024 * 100) / 100,
      mb: Math.round(totalSize / (1024 * 1024) * 100) / 100
    };
  }

  // Check if key exists in cache (without checking expiration)
  has(key) {
    return this.cache.has(key);
  }

  // Get all cache keys
  keys() {
    return Array.from(this.cache.keys());
  }

  // Get cache size
  size() {
    return this.cache.size;
  }

  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    let cleanedUp = 0;

    for (const [key, ttl] of this.ttls.entries()) {
      if (ttl && now >= ttl) {
        this.cache.delete(key);
        this.ttls.delete(key);
        cleanedUp++;
      }
    }

    if (cleanedUp > 0) {
      console.log(`🧹 Cache cleanup: ${cleanedUp} expired entries removed`);
    }

    return cleanedUp;
  }

  // Set multiple values at once
  async setMultiple(entries, ttlSeconds = 3600) {
    const results = [];
    
    for (const [key, value] of Object.entries(entries)) {
      const result = await this.set(key, value, ttlSeconds);
      results.push({ key, success: result });
    }
    
    return results;
  }

  // Get multiple values at once
  async getMultiple(keys) {
    const results = {};
    
    for (const key of keys) {
      results[key] = await this.get(key);
    }
    
    return results;
  }

  // Delete multiple keys at once
  async deleteMultiple(keys) {
    const results = [];
    
    for (const key of keys) {
      const result = await this.delete(key);
      results.push({ key, deleted: result });
    }
    
    return results;
  }

  // Increment a numeric value (useful for counters)
  async increment(key, amount = 1, ttlSeconds = 3600) {
    const currentValue = await this.get(key) || 0;
    const newValue = currentValue + amount;
    await this.set(key, newValue, ttlSeconds);
    return newValue;
  }

  // Decrement a numeric value
  async decrement(key, amount = 1, ttlSeconds = 3600) {
    return this.increment(key, -amount, ttlSeconds);
  }

  // Set value only if key doesn't exist
  async setIfNotExists(key, value, ttlSeconds = 3600) {
    if (!this.cache.has(key)) {
      return this.set(key, value, ttlSeconds);
    }
    return false;
  }

  // Get value and extend its TTL
  async getAndExtend(key, ttlSeconds = 3600) {
    const value = await this.get(key);
    
    if (value !== null) {
      // Extend the TTL
      const expiryTime = Date.now() + (ttlSeconds * 1000);
      this.ttls.set(key, expiryTime);
      console.log(`⏰ Cache TTL extended: ${key} (new TTL: ${ttlSeconds}s)`);
    }
    
    return value;
  }

  // Destroy the cache manager and cleanup
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.clear();
    console.log('💥 Cache manager destroyed');
  }
}

// Create a singleton instance
const cacheManager = new CacheManager();

// Handle process termination gracefully
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    cacheManager.destroy();
  });

  process.on('SIGINT', () => {
    cacheManager.destroy();
  });
}

// Export the singleton instance
module.exports = cacheManager;