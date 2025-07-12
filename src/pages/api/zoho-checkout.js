// ===== src/pages/api/zoho-checkout.js ===== (REAL ZOHO WITH VERBOSE LOGGING)
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== ZOHO CHECKOUT REQUEST [${requestId}] ===`);
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('User-Agent:', req.headers['user-agent']);
  console.log('Origin:', req.headers.origin);
  
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      requestId 
    });
  }

  try {
    console.log('\n--- STEP 1: PARSING REQUEST DATA ---');
    const { customerInfo, shippingAddress, cartItems, orderNotes, checkoutType = 'hosted' } = req.body;
    
    console.log('Request body structure:', {
      hasCustomerInfo: !!customerInfo,
      hasShippingAddress: !!shippingAddress,
      hasCartItems: !!cartItems,
      cartItemCount: cartItems?.length || 0,
      checkoutType,
      orderNotesLength: orderNotes?.length || 0
    });

    if (customerInfo) {
      console.log('Customer info:', {
        email: customerInfo.email,
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        hasPhone: !!customerInfo.phone
      });
    }

    if (shippingAddress) {
      console.log('Shipping address:', {
        city: shippingAddress.city,
        state: shippingAddress.state,
        zipCode: shippingAddress.zipCode,
        country: shippingAddress.country,
        hasAddress1: !!shippingAddress.address1
      });
    }

    if (cartItems && cartItems.length > 0) {
      console.log('Cart items detail:');
      cartItems.forEach((item, index) => {
        console.log(`  Item ${index + 1}:`, {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          product_price: item.product_price,
          hasImages: !!item.product_images?.length
        });
      });
    }

    console.log('\n--- STEP 2: VALIDATION ---');
    const validationErrors = validateCheckoutData({ customerInfo, shippingAddress, cartItems });
    if (validationErrors.length > 0) {
      console.log('❌ Validation failed:', validationErrors);
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
        requestId
      });
    }
    console.log('✅ Validation passed');

    console.log('\n--- STEP 3: CALCULATING TOTALS ---');
    const subtotal = cartItems.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
    const tax = calculateTax(subtotal, shippingAddress.state);
    const shipping = calculateShipping(cartItems, shippingAddress);
    const total = subtotal + tax + shipping;

    console.log('Order calculations:', {
      subtotal: `$${subtotal.toFixed(2)}`,
      tax: `$${tax.toFixed(2)}`,
      shipping: `$${shipping.toFixed(2)}`,
      total: `$${total.toFixed(2)}`,
      taxRate: `${((tax / subtotal) * 100).toFixed(2)}%`
    });

    console.log('\n--- STEP 4: ZOHO API AUTHENTICATION TEST ---');
    let accessToken;
    try {
      accessToken = await zohoAPI.getAccessToken();
      console.log('✅ Authentication successful:', {
        tokenLength: accessToken?.length || 0,
        tokenPrefix: accessToken?.substring(0, 10) + '...'
      });
    } catch (authError) {
      console.log('❌ Authentication failed:', {
        error: authError.message,
        name: authError.name,
        stack: authError.stack?.split('\n')[0]
      });
      return res.status(500).json({
        error: 'Zoho authentication failed',
        details: authError.message,
        type: 'AUTH_ERROR',
        requestId,
        suggestions: [
          'Check ZOHO_REFRESH_TOKEN validity',
          'Verify ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET',
          'Ensure Zoho OAuth app has correct scopes'
        ]
      });
    }

    console.log('\n--- STEP 5: ZOHO COMMERCE ORDER CREATION ---');
    
    // Try Method 1: Zoho Commerce Sales Order
    try {
      console.log('Attempting Method 1: Zoho Sales Order creation...');
      
      const salesOrderData = {
        customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone || '',
        
        line_items: cartItems.map((item, index) => {
          console.log(`  Processing line item ${index + 1}:`, item.product_name);
          return {
            item_name: item.product_name,
            item_id: item.product_id,
            quantity: item.quantity,
            rate: item.product_price,
            amount: item.product_price * item.quantity,
            description: item.product_description || ''
          };
        }),
        
        shipping_address: {
          attention: `${customerInfo.firstName} ${customerInfo.lastName}`,
          address: shippingAddress.address1,
          street2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: 'United States',
          phone: customerInfo.phone || ''
        },
        
        billing_address: {
          attention: `${customerInfo.firstName} ${customerInfo.lastName}`,
          address: shippingAddress.address1,
          street2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: 'United States',
          phone: customerInfo.phone || ''
        },
        
        date: new Date().toISOString().split('T')[0],
        shipment_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        
        sub_total: subtotal,
        tax_total: tax,
        shipping_charge: shipping,
        total: total,
        
        notes: orderNotes || '',
        terms: 'Payment due upon receipt',
        
        custom_fields: [
          { label: 'Source', value: 'Travel Data WiFi Website' },
          { label: 'Checkout Type', value: checkoutType },
          { label: 'Request ID', value: requestId }
        ]
      };

      console.log('Sales order data prepared:', {
        customerName: salesOrderData.customer_name,
        itemCount: salesOrderData.line_items.length,
        totalAmount: salesOrderData.total,
        hasShippingAddress: !!salesOrderData.shipping_address,
        hasBillingAddress: !!salesOrderData.billing_address
      });

      console.log('Calling zohoAPI.createOrder...');
      const salesOrder = await zohoAPI.createOrder(salesOrderData);
      
      console.log('✅ Sales order created successfully:', {
        orderId: salesOrder.salesorder_id || salesOrder.id,
        orderNumber: salesOrder.salesorder_number || salesOrder.number,
        status: salesOrder.status,
        total: salesOrder.total,
        responseKeys: Object.keys(salesOrder)
      });

      // Try to create payment link
      console.log('\n--- STEP 6: PAYMENT LINK CREATION ---');
      let paymentUrl;
      
      try {
        console.log('Attempting to create Zoho payment link...');
        
        const paymentLinkData = {
          reference_number: salesOrder.salesorder_number || salesOrder.number || `ORDER-${Date.now()}`,
          amount: total,
          currency_code: 'USD',
          expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days
          description: `Payment for Travel Data WiFi Order ${salesOrder.salesorder_number || salesOrder.number}`,
          customer: {
            customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
            email: customerInfo.email,
            phone: customerInfo.phone || ''
          },
          notes: orderNotes || '',
          redirect_url: `${req.headers.origin}/checkout/success?order_id=${salesOrder.salesorder_id || salesOrder.id}`,
          payment_options: {
            payment_gateways: [
              { configured: true, additional_field1: 'standard' }
            ]
          }
        };

        console.log('Payment link data:', {
          amount: paymentLinkData.amount,
          currency: paymentLinkData.currency_code,
          customerEmail: paymentLinkData.customer.email,
          redirectUrl: paymentLinkData.redirect_url
        });

        // Try different payment link endpoints
        const paymentEndpoints = [
          '/paymentlinks',
          '/payment_links', 
          '/invoices/paymentlinks',
          `/salesorders/${salesOrder.salesorder_id || salesOrder.id}/paymentlinks`
        ];

        let paymentResponse;
        for (const endpoint of paymentEndpoints) {
          try {
            console.log(`Trying payment link endpoint: ${endpoint}`);
            paymentResponse = await zohoAPI.apiRequest(endpoint, {
              method: 'POST',
              body: JSON.stringify(paymentLinkData)
            });
            console.log(`✅ Payment link created at ${endpoint}:`, {
              paymentLinkId: paymentResponse.paymentlink_id || paymentResponse.id,
              paymentUrl: paymentResponse.payment_url || paymentResponse.url,
              status: paymentResponse.status
            });
            paymentUrl = paymentResponse.payment_url || paymentResponse.url;
            break;
          } catch (endpointError) {
            console.log(`❌ Payment endpoint ${endpoint} failed:`, endpointError.message);
          }
        }

        if (!paymentUrl) {
          throw new Error('All payment link endpoints failed');
        }

      } catch (paymentError) {
        console.log('❌ Payment link creation failed:', paymentError.message);
        console.log('Creating fallback invoice URL...');
        
        // Fallback: Create invoice-style URL
        const invoiceParams = new URLSearchParams({
          order_id: salesOrder.salesorder_id || salesOrder.id,
          order_number: salesOrder.salesorder_number || salesOrder.number,
          amount: total.toString(),
          currency: 'USD',
          customer_email: customerInfo.email,
          customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
          return_url: `${req.headers.origin}/checkout/success`,
          request_id: requestId
        });
        
        paymentUrl = `${req.headers.origin}/payment/invoice?${invoiceParams.toString()}`;
        console.log('Fallback payment URL created:', paymentUrl);
      }

      console.log('\n--- STEP 7: SUCCESS RESPONSE ---');
      const successResponse = {
        type: 'hosted',
        success: true,
        checkout_url: paymentUrl,
        order_id: salesOrder.salesorder_id || salesOrder.id,
        order_number: salesOrder.salesorder_number || salesOrder.number,
        session_id: `zoho_${salesOrder.salesorder_id || salesOrder.id}`,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        total_amount: total,
        currency: 'USD',
        order_details: {
          subtotal,
          tax,
          shipping,
          total,
          items: cartItems.length,
          customer: `${customerInfo.firstName} ${customerInfo.lastName}`,
          created_via: 'zoho_sales_order'
        },
        request_id: requestId
      };

      console.log('Sending success response:', {
        checkoutUrl: successResponse.checkout_url,
        orderId: successResponse.order_id,
        orderNumber: successResponse.order_number,
        totalAmount: successResponse.total_amount
      });

      return res.status(200).json(successResponse);

    } catch (salesOrderError) {
      console.log('\n❌ Method 1 (Sales Order) failed:', {
        error: salesOrderError.message,
        name: salesOrderError.name,
        stack: salesOrderError.stack?.split('\n').slice(0, 3)
      });

      // Try Method 2: Direct Zoho Commerce Order
      console.log('\n--- TRYING METHOD 2: DIRECT COMMERCE ORDER ---');
      
      try {
        const directOrderData = {
          customer: {
            name: `${customerInfo.firstName} ${customerInfo.lastName}`,
            email: customerInfo.email,
            phone: customerInfo.phone || ''
          },
          
          items: cartItems.map(item => ({
            product_id: item.product_id,
            name: item.product_name,
            quantity: item.quantity,
            price: item.product_price,
            total: item.product_price * item.quantity
          })),
          
          shipping_address: {
            name: `${customerInfo.firstName} ${customerInfo.lastName}`,
            line1: shippingAddress.address1,
            line2: shippingAddress.address2 || '',
            city: shippingAddress.city,
            state: shippingAddress.state,
            postal_code: shippingAddress.zipCode,
            country: 'US',
            phone: customerInfo.phone || ''
          },
          
          totals: {
            subtotal,
            tax,
            shipping,
            total
          },
          
          metadata: {
            source: 'travel_data_wifi',
            checkout_type: checkoutType,
            request_id: requestId,
            notes: orderNotes || ''
          }
        };

        console.log('Direct order data prepared:', {
          customerEmail: directOrderData.customer.email,
          itemCount: directOrderData.items.length,
          total: directOrderData.totals.total
        });

        // Try different order creation endpoints
        const orderEndpoints = [
          '/orders',
          '/commerce/orders', 
          `/stores/${process.env.ZOHO_STORE_ID}/orders`,
          '/salesorders'
        ];

        let orderResponse;
        for (const endpoint of orderEndpoints) {
          try {
            console.log(`Trying direct order endpoint: ${endpoint}`);
            orderResponse = await zohoAPI.apiRequest(endpoint, {
              method: 'POST',
              body: JSON.stringify(directOrderData)
            });
            console.log(`✅ Order created at ${endpoint}:`, {
              orderId: orderResponse.order_id || orderResponse.id,
              status: orderResponse.status,
              responseKeys: Object.keys(orderResponse)
            });
            break;
          } catch (endpointError) {
            console.log(`❌ Order endpoint ${endpoint} failed:`, endpointError.message);
          }
        }

        if (!orderResponse) {
          throw new Error('All direct order endpoints failed');
        }

        // Create payment URL for direct order
        const paymentParams = new URLSearchParams({
          order_id: orderResponse.order_id || orderResponse.id,
          amount: total.toString(),
          currency: 'USD',
          customer_email: customerInfo.email,
          method: 'direct_order',
          request_id: requestId
        });

        const directPaymentUrl = `${req.headers.origin}/payment/direct?${paymentParams.toString()}`;

        console.log('✅ Method 2 successful - returning response');
        return res.status(200).json({
          type: 'hosted',
          success: true,
          checkout_url: directPaymentUrl,
          order_id: orderResponse.order_id || orderResponse.id,
          order_number: `TDW-${orderResponse.order_id || orderResponse.id}`,
          session_id: `direct_${orderResponse.order_id || orderResponse.id}`,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          total_amount: total,
          currency: 'USD',
          order_details: {
            subtotal, tax, shipping, total,
            items: cartItems.length,
            customer: `${customerInfo.firstName} ${customerInfo.lastName}`,
            created_via: 'direct_commerce_order'
          },
          request_id: requestId
        });

      } catch (directOrderError) {
        console.log('\n❌ Method 2 (Direct Order) also failed:', {
          error: directOrderError.message,
          name: directOrderError.name,
          stack: directOrderError.stack?.split('\n').slice(0, 3)
        });

        // If all Zoho methods fail, provide detailed error info
        console.log('\n❌ ALL ZOHO METHODS FAILED - Providing detailed error response');
        
        return res.status(500).json({
          error: 'Zoho Commerce integration failed',
          details: 'Both sales order and direct order creation methods failed',
          type: 'ZOHO_API_ERROR',
          request_id: requestId,
          errors: {
            salesOrder: salesOrderError.message,
            directOrder: directOrderError.message
          },
          suggestions: [
            'Check Zoho Commerce API documentation for correct endpoints',
            'Verify API permissions and scopes',
            'Test API endpoints directly using Postman or curl',
            'Contact Zoho support for API guidance',
            'Check if Zoho Commerce is properly configured for your account'
          ],
          debug_info: {
            storeId: process.env.ZOHO_STORE_ID,
            hasAuth: !!accessToken,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

  } catch (error) {
    console.log('\n❌ CATASTROPHIC ERROR:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5)
    });
    
    return res.status(500).json({
      error: 'Checkout processing failed',
      details: error.message,
      type: 'INTERNAL_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Validation helper function
function validateCheckoutData({ customerInfo, shippingAddress, cartItems }) {
  const errors = [];

  if (!customerInfo?.email) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
    errors.push('Please enter a valid email address');
  }
  
  if (!customerInfo?.firstName) errors.push('First name is required');
  if (!customerInfo?.lastName) errors.push('Last name is required');
  
  if (!shippingAddress?.address1) errors.push('Street address is required');
  if (!shippingAddress?.city) errors.push('City is required');
  if (!shippingAddress?.state) errors.push('State is required');
  if (!shippingAddress?.zipCode) errors.push('ZIP code is required');
  
  if (shippingAddress?.zipCode && !/^\d{5}(-\d{4})?$/.test(shippingAddress.zipCode)) {
    errors.push('Please enter a valid ZIP code');
  }
  
  if (!cartItems || cartItems.length === 0) {
    errors.push('Cart is empty');
  }
  
  cartItems?.forEach((item, index) => {
    if (!item.product_id) errors.push(`Item ${index + 1}: Product ID is missing`);
    if (!item.product_name) errors.push(`Item ${index + 1}: Product name is missing`);
    if (!item.quantity || item.quantity < 1) errors.push(`Item ${index + 1}: Invalid quantity`);
    if (!item.product_price || item.product_price < 0) errors.push(`Item ${index + 1}: Invalid price`);
  });

  return errors;
}

function calculateTax(subtotal, state) {
  const taxRates = {
    'CA': 0.0875, 'NY': 0.08, 'TX': 0.0625, 'FL': 0.06, 'WA': 0.065
  };
  const taxRate = taxRates[state] || 0.07;
  return Math.round(subtotal * taxRate * 100) / 100;
}

function calculateShipping(cartItems, shippingAddress) {
  const totalValue = cartItems.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
  if (totalValue >= 100) return 0;
  return 9.99;
}