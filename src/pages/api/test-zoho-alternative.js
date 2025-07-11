// ===== src/pages/api/test-zoho-alternatives.js =====
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TESTING ALTERNATIVE ZOHO API APPROACHES ===');

    const results = {
      timestamp: new Date().toISOString(),
      alternativeApis: {},
      storefrontApi: {},
      publicApi: {},
      recommendations: []
    };

    // Get access token first
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Failed to get access token');
    }

    // Test 1: Try the storefront API (public-facing)
    console.log('\n=== TESTING STOREFRONT API ===');
    
    const storefrontTests = [
      {
        name: 'Storefront Products',
        url: `https://commerce.zoho.com/storefront/api/v1/products`,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID
        }
      },
      {
        name: 'Public Store Products',
        url: `https://commerce.zoho.com/api/v1/public/stores/${process.env.ZOHO_STORE_ID}/products`,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`
        }
      },
      {
        name: 'Store JSON Feed',
        url: `https://commerce.zoho.com/store/${process.env.ZOHO_STORE_ID}/products.json`,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID
        }
      }
    ];

    for (const test of storefrontTests) {
      try {
        console.log(`Testing: ${test.name}`);
        const response = await fetch(test.url, {
          headers: test.headers
        });

        const responseText = await response.text();
        let responseData = null;
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }

        results.storefrontApi[test.name] = {
          success: response.ok,
          status: response.status,
          url: test.url,
          hasProducts: !!(responseData?.products || Array.isArray(responseData)),
          productCount: (responseData?.products || responseData)?.length || 0,
          sampleProduct: (responseData?.products || responseData)?.[0] || null,
          responseKeys: typeof responseData === 'object' ? Object.keys(responseData) : [],
          responsePreview: JSON.stringify(responseData).substring(0, 500)
        };

        if (response.ok) {
          console.log(`✓ ${test.name} - Success`);
        } else {
          console.log(`✗ ${test.name} - ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        results.storefrontApi[test.name] = {
          success: false,
          url: test.url,
          error: error.message
        };
        console.log(`✗ ${test.name} - Error: ${error.message}`);
      }
    }

    // Test 2: Try different API versions and endpoints
    console.log('\n=== TESTING ALTERNATIVE API VERSIONS ===');
    
    const alternativeTests = [
      {
        name: 'API v2 Products',
        url: `https://commerce.zoho.com/store/api/v2/products`,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID
        }
      },
      {
        name: 'Legacy API Products',
        url: `https://commerce.zoho.com/api/v1/products`,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID
        }
      },
      {
        name: 'Admin API Products',
        url: `https://commerce.zoho.com/admin/api/v1/products`,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID
        }
      },
      {
        name: 'GraphQL API',
        url: `https://commerce.zoho.com/store/api/graphql`,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          query: `
            query {
              products {
                product_id
                name
                documents {
                  document_id
                  file_name
                  image_url
                }
                images {
                  url
                  alt_text
                }
              }
            }
          `
        })
      }
    ];

    for (const test of alternativeTests) {
      try {
        console.log(`Testing: ${test.name}`);
        const response = await fetch(test.url, {
          method: test.method || 'GET',
          headers: test.headers,
          body: test.body
        });

        const responseText = await response.text();
        let responseData = null;
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }

        results.alternativeApis[test.name] = {
          success: response.ok,
          status: response.status,
          url: test.url,
          method: test.method || 'GET',
          hasProducts: !!(responseData?.products || responseData?.data?.products),
          productCount: (responseData?.products || responseData?.data?.products)?.length || 0,
          sampleProduct: (responseData?.products || responseData?.data?.products)?.[0] || null,
          responseKeys: typeof responseData === 'object' ? Object.keys(responseData) : [],
          responsePreview: JSON.stringify(responseData).substring(0, 500)
        };

        if (response.ok) {
          console.log(`✓ ${test.name} - Success`);
        } else {
          console.log(`✗ ${test.name} - ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        results.alternativeApis[test.name] = {
          success: false,
          url: test.url,
          error: error.message
        };
        console.log(`✗ ${test.name} - Error: ${error.message}`);
      }
    }

    // Test 3: Try accessing images through specific product with editpage
    console.log('\n=== TESTING PRODUCT EDITPAGE ENDPOINT ===');
    
    try {
      // First get a product ID
      const productsResponse = await fetch(`https://commerce.zoho.com/store/api/v1/products`, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID
        }
      });
      
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        const sampleProductId = productsData.products?.[0]?.product_id;
        
        if (sampleProductId) {
          console.log(`Testing editpage for product: ${sampleProductId}`);
          
          const editpageResponse = await fetch(`https://commerce.zoho.com/store/api/v1/products/editpage?product_id=${sampleProductId}`, {
            headers: {
              'Authorization': `Zoho-oauthtoken ${token}`,
              'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID
            }
          });

          if (editpageResponse.ok) {
            const editpageData = await editpageResponse.json();
            
            results.publicApi['Editpage Endpoint'] = {
              success: true,
              productId: sampleProductId,
              responseKeys: Object.keys(editpageData),
              productKeys: editpageData.product ? Object.keys(editpageData.product) : [],
              hasDocuments: !!(editpageData.product?.documents),
              documentsStructure: editpageData.product?.documents || null,
              hasImages: !!(editpageData.product?.images),
              imagesStructure: editpageData.product?.images || null,
              fullResponse: editpageData
            };
            
            console.log('✓ Editpage endpoint - Success');
          } else {
            const errorText = await editpageResponse.text();
            results.publicApi['Editpage Endpoint'] = {
              success: false,
              status: editpageResponse.status,
              error: errorText
            };
            console.log(`✗ Editpage endpoint - ${editpageResponse.status}`);
          }
        }
      }
    } catch (error) {
      results.publicApi['Editpage Endpoint'] = {
        success: false,
        error: error.message
      };
      console.log(`✗ Editpage endpoint - Error: ${error.message}`);
    }

    // Generate recommendations
    const allSuccessfulTests = [
      ...Object.values(results.storefrontApi).filter(test => test.success),
      ...Object.values(results.alternativeApis).filter(test => test.success),
      ...Object.values(results.publicApi).filter(test => test.success)
    ];

    if (allSuccessfulTests.length === 0) {
      results.recommendations.push('❌ No alternative APIs are working');
    } else {
      results.recommendations.push(`✅ Found ${allSuccessfulTests.length} working alternative endpoints`);
      
      allSuccessfulTests.forEach(test => {
        if (test.hasProducts && test.productCount > 0) {
          results.recommendations.push(`🎯 Working endpoint: ${test.url || 'Unknown URL'} (${test.productCount} products)`);
        }
      });
    }

    // Check for image data in any successful response
    const testsWithImages = allSuccessfulTests.filter(test => 
      test.sampleProduct && (
        test.sampleProduct.documents?.length > 0 ||
        test.sampleProduct.images?.length > 0 ||
        test.hasDocuments ||
        test.hasImages
      )
    );

    if (testsWithImages.length > 0) {
      results.recommendations.push(`🖼️ Found ${testsWithImages.length} endpoint(s) with image data`);
    } else {
      results.recommendations.push('❌ No endpoints returned image data');
      results.recommendations.push('🔧 Images might be served through a different service or CDN');
      results.recommendations.push('🔧 Check Zoho Commerce admin panel for image storage settings');
    }

    return res.status(200).json({
      ...results,
      summary: {
        totalEndpointsTested: Object.keys(results.storefrontApi).length + Object.keys(results.alternativeApis).length + Object.keys(results.publicApi).length,
        successfulEndpoints: allSuccessfulTests.length,
        endpointsWithImageData: testsWithImages.length
      },
      nextSteps: [
        '1. Check the working endpoints for actual image data',
        '2. Look at the sample products to see image field structure',
        '3. Test the editpage endpoint specifically for image access',
        '4. Consider checking Zoho Commerce admin for image storage configuration'
      ]
    });

  } catch (error) {
    console.error('Alternative API test failed:', error);
    return res.status(500).json({
      error: 'Alternative API test failed',
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

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}