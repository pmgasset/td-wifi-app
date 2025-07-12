// ===== src/pages/api/checkout/verify.js =====
import { zohoAPI } from '../../../lib/zoho-api';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== VERIFYING CHECKOUT COMPLETION ===');
    
    const { session_id, order_id, payment_intent } = req.body;

    if (!session_id && !order_id && !payment_intent) {
      return res.status(400).json({ 
        error: 'Missing verification parameters',
        details: 'Either session_id, order_id, or payment_intent is required'
      });
    }

    let orderData = null;
    let verificationMethod = '';

    // Method 1: Verify using Zoho checkout session ID
    if (session_id) {
      try {
        console.log('Verifying using Zoho checkout session ID:', session_id);
        
        const sessionResponse = await zohoAPI.apiRequest(`/checkout_sessions/${session_id}`);
        
        if (sessionResponse.status === 'completed') {
          orderData = await zohoAPI.apiRequest(`/orders/${sessionResponse.order_id}`);
          verificationMethod = 'session_id';
          console.log('✓ Order verified via session ID');
        } else {
          throw new Error(`Checkout session status: ${sessionResponse.status}`);
        }
      } catch (error) {
        console.log('Session ID verification failed:', error.message);
      }
    }

    // Method 2: Verify using direct order ID
    if (!orderData && order_id) {
      try {
        console.log('Verifying using order ID:', order_id);
        
        orderData = await zohoAPI.apiRequest(`/orders/${order_id}`);
        
        // Check if order is paid and confirmed
        if (orderData.payment_status === 'paid') {
          verificationMethod = 'order_id';
          console.log('✓ Order verified via order ID');
        } else {
          throw new Error(`Order payment status: ${orderData.payment_status}`);
        }
      } catch (error) {
        console.log('Order ID verification failed:', error.message);
      }
    }

    // Method 3: Verify using payment intent (for Stripe/external processors)
    if (!orderData && payment_intent) {
      try {
        console.log('Verifying using payment intent:', payment_intent);
        
        // Look up order by payment intent
        const ordersResponse = await zohoAPI.apiRequest(`/orders?payment_intent=${payment_intent}`);
        
        if (ordersResponse.orders && ordersResponse.orders.length > 0) {
          orderData = ordersResponse.orders[0];
          verificationMethod = 'payment_intent';
          console.log('✓ Order verified via payment intent');
        } else {
          throw new Error('No order found for payment intent');
        }
      } catch (error) {
        console.log('Payment intent verification failed:', error.message);
      }
    }

    // If no verification method worked
    if (!orderData) {
      return res.status(404).json({
        error: 'Order not found or not verified',
        details: 'Unable to verify order with provided parameters'
      });
    }

    // Transform Zoho order data to our expected format
    const transformedOrder = {
      orderId: orderData.order_id || orderData.id,
      orderNumber: orderData.order_number || `TDW-${orderData.order_id}`,
      orderDate: orderData.created_at || orderData.order_date || new Date().toISOString(),
      
      // Customer information
      customer: {
        email: orderData.customer?.email || orderData.billing_address?.email,
        firstName: orderData.customer?.first_name || orderData.billing_address?.first_name,
        lastName: orderData.customer?.last_name || orderData.billing_address?.last_name,
        phone: orderData.customer?.phone || orderData.billing_address?.phone
      },
      
      // Order totals
      subtotal: orderData.subtotal_price || orderData.subtotal || 0,
      tax: orderData.total_tax || orderData.tax_amount || 0,
      shipping: orderData.shipping_amount || orderData.total_shipping || 0,
      total: orderData.total_price || orderData.order_total || orderData.total || 0,
      
      // Payment information
      paymentStatus: orderData.payment_status || 'unknown',
      paymentMethod: getPaymentMethodDisplay(orderData),
      last4: extractLast4(orderData),
      
      // Order status
      orderStatus: orderData.fulfillment_status || orderData.order_status || 'pending',
      
      // Items
      items: transformOrderItems(orderData.line_items || orderData.order_items || []),
      
      // Addresses
      shippingAddress: orderData.shipping_address || {},
      billingAddress: orderData.billing_address || {},
      
      // Additional data
      orderNotes: orderData.notes || orderData.order_notes || '',
      trackingNumber: orderData.tracking_number || null,
      trackingUrl: orderData.tracking_url || null,
      
      // Zoho-specific data
      zohoOrderUrl: `https://commerce.zoho.com/store/orders/${orderData.order_id}`,
      verificationMethod: verificationMethod,
      
      // Estimated delivery
      estimatedDelivery: calculateEstimatedDelivery(orderData)
    };

    // Log successful verification
    console.log('Order verification successful:', {
      orderId: transformedOrder.orderId,
      method: verificationMethod,
      status: transformedOrder.paymentStatus
    });

    // Return the transformed order data
    res.status(200).json({
      success: true,
      ...transformedOrder,
      verifiedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Checkout verification error:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    
    res.status(500).json({
      error: 'Verification failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Helper function to get payment method display name
function getPaymentMethodDisplay(orderData) {
  if (orderData.payment_method) {
    return orderData.payment_method;
  }
  
  if (orderData.payment_gateway) {
    switch (orderData.payment_gateway.toLowerCase()) {
      case 'stripe':
        return 'Credit Card (Stripe)';
      case 'paypal':
        return 'PayPal';
      case 'square':
        return 'Credit Card (Square)';
      default:
        return 'Credit Card';
    }
  }
  
  return 'Credit Card';
}

// Helper function to extract last 4 digits of payment method
function extractLast4(orderData) {
  // Look for last 4 in various possible fields
  if (orderData.payment_details?.last4) {
    return orderData.payment_details.last4;
  }
  
  if (orderData.card_last4) {
    return orderData.card_last4;
  }
  
  if (orderData.payment_method_details?.card?.last4) {
    return orderData.payment_method_details.card.last4;
  }
  
  return null;
}

// Helper function to transform order items
function transformOrderItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  
  return items.map(item => ({
    product_id: item.product_id || item.id,
    product_name: item.product_name || item.name || item.title,
    quantity: item.quantity || 1,
    price: item.price || item.unit_price || 0,
    total: (item.quantity || 1) * (item.price || item.unit_price || 0),
    product_images: item.product_images || ['/images/placeholder.jpg'],
    sku: item.sku || null,
    variant: item.variant_title || null
  }));
}

// Helper function to calculate estimated delivery
function calculateEstimatedDelivery(orderData) {
  // If Zoho provides estimated delivery, use it
  if (orderData.estimated_delivery_date) {
    return {
      date: orderData.estimated_delivery_date,
      businessDays: null
    };
  }
  
  // Calculate based on shipping method or default
  const shippingMethod = orderData.shipping_method || 'standard';
  let businessDays = 3; // Default
  
  switch (shippingMethod.toLowerCase()) {
    case 'express':
    case 'expedited':
      businessDays = 1;
      break;
    case 'priority':
      businessDays = 2;
      break;
    case 'standard':
    default:
      businessDays = 3;
      break;
  }
  
  // Calculate delivery date (excluding weekends)
  const orderDate = new Date(orderData.created_at || Date.now());
  const deliveryDate = new Date(orderDate);
  
  let addedDays = 0;
  while (addedDays < businessDays) {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
    // Skip weekends
    if (deliveryDate.getDay() !== 0 && deliveryDate.getDay() !== 6) {
      addedDays++;
    }
  }
  
  return {
    date: deliveryDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    businessDays: businessDays
  };
}