// ===== src/pages/api/debug-checkout.js ===== (CREATE THIS FILE)
export default async function handler(req, res) {
  console.log('=== ZOHO CHECKOUT DIAGNOSTIC ===');
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    method: req.method,
    url: req.url,
    results: {}
  };

  try {
    // 1. Check Environment Variables
    console.log('1. Checking environment variables...');
    const envCheck = {
      ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
      ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
      ZOHO_STORE_ID: !!process.env.ZOHO_STORE_ID,
      client_id_length: process.env.ZOHO_CLIENT_ID?.length || 0,
      store_id_length: process.env.ZOHO_STORE_ID?.length || 0,
      token_prefix: process.env.ZOHO_REFRESH_TOKEN?.substring(0, 8) + '...' || 'missing'
    };
    
    diagnostics.results.environment = envCheck;
    console.log('Environment check:', envCheck);

    // 2. Test Zoho Authentication
    console.log('2. Testing Zoho authentication...');
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

      const authText = await authResponse.text();
      let authData;
      try {
        authData = JSON.parse(authText);
      } catch {
        authData = { raw_response: authText };
      }

      diagnostics.results.authentication = {
        success: authResponse.ok,
        status: authResponse.status,
        statusText: authResponse.statusText,
        hasAccessToken: !!authData.access_token,
        tokenLength: authData.access_token?.length || 0,
        error: authData.error || null,
        errorDescription: authData.error_description || null,
        expiresIn: authData.expires_in || null
      };

      if (authResponse.ok && authData.access_token) {
        console.log('✓ Authentication successful');
        
        // 3. Test Zoho Commerce API Access
        console.log('3. Testing Zoho Commerce API access...');
        
        const testEndpoints = [
          'https://commerce.zoho.com/store/api/v1/products',
          'https://www.zohoapis.com/commerce/v1/products',
          `https://commerce.zoho.com/store/api/v1/stores/${process.env.ZOHO_STORE_ID}/products`
        ];

        for (const endpoint of testEndpoints) {
          try {
            console.log(`Testing endpoint: ${endpoint}`);
            const testResponse = await fetch(endpoint, {
              headers: {
                'Authorization': `Zoho-oauthtoken ${authData.access_token}`,
                'Content-Type': 'application/json',
                'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
              },
            });

            const testText = await testResponse.text();
            let testData;
            try {
              testData = JSON.parse(testText);
            } catch {
              testData = { raw_response: testText.substring(0, 200) };
            }

            diagnostics.results[`api_test_${endpoint.split('/').pop()}`] = {
              endpoint: endpoint,
              success: testResponse.ok,
              status: testResponse.status,
              statusText: testResponse.statusText,
              hasProducts: !!testData.products,
              productCount: testData.products?.length || 0,
              error: testData.error || null,
              responsePreview: JSON.stringify(testData).substring(0, 300)
            };

            if (testResponse.ok) {
              console.log(`✓ API endpoint working: ${endpoint}`);
              break;
            } else {
              console.log(`✗ API endpoint failed: ${endpoint} - ${testResponse.status}`);
            }
          } catch (error) {
            diagnostics.results[`api_test_${endpoint.split('/').pop()}`] = {
              endpoint: endpoint,
              success: false,
              error: error.message
            };
            console.log(`✗ API endpoint error: ${endpoint} - ${error.message}`);
          }
        }

        // 4. Test Order Creation (with minimal data)
        console.log('4. Testing order creation...');
        try {
          const testOrderData = {
            customer_name: "Test Customer",
            customer_email: "test@example.com",
            line_items: [{
              item_name: "Test Item",
              quantity: 1,
              rate: 99.99,
              amount: 99.99
            }],
            sub_total: 99.99,
            total: 99.99,
            date: new Date().toISOString().split('T')[0]
          };

          const orderResponse = await fetch('https://commerce.zoho.com/store/api/v1/salesorders', {
            method: 'POST',
            headers: {
              'Authorization': `Zoho-oauthtoken ${authData.access_token}`,
              'Content-Type': 'application/json',
              'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
            },
            body: JSON.stringify(testOrderData)
          });

          const orderText = await orderResponse.text();
          let orderData;
          try {
            orderData = JSON.parse(orderText);
          } catch {
            orderData = { raw_response: orderText.substring(0, 300) };
          }

          diagnostics.results.order_creation_test = {
            success: orderResponse.ok,
            status: orderResponse.status,
            statusText: orderResponse.statusText,
            hasOrderId: !!(orderData.salesorder_id || orderData.order_id),
            orderId: orderData.salesorder_id || orderData.order_id || null,
            error: orderData.error || null,
            message: orderData.message || null,
            responsePreview: JSON.stringify(orderData).substring(0, 400)
          };

          if (orderResponse.ok) {
            console.log('✓ Order creation test successful');
          } else {
            console.log(`✗ Order creation test failed: ${orderResponse.status}`);
          }

        } catch (error) {
          diagnostics.results.order_creation_test = {
            success: false,
            error: error.message
          };
          console.log(`✗ Order creation test error: ${error.message}`);
        }

      } else {
        console.log('✗ Authentication failed');
      }

    } catch (authError) {
      diagnostics.results.authentication = {
        success: false,
        error: authError.message,
        errorType: authError.name
      };
      console.log(`✗ Authentication error: ${authError.message}`);
    }

    // 5. Generate Recommendations
    const recommendations = generateRecommendations(diagnostics.results);
    diagnostics.recommendations = recommendations;

    console.log('Diagnostic complete. Results:', diagnostics);

    return res.status(200).json({
      success: true,
      message: 'Zoho Checkout Diagnostic Complete',
      diagnostics,
      summary: generateSummary(diagnostics.results)
    });

  } catch (error) {
    console.error('Diagnostic failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Diagnostic failed',
      details: error.message,
      stack: error.stack,
      partialDiagnostics: diagnostics
    });
  }
}

