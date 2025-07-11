// ===== src/pages/api/test-working-products.js =====
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TESTING WORKING PRODUCTS SETUP ===');

    // Get all products
    const allProducts = await zohoAPI.getProducts();
    console.log(`Total products found: ${allProducts.length}`);

    // Separate active vs inactive products
    const activeProducts = allProducts.filter(p => p.status === 'active');
    const storefrontProducts = allProducts.filter(p => p.show_in_storefront);
    const productsWithImages = allProducts.filter(p => p.product_images && p.product_images.length > 0);

    // Get a detailed look at a few products
    const sampleProducts = allProducts.slice(0, 5).map(product => ({
      id: product.product_id,
      name: product.product_name || product.name,
      status: product.status,
      showInStorefront: product.show_in_storefront,
      price: product.product_price || product.min_rate,
      hasDocuments: !!product.documents?.length,
      documentCount: product.documents?.length || 0,
      documents: product.documents || [],
      hasProductImages: !!product.product_images?.length,
      productImages: product.product_images || [],
      category: product.product_category || product.category_name,
      url: product.seo_url || product.url
    }));

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalProducts: allProducts.length,
        activeProducts: activeProducts.length,
        storefrontProducts: storefrontProducts.length,
        productsWithImages: productsWithImages.length
      },
      sampleProducts,
      recommendations: [
        allProducts.length > 0 ? `✅ Successfully fetched ${allProducts.length} products` : '❌ No products found',
        activeProducts.length > 0 ? `✅ Found ${activeProducts.length} active products` : '⚠️ No active products',
        storefrontProducts.length > 0 ? `✅ Found ${storefrontProducts.length} storefront products` : '⚠️ No storefront products',
        productsWithImages.length > 0 ? `🖼️ Found ${productsWithImages.length} products with images` : '📷 No products have images yet',
        '🔧 To add images: Go to Zoho Commerce admin → Products → Edit product → Upload images'
      ],
      nextSteps: [
        '1. Replace src/lib/zoho-api.ts with the new version',
        '2. Replace src/pages/api/products.js with the updated version', 
        '3. Replace src/components/ProductImage.tsx with the updated version',
        '4. Test your /products page',
        '5. Add images to products in Zoho Commerce admin panel'
      ]
    });

  } catch (error) {
    console.error('Test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}