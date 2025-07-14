// ===== src/pages/api/debug-imports.js ===== (CREATE THIS FILE)

export default async function handler(req, res) {
  const results = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    tests: {}
  };

  try {
    console.log('=== DEBUGGING API IMPORTS ===');

    // Test 1: Direct import of zoho-api
    console.log('1. Testing direct import of zoho-api...');
    try {
      const zohoModule = await import('../../lib/zoho-api');
      results.tests.direct_import = {
        success: true,
        moduleKeys: Object.keys(zohoModule),
        hasZohoAPI: 'zohoAPI' in zohoModule,
        zohoAPIType: typeof zohoModule.zohoAPI,
        hasCreateOrder: zohoModule.zohoAPI && typeof zohoModule.zohoAPI.createOrder === 'function'
      };
      console.log('✓ Direct import successful');
    } catch (error) {
      results.tests.direct_import = {
        success: false,
        error: error.message,
        stack: error.stack
      };
      console.log('✗ Direct import failed:', error.message);
    }

    // Test 2: Test TypeScript compilation
    console.log('2. Testing TypeScript compilation...');
    try {
      // Try importing the .ts file directly
      const tsModule = await import('../../lib/zoho-api.ts');
      results.tests.typescript_import = {
        success: true,
        moduleKeys: Object.keys(tsModule)
      };
      console.log('✓ TypeScript import successful');
    } catch (error) {
      results.tests.typescript_import = {
        success: false,
        error: error.message
      };
      console.log('✗ TypeScript import failed:', error.message);
    }

    // Test 3: Test environment variables
    console.log('3. Testing environment variables...');
    results.tests.environment_vars = {
      ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
      ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
      ZOHO_STORE_ID: !!process.env.ZOHO_STORE_ID,
      NODE_ENV: process.env.NODE_ENV
    };

    // Test 4: Test manual implementation
    console.log('4. Testing manual Zoho API implementation...');
    try {
      class TestZohoAPI {
        async createOrder(data) {
          return { test: true, data };
        }
      }
      
      const testAPI = new TestZohoAPI();
      const testResult = await testAPI.createOrder({ test: 'data' });
      
      results.tests.manual_implementation = {
        success: true,
        testResult
      };
      console.log('✓ Manual implementation works');
    } catch (error) {
      results.tests.manual_implementation = {
        success: false,
        error: error.message
      };
      console.log('✗ Manual implementation failed:', error.message);
    }

    // Test 5: Check file system
    console.log('5. Testing file system access...');
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Check if the zoho-api file exists
      const zohoApiPath = path.resolve(process.cwd(), 'src/lib/zoho-api.ts');
      const zohoApiJsPath = path.resolve(process.cwd(), 'src/lib/zoho-api.js');
      
      results.tests.file_system = {
        zoho_api_ts_exists: fs.existsSync(zohoApiPath),
        zoho_api_js_exists: fs.existsSync(zohoApiJsPath),
        current_directory: process.cwd(),
        zoho_api_path: zohoApiPath
      };
      console.log('✓ File system check complete');
    } catch (error) {
      results.tests.file_system = {
        success: false,
        error: error.message
      };
      console.log('✗ File system check failed:', error.message);
    }

    // Generate recommendations
    const recommendations = [];
    
    if (!results.tests.direct_import?.success) {
      recommendations.push({
        issue: 'Direct import of zoho-api module failed',
        solutions: [
          'Check if src/lib/zoho-api.ts exists',
          'Ensure TypeScript is properly configured',
          'Try creating src/lib/zoho-api.js instead',
          'Check Next.js build configuration'
        ]
      });
    }
    
    if (results.tests.direct_import?.success && !results.tests.direct_import?.hasZohoAPI) {
      recommendations.push({
        issue: 'zoho-api module imported but zohoAPI export is missing',
        solutions: [
          'Check export statement in zoho-api.ts',
          'Ensure default export is properly configured',
          'Verify class instantiation is correct'
        ]
      });
    }
    
    if (results.tests.direct_import?.hasZohoAPI && !results.tests.direct_import?.hasCreateOrder) {
      recommendations.push({
        issue: 'zohoAPI exists but createOrder method is missing',
        solutions: [
          'Check if createOrder method is defined in the class',
          'Verify method is properly bound to the instance',
          'Check for TypeScript compilation errors'
        ]
      });
    }

    const envVarsMissing = Object.entries(results.tests.environment_vars || {})
      .filter(([key, value]) => key.startsWith('ZOHO_') && !value)
      .map(([key]) => key);
    
    if (envVarsMissing.length > 0) {
      recommendations.push({
        issue: `Missing environment variables: ${envVarsMissing.join(', ')}`,
        solutions: [
          'Set environment variables in your deployment platform',
          'Check .env.local file for development',
          'Verify environment variables are properly deployed'
        ]
      });
    }

    return res.status(200).json({
      success: true,
      results,
      recommendations,
      summary: {
        direct_import_works: results.tests.direct_import?.success,
        zoho_api_available: results.tests.direct_import?.hasZohoAPI,
        create_order_available: results.tests.direct_import?.hasCreateOrder,
        environment_vars_set: envVarsMissing.length === 0,
        likely_cause: recommendations.length > 0 ? recommendations[0].issue : 'No issues detected'
      }
    });

  } catch (error) {
    console.error('Debug imports failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Debug process failed',
      details: error.message,
      results
    });
  }
}