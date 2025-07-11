// ===== src/pages/api/debug-us-zoho.js =====
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const results = {
    timestamp: new Date().toISOString(),
    orgId: process.env.ZOHO_STORE_ID,
    tests: {},
    storeDiscovery: null,
    workingEndpoint: null
  };

  try {
    console.log('=== ZOHO US COMMERCE API DEBUG ===');
    console.log('Organization ID:', process.env.ZOHO_STORE_ID);

    // Step 1: Get access token
    const token = await getAccessToken();
    if (!token) {
      return res.status(500).json({ error: 'Failed to get access token' });
    }

    console.log('✓ Authentication successful');

    // Step 2: Try to discover stores using organization ID
    const orgId = process.env.ZOHO_STORE_ID;
    
    const discoveryEndpoints = [
      // Organization-based endpoints
      { name: 'Stores List', url: `https://www.zohoapis.com/commerce/v1/organizations/${orgId}/stores` },
      { name: 'Org Info', url: `https://www.zohoapis.com/commerce/v1/organizations/${orgId}` },
      
      // Alternative store discovery
      { name: 'Direct Stores', url: `https://www.zohoapis.com/commerce/v1/stores` },
      { name: 'User Stores', url: `https://www.zohoapis.com/commerce/v1/user/stores` },
      
      // Try treating org ID as store ID
      { name: 'Org as Store', url: `https://www.zohoapis.com/commerce/v1/stores/${orgId}` },
      { name: 'Org Store Products', url: `https://www.zohoapis.com/commerce/v1/stores/${orgId}/products` }
    ];

    for (const endpoint of discoveryEndpoints) {
      try {
        console.log(`Testing: ${endpoint.name} - ${endpoint.url}`);
        
        const response = await fetch(endpoint.url, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const responseText = await response.text();
        let responseData = null;
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }

        results.tests[endpoint.name] = {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          url: endpoint.url,
          hasData: !!responseData,
          dataKeys: typeof responseData === 'object' ? Object.keys(responseData) : [],
          preview: JSON.stringify(responseData).substring(0, 300)
        };

        if (response.ok) {
          console.log(`✓ ${endpoint.name} - SUCCESS`);
          
          // Check if this is stores list
          if (responseData && (responseData.stores || Array.isArray(responseData))) {
            results.storeDiscovery = {
              endpoint: endpoint.name,
              stores: responseData.stores || responseData,
              storeCount: (responseData.stores || responseData)?.length || 0
            };
          }
          
          // Check if this is products
          if (responseData && (responseData.products || Array.isArray(responseData))) {
            results.workingEndpoint = {
              name: endpoint.name,
              url: endpoint.url,
              productCount: (responseData.products || responseData)?.length || 0,
              products: (responseData.products || responseData)?.slice(0, 2) || []
            };
          }
          
        } else {
          console.log(`✗ ${endpoint.name} - ${response.status}: ${response.statusText}`);
        }

      } catch (error) {
        results.tests[endpoint.name] = {
          success: false,
          error: error.message
        };
        console.log(`✗ ${endpoint.name} - Error: ${error.message}`);
      }
    }

    // Step 3: If we found stores, try to get products from each
    if (results.storeDiscovery && results.storeDiscovery.stores) {
      console.log('\n=== TESTING INDIVIDUAL STORE ENDPOINTS ===');
      
      for (const store of results.storeDiscovery.stores.slice(0, 3)) { // Test first 3 stores
        const storeId = store.store_id || store.id || store.zoid;
        if (!storeId) continue;
        
        try {
          console.log(`Testing store: ${store.store_name || storeId}`);
          
          const storeProductsUrl = `https://www.zohoapis.com/commerce/v1/stores/${storeId}/products`;
          const response = await fetch(storeProductsUrl, {
            headers: {
              'Authorization': `Zoho-oauthtoken ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            const products = data.products || data;
            
            results.tests[`Store ${storeId} Products`] = {
              success: true,
              storeId: storeId,
              storeName: store.store_name,
              productCount: products?.length || 0,
              url: storeProductsUrl,
              sampleProduct: products?.[0] || null
            };
            
            if (products && products.length > 0 && !results.workingEndpoint) {
              results.workingEndpoint = {
                name: `Store ${storeId} Products`,
                url: storeProductsUrl,
                storeId: storeId,
                storeName: store.store_name,
                productCount: products.length,
                products: products.slice(0, 2)
              };
            }
            
            console.log(`✓ Store ${storeId} - Found ${products?.length || 0} products`);
          } else {
            console.log(`✗ Store ${storeId} - ${response.status}: ${response.statusText}`);
          }
          
        } catch (error) {
          console.log(`✗ Store ${storeId} - Error: ${error.message}`);
        }
      }
    }

    // Generate recommendations
    const recommendations = [];
    
    if (results.workingEndpoint) {
      recommendations.push(`✅ FOUND WORKING ENDPOINT: ${results.workingEndpoint.url}`);
      recommendations.push(`🏪 Store ID to use: ${results.workingEndpoint.storeId}`);
      recommendations.push(`📦 Found ${results.workingEndpoint.productCount} products`);
      recommendations.push(`🔧 Update your ZOHO_STORE_ID to: ${results.workingEndpoint.storeId}`);
    } else if (results.storeDiscovery) {
      recommendations.push(`🏪 Found ${results.storeDiscovery.storeCount} stores in your organization`);
      recommendations.push('🔧 Try using one of the individual store IDs instead of organization ID');
    } else {
      recommendations.push('❌ No working endpoints found');
      recommendations.push('🔧 Check if your organization has any Commerce stores set up');
    }

    return res.status(200).json({
      ...results,
      recommendations,
      nextSteps: results.workingEndpoint ? [
        `1. Update ZOHO_STORE_ID from ${orgId} to ${results.workingEndpoint.storeId}`,
        '2. Update your API base URL to https://www.zohoapis.com/commerce/v1',
        '3. Test the products endpoint again',
        '4. Check product image structure'
      ] : [
        '1. Verify your Zoho Commerce account has stores configured',
        '2. Check if you need to create a store first',
        '3. Verify API permissions include store access'
      ]
    });

  } catch (error) {
    console.error('Debug failed:', error);
    return res.status(500).json({
      error: 'Debug failed',
      details: error.message,
      stack: error.stack
    });
  }
}

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
      const errorText = await response.text();
      console.error('Auth failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}
