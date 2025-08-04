import { productService } from '../../lib/redis-product-service';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const result = await productService.syncProducts();
    res.status(200).json({
      message: 'Sync completed',
      instructions: 'Use /api/cache-status to verify cache health',
      ...result,
    });
  } catch (err) {
    console.error('Manual sync failed', err);
    res.status(500).json({ error: 'Sync failed', details: err.message });
  }
}
