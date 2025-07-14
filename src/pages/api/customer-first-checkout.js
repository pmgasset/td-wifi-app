// ===== src/pages/api/customer-first-checkout.js ===== (CREATE THIS FILE)
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  const requestId = `cfc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== CUSTOMER-FIRST CHECKOUT [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    const { customerInfo, shippingAddress, cartItems, orderNotes } = req.body;
    
    console.log('Processing customer-first checkout for:', customerInfo?.email);

    // ===== STEP 1: CREATE OR FIND CUSTOMER =====
    console.log('Step 1: Creating/finding customer...');
    let customerId = null;
    let customerData = null;

    try {
      // Try to create customer first using multiple possible endpoints
      const customerEndpoints = [
        '/customers',           // Standard REST endpoint
        '/contacts',           // Alternative endpoint name
        '/people',             // Another possible name
        '/buyers'              // Commerce-specific endpoint
      ];

      const customerPayload = {
        // Standard customer fields
        name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        email: customerInfo.email,
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        phone: customerInfo.phone || '',
        
        // Alternative field names
        customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        customer_email: customerInfo.email,
        display_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        
        // Address information if needed
        billing_address: shippingAddress ? {
          address1: shippingAddress.address1,
          address2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: shippingAddress.country || 'US'
        } : undefined,
        
        // Additional metadata
        source: 'website',
        created_via: 'api',
        notes: `Customer created via checkout process - Request ID: ${requestId}`
      };

      console.log('Attempting to create customer with payload:', JSON.stringify(customerPayload, null, 2));

      for (const endpoint of customerEndpoints) {
        try {
          console.log(`Trying customer endpoint: ${endpoint}`);
          
          const customerResponse = await zohoAPI.apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(customerPayload)
          });
          
          console.log(`✅ Customer creation successful at ${endpoint}:`, customerResponse);
          
          // Extract customer ID from response (different possible field names)
          customerId = customerResponse.customer_id || 
                      customerResponse.contact_id || 
                      customerResponse.id || 
                      customerResponse.person_id ||
                      customerResponse.buyer_id;
          
          customerData = customerResponse;
          
          if (customerId) {
            console.log(`✅ Customer created successfully with ID: ${customerId}`);
            break;
          }
          
        } catch (endpointError) {
          console.log(`❌ Customer endpoint ${endpoint} failed:`, endpointError.message);
          continue;
        }
      }

      // If customer creation failed, try to find existing customer
      if (!customerId) {
        console.log('Customer creation failed, trying to find existing customer...');
        
        try {
          // Try to search for existing customer by email
          const searchEndpoints = [
            `/customers?email=${encodeURIComponent(customerInfo.email)}`,
            `/contacts?email=${encodeURIComponent(customerInfo.email)}`,
            `/customers/search?email=${encodeURIComponent(customerInfo.email)}`
          ];

          for (const searchEndpoint of searchEndpoints) {
            try {
              console.log(`Searching for customer at: ${searchEndpoint}`);
              const searchResponse = await zohoAPI.apiRequest(searchEndpoint);
              
              const customers = searchResponse.customers || 
                               searchResponse.contacts || 
                               searchResponse.data || 
                               (Array.isArray(searchResponse) ? searchResponse : []);
              
              if (customers.length > 0) {
                const existingCustomer = customers[0];
                customerId = existingCustomer.customer_id || 
                            existingCustomer.contact_id || 
                            existingCustomer.id;
                
                customerData = existingCustomer;
                console.log(`✅ Found existing customer with ID: ${customerId}`);
                break;
              }
            } catch (searchError) {
              console.log(`❌ Customer search at ${searchEndpoint} failed:`, searchError.message);
              continue;
            }
          }
        } catch (searchError) {
          console.log('❌ Customer search failed:', searchError.message);
        }
      }

    } catch (customerError) {
      console.log('❌ Customer creation/search failed:', customerError.message);
      // Continue without customer ID - we'll create order without it
    }

    // ===== STEP 2: CALCULATE ORDER TOTALS =====
    console.log('Step 2: Calculating order totals...');
    const subtotal = cartItems.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
    const tax = Math.round(subtotal * 0.0875 * 100) / 100;
    const shipping = subtotal >= 100 ? 0 : 9.99;
    const total = subtotal + tax + shipping;

    console.log('Order totals:', { subtotal, tax, shipping, total });

    // ===== STEP 3: CREATE ORDER WITH CUSTOMER ID =====
    console.log('Step 3: Creating order...');
    
    const orderData = {
      // Customer information
      customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
      customer_email: customerInfo.email,
      customer_phone: customerInfo.phone || '',
      
      // Include customer_id if we have it
      ...(customerId && { customer_id: customerId }),
      
      // Line items
      line_items: cartItems.map(item => ({
        item_name: item.product_name,
        quantity: item.quantity,
        rate: item.product_price,
        amount: item.product_price * item.quantity
      })),
      
      // Order details
      date: new Date().toISOString().split('T')[0],
      sub_total: subtotal,
      tax_total: tax,
      shipping_charge: shipping,
      total: total,
      notes: orderNotes || '',
      
      // Shipping address (if customer creation worked, this might not be needed)
      ...(!customerId && shippingAddress && {
        shipping_address: {
          address1: shippingAddress.address1,
          address2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: shippingAddress.country || 'US'
        }
      }),
      
      // Metadata
      custom_fields: [
        { label: 'Source', value: 'Travel Data WiFi Website' },
        { label: 'Request ID', value: requestId },
        { label: 'Customer Process', value: customerId ? 'Customer Created' : 'Guest Order' },
        { label: 'Customer ID', value: customerId || 'None' }
      ]
    };

    console.log(`Creating order ${customerId ? 'WITH' : 'WITHOUT'} customer ID:`, JSON.stringify(orderData, null, 2));

    // Create order in Zoho
    const zohoOrder = await zohoAPI.createOrder(orderData);
    
    console.log('✅ Order created successfully:', {
      orderId: zohoOrder.salesorder_id || zohoOrder.id,
      orderNumber: zohoOrder.salesorder_number || zohoOrder.number,
      customerId: customerId
    });

    // ===== STEP 4: CREATE PAYMENT URL =====
    console.log('Step 4: Creating payment URL...');
    
    const orderId = zohoOrder.salesorder_id || zohoOrder.id;
    const orderNumber = zohoOrder.salesorder_number || zohoOrder.number || `TDW-${orderId}`;
    
    const paymentParams = new URLSearchParams({
      order_id: orderId,
      order_number: orderNumber,
      amount: total.toString(),
      currency: 'USD',
      customer_email: customerInfo.email,
      customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
      customer_id: customerId || 'guest',
      return_url: `${req.headers.origin}/checkout/success`,
      request_id: requestId
    });

    const paymentUrl = `${req.headers.origin}/payment/invoice?${paymentParams.toString()}`;

    // ===== STEP 5: RETURN SUCCESS RESPONSE =====
    const successResponse = {
      success: true,
      type: 'customer_first_checkout',
      checkout_url: paymentUrl,
      
      // Order details
      order_id: orderId,
      order_number: orderNumber,
      session_id: `zoho_${orderId}`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      
      // Customer details
      customer_created: !!customerId,
      customer_id: customerId,
      customer_data: customerData,
      
      // Financial details
      total_amount: total,
      currency: 'USD',
      order_details: {
        subtotal,
        tax,
        shipping,
        total,
        items: cartItems.length,
        customer: `${customerInfo.firstName} ${customerInfo.lastName}`
      },
      
      // Process metadata
      request_id: requestId,
      process_notes: [
        customerId ? `✅ Customer created/found with ID: ${customerId}` : '⚠️ Order created as guest (no customer ID)',
        `✅ Order created with ID: ${orderId}`,
        `✅ Payment URL generated successfully`
      ]
    };

    console.log('✅ Customer-first checkout completed successfully');
    console.log('Process summary:', {
      customerCreated: !!customerId,
      orderId: orderId,
      total: total
    });

    return res.status(200).json(successResponse);

  } catch (error) {
    console.error('❌ Customer-first checkout failed:', error);
    
    // Enhanced error response with more context
    return res.status(500).json({
      error: 'Customer-first checkout processing failed',
      details: error.message || 'An unexpected error occurred',
      type: 'CUSTOMER_FIRST_CHECKOUT_ERROR',
      stage: error.stage || 'unknown',
      
      // Additional debugging information
      error_context: {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n')[0]
      },
      
      request_id: requestId,
      timestamp: new Date().toISOString(),
      
      // Suggestions for debugging
      debug_suggestions: [
        'Check if customer creation endpoints are accessible',
        'Verify order creation works without customer_id',
        'Review Zoho Commerce API documentation for customer endpoints',
        'Test with minimal customer data payload'
      ]
    });
  }
}