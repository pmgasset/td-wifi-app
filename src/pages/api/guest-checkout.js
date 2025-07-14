// ===== src/pages/api/guest-checkout.js ===== (CREATE THIS FILE)
import { zohoAPI } from '../../lib/zoho-api-guest';

export default async function handler(req, res) {
  const requestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== GUEST-ONLY CHECKOUT [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    const { customerInfo, shippingAddress, cartItems, orderNotes } = req.body;
    
    console.log('Processing guest checkout for:', customerInfo?.email);

    // Validate input
    if (!customerInfo?.email || !customerInfo?.firstName || !customerInfo?.lastName) {
      return res.status(400).json({
        error: 'Missing customer information',
        details: ['Email, first name, and last name are required'],
        requestId
      });
    }

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        error: 'Cart is empty',
        details: ['Please add items to your cart'],
        requestId
      });
    }

    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
    const tax = Math.round(subtotal * 0.0875 * 100) / 100;
    const shipping = subtotal >= 100 ? 0 : 9.99;
    const total = subtotal + tax + shipping;

    console.log('Order totals:', { subtotal, tax, shipping, total });

    // ✅ CRITICAL: Create order data WITHOUT any customer_id fields
    const orderData = {
      // Customer information (but NO customer_id field)
      customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
      customer_email: customerInfo.email,
      customer_phone: customerInfo.phone || '',
      
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
      
      // ✅ IMPORTANT: Include shipping address directly in order
      shipping_address: {
        attention: `${customerInfo.firstName} ${customerInfo.lastName}`,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zipCode,
        country: shippingAddress.country || 'US',
        phone: customerInfo.phone || ''
      },
      
      // Billing address (same as shipping for most cases)
      billing_address: {
        attention: `${customerInfo.firstName} ${customerInfo.lastName}`,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zipCode,
        country: shippingAddress.country || 'US',
        phone: customerInfo.phone || ''
      },
      
      // Metadata
      custom_fields: [
        { label: 'Source', value: 'Travel Data WiFi Website' },
        { label: 'Request ID', value: requestId },
        { label: 'Order Type', value: 'Guest Order' },
        { label: 'API Version', value: 'Guest-Only v1.0' }
      ]
    };

    console.log('✅ Creating GUEST order (NO customer_id):', JSON.stringify(orderData, null, 2));

    // ✅ CRITICAL: Verify no customer_id is present
    if ('customer_id' in orderData) {
      console.error('❌ CRITICAL ERROR: customer_id found in order data!');
      delete orderData.customer_id;
      console.log('✅ Removed customer_id from order data');
    }

    // Create order in Zoho (should work without customer_id)
    const zohoOrder = await zohoAPI.createOrder(orderData);
    
    console.log('✅ Guest order created successfully:', {
      orderId: zohoOrder.salesorder_id || zohoOrder.id,
      orderNumber: zohoOrder.salesorder_number || zohoOrder.number
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
      customer_type: 'guest',
      return_url: `${req.headers.origin}/checkout/success`,
      request_id: requestId
    });

    const paymentUrl = `${req.headers.origin}/payment/invoice?${paymentParams.toString()}`;

    // Return success response
    const successResponse = {
      success: true,
      type: 'guest_checkout',
      checkout_url: paymentUrl,
      
      // Order details
      order_id: orderId,
      order_number: orderNumber,
      session_id: `guest_${orderId}`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      
      // Customer details
      customer_created: false,
      customer_id: null,
      customer_type: 'guest',
      
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
        '✅ Guest order created successfully (no customer_id)',
        '✅ All customer information included in order directly',
        '✅ Shipping and billing addresses included',
        '✅ Payment URL generated successfully'
      ]
    };

    console.log('✅ Guest checkout completed successfully');
    console.log('Process summary:', {
      orderType: 'guest',
      orderId: orderId,
      total: total,
      hasCustomerId: false
    });

    return res.status(200).json(successResponse);

  } catch (error) {
    console.error('❌ Guest checkout failed:', error);
    
    // Enhanced error response
    return res.status(500).json({
      error: 'Guest checkout processing failed',
      details: error.message || 'An unexpected error occurred',
      type: 'GUEST_CHECKOUT_ERROR',
      
      // Additional debugging information
      error_context: {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n')[0],
        hasCustomerId: error.message?.includes('customer ID'),
        isGuestOrder: true
      },
      
      request_id: requestId,
      timestamp: new Date().toISOString(),
      
      // Suggestions for debugging
      debug_suggestions: [
        'Verify order data contains no customer_id field',
        'Check that all required fields are present',
        'Ensure shipping_address format is correct',
        'Review Zoho API response for additional error details'
      ]
    });
  }
}