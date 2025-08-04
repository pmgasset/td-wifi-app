import { productService } from '../src/lib/redis-product-service.js'

async function main() {
  console.log('🔄 Syncing products from Zoho to Redis...')
  try {
    const data = await productService.fetchAndCacheProducts()
    console.log(`✅ Synced ${data.products.length} products to Redis`)
    process.exit(0)
  } catch (err) {
    console.error('❌ Product sync failed:', err)
    process.exit(1)
  }
}

main()
