// ===== src/pages/api/test-customer-endpoints.js ===== (CREATE THIS FILE)
import { enhancedZohoAPI } from '../../lib/zoho-api-enhanced';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TESTING CUSTOMER ENDPOINTS ===');

    const results = {
      timestamp: new Date().toISOString(),
      endpointTests: {},
      customerCreationTest: null,
      customerSearchTest: null,
      recommendations: []
    };

    // Test 1: Check which customer endpoints are accessible
    console.log('Step 1: Testing customer endpoint accessibility...');
    
    const customerEndpoints = [
      '/customers',
      '/contacts', 
      '/people',
      '/buyers',
      '/users',
      '/accounts'
    ];

    for (const endpoint of customerEndpoints) {
      try {
        console.log(`Testing endpoint: ${endpoint}`);
        
        const response = await enhancedZohoAPI.apiRequest(endpoint);
        
        results.endpointTests[endpoint] = {
          success: true,
          method: 'GET',
          responseKeys: Object.keys(response),
          hasData: !!(response.customers || response.contacts || response.people || response.data),
          dataCount: (response.customers || response.contacts || response.people || response.data || []).length,
          responsePreview: JSON.stringify(response).substring(0, 200)
        };
        
        console.log(`✅ ${endpoint} - accessible`);
        
      } catch (error) {
        results.endpointTests[endpoint] = {
          success: false,
          method: 'GET',
          error: error.message,
          status: error.status || 'unknown'
        };
        
        console.log(`❌ ${endpoint} - failed: ${error.message}`);
      }
    }

    // Test 2: Try creating a test customer
    console.log('\nStep 2: Testing customer creation...');
    
    const testCustomerData = {
      name: 'Test Customer',
      email: `test-${Date.now()}@example.com`,
      first_name: 'Test',
      last_name: 'Customer',
      phone: '555-0123',
      customer_name: 'Test Customer',
      customer_email: `test-${Date.now()}@example.com`,
      display_name: 'Test Customer'
    };

    try {
      const customerResult = await enhancedZohoAPI.createCustomer(testCustomerData);
      
      results.customerCreationTest = {
        success: !!customerResult,
        customerData: customerResult,
        customerId: customerResult?.customer_id || null,
        testEmail: testCustomerData.email
      };
      
      if (customerResult) {
        console.log('✅ Customer creation successful:', customerResult.customer_id);
      } else {
        console.log('❌ Customer creation returned null');
      }
      
    } catch (error) {
      results.customerCreationTest = {
        success: false,
        error: error.message,
        status: error.status || 'unknown',
        testEmail: testCustomerData.email
      };
      
      console.log('❌ Customer creation failed:', error.message);
    }

    // Test 3: Try searching for customers
    console.log('\nStep 3: Testing customer search...');
    
    try {
      // Try to search for a customer that definitely exists (if any)
      const searchResult = await enhancedZohoAPI.findCustomerByEmail('test@example.com');
      
      results.customerSearchTest = {
        success: true,
        found: !!searchResult,
        customerData: searchResult,
        searchEmail: 'test@example.com'
      };
      
      console.log('✅ Customer search completed:', searchResult ? 'Customer found' : 'No customer found');
      
    } catch (error) {
      results.customerSearchTest = {
        success: false,
        error: error.message,
        status: error.status || 'unknown',
        searchEmail: 'test@example.com'
      };
      
      console.log('❌ Customer search failed:', error.message);
    }

    // Test 4: Test the enhanced order creation method
    console.log('\nStep 4: Testing enhanced order creation...');
    
    const testOrderData = {
      customer_name: 'Test Order Customer',
      customer_email: 'test-order@example.com',
      line_items: [{
        item_name: 'Test Product',
        quantity: 1,
        rate: 99.99,
        amount: 99.99
      }],
      date: new Date().toISOString().split('T')[0],
      sub_total: 99.99,
      total: 99.99,
      notes: 'Test order for customer endpoint validation'
    };

    const testCustomerInfo = {
      firstName: 'Test',
      lastName: 'Customer',
      email: 'test-order@example.com',
      phone: '555-0123'
    };

    try {
      const orderResult = await enhancedZohoAPI.createOrderWithCustomer(
        testOrderData, 
        testCustomerInfo
      );
      
      results.enhancedOrderTest = {
        success: true,
        orderId: orderResult.order.salesorder_id || orderResult.order.id,
        customerCreated: orderResult.customerCreated,
        customerId: orderResult.customer?.customer_id || null,
        hasCustomer: !!orderResult.customer
      };
      
      console.log('✅ Enhanced order creation successful:', {
        orderId: orderResult.order.salesorder_id || orderResult.order.id,
        customerCreated: orderResult.customerCreated,
        customerId: orderResult.customer?.customer_id
      });
      
    } catch (error) {
      results.enhancedOrderTest = {
        success: false,
        error: error.message,
        status: error.status || 'unknown'
      };
      
      console.log('❌ Enhanced order creation failed:', error.message);
    }

    // Generate recommendations
    console.log('\nStep 5: Generating recommendations...');
    
    const workingEndpoints = Object.entries(results.endpointTests)
      .filter(([endpoint, test]) => test.success)
      .map(([endpoint]) => endpoint);

    if (workingEndpoints.length === 0) {
      results.recommendations.push('❌ No customer endpoints are accessible');
      results.recommendations.push('🔧 Customer management may not be available in your Zoho Commerce plan');
      results.recommendations.push('🔧 Continue with guest orders (no customer_id required)');
    } else {
      results.recommendations.push(`✅ Found ${workingEndpoints.length} accessible customer endpoint(s): ${workingEndpoints.join(', ')}`);
    }

    if (results.customerCreationTest?.success) {
      results.recommendations.push('✅ Customer creation is working - you can create customers before orders');
      results.recommendations.push('🎯 Use the enhanced checkout API for better customer management');
    } else {
      results.recommendations.push('❌ Customer creation failed - use guest orders');
      results.recommendations.push('🔧 Orders will be created without customer_id to avoid the error');
    }

    if (results.enhancedOrderTest?.success) {
      results.recommendations.push('✅ Enhanced order creation is working');
      if (results.enhancedOrderTest.customerCreated) {
        results.recommendations.push('🎯 Customer was created automatically during order process');
      } else {
        results.recommendations.push('ℹ️ Order was created without customer (guest order)');
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Customer endpoint testing completed',
      results,
      summary: {
        accessibleEndpoints: workingEndpoints.length,
        customerCreationWorks: results.customerCreationTest?.success || false,
        customerSearchWorks: results.customerSearchTest?.success || false,
        enhancedOrderWorks: results.enhancedOrderTest?.success || false,
        recommendedApproach: results.customerCreationTest?.success 
          ? 'Use customer-first checkout'
          : 'Use guest orders without customer_id'
      },
      nextSteps: [
        '1. Replace your checkout API with the customer-first version if customer creation works',
        '2. Update your frontend to use the new checkout endpoint',
        '3. Test the full checkout flow',
        '4. Monitor for any remaining customer_id errors'
      ]
    });

  } catch (error) {
    console.error('Customer endpoint test failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Customer endpoint testing failed',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}