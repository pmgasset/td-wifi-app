// ===== src/pages/api/zoho-checkout.js ===== (ROBUST VERSION WITH FALLBACKS)
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== ZOHO CHECKOUT [${requestId}] ===`);
  console.log('Timestamp:', new Date().toISOString());
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      requestId 
    });
  }

  try {
    const { customerInfo, shippingAddress, cartItems, orderNotes } = req.body;
    
    console.log('Processing checkout for:', customerInfo?.email);

    // Step 1: Validate input data
    const validationErrors = validateCheckoutData({ customerInfo, shippingAddress, cartItems });
    if (validationErrors.length > 0) {
      console.log('❌ Validation failed:', validationErrors);
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
        requestId
      });
    }

    // Step 2: Calculate totals
    const subtotal = cartItems.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
    const tax = Math.round(subtotal * 0.0875 * 100) / 100;
    const shipping = subtotal >= 100 ? 0 : 9.99;
    const total = subtotal + tax + shipping;

    console.log('Order totals:', { subtotal, tax, shipping, total });

    // Step 3: Get Zoho access token
    console.log('Getting Zoho access token...');
    let accessToken;
    try {
      accessToken = await zohoAPI.getAccessToken();
      console.log('✅ Authentication successful');
    } catch (authError) {
      console.error('❌ Authentication failed:', authError.message);
      return res.status(500).json({
        error: 'Authentication failed',
        details: 'Unable to authenticate with Zoho Commerce',
        type: 'AUTH_ERROR',
        requestId
      });
    }

    // Step 4: Try different order creation approaches
    console.log('Attempting order creation with multiple approaches...');
    
    let zohoOrder = null;
    let orderCreationMethod = 'unknown';

    // APPROACH 1: Try order creation without customer requirement (contact-based)
    console.log('Approach 1: Creating order with contact information...');
    try {
      const contactOrderData = {
        // Use contact information instead of customer_id
        customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone || '',
        
        line_items: cartItems.map(item => ({
          item_name: item.product_name,
          item_id: item.product_id,
          quantity: item.quantity,
          rate: item.product_price,
          amount: item.product_price * item.quantity
        })),
        
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
          { label: 'Request ID', value: requestId }
        ]
      };

      zohoOrder = await zohoAPI.createOrder(contactOrderData);
      orderCreationMethod = 'contact_based';
      console.log('✅ Approach 1 successful - Contact-based order created');

    } catch (contactOrderError) {
      console.log('❌ Approach 1 failed:', contactOrderError.message);

      // APPROACH 2: Try with customer creation first
      console.log('Approach 2: Creating customer first, then order...');
      try {
        let customerId = null;
        
        // Try to find existing customer
        console.log('Searching for existing customer...');
        try {
          const existingCustomer = await findCustomerByEmail(accessToken, customerInfo.email);
          if (existingCustomer) {
            customerId = existingCustomer.customer_id;
            console.log('✅ Found existing customer:', customerId);
          }
        } catch (searchError) {
          console.log('Customer search failed, will try to create new one');
        }

        // Create customer if not found
        if (!customerId) {
          console.log('Creating new customer...');
          try {
            const newCustomer = await createCustomerRobust(accessToken, customerInfo, shippingAddress);
            customerId = newCustomer.customer_id;
            console.log('✅ Created new customer:', customerId);
          } catch (customerCreateError) {
            console.log('❌ Customer creation failed:', customerCreateError.message);
            throw new Error(`Customer creation failed: ${customerCreateError.message}`);
          }
        }

        // Create order with customer ID
        if (customerId) {
          console.log('Creating order with customer ID:', customerId);
          const customerOrderData = {
            customer_id: customerId,
            
            line_items: cartItems.map(item => ({
              item_name: item.product_name,
              item_id: item.product_id,
              quantity: item.quantity,
              rate: item.product_price,
              amount: item.product_price * item.quantity
            })),
            
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
              { label: 'Request ID', value: requestId },
              { label: 'Customer ID', value: customerId }
            ]
          };

          zohoOrder = await zohoAPI.createOrder(customerOrderData);
          orderCreationMethod = 'customer_based';
          console.log('✅ Approach 2 successful - Customer-based order created');
        }

      } catch (customerOrderError) {
        console.log('❌ Approach 2 failed:', customerOrderError.message);

        // APPROACH 3: Simplified order creation (minimal fields)
        console.log('Approach 3: Minimal order creation...');
        try {
          const minimalOrderData = {
            customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
            customer_email: customerInfo.email,
            
            line_items: cartItems.map(item => ({
              item_name: item.product_name,
              quantity: item.quantity,
              rate: item.product_price
            })),
            
            date: new Date().toISOString().split('T')[0],
            sub_total: subtotal,
            total: total
          };

          zohoOrder = await zohoAPI.createOrder(minimalOrderData);
          orderCreationMethod = 'minimal';
          console.log('✅ Approach 3 successful - Minimal order created');

        } catch (minimalOrderError) {
          console.log('❌ Approach 3 failed:', minimalOrderError.message);
          
          // All approaches failed
          throw new Error(`All order creation approaches failed. Last error: ${minimalOrderError.message}`);
        }
      }
    }

    if (!zohoOrder) {
      throw new Error('Order creation failed - no successful approach');
    }

    // Step 5: Create payment URL
    const orderId = zohoOrder.salesorder_id || zohoOrder.id;
    const orderNumber = zohoOrder.salesorder_number || zohoOrder.number || `TDW-${orderId}`;
    
    console.log(`✅ Order created successfully using ${orderCreationMethod} method:`, {
      orderId,
      orderNumber
    });

    const paymentParams = new URLSearchParams({
      order_id: orderId,
      order_number: orderNumber,
      amount: total.toString(),
      currency: 'USD',
      customer_email: customerInfo.email,
      customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
      return_url: `${req.headers.origin}/checkout/success`,
      request_id: requestId
    });

    const paymentUrl = `${req.headers.origin}/payment/invoice?${paymentParams.toString()}`;

    // Step 6: Return success response
    const successResponse = {
      success: true,
      type: 'hosted',
      checkout_url: paymentUrl,
      order_id: orderId,
      order_number: orderNumber,
      session_id: `zoho_${orderId}`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      total_amount: total,
      currency: 'USD',
      order_details: {
        subtotal,
        tax,
        shipping,
        total,
        items: cartItems.length,
        customer: `${customerInfo.firstName} ${customerInfo.lastName}`,
        creation_method: orderCreationMethod
      },
      request_id: requestId
    };

    console.log('✅ Checkout completed successfully');
    return res.status(200).json(successResponse);

  } catch (error) {
    console.error('❌ Checkout failed:', error);
    return res.status(500).json({
      error: 'Checkout processing failed',
      details: error.message || 'An unexpected error occurred',
      type: 'CHECKOUT_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString()
    });
  }
}

// Robust customer creation with multiple attempts
async function createCustomerRobust(accessToken, customerInfo, shippingAddress) {
  const customerDataVariations = [
    // Variation 1: Full customer data
    {
      customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
      email: customerInfo.email,
      phone: customerInfo.phone || '',
      first_name: customerInfo.firstName,
      last_name: customerInfo.lastName,
      
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
      
      shipping_address: {
        attention: `${customerInfo.firstName} ${customerInfo.lastName}`,
        address: shippingAddress.address1,
        street2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zipCode,
        country: 'United States',
        phone: customerInfo.phone || ''
      }
    },
    
    // Variation 2: Minimal customer data
    {
      customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
      email: customerInfo.email,
      phone: customerInfo.phone || ''
    },
    
    // Variation 3: Just name and email
    {
      customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
      email: customerInfo.email
    }
  ];

  const customerEndpoints = [
    'https://commerce.zoho.com/store/api/v1/customers',
    'https://www.zohoapis.com/commerce/v1/customers'
  ];

  // Try each combination
  for (const endpoint of customerEndpoints) {
    for (let i = 0; i < customerDataVariations.length; i++) {
      try {
        console.log(`Trying customer creation: endpoint ${endpoint}, variation ${i + 1}`);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
            'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
          },
          body: JSON.stringify(customerDataVariations[i])
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Customer created with variation ${i + 1}`);
          return data.customer || data;
        } else {
          const errorText = await response.text();
          console.log(`❌ Variation ${i + 1} failed: ${response.status} - ${errorText}`);
        }
      } catch (error) {
        console.log(`❌ Variation ${i + 1} error:`, error.message);
      }
    }
  }

  throw new Error('All customer creation attempts failed');
}

