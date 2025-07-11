// ===== src/pages/api/products.js =====
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const products = await zohoAPI.getProducts();
    res.status(200).json({ products });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch products from Zoho API',
      details: error.message 
    });
  }
}