// ===== src/pages/checkout/success.tsx =====
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useCartStore } from '../../store/cart';
import { 
  CheckCircle, 
  Package, 
  ExternalLink, 
  Mail,
  Phone,
  Download,
  Loader2,
  AlertCircle
} from 'lucide-react';

const CheckoutSuccessPage: React.FC = () => {
  const router = useRouter();
  const { clearCart } = useCartStore();
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract session ID or order ID from URL params
  const { session_id, order_id, payment_intent } = router.query;

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!session_id && !order_id) {
        // For demo purposes, create mock order data
        setOrderData({
          orderNumber: 'TDW-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          total: 299.99,
          orderDate: new Date().toISOString(),
          paymentMethod: 'Credit Card',
          last4: '1234',
          items: [
            {
              product_id: '1',
              product_name: 'GL.iNet GL-X3000 5G Router',
              quantity: 1,
              price: 249.99,
              product_images: ['/images/placeholder.jpg']
            },
            {
              product_id: '2', 
              product_name: 'Signal Booster Antenna',
              quantity: 1,
              price: 49.99,
              product_images: ['/images/placeholder.jpg']
            }
          ]
        });
        setLoading(false);
        clearCart();
        return;
      }

      try {
        setLoading(true);
        
        const response = await fetch('/api/checkout/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id,
            order_id,
            payment_intent
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to verify order');
        }

        const result = await response.json();
        setOrderData(result);
        clearCart();
        
      } catch (err) {
        console.error('Error fetching order details:', err);
        setError('Unable to load order details. Please contact support.');
      } finally {
        setLoading(false);
      }
    };

    if (router.isReady) {
      fetchOrderDetails();
    }
  }, [router.isReady, session_id, order_id, payment_intent, clearCart]);

  if (loading) {
    return (
      <Layout title="Order Confirmation - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-travel-blue mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Confirming Your Order</h2>
            <p className="text-gray-600">Please wait while we verify your payment...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Order Error - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Order Verification Failed</h1>
              <p className="text-gray-600 mb-6">{error}</p>
              
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/checkout')}
                  className="w-full bg-travel-blue text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
                
                <div className="flex items-center space-x-3 text-sm text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>Need help? Call 1-800-WIFI-RV</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Order Confirmed - Travel Data WiFi">
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Success Header */}
          <div className="text-center mb-12">
            <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Order Confirmed!</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Thank you for your purchase! Your order has been successfully processed.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Order Details */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Order Details</h2>
                
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Order Number</h3>
                    <p className="text-lg font-semibold text-gray-900">
                      {orderData?.orderNumber || 'TDW-' + Math.random().toString(36).substr(2, 9).toUpperCase()}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Order Total</h3>
                    <p className="text-lg font-semibold text-travel-blue">
                      ${orderData?.total?.toFixed(2) || '299.99'}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Payment Method</h3>
                    <p className="text-gray-900">
                      {orderData?.paymentMethod || 'Credit Card'} •••• {orderData?.last4 || '1234'}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Order Date</h3>
                    <p className="text-gray-900">
                      {orderData?.orderDate ? new Date(orderData.orderDate).toLocaleDateString() : new Date().toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Zoho Commerce Link */}
                {orderData?.zohoOrderUrl && (
                  <div className="border-t pt-6">
                    <a 
                      href={orderData.zohoOrderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 text-travel-blue hover:text-blue-700"
                    >
                      <span>View order in Zoho Commerce</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>

              {/* Order Items */}
              <div className="bg-white rounded-lg shadow-sm p-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Items Ordered</h2>
                
                <div className="space-y-6">
                  {orderData?.items?.map((item: any, index: number) => (
                    <div key={index} className="flex items-start space-x-4 pb-6 border-b border-gray-200 last:border-b-0">
                      <img 
                        src={item.product_images?.[0] || '/images/placeholder.jpg'}
                        alt={item.product_name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{item.product_name}</h3>
                        <p className="text-gray-600 mt-1">Quantity: {item.quantity}</p>
                        <p className="text-lg font-semibold text-travel-blue mt-2">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Summary & Next Steps */}
            <div className="space-y-8">
              {/* What's Next */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">What's Next?</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-green-600 text-sm font-bold">1</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Confirmation Email</p>
                      <p className="text-sm text-gray-600">You'll receive an email confirmation shortly with your order details.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 text-sm font-bold">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Order Processing</p>
                      <p className="text-sm text-gray-600">We'll prepare your order and ship within 1-2 business days.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-purple-600 text-sm font-bold">3</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Shipping Notification</p>
                      <p className="text-sm text-gray-600">You'll get tracking information once your order ships.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-orange-600 text-sm font-bold">4</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Setup Support</p>
                      <p className="text-sm text-gray-600">Our team will contact you to schedule setup assistance if needed.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Download Resources */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Resources</h3>
                
                <div className="space-y-3">
                  <a 
                    href="/downloads/setup-guide.pdf"
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Download className="h-5 w-5 text-travel-blue" />
                    <span className="text-gray-900">Setup Guide PDF</span>
                  </a>
                  
                  <a 
                    href="/downloads/troubleshooting.pdf"
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Download className="h-5 w-5 text-travel-blue" />
                    <span className="text-gray-900">Troubleshooting Guide</span>
                  </a>
                  
                  <a 
                    href="/support/contact"
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Phone className="h-5 w-5 text-travel-blue" />
                    <span className="text-gray-900">Contact Support</span>
                  </a>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Mail className="h-5 w-5 text-travel-blue" />
                    <div>
                      <p className="font-medium text-gray-900">Email Support</p>
                      <a href="mailto:support@traveldatawifi.com" className="text-travel-blue hover:underline text-sm">
                        support@traveldatawifi.com
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Phone className="h-5 w-5 text-travel-blue" />
                    <div>
                      <p className="font-medium text-gray-900">Phone Support</p>
                      <a href="tel:1-800-943-4781" className="text-travel-blue hover:underline text-sm">
                        1-800-WIFI-RV (1-800-943-4781)
                      </a>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-4">
                    Support hours: Monday-Friday, 9 AM - 6 PM CST
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/products')}
                  className="w-full bg-travel-blue text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Continue Shopping
                </button>
                
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Return to Home
                </button>
                
                {orderData?.orderNumber && (
                  <button
                    onClick={() => router.push(`/order/${orderData.orderNumber}`)}
                    className="w-full border border-travel-blue text-travel-blue py-3 px-4 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                  >
                    Track Your Order
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="mt-12 bg-white rounded-lg shadow-sm p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <Package className="h-12 w-12 text-travel-blue mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Fast Shipping</h3>
                <p className="text-gray-600">Most orders ship within 1-2 business days with tracking provided.</p>
              </div>
              
              <div>
                <CheckCircle className="h-12 w-12 text-travel-green mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Setup Support</h3>
                <p className="text-gray-600">Free Concierge Connect service to help you get online quickly.</p>
              </div>
              
              <div>
                <Phone className="h-12 w-12 text-travel-orange mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Expert Support</h3>
                <p className="text-gray-600">24/7 technical support from our connectivity experts.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CheckoutSuccessPage;