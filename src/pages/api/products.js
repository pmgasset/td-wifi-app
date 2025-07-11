// ===== src/pages/api/products.js =====
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  console.log('API route called:', req.method, req.url);
  
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
    console.log('First product (if any):', products[0] || 'No products');
    
    res.status(200).json({ products });
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