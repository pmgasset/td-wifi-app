import { productService } from '../../lib/redis-product-service'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🚀 Loading products from Redis cache (Inventory API source)...')

    const startTime = Date.now()
    const products = await productService.getAllProducts()
    const processingTime = Date.now() - startTime

    console.log(`✅ Products API completed in ${processingTime}ms`)
    console.log(`📊 Serving ${products.length} products from cache`)

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')

    return res.json({
      success: true,
      products: products,
      meta: {
        total_products: products.length,
        cached: true,
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
        source: 'redis_cache',
        api_source: 'inventory_only',
        no_storefront_api: true,
      },
    })
  } catch (error) {
    console.error('❌ Products API Error:', error)

    return res.status(500).json({
      error: 'Failed to load products',
      details: error.message,
      timestamp: new Date().toISOString(),
      success: false,
    })
  }
}

