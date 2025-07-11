// ===== src/pages/api/debug-zoho-comprehensive.js =====
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const results = {
    environment: {},
    authentication: {},
    apiTests: {},
    recommendations: []
  };

  try {
    // Step 1: Check environment variables
    console.log('=== CHECKING ENVIRONMENT VARIABLES ===');
    results.environment = {
      ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
      ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
      ZOHO_STORE_ID: !!process.env.ZOHO_STORE_ID,
      client_id_length: process.env.ZOHO_CLIENT_ID?.length || 0,
      store_id_length: process.env.ZOHO_STORE_ID?.length || 0
    };

    // Step 2: Test authentication
    console.log('=== TESTING AUTHENTICATION ===');
    try {
      const token = await zohoAPI.getAccessToken();
      results.authentication = {
        success: true,
        tokenReceived: !!token,
        tokenLength: token?.length || 0,
        tokenPrefix: token?.substring(0, 10) + '...'
      };
    } catch (authError) {
      results.authentication = {
        success: false,
        error: authError.message,
        errorDetails: {
          name: authError.name,
          stack: authError.stack?.split('\n')[0]
        }
      };
    }

    // Step 3: Test different API base URLs and endpoints
    console.log('=== TESTING API ENDPOINTS ===');
    
    const testConfigs = [
      {
        name: 'Original Commerce API',
        baseURL: 'https://commerce.zoho.com/api/v1',
        endpoint: `/stores/${process.env.ZOHO_STORE_ID}/products`
      },
      {
        name: 'Alternative Commerce API',
        baseURL: 'https://www.zohoapis.com/commerce/v1',
        endpoint: `/stores/${process.env.ZOHO_STORE_ID}/products`
      },
      {
        name: 'Direct Store API',
        baseURL: 'https://commerce.zoho.com/api/v1',
        endpoint: `/products`
      },
      {
        name: 'Store Info API',
        baseURL: 'https://commerce.zoho.com/api/v1',
        endpoint: `/stores/${process.env.ZOHO_STORE_ID}`
      },
      {
        name: 'Root API Discovery',
        baseURL: 'https://commerce.zoho.com/api/v1',
        endpoint: ``
      }
    ];

    for (const config of testConfigs) {
      try {
        console.log(`Testing: ${config.name}`);
        const token = await zohoAPI.getAccessToken();
        const url = `${config.baseURL}${config.endpoint}`;
        
        const response = await fetch(url, {
          method: 'GET',
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

        results.apiTests[config.name] = {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          url: url,
          responseSize: responseText.length,
          responsePreview: typeof responseData === 'string' 
            ? responseData.substring(0, 200)
            : JSON.stringify(responseData).substring(0, 200),
          headers: Object.fromEntries([...response.headers.entries()]),
          hasData: responseData && (responseData.products || responseData.data || Array.isArray(responseData))
        };

        if (response.ok && responseData) {
          console.log(`✓ ${config.name} - Success!`);
          if (responseData.products) {
            results.apiTests[config.name].productCount = responseData.products.length;
          }
        } else {
          console.log(`✗ ${config.name} - ${response.status}: ${response.statusText}`);
        }

      } catch (error) {
        results.apiTests[config.name] = {
          success: false,
          error: error.message,
          errorType: error.name
        };
        console.log(`✗ ${config.name} - Error: ${error.message}`);
      }
    }

    // Step 4: Test OAuth scopes and permissions
    console.log('=== TESTING OAUTH TOKEN INFO ===');
    try {
      const token = await zohoAPI.getAccessToken();
      const tokenInfoResponse = await fetch('https://accounts.zoho.com/oauth/user/info', {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`
        }
      });
      
      if (tokenInfoResponse.ok) {
        const tokenInfo = await tokenInfoResponse.json();
        results.authentication.userInfo = {
          success: true,
          data: tokenInfo
        };
      } else {
        results.authentication.userInfo = {
          success: false,
          status: tokenInfoResponse.status,
          statusText: tokenInfoResponse.statusText
        };
      }
    } catch (error) {
      results.authentication.userInfo = {
        success: false,
        error: error.message
      };
    }

    // Step 5: Generate recommendations
    console.log('=== GENERATING RECOMMENDATIONS ===');
    
    if (!results.authentication.success) {
      results.recommendations.push('❌ CRITICAL: Authentication failed. Check your Zoho OAuth credentials.');
      results.recommendations.push('🔧 Verify your ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN');
      results.recommendations.push('🔧 Make sure your refresh token hasn\'t expired');
    }

    if (!results.environment.ZOHO_STORE_ID) {
      results.recommendations.push('❌ CRITICAL: ZOHO_STORE_ID is missing');
    }

    const successfulTests = Object.values(results.apiTests).filter(test => test.success);
    if (successfulTests.length === 0) {
      results.recommendations.push('❌ CRITICAL: No API endpoints are working');
      results.recommendations.push('🔧 Check if your Zoho Commerce store is properly set up');
      results.recommendations.push('🔧 Verify the correct API base URL for your Zoho region');
      results.recommendations.push('🔧 Check if you have the correct permissions/scopes for Commerce API');
    } else {
      results.recommendations.push(`✅ Found ${successfulTests.length} working endpoint(s)`);
      successfulTests.forEach(test => {
        if (test.hasData) {
          results.recommendations.push(`🎯 Use this working endpoint: ${test.url}`);
        }
      });
    }

    // API region check
    if (results.environment.ZOHO_CLIENT_ID) {
      const clientId = process.env.ZOHO_CLIENT_ID;
      if (clientId.includes('.eu')) {
        results.recommendations.push('🌍 Detected EU region - you may need to use eu-specific API endpoints');
      } else if (clientId.includes('.in')) {
        results.recommendations.push('🌍 Detected India region - you may need to use in-specific API endpoints');
      } else if (clientId.includes('.com.au')) {
        results.recommendations.push('🌍 Detected Australia region - you may need to use au-specific API endpoints');
      }
    }

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      summary: {
        environmentOK: Object.values(results.environment).every(Boolean),
        authenticationOK: results.authentication.success,
        workingEndpoints: Object.values(results.apiTests).filter(test => test.success).length,
        totalEndpointsTested: Object.keys(results.apiTests).length
      },
      results,
      nextSteps: [
        '1. Fix any authentication issues first',
        '2. Use the working endpoint to update your zoho-api.ts',
        '3. Test the updated API with the working endpoint',
        '4. Check the response structure for image fields'
      ]
    });

  } catch (error) {
    console.error('Comprehensive debug failed:', error);
    return res.status(500).json({
      error: 'Debug process failed',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}