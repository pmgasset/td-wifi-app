// ===== src/pages/api/test-product-images.js =====
import { zohoAPI } from '../../lib/zoho-api.ts';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Testing different Zoho API endpoints for images...');
    
    const productId = '2948665000025595236';
    const results = {};
    
    // Test 1: Try the editpage endpoint (administrative)
    try {
      console.log('Testing editpage endpoint...');
      const editResponse = await zohoAPI.apiRequest(`/products/editpage?product_id=${productId}`);
      results.editpage = {
        success: true,
        hasDocuments: 'documents' in (editResponse.product || {}),
        hasImages: 'images' in (editResponse.product || {}),
        documents: editResponse.product?.documents,
        images: editResponse.product?.images
      };
    } catch (error) {
      console.log('Editpage endpoint failed:', error.message);
      results.editpage = { success: false, error: error.message };
    }
    
    // Test 2: Try direct product endpoint
    try {
      console.log('Testing direct product endpoint...');
      const directResponse = await zohoAPI.apiRequest(`/products/${productId}`);
      results.direct = {
        success: true,
        hasDocuments: 'documents' in (directResponse.product || directResponse),
        hasImages: 'images' in (directResponse.product || directResponse),
        response: directResponse
      };
    } catch (error) {
      console.log('Direct endpoint failed:', error.message);
      results.direct = { success: false, error: error.message };
    }
    
    // Test 3: Try to make a storefront API call (this might need different auth/headers)
    try {
      console.log('Testing storefront approach...');
      // We might need to modify the base URL and headers for storefront API
      const storefrontUrl = `https://commerce.zoho.com/storefront/api/v1/products/${productId}?format=json`;
      
      const storefrontResponse = await fetch(storefrontUrl, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${await zohoAPI.getAccessToken()}`,
          'Content-Type': 'application/json',
          // Note: Storefront API might need domain-name header instead of store org ID
        }
      });
      
      if (storefrontResponse.ok) {
        const storefrontData = await storefrontResponse.json();
        results.storefront = {
          success: true,
          data: storefrontData
        };
      } else {
        results.storefront = {
          success: false,
          status: storefrontResponse.status,
          statusText: storefrontResponse.statusText
        };
      }
    } catch (error) {
      console.log('Storefront endpoint failed:', error.message);
      results.storefront = { success: false, error: error.message };
    }
    
    // Test 4: Try to get product images using the images endpoint directly
    try {
      console.log('Testing images endpoint...');
      const imagesResponse = await zohoAPI.apiRequest(`/products/${productId}/images`);
      results.images = {
        success: true,
        data: imagesResponse
      };
    } catch (error) {
      console.log('Images endpoint failed:', error.message);
      results.images = { success: false, error: error.message };
    }
    
    // Test 5: Check if we can get a list of all possible endpoints
    try {
      console.log('Testing root API...');
      const rootResponse = await zohoAPI.apiRequest('/');
      results.root = {
        success: true,
        data: rootResponse
      };
    } catch (error) {
      console.log('Root endpoint failed:', error.message);
      results.root = { success: false, error: error.message };
    }
    
    return res.status(200).json({
      productId,
      testResults: results,
      summary: {
        totalTests: Object.keys(results).length,
        successfulTests: Object.values(results).filter(r => r.success).length,
        recommendations: [
          'Check which endpoint returned images',
          'Look at the response structure for image fields',
          'Check if we need different headers or authentication for storefront API'
        ]
      }
    });
    
  } catch (error) {
    console.error('Test API Error:', error);
    return res.status(500).json({
      error: 'Failed to test product images',
      details: error.message,
      stack: error.stack
    });
  }
}