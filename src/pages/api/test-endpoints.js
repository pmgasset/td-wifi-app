// src/pages/api/test-endpoints.js - Test the EXACT endpoints from your debug files

import { tokenManager } from '../../lib/enhanced-token-manager';

export default async function handler(req, res) {
  try {
    console.log('🔍 Testing EXACT endpoints from debug files...');
    
    // Get access token
    const token = await tokenManager.getAccessToken('commerce');
    
    // Test the EXACT endpoints from your debug-checkout.js file
    const testEndpoints = [
      'https://commerce.zoho.com/store/api/v1/products',
      'https://www.zohoapis.com/commerce/v1/products',
      `https://commerce.zoho.com/store/api/v1/stores/${process.env.ZOHO_STORE_ID}/products`,
      // Additional endpoints from debug-us-zoho.js
      `https://www.zohoapis.com/commerce/v1/stores/${process.env.ZOHO_STORE_ID}/products`,
      `https://www.zohoapis.com/commerce/v1/organizations/${process.env.ZOHO_STORE_ID}/stores`,
      `https://www.zohoapis.com/commerce/v1/stores`,
      `https://www.zohoapis.com/commerce/v1/user/stores`
    ];

    const results = {
      store_id: process.env.ZOHO_STORE_ID,
      working_endpoints: [],
      failed_endpoints: [],
      recommendations: []
    };

    for (const endpoint of testEndpoints) {
      try {
        console.log(`Testing: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json',
            'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
          },
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        const responseText = await response.text();
        let responseData = null;
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw_response: responseText.substring(0, 200) };
        }

        const result = {
          endpoint: endpoint,
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          hasProducts: !!responseData.products,
          productCount: responseData.products?.length || 0,
          hasStores: !!responseData.stores,
          storeCount: responseData.stores?.length || 0,
          error: responseData.error || responseData.message || null,
          responsePreview: JSON.stringify(responseData).substring(0, 300)
        };

        if (response.ok) {
          console.log(`✅ SUCCESS: ${endpoint}`);
          
          if (responseData.products && responseData.products.length > 0) {
            const productsWithImages = responseData.products.filter(p => 
              p.documents && p.documents.length > 0
            );
            
            result.productsWithImages = productsWithImages.length;
            result.sampleProduct = responseData.products[0];
            result.hasImageData = productsWithImages.length > 0;
            
            console.log(`  📦 Found ${responseData.products.length} products`);
            console.log(`  🖼️ ${productsWithImages.length} products have images`);
            
            results.working_endpoints.push(result);
            
            // This is a good candidate for your commerce API
            if (productsWithImages.length > 0) {
              results.recommendations.push(`🎯 BEST OPTION: ${endpoint} - Has ${productsWithImages.length} products with images`);
            }
          } else if (responseData.stores && responseData.stores.length > 0) {
            result.stores = responseData.stores;
            results.working_endpoints.push(result);
            
            console.log(`  🏪 Found ${responseData.stores.length} stores`);
            
            // Test each store for products
            for (const store of responseData.stores.slice(0, 2)) {
              const storeId = store.store_id || store.id;
              if (storeId) {
                results.recommendations.push(`🔧 Try store: ${storeId} (${store.store_name || 'Unknown'})`);
              }
            }
          } else {
            results.working_endpoints.push(result);
          }
        } else {
          console.log(`❌ FAILED: ${endpoint} - ${response.status}: ${result.error}`);
          results.failed_endpoints.push(result);
        }

      } catch (error) {
        console.log(`❌ ERROR: ${endpoint} - ${error.message}`);
        results.failed_endpoints.push({
          endpoint: endpoint,
          success: false,
          error: error.message
        });
      }
    }

    // Generate final recommendations
    if (results.working_endpoints.length === 0) {
      results.recommendations.push('❌ NO WORKING ENDPOINTS FOUND');
      results.recommendations.push('🔧 Your Zoho Commerce store may not be set up correctly');
      results.recommendations.push('🔧 Check if you have the right permissions');
      results.recommendations.push('🔧 Verify your ZOHO_STORE_ID is correct');
    } else {
      const bestEndpoint = results.working_endpoints.find(ep => ep.hasImageData) || 
                           results.working_endpoints.find(ep => ep.productCount > 0);
      
      if (bestEndpoint) {
        results.recommendations.unshift(`✅ UPDATE YOUR COMMERCE API BASE URL TO: ${bestEndpoint.endpoint.split('/').slice(0, -1).join('/')}`);
        results.recommendations.unshift(`✅ USE THIS ENDPOINT PATTERN: ${bestEndpoint.endpoint.split('/').slice(-1)[0]}`);
      }
    }

    console.log('\n=== FINAL RECOMMENDATIONS ===');
    results.recommendations.forEach(rec => console.log(rec));

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      summary: {
        working_endpoints: results.working_endpoints.length,
        failed_endpoints: results.failed_endpoints.length,
        endpoints_with_products: results.working_endpoints.filter(ep => ep.productCount > 0).length,
        endpoints_with_images: results.working_endpoints.filter(ep => ep.hasImageData).length
      },
      ...results
    });

  } catch (error) {
    console.error('Endpoint test failed:', error);
    return res.status(500).json({
      error: 'Endpoint test failed',
      details: error.message,
      store_id: process.env.ZOHO_STORE_ID
    });
  }
}