// src/pages/api/knowledge-base/debug.js
// Debug endpoint to check what's causing the 500 errors

export default async function handler(req, res) {
  const results = {
    timestamp: new Date().toISOString(),
    method: req.method,
    query: req.query,
    tests: {}
  };

  try {
    console.log('=== DEBUGGING KNOWLEDGE BASE API ===');

    // Test 1: Check environment variables
    console.log('1. Testing environment variables...');
    results.tests.environment_vars = {
      ZOHO_DESK_API_URL: !!process.env.ZOHO_DESK_API_URL,
      ZOHO_ORG_ID: !!process.env.ZOHO_ORG_ID,
      ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
      ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
      NODE_ENV: process.env.NODE_ENV
    };
    console.log('✓ Environment variables checked');

    // Test 2: Try importing ZohoDeskClient
    console.log('2. Testing ZohoDeskClient import...');
    try {
      const { ZohoDeskClient } = require('../../../lib/zoho-desk-client');
      results.tests.zoho_desk_client = {
        success: true,
        hasClient: !!ZohoDeskClient,
        clientType: typeof ZohoDeskClient
      };
      console.log('✓ ZohoDeskClient import successful');

      // Test 3: Try creating instance
      console.log('3. Testing ZohoDeskClient instantiation...');
      try {
        const client = new ZohoDeskClient();
        results.tests.client_instantiation = {
          success: true,
          hasInstance: !!client,
          methods: Object.getOwnPropertyNames(Object.getPrototypeOf(client))
        };
        console.log('✓ ZohoDeskClient instantiation successful');
      } catch (error) {
        results.tests.client_instantiation = {
          success: false,
          error: error.message,
          stack: error.stack
        };
        console.log('✗ ZohoDeskClient instantiation failed:', error.message);
      }
    } catch (error) {
      results.tests.zoho_desk_client = {
        success: false,
        error: error.message,
        stack: error.stack
      };
      console.log('✗ ZohoDeskClient import failed:', error.message);
    }

    // Test 4: Try importing cache manager
    console.log('4. Testing cache manager import...');
    try {
      const cache = require('../../../utils/cache-manager');
      results.tests.cache_manager = {
        success: true,
        hasCache: !!cache,
        cacheType: typeof cache,
        methods: Object.getOwnPropertyNames(cache)
      };
      console.log('✓ Cache manager import successful');
    } catch (error) {
      results.tests.cache_manager = {
        success: false,
        error: error.message,
        stack: error.stack
      };
      console.log('✗ Cache manager import failed:', error.message);
    }

    // Test 5: Check file system paths
    console.log('5. Testing file system paths...');
    try {
      const fs = require('fs');
      const path = require('path');
      
      const libPath = path.resolve(process.cwd(), 'lib/zoho-desk-client.js');
      const srcLibPath = path.resolve(process.cwd(), 'src/lib/zoho-desk-client.js');
      const utilsPath = path.resolve(process.cwd(), 'utils/cache-manager.js');
      const srcUtilsPath = path.resolve(process.cwd(), 'src/utils/cache-manager.js');
      
      results.tests.file_system = {
        current_directory: process.cwd(),
        lib_path_exists: fs.existsSync(libPath),
        src_lib_path_exists: fs.existsSync(srcLibPath),
        utils_path_exists: fs.existsSync(utilsPath),
        src_utils_path_exists: fs.existsSync(srcUtilsPath),
        lib_path: libPath,
        src_lib_path: srcLibPath,
        utils_path: utilsPath,
        src_utils_path: srcUtilsPath
      };
      console.log('✓ File system paths checked');
    } catch (error) {
      results.tests.file_system = {
        success: false,
        error: error.message
      };
      console.log('✗ File system check failed:', error.message);
    }

    // Test 6: Test a simple mock response
    console.log('6. Testing mock response...');
    results.tests.mock_response = {
      success: true,
      mockData: {
        data: [
          {
            id: 'mock-1',
            title: 'Mock Article',
            summary: 'This is a mock article for testing',
            status: 'PUBLISHED'
          }
        ],
        total: 1
      }
    };
    console.log('✓ Mock response ready');

    // Generate recommendations
    const recommendations = [];
    
    if (!results.tests.environment_vars?.ZOHO_ORG_ID) {
      recommendations.push({
        issue: 'Missing ZOHO_ORG_ID environment variable',
        solutions: [
          'Add ZOHO_ORG_ID to your .env.local file',
          'Set ZOHO_ORG_ID in your deployment environment (Vercel/Netlify)',
          'Check that the environment variable name is spelled correctly'
        ]
      });
    }
    
    if (!results.tests.zoho_desk_client?.success) {
      recommendations.push({
        issue: 'ZohoDeskClient import failed',
        solutions: [
          'Move lib/zoho-desk-client.js to src/lib/zoho-desk-client.js',
          'Check if the file exists and has proper exports',
          'Verify the file path in the require statement'
        ]
      });
    }
    
    if (!results.tests.cache_manager?.success) {
      recommendations.push({
        issue: 'Cache manager import failed',
        solutions: [
          'Move utils/cache-manager.js to src/utils/cache-manager.js',
          'Check if the file exists and has proper exports',
          'Verify the file path in the require statement'
        ]
      });
    }

    results.recommendations = recommendations;
    results.summary = {
      total_tests: Object.keys(results.tests).length,
      passed_tests: Object.values(results.tests).filter(test => test.success).length,
      failed_tests: Object.values(results.tests).filter(test => test.success === false).length
    };

    res.json(results);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      error: 'Debug endpoint failed',
      message: error.message,
      stack: error.stack,
      results
    });
  }
}