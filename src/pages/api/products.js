// ===== src/pages/api/products.js ===== (FIXED JAVASCRIPT SYNTAX)
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  console.log('Products API called:', req.method, req.url);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Fetching products from Zoho Commerce...');
    
    const products = await zohoAPI.getProducts();
    console.log(`Successfully fetched ${products.length} products`);
    
    // Filter out inactive products and products not shown in storefront for public API
    const activeProducts = products.filter(product => 
      product.status === 'active' && 
      product.show_in_storefront === true
    );
    
    console.log(`Filtered to ${activeProducts.length} active storefront products`);
    
    // Add some debug info for the first few products
    if (activeProducts.length > 0) {
      console.log('Sample product structure:', {
        id: activeProducts[0].product_id,
        name: activeProducts[0].product_name,
        price: activeProducts[0].product_price,
        hasImages: activeProducts[0].product_images?.length > 0,
        imageCount: activeProducts[0].product_images?.length || 0,
        status: activeProducts[0].status,
        showInStorefront: activeProducts[0].show_in_storefront
      });
    }
    
    res.status(200).json({ 
      products: activeProducts,
      meta: {
        total: products.length,
        active: activeProducts.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Products API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch products from Zoho Commerce',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}