// ===== src/pages/api/zoho-checkout.js ===== (SIMPLE WORKING VERSION)
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`\n=== SIMPLE ZOHO CHECKOUT [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    const { customerInfo, shippingAddress, cartItems, orderNotes } = req.body;
    
    console.log('Processing checkout for:', customerInfo?.email);

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

    // Create order data (NO customer_id field!)
    const orderData = {
      customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
      customer_email: customerInfo.email,
      customer_phone: customerInfo.phone || '',
      
      line_items: cartItems.map(item => ({
        item_name: item.product_name,
        quantity: item.quantity,
        rate: item.product_price,
        amount: item.product_price * item.quantity
      })),
      
      date: new Date().toISOString().split('T')[0],
      
      sub_total: subtotal,
      tax_total: tax,
      shipping_charge: shipping,
      total: total,
      
      notes: orderNotes || '',
      
      // TEMPORARILY REMOVE shipping_address to get order working
      // We'll add it back once order creation is successful
      
      custom_fields: [
        { label: 'Source', value: 'Travel Data WiFi Website' },
        { label: 'Request ID', value: requestId }
      ]
    };

    console.log('Creating order with data (NO customer_id):', JSON.stringify(orderData, null, 2));

    // Create order in Zoho
    const zohoOrder = await zohoAPI.createOrder(orderData);
    
    console.log('✅ Order created successfully:', {
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
      return_url: `${req.headers.origin}/checkout/success`,
      request_id: requestId
    });

    const paymentUrl = `${req.headers.origin}/payment/invoice?${paymentParams.toString()}`;

    // Return success response
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

    console.log('✅ Checkout successful');
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