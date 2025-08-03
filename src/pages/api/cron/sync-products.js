import { Redis } from '@upstash/redis'
import { zohoInventoryAPI } from '../../../lib/zoho-api-inventory'

const redis = Redis.fromEnv()

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log('🔄 Starting daily product sync...')

    const products = await zohoInventoryAPI.getInventoryProducts()

    await redis.setex('products:all', 86400, JSON.stringify(products))
    await redis.setex('products:last_sync', 86400, Date.now())

    for (const product of products) {
      await redis.setex(`product:${product.item_id}`, 86400, JSON.stringify(product))
      if (product.sku) {
        await redis.setex(`product:sku:${product.sku}`, 86400, JSON.stringify(product))
      }
    }

    console.log(`✅ Synced ${products.length} products to Redis`)

    return res.json({
      success: true,
      count: products.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Product sync failed:', error)
    return res.status(500).json({ error: error.message })
  }
}
