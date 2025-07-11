// ===== src/pages/api/test-improved-api.js =====
import { zohoAPIImproved, zohoAPIAlternatives } from '../../lib/zoho-api-improved';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const results = {
    timestamp: new Date().toISOString(),
    testResults: {},
    successfulConfig: null,
    productData: null,
    summary: {
      totalConfigurations: 0,
      successfulConfigurations: 0,
      hasProducts: false
    }
  };

  try {
    console.log('=== TESTING IMPROVED ZOHO API CLIENT ===');

    // Test the default improved API
    const allConfigs = [
      { name: 'Default Improved API', api: zohoAPIImproved },
      ...zohoAPIAlternatives.map((api, index) => ({
        name: `Alternative Config ${index + 1}`,
        api
      }))
    ];

    results.summary.totalConfigurations = allConfigs.length;

    for (const config of allConfigs) {
      console.log(`\nTesting: ${config.name}`);
      
      try {
        // Test authentication first
        const token = await config.api.getAccessToken();
        
        // Test getting products
        const products = await config.api.getProducts();
        
        results.testResults[config.name] = {
          success: true,
          hasToken: !!token,
          tokenLength: token?.length || 0,
          productCount: products?.length || 0,
          products: products?.slice(0, 2) || [], // First 2 products for inspection
          apiConfig: {
            baseURL: config.api.config?.baseURL || 'unknown',
            region: config.api.config?.region || 'unknown'
          }
        };

        if (products && products.length > 0) {
          results.summary.hasProducts = true;
          if (!results.successfulConfig) {
            results.successfulConfig = config.name;
            results.productData = {
              totalProducts: products.length,
              sampleProducts: products.slice(0, 3).map(p => ({
                id: p.product_id,
                name: p.product_name,
                price: p.product_price,
                hasImages: !!(p.product_images && p.product_images.length > 0),
                imageCount: p.product_images?.length || 0,
                imageUrls: p.product_images || [],
                allFields: Object.keys(p)
              }))
            };
          }
        }

        results.summary.successfulConfigurations++;
        console.log(`✓ ${config.name} - Success! Found ${products?.length || 0} products`);

      } catch (error) {
        results.testResults[config.name] = {
          success: false,
          error: error.message,
          errorType: error.name,
          stackTrace: error.stack?.split('\n')[0]
        };
        console.log(`✗ ${config.name} - Error: ${error.message}`);
      }
    }

    // Generate recommendations
    const recommendations = [];
    
    if (results.summary.successfulConfigurations === 0) {
      recommendations.push('❌ CRITICAL: No API configurations worked');
      recommendations.push('🔧 Check your Zoho credentials and store ID');
      recommendations.push('🔧 Verify your Zoho Commerce account is active');
      recommendations.push('🔧 Check if you need different API scopes');
    } else {
      recommendations.push(`✅ Found ${results.summary.successfulConfigurations} working configuration(s)`);
      
      if (results.successfulConfig) {
        recommendations.push(`🎯 Use this configuration: ${results.successfulConfig}`);
      }
      
      if (results.summary.hasProducts) {
        recommendations.push(`📦 Successfully loaded ${results.productData.totalProducts} products`);
        
        // Check image availability
        const productsWithImages = results.productData.sampleProducts.filter(p => p.hasImages);
        if (productsWithImages.length > 0) {
          recommendations.push(`🖼️ Found ${productsWithImages.length} products with images`);
        } else {
          recommendations.push('⚠️ No products have images - check image field structure');
        }
      }
    }

    return res.status(200).json({
      ...results,
      recommendations,
      nextSteps: [
        '1. Use the successful configuration in your main API',
        '2. Update your zoho-api.ts with the working baseURL',
        '3. Test the product images endpoint specifically',
        '4. Update your ProductImage component to handle the response structure'
      ]
    });

  } catch (error) {
    console.error('Test failed:', error);
    return res.status(500).json({
      error: 'API test failed',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}