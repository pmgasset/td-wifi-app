import { productService } from '../../../lib/redis-product-service'

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🔄 Starting scheduled product sync (Inventory API only)...')

    const result = await productService.syncProducts()

    console.log(`✅ Scheduled sync completed: ${result.productCount} products`)

    return res.json({
      success: true,
      ...result,
      message: 'Products synced successfully from Inventory API only',
      api_source: 'inventory_only',
    })
  } catch (error) {
    console.error('❌ Scheduled product sync failed:', error)
    return res.status(500).json({
      error: error.message,
      success: false,
      timestamp: new Date().toISOString(),
    })
  }
}

