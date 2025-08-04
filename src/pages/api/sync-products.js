import { productService } from '../../lib/redis-product-service'

export default async function handler(req, res) {
  const { secret } = req.query
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🔄 Manual product sync triggered (Inventory API only)...')

    const result = await productService.syncProducts()

    console.log(`✅ Manual sync completed: ${result.productCount} products`)

    return res.json({
      success: true,
      ...result,
      message: 'Manual sync completed successfully',
      api_source: 'inventory_only',
      benefits: [
        '🚀 No Storefront API calls = No rate limits',
        '⚡ Faster sync (single API source)',
        '🖼️ Images from Inventory API work perfectly',
        '💾 All data cached in Redis for speed',
      ],
      instructions: [
        'Products are now cached in Redis',
        'Visit /api/products to see cached products',
        'Visit /api/cache-status to check cache health',
        'Images served via /api/images/{itemId} proxy',
      ],
    })
  } catch (error) {
    console.error('❌ Manual product sync failed:', error)
    return res.status(500).json({
      error: error.message,
      success: false,
      timestamp: new Date().toISOString(),
    })
  }
}

