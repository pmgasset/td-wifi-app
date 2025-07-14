// ===== src/pages/api/zoho-checkout.js ===== (FINAL WORKING VERSION)
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

    // Step 4: Create or find customer in Zoho
    console.log('Creating/finding customer in Zoho...');
    let customerId;
    try {
      // First, try to find existing customer
      console.log('Searching for existing customer...');
      const existingCustomer = await findCustomerByEmail(accessToken, customerInfo.email);
      
      if (existingCustomer) {
        customerId = existingCustomer.customer_id;
        console.log('✅ Found existing customer:', customerId);
      } else {
        // Create new customer
        console.log('Creating new customer...');
        const newCustomer = await createCustomer(accessToken, customerInfo, shippingAddress);
        customerId = newCustomer.customer_id;
        console.log('✅ Created new customer:', customerId);
      }
    } catch (customerError) {
      console.error('❌ Customer creation/lookup failed:', customerError.message);
      return res.status(500).json({
        error: 'Customer creation failed',
        details: 'Unable to create customer record in Zoho',
        type: 'CUSTOMER_ERROR',
        requestId
      });
    }

    // Step 5: Create order in Zoho Commerce
    console.log('Creating order with customer ID:', customerId);
    
    const orderData = {
      customer_id: customerId, // ✅ This is the key fix!
      
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

    let zohoOrder;
    try {
      zohoOrder = await zohoAPI.createOrder(orderData);
      console.log('✅ Order created successfully:', {
        orderId: zohoOrder.salesorder_id || zohoOrder.id,
        orderNumber: zohoOrder.salesorder_number || zohoOrder.number
      });
    } catch (orderError) {
      console.error('❌ Order creation failed:', orderError.message);
      return res.status(500).json({
        error: 'Order creation failed',
        details: orderError.message,
        type: 'ORDER_ERROR',
        requestId
      });
    }

    // Step 6: Create payment URL
    const orderId = zohoOrder.salesorder_id || zohoOrder.id;
    const orderNumber = zohoOrder.salesorder_number || zohoOrder.number || `TDW-${orderId}`;
    
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

    // Step 7: Return success response
    const successResponse = {
      success: true,
      type: 'hosted',
      checkout_url: paymentUrl,
      order_id: orderId,
      order_number: orderNumber,
      customer_id: customerId,
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
        customer: `${customerInfo.firstName} ${customerInfo.lastName}`
      },
      request_id: requestId
    };

    console.log('✅ Checkout completed successfully');
    return res.status(200).json(successResponse);

  } catch (error) {
    console.error('❌ Checkout failed:', error);
    return res.status(500).json({
      error: 'Checkout processing failed',
      details: 'An unexpected error occurred',
      type: 'INTERNAL_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString()
    });
  }
}

// Helper function to find customer by email
async function findCustomerByEmail(accessToken, email) {
  try {
    const response = await fetch(`https://commerce.zoho.com/store/api/v1/customers?search_text=${encodeURIComponent(email)}`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
      },
    });

    if (!response.ok) {
      console.log('Customer search failed:', response.status);
      return null;
    }

    const data = await response.json();
    const customers = data.customers || [];
    
    // Find exact email match
    const exactMatch = customers.find(customer => 
      customer.email && customer.email.toLowerCase() === email.toLowerCase()
    );
    
    return exactMatch || null;
  } catch (error) {
    console.error('Customer search error:', error);
    return null;
  }
}

// Helper function to create customer
async function createCustomer(accessToken, customerInfo, shippingAddress) {
  const customerData = {
    customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
    email: customerInfo.email,
    phone: customerInfo.phone || '',
    
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
  };

  const response = await fetch('https://commerce.zoho.com/store/api/v1/customers', {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
      'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
    },
    body: JSON.stringify(customerData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Customer creation failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.customer || data;
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