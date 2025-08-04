import { Redis } from '@upstash/redis'
import { zohoAPI } from './zoho-api.ts'

const redis = Redis.fromEnv()
const CACHE_KEY = 'products:all'
const CACHE_TTL = 60 * 60 * 24 // 24 hours

export class RedisProductService {
  async getAllProducts() {
    try {
      const cached = await redis.get(CACHE_KEY)
      if (cached) {
        console.log('✅ Products loaded from Redis cache')
        try {
          const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
          // Handle legacy array-only cache
          if (Array.isArray(parsed)) {
            return {
              products: parsed,
              meta: {
                total_products: parsed.length,
                source: 'legacy-array'
              }
            }
          }
          return parsed
        } catch (parseError) {
          console.error('Error parsing cached products, refreshing from Zoho', parseError)
          return await this.fetchAndCacheProducts()
        }
      }
      console.log('⚠️ Cache miss - falling back to Zoho API')
      return await this.fetchAndCacheProducts()
    } catch (error) {
      console.error('Redis error, falling back to Zoho API:', error)
      const products = await this.fetchFromZohoDirectly()
      return {
        products,
        meta: {
          total_products: products.length,
          source: 'zoho',
          last_sync: new Date().toISOString()
        }
      }
    }
  }

  async getProductById(itemId) {
    try {
      const cached = await redis.get(`product:${itemId}`)
      if (cached) {
        try {
          return typeof cached === 'string' ? JSON.parse(cached) : cached
        } catch (parseError) {
          console.error('Error parsing cached product:', parseError)
        }
      }
      const allProducts = await this.getAllProducts()
      return allProducts.products?.find(p => p.product_id === itemId)
    } catch (error) {
      console.error('Error fetching product:', error)
      return null
    }
  }

  async getProductBySku(sku) {
    try {
      const cached = await redis.get(`product:sku:${sku}`)
      if (cached) {
        try {
          return typeof cached === 'string' ? JSON.parse(cached) : cached
        } catch (parseError) {
          console.error('Error parsing cached product by SKU:', parseError)
        }
      }
      const allProducts = await this.getAllProducts()
      return allProducts.products?.find(p => p.sku === sku)
    } catch (error) {
      console.error('Error fetching product by SKU:', error)
      return null
    }
  }

  async getCacheStats() {
    try {
      const lastSync = await redis.get('products:last_sync')
      const productCountRaw = await redis.get(CACHE_KEY)
      let productCount = 0
      if (productCountRaw) {
        try {
          const parsed =
            typeof productCountRaw === 'string'
              ? JSON.parse(productCountRaw)
              : productCountRaw
          if (Array.isArray(parsed)) {
            productCount = parsed.length
          } else if (Array.isArray(parsed?.products)) {
            productCount = parsed.products.length
          }
        } catch (_) {
          productCount = 0
        }
      }
      return {
        lastSync: lastSync ? new Date(Number(lastSync)) : null,
        productCount,
        cacheAge: lastSync ? Date.now() - Number(lastSync) : null
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  async fetchAndCacheProducts() {
    const products = await this.fetchFromZohoDirectly()
    const payload = {
      products,
      meta: {
        total_products: products.length,
        source: 'zoho',
        last_sync: new Date().toISOString()
      }
    }
    await redis.set(CACHE_KEY, JSON.stringify(payload), { ex: CACHE_TTL })
    await redis.set('products:last_sync', Date.now().toString())
    return payload
  }

  async fetchFromZohoDirectly() {
    const products = await zohoAPI.getProducts()

    const filtered = (products || []).filter(product => {
      const displayInApp =
        product.cf_display_in_app ||
        product.cf_display_in_app_unformatted ||
        product.display_in_app
      return (
        displayInApp === true ||
        displayInApp === 'true' ||
        displayInApp === 'True' ||
        displayInApp === 'TRUE' ||
        displayInApp === '1' ||
        displayInApp === 1
      )
    })

    const transformed = filtered.map(item => ({
      product_id: item.product_id || item.item_id,
      product_name: item.product_name || item.name,
      product_price: item.product_price || item.min_rate || item.rate || 0,
      product_description: item.product_description || item.description || '',
      inventory_count: parseInt(
        item.inventory_count || item.available_stock || item.stock_on_hand || 0
      ),
      product_category: item.product_category || item.category_name || '',
      sku: item.sku,
      status: item.status,
      product_images: item.product_images || [],
      enhanced_images: item.enhanced_images || undefined
    }))

    const activeProducts = transformed.filter(
      product =>
        product.status === 'active' ||
        product.status === 'Active' ||
        !product.status
    )

    return activeProducts
  }
}

export const productService = new RedisProductService()
