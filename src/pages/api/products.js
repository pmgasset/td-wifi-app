import { productService } from '../../lib/redis-product-service'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🚀 Loading products from Redis cache...')
    const products = await productService.getAllProducts()

    const filtered = products.filter(product => {
      const displayInAppString = product.cf_display_in_app
      const displayInAppBoolean = product.cf_display_in_app_unformatted
      return (
        displayInAppBoolean === true ||
        displayInAppString === 'true' ||
        displayInAppString === 'True' ||
        displayInAppString === 'TRUE' ||
        displayInAppString === '1' ||
        displayInAppString === 1
      )
    })

    const transformed = filtered.map(item => ({
      product_id: item.item_id,
      product_name: item.name,
      product_price: item.rate || 0,
      product_description: item.description || '',
      inventory_count: parseInt(item.stock_on_hand) || 0,
      product_category: item.category_name || '',
      sku: item.sku,
      status: item.status,
      product_images: item.image_id ? [`/api/images/${item.item_id}`] : []
    }))

    const activeProducts = transformed.filter(product =>
      product.status === 'active' ||
      product.status === 'Active' ||
      !product.status
    )

    return res.json({
      success: true,
      products: activeProducts,
      cached: true,
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
