// ===== src/pages/api/checkout.js =====
import { zohoAPI } from '../../lib/zoho-api.ts';
import { zohoBillingAPI } from '../../lib/zoho-billing-api.ts';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Processing checkout request...');
    
    const {
      customerInfo,
      shippingAddress,
      billingAddress,
      cartItems,
      paymentMethod,
      orderNotes
    } = req.body;

    // Validate required fields
    const validationErrors = validateCheckoutData({
      customerInfo,
      shippingAddress,
      cartItems
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Retrieve any existing subscription info for the customer
    const billingInfo = await zohoBillingAPI.getSubscription(customerInfo.email).catch(() => null);

    // Calculate order totals
    const subtotal = cartItems.reduce((sum, item) => 
      sum + (item.product_price * item.quantity), 0
    );
    
    const tax = calculateTax(subtotal, shippingAddress.state);
    const shipping = calculateShipping(cartItems, shippingAddress);
    const total = subtotal + tax + shipping;

    // Prepare order data for Zoho Commerce
    const zohoOrderData = {
      customer_email: customerInfo.email,
      customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
      customer_phone: customerInfo.phone || '',
      
      order_items: cartItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.product_price,
        product_name: item.product_name
      })),
      
      order_total: total,
      subtotal: subtotal,
      tax_amount: tax,
      shipping_amount: shipping,
      
      shipping_address: {
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zipCode,
        country: shippingAddress.country || 'US',
        phone: customerInfo.phone || ''
      },
      
      billing_address: billingAddress.sameAsShipping ? {
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zipCode,
        country: shippingAddress.country || 'US',
        phone: customerInfo.phone || ''
      } : {
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        address1: billingAddress.address1,
        address2: billingAddress.address2 || '',
        city: billingAddress.city,
        state: billingAddress.state,
        zip: billingAddress.zipCode,
        country: billingAddress.country || 'US',
        phone: customerInfo.phone || ''
      },
      
      payment_method: paymentMethod.type || 'credit_card',
      payment_status: 'pending',
      order_status: 'pending',
      order_notes: orderNotes || '',
      
      // Add timestamp and source
      order_date: new Date().toISOString(),
      order_source: 'website',
      
      // Customer notes
      special_instructions: orderNotes || ''
    };

    console.log('Creating order in Zoho Commerce...');
    
    // Create order in Zoho Commerce
    const zohoOrder = await zohoAPI.createOrder(zohoOrderData);
    
    console.log('Order created successfully:', zohoOrder.order_id || zohoOrder.id);

    // For this demo, we'll simulate payment processing
    // In production, integrate with Stripe, PayPal, etc.
    const paymentResult = await processPayment({
      amount: total,
      currency: 'USD',
      paymentMethod: paymentMethod,
      customerEmail: customerInfo.email,
      orderId: zohoOrder.order_id || zohoOrder.id
    });

    if (!paymentResult.success) {
      // If payment fails, you might want to update the order status
      console.error('Payment failed:', paymentResult.error);
      return res.status(400).json({
        error: 'Payment processing failed',
        details: paymentResult.error,
        orderId: zohoOrder.order_id || zohoOrder.id
      });
    }

    // Send confirmation email (implement this based on your email service)
    try {
      await sendOrderConfirmationEmail({
        customerEmail: customerInfo.email,
        customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
        orderId: zohoOrder.order_id || zohoOrder.id,
        orderItems: cartItems,
        orderTotal: total,
        shippingAddress
      });
      console.log('Confirmation email sent');
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the order for email issues
    }

    // Return success response
    res.status(200).json({
      success: true,
      orderId: zohoOrder.order_id || zohoOrder.id,
      orderNumber: zohoOrder.order_number || zohoOrder.order_id,
      total: total,
      paymentId: paymentResult.paymentId,
      message: 'Order placed successfully!',
      estimatedDelivery: calculateEstimatedDelivery(shippingAddress),
      trackingInfo: {
        available: false,
        message: 'Tracking information will be available once your order ships'
      },
      billing: billingInfo
    });

  } catch (error) {
    console.error('Checkout API Error:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    
    res.status(500).json({
      error: 'Checkout processing failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Validation helper
function validateCheckoutData({ customerInfo, shippingAddress, cartItems }) {
  const errors = [];

  // Validate customer info
  if (!customerInfo?.email) errors.push('Email is required');
  if (!customerInfo?.firstName) errors.push('First name is required');
  if (!customerInfo?.lastName) errors.push('Last name is required');
  
  // Basic email validation
  if (customerInfo?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
    errors.push('Valid email address is required');
  }

  // Validate shipping address
  if (!shippingAddress?.address1) errors.push('Shipping address is required');
  if (!shippingAddress?.city) errors.push('City is required');
  if (!shippingAddress?.state) errors.push('State is required');
  if (!shippingAddress?.zipCode) errors.push('ZIP code is required');

  // Validate ZIP code format (basic US format)
  if (shippingAddress?.zipCode && !/^\d{5}(-\d{4})?$/.test(shippingAddress.zipCode)) {
    errors.push('Valid ZIP code is required (e.g., 12345 or 12345-6789)');
  }

  // Validate cart items
  if (!cartItems || cartItems.length === 0) {
    errors.push('Cart is empty');
  } else {
    cartItems.forEach((item, index) => {
      if (!item.product_id) errors.push(`Cart item ${index + 1}: Product ID is required`);
      if (!item.quantity || item.quantity <= 0) errors.push(`Cart item ${index + 1}: Valid quantity is required`);
      if (!item.product_price || item.product_price <= 0) errors.push(`Cart item ${index + 1}: Valid price is required`);
    });
  }

  return errors;
}

// Tax calculation (simplified - in production, use a tax service)
function calculateTax(subtotal, state) {
  const taxRates = {
    'CA': 0.0875, // California
    'NY': 0.08,   // New York
    'TX': 0.0625, // Texas
    'FL': 0.06,   // Florida
    'WA': 0.065,  // Washington
    // Add more states as needed
  };

  const rate = taxRates[state] || 0.05; // Default 5% for other states
  return Math.round(subtotal * rate * 100) / 100;
}

// Shipping calculation (simplified)
function calculateShipping(cartItems, shippingAddress) {
  const totalWeight = cartItems.reduce((weight, item) => weight + (item.quantity * 2), 0); // Assume 2 lbs per item
  const baseShipping = 9.99;
  const weightShipping = Math.max(0, (totalWeight - 5) * 2); // $2 per lb over 5 lbs
  
  // Free shipping over $100
  const subtotal = cartItems.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
  if (subtotal >= 100) return 0;
  
  return Math.round((baseShipping + weightShipping) * 100) / 100;
}

// Calculate estimated delivery
function calculateEstimatedDelivery(shippingAddress) {
  const businessDays = 3; // Standard shipping
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + businessDays);
  
  return {
    estimatedDays: businessDays,
    estimatedDate: deliveryDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  };
}

// Payment processing simulation (replace with real payment processor)
async function processPayment({ amount, currency, paymentMethod, customerEmail, orderId }) {
  // This is a simulation - integrate with Stripe, PayPal, Square, etc.
  console.log('Processing payment...', { amount, currency, orderId });
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simulate success (in production, this would be real payment processing)
  if (Math.random() > 0.05) { // 95% success rate for demo
    return {
      success: true,
      paymentId: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transactionId: `txn_${orderId}_${Date.now()}`
    };
  } else {
    return {
      success: false,
      error: 'Payment was declined. Please check your payment information and try again.'
    };
  }
}

// Email sending simulation (replace with real email service)
async function sendOrderConfirmationEmail({ customerEmail, customerName, orderId, orderItems, orderTotal, shippingAddress }) {
  // This is a simulation - integrate with SendGrid, Mailgun, AWS SES, etc.
  console.log('Sending confirmation email to:', customerEmail);
  console.log('Order details:', { orderId, orderTotal, itemCount: orderItems.length });
  
  // In production, you would:
  // 1. Generate HTML email template
  // 2. Include order details, items, shipping info
  // 3. Send via your email service
  // 4. Return success/failure result
  
  return Promise.resolve({ success: true });
}