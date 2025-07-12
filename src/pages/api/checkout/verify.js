// ===== src/pages/api/checkout/verify.js =====
import { zohoAPI } from '../../../lib/zoho-api';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { session_id, order_id, payment_intent } = req.body;

    if (!session_id && !order_id) {
      return res.status(400).json({ 
        error: 'Session ID or Order ID is required' 
      });
    }

    console.log('Verifying checkout session:', { session_id, order_id });

    let orderData;

    if (session_id) {
      // Verify the checkout session with Zoho
      const sessionResponse = await zohoAPI.apiRequest(`/checkout_sessions/${session_id}`);
      
      if (sessionResponse.status !== 'complete') {
        return res.status(400).json({
          error: 'Checkout session not completed',
          status: sessionResponse.status
        });
      }

      // Get the order details from the completed session
      orderData = await zohoAPI.apiRequest(`/orders/${sessionResponse.order_id}`);
    } else if (order_id) {
      // Direct order lookup
      orderData = await zohoAPI.apiRequest(`/orders/${order_id}`);
    }

    // Format the response for the frontend
    const formattedOrder = {
      orderNumber: orderData.order_number || `TDW-${orderData.order_id}`,
      orderId: orderData.order_id,
      status: orderData.status,
      total: orderData.total_amount || orderData.total,
      currency: orderData.currency || 'USD',
      orderDate: orderData.created_at || new Date().toISOString(),
      paymentMethod: orderData.payment_method?.type || 'Credit Card',
      last4: orderData.payment_method?.last4 || '****',
      
      // Customer information
      customer: {
        email: orderData.customer?.email,
        firstName: orderData.customer?.first_name,
        lastName: orderData.customer?.last_name,
        phone: orderData.customer?.phone
      },
      
      // Items
      items: orderData.line_items?.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name || item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.quantity * item.price,
        product_images: item.product_images || ['/images/placeholder.jpg']
      })) || [],
      
      // Addresses
      shippingAddress: orderData.shipping_address,
      billingAddress: orderData.billing_address,
      
      // Fulfillment info
      estimatedDelivery: calculateEstimatedDelivery(orderData.shipping_address),
      trackingNumber: orderData.tracking_number,
      shippingCarrier: orderData.shipping_carrier,
      
      // Zoho-specific
      zohoOrderUrl: `${process.env.ZOHO_COMMERCE_URL}/orders/${orderData.order_id}`,
      
      // Order breakdown
      subtotal: orderData.subtotal_amount || orderData.subtotal,
      taxAmount: orderData.tax_amount || orderData.tax,
      shippingAmount: orderData.shipping_amount || orderData.shipping,
      discountAmount: orderData.discount_amount || 0
    };

    console.log('Order verification successful:', {
      orderNumber: formattedOrder.orderNumber,
      total: formattedOrder.total,
      status: formattedOrder.status
    });

    return res.status(200).json(formattedOrder);

  } catch (error) {
    console.error('Order verification failed:', error);
    
    // Return a graceful error response
    return res.status(500).json({
      error: 'Failed to verify order',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Calculate estimated delivery date
function calculateEstimatedDelivery(shippingAddress) {
  if (!shippingAddress) return null;
  
  // Business days based on location
  let businessDays = 3; // Default
  
  if (['CA', 'NY', 'TX', 'FL', 'WA', 'IL'].includes(shippingAddress.state)) {
    businessDays = 2; // Expedited for major states
  }
  
  // Calculate delivery date (skip weekends)
  const deliveryDate = new Date();
  let daysAdded = 0;
  
  while (daysAdded < businessDays) {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
    
    // Skip weekends
    if (deliveryDate.getDay() !== 0 && deliveryDate.getDay() !== 6) {
      daysAdded++;
    }
  }
  
  return deliveryDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}