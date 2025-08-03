import { zohoAPI } from '../../lib/zoho-api.ts'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🛒 Loading products with Storefront images...')
    const products = await zohoAPI.getProducts()

    const filtered = (products || []).filter(product => {
      const displayInApp =
        product.cf_display_in_app ||
        product.cf_display_in_app_unformatted ||
        product.display_in_app
      return (
        displayInApp === true ||
        displayInApp === 'true' ||
        displayInApp === 'True' ||
        displayInApp === 'TRUE' ||
        displayInApp === '1' ||
        displayInApp === 1
      )
    })

    const transformed = filtered.map(item => ({
      product_id: item.product_id || item.item_id,
      product_name: item.product_name || item.name,
      product_price: item.product_price || item.min_rate || item.rate || 0,
      product_description: item.product_description || item.description || '',
      inventory_count: parseInt(
        item.inventory_count || item.available_stock || item.stock_on_hand || 0
      ),
      product_category: item.product_category || item.category_name || '',
      sku: item.sku,
      status: item.status,
      product_images: item.product_images || [],
      enhanced_images: item.enhanced_images || undefined
    }))

    const activeProducts = transformed.filter(
      product =>
        product.status === 'active' ||
        product.status === 'Active' ||
        !product.status
    )

    return res.status(200).json({
      success: true,
      products: activeProducts,
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
