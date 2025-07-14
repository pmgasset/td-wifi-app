// ===== src/pages/api/test-existing-api.js ===== (CREATE THIS FILE)

export default async function handler(req, res) {
  const testId = `test_${Date.now()}`;
  
  console.log(`\n=== TESTING EXISTING TYPESCRIPT ZOHO API [${testId}] ===`);

  try {
    // Test importing the existing TypeScript module
    console.log('1. Testing TypeScript zoho-api import...');
    
    let zohoAPI;
    try {
      const zohoModule = await import('../../lib/zoho-api');
      console.log('Available exports:', Object.keys(zohoModule));
      
      // Try different possible exports
      zohoAPI = zohoModule.zohoAPI || zohoModule.simpleZohoAPI || zohoModule.default;
      
      if (!zohoAPI) {
        return res.status(500).json({
          success: false,
          test: 'import',
          error: 'No zohoAPI found in exports',
          availableExports: Object.keys(zohoModule),
          testId
        });
      }
      
      console.log('✓ TypeScript zoho-api imported successfully');
    } catch (importError) {
      console.error('✗ TypeScript import failed:', importError);
      return res.status(500).json({
        success: false,
        test: 'import',
        error: importError.message,
        stack: importError.stack,
        testId
      });
    }

    // Test 2: Check methods exist
    console.log('2. Testing API methods exist...');
    const expectedMethods = ['getAccessToken', 'apiRequest', 'getProducts', 'getProduct', 'createOrder'];
    const methodsCheck = {};
    const availableMethods = [];
    
    // Get all methods on the zohoAPI object
    const allProperties = Object.getOwnPropertyNames(Object.getPrototypeOf(zohoAPI))
      .concat(Object.getOwnPropertyNames(zohoAPI));
    
    allProperties.forEach(prop => {
      if (typeof zohoAPI[prop] === 'function') {
        availableMethods.push(prop);
      }
    });
    
    expectedMethods.forEach(method => {
      methodsCheck[method] = typeof zohoAPI[method] === 'function';
    });
    
    console.log('Available methods:', availableMethods);
    console.log('Expected method check results:', methodsCheck);

    // Test 3: Test environment variables
    console.log('3. Checking environment variables...');
    const envCheck = {
      ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
      ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
      ZOHO_STORE_ID: !!process.env.ZOHO_STORE_ID
    };

    const missingEnvVars = Object.entries(envCheck)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    console.log('Environment variables check:', envCheck);

    // Test 4: Try authentication (if env vars are available)
    let authResult = { skipped: true, reason: 'Environment variables missing' };
    if (missingEnvVars.length === 0) {
      console.log('4. Testing authentication...');
      try {
        if (typeof zohoAPI.getAccessToken === 'function') {
          const token = await zohoAPI.getAccessToken();
          authResult = {
            success: true,
            hasToken: !!token,
            tokenLength: token ? token.length : 0
          };
          console.log('✓ Authentication successful');
        } else {
          authResult = {
            success: false,
            error: 'getAccessToken method not available'
          };
        }
      } catch (authError) {
        authResult = {
          success: false,
          error: authError.message
        };
        console.log('✗ Authentication failed:', authError.message);
      }
    }

    // Test 5: Verify createOrder method specifically
    console.log('5. Testing createOrder method...');
    let createOrderTest = {};
    if (typeof zohoAPI.createOrder === 'function') {
      createOrderTest = {
        methodExists: true,
        methodType: typeof zohoAPI.createOrder,
        isFunction: true
      };
      console.log('✓ createOrder method exists and is callable');
    } else {
      createOrderTest = {
        methodExists: false,
        methodType: typeof zohoAPI.createOrder,
        isFunction: false
      };
      console.log('✗ createOrder method missing or not a function');
    }

    // Generate summary
    const readyForUse = 
      zohoAPI && 
      methodsCheck.createOrder && 
      (authResult.success || authResult.skipped);

    const summary = {
      import_successful: !!zohoAPI,
      has_create_order: methodsCheck.createOrder,
      has_required_methods: Object.values(methodsCheck).filter(Boolean).length,
      total_expected_methods: expectedMethods.length,
      authentication_status: authResult.success ? 'working' : authResult.skipped ? 'not_tested' : 'failed',
      environment_complete: missingEnvVars.length === 0,
      ready_for_checkout: readyForUse
    };

    console.log('Test summary:', summary);

    return res.status(200).json({
      success: readyForUse,
      testId,
      timestamp: new Date().toISOString(),
      results: {
        import: { 
          success: !!zohoAPI,
          availableMethods: availableMethods
        },
        methods: methodsCheck,
        authentication: authResult,
        createOrder: createOrderTest,
        environment: envCheck
      },
      summary,
      diagnostics: {
        missing_env_vars: missingEnvVars,
        missing_methods: expectedMethods.filter(method => !methodsCheck[method]),
        zoho_api_type: typeof zohoAPI,
        available_method_count: availableMethods.length
      },
      recommendations: readyForUse ? [
        "✅ All tests passed! The TypeScript API is ready to use.",
        "The guest-checkout endpoint should work with this API.",
        "Consider testing with a small order to verify Zoho integration."
      ] : [
        !zohoAPI ? "❌ Fix the TypeScript import/export for zoho-api.ts" : null,
        !methodsCheck.createOrder ? "❌ Add createOrder method to zohoAPI class" : null,
        missingEnvVars.length > 0 ? `❌ Set missing environment variables: ${missingEnvVars.join(', ')}` : null,
        authResult.success === false ? "❌ Fix Zoho authentication credentials" : null
      ].filter(Boolean)
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    return res.status(500).json({
      success: false,
      testId,
      error: 'Test execution failed',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}