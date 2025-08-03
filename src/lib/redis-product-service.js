import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export class RedisProductService {
  async getAllProducts() {
    try {
      const cached = await redis.get('products:all')
      if (cached) {
        console.log('✅ Products loaded from Redis cache')
        return JSON.parse(cached)
      }
      console.log('⚠️ Cache miss - falling back to API')
      return await this.fetchAndCacheProducts()
    } catch (error) {
      console.error('Redis error, falling back to API:', error)
      return await this.fetchFromZohoDirectly()
    }
  }

  async getProductById(itemId) {
    try {
      const cached = await redis.get(`product:${itemId}`)
      if (cached) {
        return JSON.parse(cached)
      }
      const allProducts = await this.getAllProducts()
      return allProducts.find(p => p.item_id === itemId)
    } catch (error) {
      console.error('Error fetching product:', error)
      return null
    }
  }

  async getProductBySku(sku) {
    try {
      const cached = await redis.get(`product:sku:${sku}`)
      if (cached) {
        return JSON.parse(cached)
      }
      const allProducts = await this.getAllProducts()
      return allProducts.find(p => p.sku === sku)
    } catch (error) {
      console.error('Error fetching product by SKU:', error)
      return null
    }
  }

  async getCacheStats() {
    try {
      const lastSync = await redis.get('products:last_sync')
      const productCount = await redis.get('products:all')
      return {
        lastSync: lastSync ? new Date(lastSync) : null,
        productCount: productCount ? JSON.parse(productCount).length : 0,
        cacheAge: lastSync ? Date.now() - lastSync : null
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  async fetchAndCacheProducts() {
    const products = await this.fetchFromZohoDirectly()
    await redis.setex('products:all', 3600, JSON.stringify(products))
    return products
  }

  async fetchFromZohoDirectly() {
    const { zohoInventoryAPI } = await import('./zoho-api-inventory')
    return await zohoInventoryAPI.getInventoryProducts()
  }
}

export const productService = new RedisProductService()