function generateRecommendations(results) {
  const recommendations = [];

  // Check environment variables
  if (!results.environment?.ZOHO_CLIENT_ID || !results.environment?.ZOHO_CLIENT_SECRET || 
      !results.environment?.ZOHO_REFRESH_TOKEN || !results.environment?.ZOHO_STORE_ID) {
    recommendations.push({
      priority: 'CRITICAL',
      category: 'Environment Variables',
      issue: 'Missing required Zoho environment variables',
      action: 'Set all required environment variables in your deployment platform',
      missing: Object.entries(results.environment || {})
        .filter(([key, value]) => key.startsWith('ZOHO_') && !value)
        .map(([key]) => key)
    });
  }

  // Check authentication
  if (results.authentication && !results.authentication.success) {
    if (results.authentication.error === 'invalid_grant') {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Authentication',
        issue: 'Zoho refresh token has expired',
        action: 'Generate a new refresh token through Zoho OAuth flow',
        details: results.authentication.errorDescription
      });
    } else {
      recommendations.push({
        priority: 'HIGH',
        category: 'Authentication', 
        issue: 'Zoho API authentication failed',
        action: 'Check your Zoho OAuth credentials',
        error: results.authentication.error
      });
    }
  }

  // Check API access
  const apiTests = Object.entries(results).filter(([key]) => key.startsWith('api_test_'));
  const workingTests = apiTests.filter(([, test]) => test.success);
  
  if (workingTests.length === 0 && apiTests.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: 'API Access',
      issue: 'No Zoho Commerce API endpoints are accessible',
      action: 'Check API permissions and store configuration',
      details: 'All API endpoints returned errors'
    });
  }

  // Check order creation
  if (results.order_creation_test && !results.order_creation_test.success) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Order Creation',
      issue: 'Cannot create orders in Zoho Commerce',
      action: 'Verify order data format and API permissions',
      error: results.order_creation_test.error || `Status: ${results.order_creation_test.status}`
    });
  }

  return recommendations;
}

function generateSummary(results) {
  const issues = [];
  const successes = [];

  // Environment check
  const missingEnvVars = Object.entries(results.environment || {})
    .filter(([key, value]) => key.startsWith('ZOHO_') && !value)
    .map(([key]) => key);
  
  if (missingEnvVars.length > 0) {
    issues.push(`Missing environment variables: ${missingEnvVars.join(', ')}`);
  } else {
    successes.push('All Zoho environment variables present');
  }

  // Authentication check
  if (results.authentication) {
    if (results.authentication.success) {
      successes.push('Zoho API authentication working');
    } else {
      issues.push(`Authentication failed: ${results.authentication.error || 'Unknown error'}`);
    }
  }

  // API access check
  const apiTests = Object.entries(results).filter(([key]) => key.startsWith('api_test_'));
  const workingApis = apiTests.filter(([, test]) => test.success);
  
  if (workingApis.length > 0) {
    successes.push(`${workingApis.length} API endpoint(s) working`);
  } else if (apiTests.length > 0) {
    issues.push('No API endpoints accessible');
  }

  // Order creation check
  if (results.order_creation_test) {
    if (results.order_creation_test.success) {
      successes.push('Order creation test passed');
    } else {
      issues.push('Order creation test failed');
    }
  }

  return {
    overallStatus: issues.length === 0 ? 'HEALTHY' : issues.length <= 2 ? 'ISSUES_FOUND' : 'CRITICAL',
    issueCount: issues.length,
    successCount: successes.length,
    issues,
    successes,
    nextSteps: issues.length > 0 ? [
      'Fix the issues listed above',
      'Test checkout again after fixes',
      'Check server logs for additional errors'
    ] : [
      'Checkout API should be working',
      'Test with real checkout data',
      'Monitor for any remaining issues'
    ]
  };
}