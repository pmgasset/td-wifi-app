// ===== src/pages/api/zoho-webhook.js =====
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== ZOHO COMMERCE WEBHOOK RECEIVED ===');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));

    const {
      event_type,
      event_id,
      order_id,
      payment_id,
      customer_id,
      data,
      timestamp
    } = req.body;

    // Verify webhook authenticity (if Zoho provides signature verification)
    const isValidWebhook = await verifyZohoWebhook(req);
    if (!isValidWebhook) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // Handle different event types
    switch (event_type) {
      case 'order.created':
        await handleOrderCreated(data);
        break;
      
      case 'order.updated':
        await handleOrderUpdated(data);
        break;
      
      case 'payment.succeeded':
        await handlePaymentSucceeded(data);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(data);
        break;
      
      case 'order.shipped':
        await handleOrderShipped(data);
        break;
      
      case 'order.delivered':
        await handleOrderDelivered(data);
        break;
      
      case 'order.cancelled':
        await handleOrderCancelled(data);
        break;
      
      case 'inventory.updated':
        await handleInventoryUpdated(data);
        break;
      
      default:
        console.log(`Unhandled event type: ${event_type}`);
    }

    // Log the webhook event
    await logWebhookEvent({
      event_id,
      event_type,
      order_id,
      payment_id,
      processed_at: new Date().toISOString(),
      data
    });

    // Acknowledge the webhook
    res.status(200).json({
      success: true,
      event_id,
      processed_at: new Date().toISOString(),
      message: `Event ${event_type} processed successfully`
    });

  } catch (error) {
    console.error('Zoho webhook processing error:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    
    res.status(500).json({
      error: 'Webhook processing failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Verify webhook authenticity
async function verifyZohoWebhook(req) {
  try {
    // Zoho should provide a signature in headers for verification
    const signature = req.headers['x-zoho-signature'] || req.headers['zoho-signature'];
    
    if (!signature) {
      console.warn('No webhook signature provided');
      return true; // For now, accept unsigned webhooks in development
    }

    // In production, verify the signature using Zoho's webhook secret
    const webhookSecret = process.env.ZOHO_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('ZOHO_WEBHOOK_SECRET not configured');
      return true; // Accept in development
    }

    // Implement signature verification based on Zoho's documentation
    // This typically involves HMAC verification
    const crypto = require('crypto');
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Webhook verification error:', error);
    return false;
  }
}

// Handle order created event
async function handleOrderCreated(orderData) {
  console.log('Processing order created event:', orderData.order_id);
  
  try {
    // Send order confirmation email
    await sendOrderConfirmationEmail({
      orderId: orderData.order_id,
      customerEmail: orderData.customer.email,
      customerName: `${orderData.customer.first_name} ${orderData.customer.last_name}`,
      orderTotal: orderData.total_price,
      items: orderData.line_items
    });

    // Update internal systems (inventory, CRM, etc.)
    await updateInternalSystems('order_created', orderData);

    console.log('Order created event processed successfully');
  } catch (error) {
    console.error('Error processing order created event:', error);
    throw error;
  }
}

// Handle order updated event
async function handleOrderUpdated(orderData) {
  console.log('Processing order updated event:', orderData.order_id);
  
  try {
    // Check what was updated
    const updatedFields = orderData.updated_fields || [];
    
    if (updatedFields.includes('fulfillment_status')) {
      await handleFulfillmentStatusChange(orderData);
    }
    
    if (updatedFields.includes('payment_status')) {
      await handlePaymentStatusChange(orderData);
    }

    // Notify customer of significant updates
    if (shouldNotifyCustomer(updatedFields)) {
      await sendOrderUpdateEmail(orderData);
    }

    await updateInternalSystems('order_updated', orderData);
    console.log('Order updated event processed successfully');
  } catch (error) {
    console.error('Error processing order updated event:', error);
    throw error;
  }
}

// Handle payment succeeded event
async function handlePaymentSucceeded(paymentData) {
  console.log('Processing payment succeeded event:', paymentData.payment_id);
  
  try {
    // Get the associated order
    const order = await zohoAPI.apiRequest(`/orders/${paymentData.order_id}`);
    
    // Send payment confirmation
    await sendPaymentConfirmationEmail({
      orderId: paymentData.order_id,
      paymentId: paymentData.payment_id,
      amount: paymentData.amount,
      customerEmail: order.customer.email
    });

    // Update internal accounting systems
    await updateAccountingSystems('payment_received', {
      orderId: paymentData.order_id,
      amount: paymentData.amount,
      paymentMethod: paymentData.payment_method,
      transactionId: paymentData.transaction_id
    });

    console.log('Payment succeeded event processed successfully');
  } catch (error) {
    console.error('Error processing payment succeeded event:', error);
    throw error;
  }
}

// Handle payment failed event
async function handlePaymentFailed(paymentData) {
  console.log('Processing payment failed event:', paymentData.payment_id);
  
  try {
    // Get the associated order
    const order = await zohoAPI.apiRequest(`/orders/${paymentData.order_id}`);
    
    // Send payment failure notification
    await sendPaymentFailureEmail({
      orderId: paymentData.order_id,
      customerEmail: order.customer.email,
      failureReason: paymentData.failure_reason
    });

    // Update internal systems
    await updateInternalSystems('payment_failed', paymentData);

    console.log('Payment failed event processed successfully');
  } catch (error) {
    console.error('Error processing payment failed event:', error);
    throw error;
  }
}

// Handle order shipped event
async function handleOrderShipped(orderData) {
  console.log('Processing order shipped event:', orderData.order_id);
  
  try {
    // Send shipping notification with tracking info
    await sendShippingNotificationEmail({
      orderId: orderData.order_id,
      customerEmail: orderData.customer.email,
      trackingNumber: orderData.tracking_number,
      carrier: orderData.shipping_carrier,
      estimatedDelivery: orderData.estimated_delivery_date
    });

    // Update CRM and customer service systems
    await updateInternalSystems('order_shipped', orderData);

    console.log('Order shipped event processed successfully');
  } catch (error) {
    console.error('Error processing order shipped event:', error);
    throw error;
  }
}

// Handle order delivered event
async function handleOrderDelivered(orderData) {
  console.log('Processing order delivered event:', orderData.order_id);
  
  try {
    // Send delivery confirmation
    await sendDeliveryConfirmationEmail({
      orderId: orderData.order_id,
      customerEmail: orderData.customer.email,
      deliveredAt: orderData.delivered_at
    });

    // Send follow-up for reviews/support
    await scheduleFollowUpEmails({
      orderId: orderData.order_id,
      customerEmail: orderData.customer.email,
      deliveredAt: orderData.delivered_at
    });

    await updateInternalSystems('order_delivered', orderData);
    console.log('Order delivered event processed successfully');
  } catch (error) {
    console.error('Error processing order delivered event:', error);
    throw error;
  }
}

// Handle order cancelled event
async function handleOrderCancelled(orderData) {
  console.log('Processing order cancelled event:', orderData.order_id);
  
  try {
    // Send cancellation confirmation
    await sendCancellationEmail({
      orderId: orderData.order_id,
      customerEmail: orderData.customer.email,
      refundAmount: orderData.refund_amount,
      cancelReason: orderData.cancel_reason
    });

    // Update inventory and internal systems
    await updateInternalSystems('order_cancelled', orderData);

    console.log('Order cancelled event processed successfully');
  } catch (error) {
    console.error('Error processing order cancelled event:', error);
    throw error;
  }
}

// Handle inventory updated event
async function handleInventoryUpdated(inventoryData) {
  console.log('Processing inventory updated event');
  
  try {
    // Update local cache/database if maintaining inventory sync
    await updateLocalInventory(inventoryData);

    // Notify relevant teams of low stock
    if (inventoryData.quantity < inventoryData.low_stock_threshold) {
      await notifyLowStock(inventoryData);
    }

    console.log('Inventory updated event processed successfully');
  } catch (error) {
    console.error('Error processing inventory updated event:', error);
    throw error;
  }
}

// Helper functions

function shouldNotifyCustomer(updatedFields) {
  const notifiableFields = [
    'fulfillment_status',
    'tracking_number',
    'estimated_delivery_date',
    'shipping_address'
  ];
  
  return updatedFields.some(field => notifiableFields.includes(field));
}

async function handleFulfillmentStatusChange(orderData) {
  const status = orderData.fulfillment_status;
  
  switch (status) {
    case 'processing':
      console.log(`Order ${orderData.order_id} is now processing`);
      break;
    case 'shipped':
      await handleOrderShipped(orderData);
      break;
    case 'delivered':
      await handleOrderDelivered(orderData);
      break;
    case 'cancelled':
      await handleOrderCancelled(orderData);
      break;
  }
}

async function handlePaymentStatusChange(orderData) {
  const status = orderData.payment_status;
  
  switch (status) {
    case 'paid':
      console.log(`Payment confirmed for order ${orderData.order_id}`);
      break;
    case 'failed':
      console.log(`Payment failed for order ${orderData.order_id}`);
      break;
    case 'refunded':
      console.log(`Payment refunded for order ${orderData.order_id}`);
      break;
  }
}

// Email sending functions (implement with your email service)
async function sendOrderConfirmationEmail({ orderId, customerEmail, customerName, orderTotal, items }) {
  console.log(`Sending order confirmation email to ${customerEmail} for order ${orderId}`);
  // Implement with SendGrid, Mailgun, AWS SES, etc.
  return Promise.resolve();
}

async function sendOrderUpdateEmail(orderData) {
  console.log(`Sending order update email for order ${orderData.order_id}`);
  return Promise.resolve();
}

async function sendPaymentConfirmationEmail({ orderId, paymentId, amount, customerEmail }) {
  console.log(`Sending payment confirmation email to ${customerEmail}`);
  return Promise.resolve();
}

async function sendPaymentFailureEmail({ orderId, customerEmail, failureReason }) {
  console.log(`Sending payment failure email to ${customerEmail}`);
  return Promise.resolve();
}

async function sendShippingNotificationEmail({ orderId, customerEmail, trackingNumber, carrier }) {
  console.log(`Sending shipping notification to ${customerEmail} with tracking ${trackingNumber}`);
  return Promise.resolve();
}

async function sendDeliveryConfirmationEmail({ orderId, customerEmail, deliveredAt }) {
  console.log(`Sending delivery confirmation to ${customerEmail}`);
  return Promise.resolve();
}

async function sendCancellationEmail({ orderId, customerEmail, refundAmount, cancelReason }) {
  console.log(`Sending cancellation email to ${customerEmail}`);
  return Promise.resolve();
}

async function scheduleFollowUpEmails({ orderId, customerEmail, deliveredAt }) {
  console.log(`Scheduling follow-up emails for order ${orderId}`);
  return Promise.resolve();
}

// System integration functions
async function updateInternalSystems(eventType, data) {
  console.log(`Updating internal systems for event: ${eventType}`);
  // Integrate with your CRM, inventory management, accounting systems, etc.
  return Promise.resolve();
}

async function updateAccountingSystems(eventType, data) {
  console.log(`Updating accounting systems for event: ${eventType}`);
  // Integrate with QuickBooks, Xero, etc.
  return Promise.resolve();
}

async function updateLocalInventory(inventoryData) {
  console.log('Updating local inventory cache');
  // Update local database/cache if maintaining inventory sync
  return Promise.resolve();
}

async function notifyLowStock(inventoryData) {
  console.log(`Low stock alert for product ${inventoryData.product_id}`);
  // Send alerts to inventory management team
  return Promise.resolve();
}

// Webhook event logging
async function logWebhookEvent(eventData) {
  console.log('Logging webhook event:', eventData.event_id);
  // Store webhook events for debugging and audit trail
  // Could save to database, send to logging service, etc.
  return Promise.resolve();
}