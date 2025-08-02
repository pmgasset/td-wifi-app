// ===== src/pages/api/test-specific-products-images.js =====
import { zohoAPI } from '../../lib/zoho-api.old';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TESTING SPECIFIC PRODUCTS WITH KNOWN IMAGES ===');

    // These are the 4 products from the category that we know have images on the live site
    const knownProductsWithImages = [
      { id: '2948665000025595092', name: 'Cudy 5G NR/SA/NSA AX3000' },
      { id: '2948665000025595158', name: 'GL.iNet GL-X3000 (Spitz AX) 5G NR' },
      { id: '2948665000025859043', name: 'NRadio 5G AX3000 Tower' },
      { id: '2948665000026496005', name: 'UOTEK 5G CPE' }
    ];

    const results = {
      timestamp: new Date().toISOString(),
      productTests: {},
      alternativeEndpoints: {},
      imageDiscovery: {},
      recommendations: []
    };

    // Get access token
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Failed to get access token');
    }

    // Test each product with multiple API approaches
    for (const testProduct of knownProductsWithImages) {
      console.log(`\n=== TESTING PRODUCT: ${testProduct.name} ===`);
      
      const productResults = {
        product_id: testProduct.id,
        name: testProduct.name,
        tests: {}
      };

      // Test 1: Standard product endpoint
      try {
        console.log('Testing standard product endpoint...');
        const response = await zohoAPI.apiRequest(`/products/${testProduct.id}`);
        const product = response.product || response;
        
        productResults.tests.standard = {
          success: true,
          hasDocuments: !!product.documents,
          documentsCount: product.documents?.length || 0,
          documents: product.documents || [],
          hasImageFields: Object.keys(product).filter(key => 
            key.toLowerCase().includes('image') || key.toLowerCase().includes('photo')
          ),
          allFields: Object.keys(product)
        };
        
        console.log(`✓ Standard endpoint - ${product.documents?.length || 0} documents`);
      } catch (error) {
        productResults.tests.standard = { success: false, error: error.message };
        console.log(`✗ Standard endpoint failed: ${error.message}`);
      }

      // Test 2: Storefront API approach
      try {
        console.log('Testing storefront API...');
        const storefrontUrl = `https://commerce.zoho.com/storefront/api/v1/products/${testProduct.id}?format=json`;
        
        const response = await fetch(storefrontUrl, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const product = data.payload?.product || data.product || data;
          
          productResults.tests.storefront = {
            success: true,
            hasDocuments: !!product.documents,
            documentsCount: product.documents?.length || 0,
            documents: product.documents || [],
            hasImages: !!product.images,
            imagesCount: product.images?.length || 0,
            images: product.images || [],
            hasVariantImages: !!product.variants?.[0]?.images,
            variantImagesCount: product.variants?.[0]?.images?.length || 0,
            variantImages: product.variants?.[0]?.images || [],
            responseStructure: Object.keys(product)
          };
          
          console.log(`✓ Storefront API - ${product.documents?.length || 0} documents, ${product.images?.length || 0} images`);
        } else {
          const errorText = await response.text();
          productResults.tests.storefront = {
            success: false,
            status: response.status,
            error: errorText
          };
          console.log(`✗ Storefront API failed: ${response.status}`);
        }
      } catch (error) {
        productResults.tests.storefront = { success: false, error: error.message };
        console.log(`✗ Storefront API error: ${error.message}`);
      }

      // Test 3: Try editpage endpoint
      try {
        console.log('Testing editpage endpoint...');
        const response = await zohoAPI.apiRequest(`/products/editpage?product_id=${testProduct.id}`);
        const product = response.product || response;
        
        productResults.tests.editpage = {
          success: true,
          hasDocuments: !!product.documents,
          documentsCount: product.documents?.length || 0,
          documents: product.documents || [],
          responseStructure: Object.keys(product)
        };
        
        console.log(`✓ Editpage endpoint - ${product.documents?.length || 0} documents`);
      } catch (error) {
        productResults.tests.editpage = { success: false, error: error.message };
        console.log(`✗ Editpage endpoint failed: ${error.message}`);
      }

      // Test 4: Try images endpoint directly
      try {
        console.log('Testing direct images endpoint...');
        const response = await fetch(`https://commerce.zoho.com/store/api/v1/products/${testProduct.id}/images`, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          productResults.tests.directImages = {
            success: true,
            responseKeys: Object.keys(data),
            hasImages: !!data.images,
            imagesCount: data.images?.length || 0,
            images: data.images || [],
            rawResponse: data
          };
          console.log(`✓ Direct images endpoint - ${data.images?.length || 0} images`);
        } else {
          const errorText = await response.text();
          productResults.tests.directImages = {
            success: false,
            status: response.status,
            error: errorText
          };
          console.log(`✗ Direct images endpoint failed: ${response.status}`);
        }
      } catch (error) {
        productResults.tests.directImages = { success: false, error: error.message };
        console.log(`✗ Direct images endpoint error: ${error.message}`);
      }

      results.productTests[testProduct.id] = productResults;
    }

    // Analyze results and find working patterns
    console.log('\n=== ANALYZING RESULTS ===');
    
    const workingEndpoints = [];
    const imageData = [];

    Object.values(results.productTests).forEach(productResult => {
      Object.entries(productResult.tests).forEach(([testName, testResult]) => {
        if (testResult.success) {
          const hasImages = testResult.documentsCount > 0 || testResult.imagesCount > 0;
          if (hasImages) {
            workingEndpoints.push({
              productId: productResult.product_id,
              productName: productResult.name,
              endpoint: testName,
              documentsCount: testResult.documentsCount || 0,
              imagesCount: testResult.imagesCount || 0,
              documents: testResult.documents || [],
              images: testResult.images || []
            });

            // Collect all image data
            if (testResult.documents) {
              imageData.push(...testResult.documents.map(doc => ({
                type: 'document',
                productId: productResult.product_id,
                endpoint: testName,
                ...doc
              })));
            }
            if (testResult.images) {
              imageData.push(...testResult.images.map(img => ({
                type: 'image',
                productId: productResult.product_id,
                endpoint: testName,
                ...img
              })));
            }
          }
        }
      });
    });

    results.imageDiscovery = {
      workingEndpoints: workingEndpoints,
      totalImagesFound: imageData.length,
      imageData: imageData,
      uniqueImageUrls: [...new Set(imageData.map(img => img.url || img.image_url).filter(Boolean))]
    };

    // Generate recommendations
    if (workingEndpoints.length === 0) {
      results.recommendations.push('❌ No API endpoints returned image data for products that have images on live site');
      results.recommendations.push('🔧 The live site might be using a different API or caching mechanism');
      results.recommendations.push('🔧 Try checking the live site\'s network requests to see how it loads images');
    } else {
      results.recommendations.push(`✅ Found ${workingEndpoints.length} working endpoint(s) with image data`);
      
      workingEndpoints.forEach(endpoint => {
        results.recommendations.push(`🎯 ${endpoint.endpoint}: ${endpoint.productName} has ${endpoint.documentsCount + endpoint.imagesCount} images`);
      });

      if (imageData.length > 0) {
        results.recommendations.push('🖼️ Sample image URLs found:');
        results.imageDiscovery.uniqueImageUrls.slice(0, 5).forEach(url => {
          results.recommendations.push(`   • ${url}`);
        });
      }
    }

    return res.status(200).json({
      ...results,
      summary: {
        productsTestedWithImages: knownProductsWithImages.length,
        workingEndpoints: workingEndpoints.length,
        totalImagesFound: imageData.length,
        needsFurtherInvestigation: workingEndpoints.length === 0
      },
      nextSteps: workingEndpoints.length > 0 ? [
        '1. Update your API client to use the working endpoint',
        '2. Test the image URLs to make sure they load',
        '3. Update your ProductImage component',
        '4. Deploy and test on your live site'
      ] : [
        '1. Run the live site analysis to see how images are served',
        '2. Check network requests on traveldatawifi.com to find image sources',
        '3. Look for a different API endpoint or image service',
        '4. Consider using the live site\'s image URLs directly'
      ]
    });

  } catch (error) {
    console.error('Product image test failed:', error);
    return res.status(500).json({
      error: 'Product image test failed',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}

// Helper function to get access token
async function getAccessToken() {
  try {
    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    return null;
  }
}