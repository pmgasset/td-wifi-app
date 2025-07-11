// ===== src/pages/api/test-product-images.js =====
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Testing individual product fetch for images...');
    
    // Test with the product ID you mentioned: NRadio AC1200 Dual Band Tower
    const productId = '2948665000025595236';
    
    console.log(`Fetching product details for: ${productId}`);
    
    // Try the editpage endpoint which should include images
    const detailResponse = await zohoAPI.apiRequest(`/products/editpage?product_id=${productId}`);
    
    console.log('Full product response:', JSON.stringify(detailResponse, null, 2));
    
    if (detailResponse.code === 0 && detailResponse.product) {
      const product = detailResponse.product;
      
      // Analyze the image fields
      const imageAnalysis = {
        hasDocuments: 'documents' in product,
        documentsType: typeof product.documents,
        documentsLength: product.documents?.length || 0,
        documentsContent: product.documents,
        hasImages: 'images' in product,
        imagesContent: product.images,
        hasProductImages: 'product_images' in product,
        productImagesContent: product.product_images,
        allKeys: Object.keys(product)
      };
      
      console.log('Image analysis:', imageAnalysis);
      
      return res.status(200).json({
        success: true,
        productId,
        productName: product.name || product.product_name,
        imageAnalysis,
        fullProduct: product
      });
    } else {
      return res.status(404).json({
        error: 'Product not found or invalid response',
        response: detailResponse
      });
    }
    
  } catch (error) {
    console.error('Test API Error:', error);
    return res.status(500).json({
      error: 'Failed to test product images',
      details: error.message,
      stack: error.stack
    });
  }
}