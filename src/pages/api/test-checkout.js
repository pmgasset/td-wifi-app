// ===== src/pages/api/test-checkout.js =====
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TESTING CHECKOUT FLOW ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const {
      customerInfo,
      shippingAddress,
      billingAddress,
      cartItems,
      paymentMethod,
      orderNotes
    } = req.body;

    // Simulate the checkout process
    const result = {
      success: true,
      orderId: `TEST_${Date.now()}`,
      orderNumber: `TDW-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      total: cartItems?.reduce((sum, item) => sum + (item.product_price * item.quantity), 0) || 0,
      paymentId: `pay_test_${Date.now()}`,
      message: 'Test order processed successfully!',
      estimatedDelivery: {
        estimatedDays: 3,
        estimatedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      },
      trackingInfo: {
        available: false,
        message: 'Tracking information will be available once your order ships'
      },
      customerInfo,
      shippingAddress,
      itemCount: cartItems?.length || 0
    };

    console.log('Test checkout result:', result);

    res.status(200).json(result);

  } catch (error) {
    console.error('Test checkout error:', error);
    res.status(500).json({
      error: 'Test checkout failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}