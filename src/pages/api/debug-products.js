// ===== src/pages/api/debug-products.js =====
import { zohoAPI } from '../../lib/zoho-api.ts';

export default async function handler(req, res) {
  console.log('Debug API route called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Attempting to fetch products from Zoho...');
    
    // Check environment variables
    const envVars = {
      ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
      ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
      ZOHO_STORE_ID: !!process.env.ZOHO_STORE_ID,
    };
    console.log('Environment variables present:', envVars);
    
    const products = await zohoAPI.getProducts();
    console.log('Products fetched successfully:', products.length, 'products');
    
    // Detailed analysis of first few products
    products.slice(0, 3).forEach((product, index) => {
      console.log(`\n=== Product ${index + 1} Analysis ===`);
      console.log('Product ID:', product.product_id);
      console.log('Product Name:', product.product_name);
      console.log('Has product_images field:', 'product_images' in product);
      console.log('product_images type:', typeof product.product_images);
      console.log('product_images value:', product.product_images);
      console.log('product_images length:', product.product_images?.length);
      
      if (product.product_images && Array.isArray(product.product_images)) {
        product.product_images.forEach((img, imgIndex) => {
          console.log(`  Image ${imgIndex + 1}:`, img);
          console.log(`  Image ${imgIndex + 1} type:`, typeof img);
          console.log(`  Image ${imgIndex + 1} length:`, img?.length);
        });
      }
      
      // Check for other possible image fields
      const possibleImageFields = ['images', 'image', 'photo', 'picture', 'thumbnail', 'image_url', 'product_image'];
      possibleImageFields.forEach(field => {
        if (field in product) {
          console.log(`Found alternative image field '${field}':`, product[field]);
        }
      });
      
      console.log('All product keys:', Object.keys(product));
    });
    
    res.status(200).json({ 
      products,
      debug: {
        totalProducts: products.length,
        envVars,
        sampleProduct: products[0] || null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('API Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch products from Zoho API',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}