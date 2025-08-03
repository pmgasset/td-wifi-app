import { productService } from '../../lib/redis-product-service'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🛒 Loading products from Redis cache...')
    const products = await productService.getAllProducts()

    return res.status(200).json({
      success: true,
      products,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Products API Error:', error)
    return res.status(500).json({
      error: 'Failed to load products',
      message: error.message
    })
  }
}
