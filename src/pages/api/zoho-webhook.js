// ===== src/pages/api/zoho-webhook.js =====
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook signature (important for security)
    const signature = req.headers['x-zoho-signature'] || req.headers['zoho-signature'];
    const webhookSecret = process.env.ZOHO_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      const computedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');
      
      if (signature !== computedSignature) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { event_type, data } = req.body;
    
    console.log('Zoho webhook received:', {
      event_type,
      order_id: data?.order?.order_id,
      status: data?.order?.status
    });

    // Handle different webhook events
    switch (event_type) {
      case 'order.created':
        await handleOrderCreated(data.order);
        break;
        
      case 'order.paid':
        await handleOrderPaid(data.order);
        break;
        
      case 'order.shipped':
        await handleOrderShipped(data.order);
        break;
        
      case 'order.delivered':
        await handleOrderDelivered(data.order);
        break;
        
      case 'payment.succeeded':
        await handlePaymentSucceeded(data.payment, data.order);
        break;
        
      case 'payment.failed':
        await handlePaymentFailed(data.payment, data.order);
        break;
        
      default:
        console.log(`Unhandled webhook event: ${event_type}`);
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ 
      success: true, 
      event_type,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Return 200 even on error to prevent retries for invalid data
    return res.status(200).json({ 
      error: 'Webhook processing failed',
      details: error.message 
    });
  }
}

// Handle order created event
async function handleOrderCreated(order) {
  console.log('Order created:', order.order_id);
  
  try {
    // Send confirmation email to customer
    if (order.customer?.email) {
      await sendOrderConfirmationEmail(order);
    }
    
    // Log to your analytics/CRM
    await logOrderEvent('created', order);
    
    // Notify admin/team
    await notifyTeam('order_created', {
      orderNumber: order.order_number,
      customerEmail: order.customer?.email,
      total: order.total_amount,
      items: order.line_items?.length || 0
    });
    
  } catch (error) {
    console.error('Error handling order created:', error);
  }
}

// Handle payment succeeded event
async function handlePaymentSucceeded(payment, order) {
  console.log('Payment succeeded:', payment.payment_id, 'for order:', order.order_id);
  
  try {
    // Update internal records
    await updateOrderStatus(order.order_id, 'paid');
    
    // Send payment confirmation
    if (order.customer?.email) {
      await sendPaymentConfirmationEmail(order, payment);
    }
    
    // Trigger fulfillment process
    await triggerFulfillment(order);
    
    // Update inventory
    await updateInventory(order.line_items);
    
    // Log to analytics
    await logOrderEvent('paid', order, { payment_id: payment.payment_id });
    
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

// Handle order shipped event
async function handleOrderShipped(order) {
  console.log('Order shipped:', order.order_id);
  
  try {
    // Send shipping notification
    if (order.customer?.email) {
      await sendShippingNotificationEmail(order);
    }
    
    // Log shipping event
    await logOrderEvent('shipped', order);
    
  } catch (error) {
    console.error('Error handling order shipped:', error);
  }
}

// Handle payment failed event
async function handlePaymentFailed(payment, order) {
  console.log('Payment failed:', payment.payment_id, 'for order:', order.order_id);
  
  try {
    // Send payment failure notification
    if (order.customer?.email) {
      await sendPaymentFailureEmail(order, payment);
    }
    
    // Log failure event
    await logOrderEvent('payment_failed', order, { 
      payment_id: payment.payment_id,
      failure_reason: payment.failure_reason 
    });
    
    // Notify team for manual follow-up
    await notifyTeam('payment_failed', {
      orderNumber: order.order_number,
      customerEmail: order.customer?.email,
      failureReason: payment.failure_reason
    });
    
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

// Helper functions (implement based on your email service)
async function sendOrderConfirmationEmail(order) {
  // Implement with your email service (SendGrid, Mailgun, etc.)
  console.log(`Sending order confirmation to ${order.customer.email}`);
  
  // Example with a hypothetical email service
  // await emailService.send({
  //   to: order.customer.email,
  //   template: 'order-confirmation',
  //   data: {
  //     orderNumber: order.order_number,
  //     customerName: `${order.customer.first_name} ${order.customer.last_name}`,
  //     items: order.line_items,
  //     total: order.total_amount
  //   }
  // });
}

async function sendPaymentConfirmationEmail(order, payment) {
  console.log(`Sending payment confirmation to ${order.customer.email}`);
  // Implement payment confirmation email
}

async function sendShippingNotificationEmail(order) {
  console.log(`Sending shipping notification to ${order.customer.email}`);
  // Implement shipping notification email
}

async function sendPaymentFailureEmail(order, payment) {
  console.log(`Sending payment failure notification to ${order.customer.email}`);
  // Implement payment failure email
}

async function updateOrderStatus(orderId, status) {
  // Update your internal database if you're storing order info
  console.log(`Updating order ${orderId} status to ${status}`);
}

async function triggerFulfillment(order) {
  // Trigger your fulfillment process
  console.log(`Triggering fulfillment for order ${order.order_id}`);
}

async function updateInventory(lineItems) {
  // Update your inventory system
  console.log('Updating inventory for items:', lineItems?.map(item => item.product_id));
}

async function logOrderEvent(eventType, order, additionalData = {}) {
  // Log to your analytics system
  console.log('Logging order event:', {
    eventType,
    orderId: order.order_id,
    orderNumber: order.order_number,
    timestamp: new Date().toISOString(),
    ...additionalData
  });
}

async function notifyTeam(eventType, data) {
  // Notify your team via Slack, email, etc.
  console.log('Team notification:', eventType, data);
  
  // Example: Send to Slack webhook
  // await fetch(process.env.SLACK_WEBHOOK_URL, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     text: `Order Event: ${eventType}`,
  //     attachments: [{
  //       color: eventType.includes('failed') ? 'danger' : 'good',
  //       fields: Object.entries(data).map(([key, value]) => ({
  //         title: key,
  //         value: String(value),
  //         short: true
  //       }))
  //     }]
  //   })
  // });
}

// Handle order delivered event
async function handleOrderDelivered(order) {
  console.log('Order delivered:', order.order_id);
  
  try {
    // Send delivery confirmation
    if (order.customer?.email) {
      await sendDeliveryConfirmationEmail(order);
    }
    
    // Request review/feedback
    setTimeout(() => {
      // Send review request after a delay
      sendReviewRequestEmail(order);
    }, 24 * 60 * 60 * 1000); // 24 hours later
    
    // Log delivery event
    await logOrderEvent('delivered', order);
    
  } catch (error) {
    console.error('Error handling order delivered:', error);
  }
}

async function sendDeliveryConfirmationEmail(order) {
  console.log(`Sending delivery confirmation to ${order.customer.email}`);
  // Implement delivery confirmation email
}

async function sendReviewRequestEmail(order) {
  console.log(`Sending review request to ${order.customer.email}`);
  // Implement review request email
}