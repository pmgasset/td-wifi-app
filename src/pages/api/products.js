import { productService } from '../../lib/redis-product-service.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const data = await productService.getAllProducts()
    res.status(200).json(data)
  } catch (error) {
    console.error('❌ Products API Error:', error)
    res.status(500).json({
      error: 'Failed to fetch products',
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
