import { productService } from '../../lib/redis-product-service';

export default async function handler(req, res) {
  try {
    const stats = await productService.getCacheStats();
    const recommendations = [];
    if (!stats.lastSync) {
      recommendations.push('Cache empty. Run sync.');
    } else if (stats.cacheAgeMs && stats.cacheAgeMs > 24 * 60 * 60 * 1000) {
      recommendations.push('Cache older than 24h. Consider syncing.');
    } else {
      recommendations.push('Cache healthy');
    }
    res.status(200).json({ ...stats, recommendations });
  } catch (err) {
    console.error('Cache status error', err);
    res.status(500).json({ error: 'Failed to get cache status', details: err.message });
  }
}
