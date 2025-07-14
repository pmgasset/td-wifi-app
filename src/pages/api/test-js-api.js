// ===== src/pages/api/test-js-api.js ===== (CREATE THIS FILE)

export default async function handler(req, res) {
  const testId = `test_${Date.now()}`;
  
  console.log(`\n=== TESTING JAVASCRIPT ZOHO API [${testId}] ===`);

  try {
    // Test 1: Import the JavaScript version
    console.log('1. Testing JavaScript zoho-api import...');
    
    let zohoAPI;
    try {
      const zohoModule = await import('../../lib/zoho-api.js');
      zohoAPI = zohoModule.zohoAPI || zohoModule.default;
      
      if (!zohoAPI) {
        throw new Error('zohoAPI is undefined after import');
      }
      
      console.log('✓ JavaScript zoho-api imported successfully');
    } catch (importError) {
      console.error('✗ JavaScript import failed:', importError);
      return res.status(500).json({
        success: false,
        test: 'import',
        error: importError.message,
        testId
      });
    }

    // Test 2: Check methods exist
    console.log('2. Testing API methods exist...');
    const methods = ['getAccessToken', 'apiRequest', 'getProducts', 'getProduct', 'createOrder'];
    const methodsCheck = {};
    
    methods.forEach(method => {
      methodsCheck[method] = typeof zohoAPI[method] === 'function';
    });
    
    console.log('Method check results:', methodsCheck);

    // Test 3: Test authentication
    console.log('3. Testing authentication...');
    let authResult = {};
    try {
      const token = await zohoAPI.getAccessToken();
      authResult = {
        success: true,
        hasToken: !!token,
        tokenLength: token ? token.length : 0
      };
      console.log('✓ Authentication successful');
    } catch (authError) {
      authResult = {
        success: false,
        error: authError.message
      };
      console.log('✗ Authentication failed:', authError.message);
    }

    // Test 4: Test createOrder method specifically
    console.log('4. Testing createOrder method...');
    let createOrderTest = {};
    try {
      // Test with minimal data (won't actually create an order)
      const testOrderData = {
        customer_name: "Test Customer",
        customer_email: "test@example.com",
        line_items: [{
          item_name: "Test Item",
          quantity: 1,
          rate: 1.00,
          amount: 1.00
        }],
        sub_total: 1.00,
        total: 1.00,
        date: new Date().toISOString().split('T')[0],
        notes: "API Test Order - Please Cancel"
      };
      
      // We won't actually call createOrder to avoid creating test orders
      // Just verify the method exists and can be called
      if (typeof zohoAPI.createOrder === 'function') {
        createOrderTest = {
          methodExists: true,
          methodType: typeof zohoAPI.createOrder,
          testDataPrepared: true
        };
        console.log('✓ createOrder method exists and is callable');
      } else {
        createOrderTest = {
          methodExists: false,
          methodType: typeof zohoAPI.createOrder
        };
        console.log('✗ createOrder method missing');
      }
    } catch (error) {
      createOrderTest = {
        methodExists: false,
        error: error.message
      };
      console.log('✗ createOrder test failed:', error.message);
    }

    // Test 5: Environment variables check
    console.log('5. Checking environment variables...');
    const envCheck = {
      ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
      ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
      ZOHO_STORE_ID: !!process.env.ZOHO_STORE_ID
    };

    const allEnvVarsPresent = Object.values(envCheck).every(Boolean);
    console.log('Environment variables check:', envCheck);

    // Generate summary
    const allTestsPassed = 
      zohoAPI && 
      Object.values(methodsCheck).every(Boolean) && 
      authResult.success && 
      createOrderTest.methodExists && 
      allEnvVarsPresent;

    const summary = {
      success: allTestsPassed,
      import_success: !!zohoAPI,
      methods_available: Object.values(methodsCheck).every(Boolean),
      authentication_working: authResult.success,
      create_order_available: createOrderTest.methodExists,
      environment_vars_set: allEnvVarsPresent,
      ready_for_checkout: allTestsPassed
    };

    console.log('Test summary:', summary);

    return res.status(200).json({
      success: allTestsPassed,
      testId,
      timestamp: new Date().toISOString(),
      results: {
        import: { success: !!zohoAPI },
        methods: methodsCheck,
        authentication: authResult,
        createOrder: createOrderTest,
        environment: envCheck
      },
      summary,
      recommendations: allTestsPassed ? [
        "✅ All tests passed! The JavaScript API is ready to use.",
        "You can now use the fixed guest-checkout.js endpoint.",
        "The import issue should be resolved."
      ] : [
        !zohoAPI ? "❌ Fix the import path for zoho-api.js" : null,
        !Object.values(methodsCheck).every(Boolean) ? "❌ Some API methods are missing" : null,
        !authResult.success ? "❌ Check Zoho authentication credentials" : null,
        !createOrderTest.methodExists ? "❌ createOrder method is not available" : null,
        !allEnvVarsPresent ? "❌ Set missing environment variables" : null
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