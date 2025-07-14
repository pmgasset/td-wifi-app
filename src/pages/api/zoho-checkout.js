// ===== src/pages/api/zoho-checkout.js ===== (DEBUG VERSION TO FIND THE EXACT ERROR)
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== ZOHO CHECKOUT DEBUG [${requestId}] ===`);
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      requestId 
    });
  }

  try {
    console.log('\n--- STEP 1: PARSING REQUEST BODY ---');
    const { customerInfo, shippingAddress, cartItems, orderNotes } = req.body;
    
    console.log('Request body keys:', Object.keys(req.body || {}));
    console.log('Customer info:', customerInfo ? {
      email: customerInfo.email,
      firstName: customerInfo.firstName,
      lastName: customerInfo.lastName,
      hasPhone: !!customerInfo.phone
    } : 'MISSING');
    
    console.log('Shipping address:', shippingAddress ? {
      city: shippingAddress.city,
      state: shippingAddress.state,
      zipCode: shippingAddress.zipCode,
      hasAddress1: !!shippingAddress.address1
    } : 'MISSING');
    
    console.log('Cart items:', cartItems ? {
      count: cartItems.length,
      firstItem: cartItems[0] ? {
        id: cartItems[0].product_id,
        name: cartItems[0].product_name,
        price: cartItems[0].product_price,
        quantity: cartItems[0].quantity
      } : 'NO ITEMS'
    } : 'MISSING');

    console.log('\n--- STEP 2: VALIDATION ---');
    const validationErrors = validateCheckoutData({ customerInfo, shippingAddress, cartItems });
    console.log('Validation errors:', validationErrors);
    
    if (validationErrors.length > 0) {
      console.log('❌ Validation failed, returning 400');
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
        requestId
      });
    }
    console.log('✅ Validation passed');

    console.log('\n--- STEP 3: CALCULATING TOTALS ---');
    const subtotal = cartItems.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
    const tax = Math.round(subtotal * 0.0875 * 100) / 100;
    const shipping = subtotal >= 100 ? 0 : 9.99;
    const total = subtotal + tax + shipping;

    console.log('Order totals calculated:', { subtotal, tax, shipping, total });

    console.log('\n--- STEP 4: ZOHO AUTHENTICATION ---');
    let accessToken;
    try {
      console.log('Attempting to get Zoho access token...');
      accessToken = await zohoAPI.getAccessToken();
      console.log('✅ Authentication successful, token length:', accessToken?.length || 0);
    } catch (authError) {
      console.error('❌ Authentication failed:', {
        message: authError.message,
        name: authError.name,
        stack: authError.stack?.split('\n').slice(0, 3)
      });
      return res.status(500).json({
        error: 'Authentication failed',
        details: authError.message,
        type: 'AUTH_ERROR',
        requestId
      });
    }

    console.log('\n--- STEP 5: SIMPLE ORDER CREATION TEST ---');
    // Let's try the simplest possible order creation first
    try {
      console.log('Attempting simple order creation...');
      
      const simpleOrderData = {
        customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        customer_email: customerInfo.email,
        date: new Date().toISOString().split('T')[0],
        line_items: cartItems.map(item => ({
          item_name: item.product_name,
          quantity: item.quantity,
          rate: item.product_price
        })),
        sub_total: subtotal,
        total: total
      };

      console.log('Simple order data:', JSON.stringify(simpleOrderData, null, 2));
      
      console.log('Calling zohoAPI.createOrder...');
      const zohoOrder = await zohoAPI.createOrder(simpleOrderData);
      
      console.log('✅ Order created successfully:', {
        orderId: zohoOrder.salesorder_id || zohoOrder.id,
        orderNumber: zohoOrder.salesorder_number || zohoOrder.number,
        responseKeys: Object.keys(zohoOrder)
      });

      // Create payment URL
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
      console.log('Payment URL created:', paymentUrl);

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
          customer: `${customerInfo.firstName} ${customerInfo.lastName}`
        },
        request_id: requestId
      };

      console.log('✅ Sending success response');
      return res.status(200).json(successResponse);

    } catch (orderError) {
      console.error('❌ Order creation failed:', {
        message: orderError.message,
        name: orderError.name,
        stack: orderError.stack?.split('\n').slice(0, 5)
      });

      // Try to get more details about the error
      if (orderError.response) {
        try {
          const errorResponse = await orderError.response.text();
          console.error('Order creation error response:', errorResponse);
        } catch (responseError) {
          console.error('Could not read error response:', responseError.message);
        }
      }

      return res.status(500).json({
        error: 'Order creation failed',
        details: orderError.message,
        type: 'ORDER_ERROR',
        requestId,
        debug: {
          errorName: orderError.name,
          hasResponse: !!orderError.response,
          stack: orderError.stack?.split('\n').slice(0, 3)
        }
      });
    }

  } catch (error) {
    console.error('❌ CATASTROPHIC CHECKOUT ERROR:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5)
    });
    
    return res.status(500).json({
      error: 'Checkout processing failed',
      details: error.message || 'Unknown error occurred',
      type: 'INTERNAL_ERROR',
      request_id: requestId,
      timestamp: new Date().toISOString(),
      debug: {
        errorName: error.name,
        nodeEnv: process.env.NODE_ENV,
        hasZohoAPI: typeof zohoAPI !== 'undefined'
      }
    });
  }
}

// Validation helper function
function validateCheckoutData({ customerInfo, shippingAddress, cartItems }) {
  const errors = [];

  console.log('Validating customer info...');
  if (!customerInfo) {
    errors.push('Customer information is missing');
    return errors;
  }

  if (!customerInfo.email) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
    errors.push('Please enter a valid email address');
  }
  
  if (!customerInfo.firstName) errors.push('First name is required');
  if (!customerInfo.lastName) errors.push('Last name is required');
  
  console.log('Validating shipping address...');
  if (!shippingAddress) {
    errors.push('Shipping address is missing');
    return errors;
  }

  if (!shippingAddress.address1) errors.push('Street address is required');
  if (!shippingAddress.city) errors.push('City is required');
  if (!shippingAddress.state) errors.push('State is required');
  if (!shippingAddress.zipCode) errors.push('ZIP code is required');
  
  if (shippingAddress.zipCode && !/^\d{5}(-\d{4})?$/.test(shippingAddress.zipCode)) {
    errors.push('Please enter a valid ZIP code');
  }
  
  console.log('Validating cart items...');
  if (!cartItems) {
    errors.push('Cart items are missing');
    return errors;
  }

  if (cartItems.length === 0) {
    errors.push('Cart is empty');
  } else {
    cartItems.forEach((item, index) => {
      if (!item.product_id) errors.push(`Item ${index + 1}: Product ID is missing`);
      if (!item.product_name) errors.push(`Item ${index + 1}: Product name is missing`);
      if (!item.quantity || item.quantity < 1) errors.push(`Item ${index + 1}: Invalid quantity`);
      if (typeof item.product_price !== 'number' || item.product_price < 0) {
        errors.push(`Item ${index + 1}: Invalid price (${typeof item.product_price}): ${item.product_price}`);
      }
    });
  }

  console.log(`Validation complete: ${errors.length} errors found`);
  return errors;
}