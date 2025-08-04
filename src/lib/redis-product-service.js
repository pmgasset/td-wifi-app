import { Redis } from '@upstash/redis'
import { zohoInventoryAPI } from './zoho-api-inventory'

// Initialize Redis with existing environment variables
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

export class RedisProductService {
  // Cache keys
  static KEYS = {
    ALL_PRODUCTS: 'products:all',
    LAST_SYNC: 'products:last_sync',
    PRODUCT_BY_ID: (id) => `product:${id}`,
    PRODUCT_BY_SKU: (sku) => `product:sku:${sku}`,
    PRODUCT_IMAGE: (id) => `product:image:${id}`,
    SYNC_STATUS: 'sync:status',
  }

  // Cache TTL (24 hours)
  static TTL = 86400

  /**
   * Get all products from Redis cache
   */
  async getAllProducts() {
    try {
      console.log('🔍 Checking Redis cache for products...')

      const cached = await redis.get(RedisProductService.KEYS.ALL_PRODUCTS)
      if (cached) {
        const products = typeof cached === 'string' ? JSON.parse(cached) : cached
        console.log(`✅ Found ${products.length} products in Redis cache`)
        return products
      }

      console.log('⚠️ Cache miss - attempting emergency sync...')
      return await this.emergencySync()
    } catch (error) {
      console.error('❌ Redis error, falling back to direct API:', error)
      return await this.fetchFromInventoryDirectly()
    }
  }

