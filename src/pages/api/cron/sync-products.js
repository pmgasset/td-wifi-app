import { productService } from '../../../lib/redis-product-service';

export default async function handler(req, res) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await productService.syncProducts();
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Cron sync failed', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