// Helper function to find customer by email
async function findCustomerByEmail(accessToken, email) {
  const searchEndpoints = [
    `https://commerce.zoho.com/store/api/v1/customers?search_text=${encodeURIComponent(email)}`,
    `https://commerce.zoho.com/store/api/v1/customers?email=${encodeURIComponent(email)}`,
    `https://www.zohoapis.com/commerce/v1/customers?search_text=${encodeURIComponent(email)}`
  ];

  for (const endpoint of searchEndpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
          'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const customers = data.customers || [];
        
        const exactMatch = customers.find(customer => 
          customer.email && customer.email.toLowerCase() === email.toLowerCase()
        );
        
        if (exactMatch) {
          return exactMatch;
        }
      }
    } catch (error) {
      console.log(`Customer search endpoint failed: ${endpoint}`);
    }
  }

  return null;
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
  } else {
    cartItems.forEach((item, index) => {
      if (!item.product_id) errors.push(`Item ${index + 1}: Product ID is missing`);
      if (!item.product_name) errors.push(`Item ${index + 1}: Product name is missing`);
      if (!item.quantity || item.quantity < 1) errors.push(`Item ${index + 1}: Invalid quantity`);
      if (!item.product_price || item.product_price < 0) errors.push(`Item ${index + 1}: Invalid price`);
    });
  }

  return errors;
}