  /**
   * Get single product by ID
   */
  async getProductById(itemId) {
    try {
      const cached = await redis.get(RedisProductService.KEYS.PRODUCT_BY_ID(itemId))
      if (cached) {
        return typeof cached === 'string' ? JSON.parse(cached) : cached
      }

      const allProducts = await this.getAllProducts()
      return allProducts.find((p) => p.item_id === itemId || p.product_id === itemId)
    } catch (error) {
      console.error('Error fetching product by ID:', error)
      return null
    }
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(sku) {
    try {
      const cached = await redis.get(RedisProductService.KEYS.PRODUCT_BY_SKU(sku))
      if (cached) {
        return typeof cached === 'string' ? JSON.parse(cached) : cached
      }

      const allProducts = await this.getAllProducts()
      return allProducts.find((p) => p.sku === sku)
    } catch (error) {
      console.error('Error fetching product by SKU:', error)
      return null
    }
  }

  /**
   * Get cached product image data
   */
  async getProductImage(itemId) {
    try {
      const cached = await redis.get(RedisProductService.KEYS.PRODUCT_IMAGE(itemId))
      if (cached) {
        return typeof cached === 'string' ? JSON.parse(cached) : cached
      }
      return null
    } catch (error) {
      console.error('Error fetching cached image:', error)
      return null
    }
  }

  /**
   * Sync products from Zoho Inventory API only - SIMPLIFIED
   */
  async syncProducts() {
    try {
      console.log('🔄 Starting product sync from Zoho Inventory API...')

      // Set sync status
      await redis.setex(
        RedisProductService.KEYS.SYNC_STATUS,
        300,
        JSON.stringify({
          status: 'syncing',
          started_at: new Date().toISOString(),
        })
      )

      // Step 1: Get ALL products from Inventory API
      console.log('📦 Fetching products from Zoho Inventory API...')
      const inventoryProducts = await zohoInventoryAPI.getInventoryProducts()
      console.log(`✅ Retrieved ${inventoryProducts.length} total inventory products`)

      // Step 2: Filter by cf_display_in_app custom field
      console.log('🔍 Filtering products by cf_display_in_app field...')
      const filteredProducts = this.filterProductsByDisplayInApp(inventoryProducts)
      console.log(`✅ Found ${filteredProducts.length} products with display_in_app=true`)

      // Step 3: Download and cache product images
      console.log('🖼️ Processing product images...')
      await this.cacheProductImages(filteredProducts)

      // Step 4: Transform to expected frontend format
      console.log('🎨 Transforming products to frontend format...')
      const transformedProducts = this.transformInventoryProducts(filteredProducts)

      // Step 5: Filter out inactive products
      const activeProducts = transformedProducts.filter(
        (product) => product.status === 'active' || product.status === 'Active' || !product.status
      )

      console.log(`✅ Final result: ${activeProducts.length} active products ready for cache`)

      // Store in Redis with multiple access patterns
      const promises = []

      // Store all products
      promises.push(
        redis.setex(
          RedisProductService.KEYS.ALL_PRODUCTS,
          RedisProductService.TTL,
          JSON.stringify(activeProducts)
        )
      )

      // Store individual products for fast lookups
      activeProducts.forEach((product) => {
        promises.push(
          redis.setex(
            RedisProductService.KEYS.PRODUCT_BY_ID(product.item_id || product.product_id),
            RedisProductService.TTL,
            JSON.stringify(product)
          )
        )

        if (product.sku) {
          promises.push(
            redis.setex(
              RedisProductService.KEYS.PRODUCT_BY_SKU(product.sku),
              RedisProductService.TTL,
              JSON.stringify(product)
            )
          )
        }
      })

      // Store sync metadata
      promises.push(
        redis.setex(
          RedisProductService.KEYS.LAST_SYNC,
          RedisProductService.TTL,
          Date.now()
        )
      )

      // Update sync status
      promises.push(
        redis.setex(
          RedisProductService.KEYS.SYNC_STATUS,
          300,
          JSON.stringify({
            status: 'completed',
            completed_at: new Date().toISOString(),
            product_count: activeProducts.length,
          })
        )
      )

      await Promise.all(promises)

      console.log(`🎉 Product sync completed successfully - ${activeProducts.length} products cached`)

      return {
        success: true,
        productCount: activeProducts.length,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('❌ Product sync failed:', error)

      // Set error status
      await redis.setex(
        RedisProductService.KEYS.SYNC_STATUS,
        300,
        JSON.stringify({
          status: 'failed',
          error: error.message,
          failed_at: new Date().toISOString(),
        })
      )

      throw error
    }
  }

  /**
   * Cache product images from Inventory API
   */
  async cacheProductImages(products) {
    const imagePromises = []

    for (const product of products) {
      if (product.image_id) {
        // Cache image metadata and URL for proxy endpoint
        const imageData = {
          item_id: product.item_id,
          image_id: product.image_id,
          image_name: product.image_name,
          image_type: product.image_type,
          proxy_url: `/api/images/${product.item_id}`, // Your existing image proxy
          cached_at: Date.now(),
        }

        imagePromises.push(
          redis.setex(
            RedisProductService.KEYS.PRODUCT_IMAGE(product.item_id),
            RedisProductService.TTL,
            JSON.stringify(imageData)
          )
        )
      }
    }

    if (imagePromises.length > 0) {
      await Promise.all(imagePromises)
      console.log(`✅ Cached ${imagePromises.length} product images`)
    }
  }

  /**
   * Emergency sync - when cache is empty
   */
  async emergencySync() {
    try {
      console.log('🚨 Emergency sync triggered')
      await this.syncProducts()
      return await this.getAllProducts()
    } catch (error) {
      console.error('❌ Emergency sync failed, falling back to direct API')
      return await this.fetchFromInventoryDirectly()
    }
  }

  /**
   * Direct Inventory API fallback (no caching)
   */
  async fetchFromInventoryDirectly() {
    try {
      console.log('🔄 Fetching products directly from Zoho Inventory API (no cache)')

      const inventoryProducts = await zohoInventoryAPI.getInventoryProducts()
      const filteredProducts = this.filterProductsByDisplayInApp(inventoryProducts)
      const transformedProducts = this.transformInventoryProducts(filteredProducts)

      return transformedProducts.filter(
        (product) => product.status === 'active' || product.status === 'Active' || !product.status
      )
    } catch (error) {
      console.error('❌ Direct API fallback failed:', error)
      return []
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const [lastSync, syncStatus, productCount] = await Promise.all([
        redis.get(RedisProductService.KEYS.LAST_SYNC),
        redis.get(RedisProductService.KEYS.SYNC_STATUS),
        redis.get(RedisProductService.KEYS.ALL_PRODUCTS),
      ])

      const products = productCount
        ? typeof productCount === 'string'
          ? JSON.parse(productCount)
          : productCount
        : []
      const status = syncStatus
        ? typeof syncStatus === 'string'
          ? JSON.parse(syncStatus)
          : syncStatus
        : null

      return {
        lastSync: lastSync ? new Date(lastSync) : null,
        productCount: Array.isArray(products) ? products.length : 0,
        cacheAge: lastSync ? Date.now() - lastSync : null,
        syncStatus: status,
        healthy: Array.isArray(products) && products.length > 0,
        apiSource: 'inventory_only',
      }
    } catch (error) {
      return {
        error: error.message,
        healthy: false,
        apiSource: 'inventory_only',
      }
    }
  }

  // === SIMPLIFIED PRODUCT PROCESSING (INVENTORY ONLY) ===

  /**
   * Filter products by cf_display_in_app custom field
   */
  filterProductsByDisplayInApp(inventoryProducts) {
    return inventoryProducts.filter((product) => {
      if (!product.custom_fields || !Array.isArray(product.custom_fields)) {
        return false
      }

      const displayField = product.custom_fields.find((field) => {
        const fieldLabel = field.label?.toLowerCase()
        const fieldName = field.field_name?.toLowerCase()

        return (
          fieldLabel === 'display_in_app' ||
          fieldName === 'display_in_app' ||
          fieldLabel === 'cf_display_in_app' ||
          fieldName === 'cf_display_in_app'
        )
      })

      if (!displayField) return false

      return (
        displayField.value === true ||
        displayField.value === 'true' ||
        displayField.value === '1' ||
        displayField.value === 1
      )
    })
  }

  /**
   * Transform Inventory products to frontend format (NO MERGING NEEDED)
   */
  transformInventoryProducts(inventoryProducts) {
    return inventoryProducts.map((item) => {
      // Extract images from Inventory API data
      const images = []

      // Primary image (use your existing proxy endpoint)
      if (item.image_id) {
        images.push(`/api/images/${item.item_id}`)
      }

      // Document images from Inventory API
      if (item.documents && Array.isArray(item.documents)) {
        item.documents.forEach((doc) => {
          if (
            doc.file_type &&
            ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(doc.file_type.toLowerCase())
          ) {
            if (doc.file_url) images.push(doc.file_url)
            else if (doc.download_url) images.push(doc.download_url)
          }
        })
      }

      // Get custom field value helper
      const getCustomFieldValue = (fieldName) => {
        if (!item.custom_fields || !Array.isArray(item.custom_fields)) {
          return null
        }

        const field = item.custom_fields.find((f) => {
          const label = f.label?.toLowerCase()
          const name = f.field_name?.toLowerCase()
          const target = fieldName.toLowerCase()

          return (
            label === target ||
            name === target ||
            label === `cf_${target}` ||
            name === `cf_${target}`
          )
        })

        return field ? field.value : null
      }

      return {
        // Core product data
        product_id: item.item_id,
        item_id: item.item_id,
        product_name: item.name,
        name: item.name,
        product_price: item.rate || item.min_rate || 0,
        rate: item.rate || 0,
        product_description: item.description || '',
        description: item.description || '',
        sku: item.sku,
        status: item.status || 'active',

        // Inventory data
        inventory_count: this.parseStock(item.stock_on_hand),
        stock_on_hand: item.stock_on_hand,
        available_stock: item.available_stock,

        // Category data
        product_category: item.category_name || item.group_name || '',
        category_name: item.category_name,
        category_id: item.category_id,
        group_name: item.group_name,

        // Images (all from Inventory API)
        product_images: images,
        image_id: item.image_id,
        image_name: item.image_name,
        image_type: item.image_type,

        // Custom fields
        cf_display_in_app: getCustomFieldValue('display_in_app'),
        custom_fields: item.custom_fields,

        // SEO
        seo_url: item.sku || item.item_id,
        url: item.sku || item.item_id,

        // Timestamps
        created_time: item.created_time,
        last_modified_time: item.last_modified_time,

        // Data source indicator
        data_source: 'inventory_api_only',
      }
    })
  }

  /**
   * Parse stock values
   */
  parseStock(stockValue) {
    if (!stockValue) return 0
    const parsed = typeof stockValue === 'string' ? parseFloat(stockValue) : Number(stockValue)
    return isNaN(parsed) ? 0 : parsed
  }
}

// Create and export the service instance
export const productService = new RedisProductService()

