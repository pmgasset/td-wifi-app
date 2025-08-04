import { productService } from '../../lib/redis-product-service'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const stats = await productService.getCacheStats()

    const cacheHealth = {
      healthy: stats.healthy,
      status: stats.healthy ? 'healthy' : 'unhealthy',
      lastSync: stats.lastSync,
      cacheAge: stats.cacheAge,
      cacheAgeHours: stats.cacheAge
        ? Math.round((stats.cacheAge / (1000 * 60 * 60)) * 100) / 100
        : null,
      productCount: stats.productCount,
      syncStatus: stats.syncStatus,
      apiSource: 'inventory_only',
      benefits: [
        '🚀 No Storefront API rate limits',
        '⚡ Single API source (faster sync)',
        '🖼️ Images via Inventory API + proxy',
        '💾 All data cached in Redis',
      ],
      recommendations: [],
    }

    if (!stats.healthy) {
      cacheHealth.recommendations.push('❌ Cache is unhealthy - run manual sync')
    }

    if (stats.cacheAge && stats.cacheAge > 25 * 60 * 60 * 1000) {
      cacheHealth.recommendations.push('⚠️ Cache is stale - consider running sync')
    }

    if (stats.productCount === 0) {
      cacheHealth.recommendations.push('❌ No products in cache - run sync immediately')
    }

    if (stats.productCount > 0 && stats.cacheAge < 2 * 60 * 60 * 1000) {
      cacheHealth.recommendations.push('✅ Cache is fresh and healthy (Inventory API only)')
    }

    return res.json({
      ...cacheHealth,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cache status error:', error)
    return res.status(500).json({
      error: 'Failed to get cache status',
      details: error.message,
      healthy: false,
      timestamp: new Date().toISOString(),
    })
  }
}

