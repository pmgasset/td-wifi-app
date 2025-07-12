// ===== src/pages/api/debug-zoho-checkout.js ===== (CREATE THIS FILE)
// This diagnostic endpoint will help identify the exact 500 error cause

export default async function handler(req, res) {
  console.log('=== ZOHO CHECKOUT DIAGNOSTIC ===');
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    method: req.method,
    url: req.url
  };

  try {
    // 1. Check Environment Variables
    console.log('1. Checking environment variables...');
    const envCheck = {
      ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
      ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
      ZOHO_STORE_ID: !!process.env.ZOHO_STORE_ID,
      NODE_ENV: process.env.NODE_ENV
    };
    
    diagnostics.environmentVariables = envCheck;
    console.log('Environment variables:', envCheck);

    // 2. Test Zoho API Import
    console.log('2. Testing Zoho API import...');
    let zohoAPI;
    try {
      const zohoModule = await import('../../lib/zoho-api');
      zohoAPI = zohoModule.zohoAPI;
      diagnostics.zohoAPIImport = { success: true };
      console.log('✓ Zoho API imported successfully');
    } catch (importError) {
      diagnostics.zohoAPIImport = { 
        success: false, 
        error: importError.message 
      };
      console.log('✗ Zoho API import failed:', importError.message);
    }

    // 3. Test Authentication (if import succeeded)
    if (zohoAPI && envCheck.ZOHO_CLIENT_ID && envCheck.ZOHO_CLIENT_SECRET && envCheck.ZOHO_REFRESH_TOKEN) {
      console.log('3. Testing Zoho authentication...');
      try {
        const token = await zohoAPI.getAccessToken();
        diagnostics.authentication = { 
          success: true, 
          tokenReceived: !!token,
          tokenLength: token ? token.length : 0
        };
        console.log('✓ Authentication successful');
      } catch (authError) {
        diagnostics.authentication = { 
          success: false, 
          error: authError.message,
          stack: authError.stack
        };
        console.log('✗ Authentication failed:', authError.message);
      }
    } else {
      diagnostics.authentication = { 
        skipped: true, 
        reason: 'Missing environment variables or API import failed' 
      };
    }

    // 4. Test Sample Checkout Data Validation
    console.log('4. Testing checkout data validation...');
    const sampleCheckoutData = {
      customerInfo: {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '555-1234'
      },
      shippingAddress: {
        address1: '123 Test St',
        city: 'Test City',
        state: 'CA',
        zipCode: '12345',
        country: 'US'
      },
      cartItems: [
        {
          product_id: 'test-1',
          product_name: 'Test Product',
          quantity: 1,
          product_price: 99.99
        }
      ]
    };

    // Test validation function (if it exists)
    try {
      // Import validation function
      const { validateCheckoutData } = await import('./zoho-checkout');
      const validationErrors = validateCheckoutData(sampleCheckoutData);
      diagnostics.dataValidation = {
        success: true,
        validationErrors: validationErrors || [],
        sampleDataValid: !validationErrors || validationErrors.length === 0
      };
      console.log('✓ Data validation test passed');
    } catch (validationError) {
      diagnostics.dataValidation = {
        success: false,
        error: validationError.message,
        note: 'Could not test validation function'
      };
      console.log('✗ Data validation test failed:', validationError.message);
    }

    // 5. Test Network Connectivity to Zoho
    console.log('5. Testing network connectivity to Zoho...');
    try {
      const testResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'HEAD', // Just test connectivity, don't actually authenticate
        timeout: 5000
      });
      diagnostics.networkConnectivity = {
        success: true,
        zohoReachable: testResponse.status !== undefined,
        statusCode: testResponse.status
      };
      console.log('✓ Network connectivity to Zoho confirmed');
    } catch (networkError) {
      diagnostics.networkConnectivity = {
        success: false,
        error: networkError.message,
        code: networkError.code
      };
      console.log('✗ Network connectivity failed:', networkError.message);
    }

    // 6. Generate Recommendations
    const recommendations = generateRecommendations(diagnostics);
    diagnostics.recommendations = recommendations;

    console.log('Diagnostic complete. Results:', diagnostics);

    return res.status(200).json({
      success: true,
      message: 'Zoho Checkout Diagnostic Complete',
      diagnostics,
      summary: generateSummary(diagnostics)
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

function generateRecommendations(diagnostics) {
  const recommendations = [];

  // Check environment variables
  const envVars = diagnostics.environmentVariables;
  if (!envVars.ZOHO_CLIENT_ID || !envVars.ZOHO_CLIENT_SECRET || !envVars.ZOHO_REFRESH_TOKEN || !envVars.ZOHO_STORE_ID) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Environment Variables',
      issue: 'Missing required Zoho environment variables',
      action: 'Add missing variables to Vercel environment settings',
      missingVars: Object.entries(envVars).filter(([key, value]) => !value).map(([key]) => key)
    });
  }

  // Check API import
  if (diagnostics.zohoAPIImport && !diagnostics.zohoAPIImport.success) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Code Error',
      issue: 'Zoho API module import failed',
      action: 'Fix zoho-api.js/ts import or syntax errors',
      error: diagnostics.zohoAPIImport.error
    });
  }

  // Check authentication
  if (diagnostics.authentication && !diagnostics.authentication.success && !diagnostics.authentication.skipped) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Authentication',
      issue: 'Zoho API authentication failed',
      action: 'Verify Zoho OAuth credentials and refresh token validity',
      error: diagnostics.authentication.error
    });
  }

  // Check network connectivity
  if (diagnostics.networkConnectivity && !diagnostics.networkConnectivity.success) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Network',
      issue: 'Cannot reach Zoho servers',
      action: 'Check network configuration and firewall settings',
      error: diagnostics.networkConnectivity.error
    });
  }

  return recommendations;
}

function generateSummary(diagnostics) {
  const issues = [];
  const successes = [];

  // Environment variables
  const envVars = diagnostics.environmentVariables;
  const missingEnvVars = Object.entries(envVars).filter(([key, value]) => key.startsWith('ZOHO_') && !value);
  
  if (missingEnvVars.length > 0) {
    issues.push(`Missing environment variables: ${missingEnvVars.map(([key]) => key).join(', ')}`);
  } else {
    successes.push('All Zoho environment variables present');
  }

  // API import
  if (diagnostics.zohoAPIImport) {
    if (diagnostics.zohoAPIImport.success) {
      successes.push('Zoho API module imported successfully');
    } else {
      issues.push(`Zoho API import failed: ${diagnostics.zohoAPIImport.error}`);
    }
  }

  // Authentication
  if (diagnostics.authentication) {
    if (diagnostics.authentication.success) {
      successes.push('Zoho API authentication working');
    } else if (!diagnostics.authentication.skipped) {
      issues.push(`Authentication failed: ${diagnostics.authentication.error}`);
    }
  }

  // Network
  if (diagnostics.networkConnectivity) {
    if (diagnostics.networkConnectivity.success) {
      successes.push('Network connectivity to Zoho confirmed');
    } else {
      issues.push(`Network connectivity failed: ${diagnostics.networkConnectivity.error}`);
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
      'Monitor server logs for additional errors'
    ] : [
      'Checkout API should be working',
      'Test with real checkout data',
      'Monitor for any remaining issues'
    ]
  };
}