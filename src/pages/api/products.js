import { productService } from '../../lib/redis-product-service';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const start = Date.now();
  try {
    const products = await productService.getAllProducts();
    const stats = await productService.getCacheStats();
    const duration = Date.now() - start;
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=30');
    res.status(200).json({
      products,
      meta: {
        product_count: products.length,
        processing_time_ms: duration,
        cache_last_sync: stats.lastSync,
        cache_age_ms: stats.cacheAgeMs,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Products handler failed', err);
    res.status(500).json({ error: 'Failed to load products', details: err.message });
  }
}
