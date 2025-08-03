import { productService } from '../../lib/redis-product-service'

export default async function handler(req, res) {
  const stats = await productService.getCacheStats()
  return res.json(stats)
}
