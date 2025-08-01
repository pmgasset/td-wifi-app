// src/pages/api/knowledge-base/debug-endpoints.js
// Diagnostic endpoint to find the correct Zoho Desk API endpoints

export default async function handler(req, res) {
  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      ZOHO_DESK_API_URL: process.env.ZOHO_DESK_API_URL,
      ZOHO_ORG_ID: !!process.env.ZOHO_ORG_ID,
      NODE_ENV: process.env.NODE_ENV
    },
    tests: {},
    workingEndpoints: [],
    recommendations: []
  };

  try {
    console.log('=== ZOHO DESK API DIAGNOSTIC ===');

    // Step 1: Test Authentication
    console.log('1. Testing authentication...');
    let accessToken = null;
    
    try {
      const authResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
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

      if (authResponse.ok) {
        const authData = await authResponse.json();
        accessToken = authData.access_token;
        results.tests.authentication = {
          success: true,
          hasToken: !!accessToken,
          tokenLength: accessToken?.length || 0
        };
        console.log('✅ Authentication successful');
      } else {
        const errorText = await authResponse.text();
        results.tests.authentication = {
          success: false,
          error: `${authResponse.status}: ${errorText}`
        };
        console.log('❌ Authentication failed');
      }
    } catch (authError) {
      results.tests.authentication = {
        success: false,
        error: authError.message
      };
      console.log('❌ Authentication error:', authError.message);
    }

    if (!accessToken) {
      return res.status(500).json({
        ...results,
        error: 'Cannot proceed without valid access token'
      });
    }

    // Step 2: Test different base URLs
    console.log('2. Testing different base URLs...');
    const baseUrls = [
      'https://desk.zoho.com/api/v1',
      'https://desk.zoho.com/api/v2', 
      'https://desk.zoho.eu/api/v1',
      'https://desk.zoho.in/api/v1',
      'https://desk.zoho.com.au/api/v1',
      process.env.ZOHO_DESK_API_URL // User's configured URL
    ].filter(Boolean);

    // Step 3: Test different endpoint patterns
    console.log('3. Testing endpoint patterns...');
    const endpointPatterns = {
      // Knowledge Base Articles
      articles: [
        '/articles',
        '/kbArticles',
        '/helpcenter/articles',
        '/kb/articles',
        '/knowledgebase/articles',
        '/helpdesk/articles'
      ],
      // Knowledge Base Categories  
      categories: [
        '/categories',
        '/kbCategories',
        '/helpcenter/categories',
        '/kb/categories',
        '/knowledgebase/categories',
        '/helpdesk/categories'
      ],
      // General info endpoints
      info: [
        '/departments',
        '/agents',
        '/tickets',
        '/contacts'
      ]
    };

    // Test each combination
    for (const baseUrl of baseUrls) {
      console.log(`Testing base URL: ${baseUrl}`);
      results.tests[baseUrl] = {};

      for (const [type, endpoints] of Object.entries(endpointPatterns)) {
        results.tests[baseUrl][type] = {};
        
        for (const endpoint of endpoints) {
          try {
            const testUrl = `${baseUrl}${endpoint}`;
            console.log(`  Testing: ${testUrl}`);
            
            const testResponse = await fetch(testUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json',
                'orgId': process.env.ZOHO_ORG_ID
              }
            });

            const responseText = await testResponse.text();
            let responseData = null;
            
            try {
              responseData = JSON.parse(responseText);
            } catch (e) {
              responseData = { raw: responseText.substring(0, 200) };
            }

            const testResult = {
              status: testResponse.status,
              success: testResponse.ok,
              hasData: !!(responseData?.data || responseData?.articles || responseData?.categories),
              dataCount: responseData?.data?.length || 0,
              responseKeys: responseData ? Object.keys(responseData) : [],
              error: !testResponse.ok ? responseData?.message || responseText.substring(0, 100) : null
            };

            results.tests[baseUrl][type][endpoint] = testResult;

            if (testResponse.ok) {
              console.log(`    ✅ SUCCESS: ${endpoint} (${testResult.dataCount} items)`);
              results.workingEndpoints.push({
                baseUrl,
                endpoint,
                type,
                fullUrl: testUrl,
                dataCount: testResult.dataCount,
                hasData: testResult.hasData
              });
            } else {
              console.log(`    ❌ FAILED: ${endpoint} (${testResponse.status})`);
            }

            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));

          } catch (error) {
            results.tests[baseUrl][type][endpoint] = {
              success: false,
              error: error.message
            };
            console.log(`    ❌ ERROR: ${endpoint} - ${error.message}`);
          }
        }
      }
    }

    // Step 4: Generate recommendations
    console.log('4. Generating recommendations...');
    
    if (results.workingEndpoints.length === 0) {
      results.recommendations.push({
        priority: 'CRITICAL',
        issue: 'No working API endpoints found',
        solutions: [
          'Check if Knowledge Base is enabled in your Zoho Desk instance',
          'Verify your Zoho Desk plan includes Knowledge Base features',
          'Confirm your API scopes include knowledge base permissions',
          'Check if you\'re using the correct Zoho region'
        ]
      });
    } else {
      // Find the best working endpoints
      const articleEndpoints = results.workingEndpoints.filter(ep => ep.type === 'articles');
      const categoryEndpoints = results.workingEndpoints.filter(ep => ep.type === 'categories');
      
      if (articleEndpoints.length > 0) {
        const bestArticleEndpoint = articleEndpoints.sort((a, b) => b.dataCount - a.dataCount)[0];
        results.recommendations.push({
          priority: 'HIGH',
          issue: 'Articles endpoint found',
          solution: `Use: ${bestArticleEndpoint.fullUrl}`,
          endpoint: bestArticleEndpoint.endpoint,
          baseUrl: bestArticleEndpoint.baseUrl,
          dataCount: bestArticleEndpoint.dataCount
        });
      }
      
      if (categoryEndpoints.length > 0) {
        const bestCategoryEndpoint = categoryEndpoints.sort((a, b) => b.dataCount - a.dataCount)[0];
        results.recommendations.push({
          priority: 'HIGH',
          issue: 'Categories endpoint found',
          solution: `Use: ${bestCategoryEndpoint.fullUrl}`,
          endpoint: bestCategoryEndpoint.endpoint,
          baseUrl: bestCategoryEndpoint.baseUrl,
          dataCount: bestCategoryEndpoint.dataCount
        });
      }

      // Check if user needs to update their base URL
      const currentBaseUrl = process.env.ZOHO_DESK_API_URL;
      const workingBaseUrls = [...new Set(results.workingEndpoints.map(ep => ep.baseUrl))];
      
      if (workingBaseUrls.length > 0 && !workingBaseUrls.includes(currentBaseUrl)) {
        results.recommendations.push({
          priority: 'MEDIUM',
          issue: 'Base URL might need updating',
          solution: `Consider changing ZOHO_DESK_API_URL to: ${workingBaseUrls[0]}`,
          currentUrl: currentBaseUrl,
          suggestedUrls: workingBaseUrls
        });
      }
    }

    // Step 5: Check for common issues
    const authFailed = !results.tests.authentication?.success;
    const noWorkingEndpoints = results.workingEndpoints.length === 0;
    
    if (authFailed) {
      results.recommendations.unshift({
        priority: 'CRITICAL',
        issue: 'Authentication failed',
        solutions: [
          'Check your ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN',
          'Verify your refresh token hasn\'t expired',
          'Ensure your API application has the correct scopes'
        ]
      });
    }

    console.log('=== DIAGNOSTIC COMPLETE ===');
    console.log(`Found ${results.workingEndpoints.length} working endpoints`);

    return res.status(200).json({
      success: results.workingEndpoints.length > 0,
      message: `Diagnostic complete. Found ${results.workingEndpoints.length} working endpoints.`,
      ...results
    });

  } catch (error) {
    console.error('Diagnostic failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Diagnostic failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      partialResults: results
    });
  }
}