// ===== src/pages/order/[orderId].tsx =====
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  MapPin, 
  Mail,
  Phone,
  CreditCard,
  Calendar,
  AlertCircle,
  Loader2
} from 'lucide-react';

const OrderStatusPage: React.FC = () => {
  const router = useRouter();
  const { orderId } = router.query;
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock order data for demonstration
  useEffect(() => {
    if (orderId) {
      // In production, fetch real order data from your API
      setOrderData({
        orderId: orderId,
        orderNumber: `TDW-${orderId}`,
        status: 'processing',
        orderDate: new Date().toISOString(),
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        total: 299.99,
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
        ],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          address1: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701'
        },
        trackingNumber: 'TRK123456789',
        shippingCarrier: 'UPS'
      });
    }
  }, [orderId]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          color: 'text-yellow-500 bg-yellow-50',
          title: 'Order Received',
          description: 'We\'ve received your order and are preparing it for shipment.'
        };
      case 'processing':
        return {
          icon: Package,
          color: 'text-blue-500 bg-blue-50',
          title: 'Processing',
          description: 'Your order is being prepared and will ship soon.'
        };
      case 'shipped':
        return {
          icon: Truck,
          color: 'text-purple-500 bg-purple-50',
          title: 'Shipped',
          description: 'Your order is on its way!'
        };
      case 'delivered':
        return {
          icon: CheckCircle,
          color: 'text-green-500 bg-green-50',
          title: 'Delivered',
          description: 'Your order has been delivered successfully.'
        };
      default:
        return {
          icon: AlertCircle,
          color: 'text-gray-500 bg-gray-50',
          title: 'Unknown',
          description: 'Order status is unknown.'
        };
    }
  };

  const statusInfo = orderData ? getStatusInfo(orderData.status) : null;
  const StatusIcon = statusInfo?.icon || AlertCircle;

  if (loading) {
    return (
      <Layout title="Loading Order - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-travel-blue mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Order Details</h2>
            <p className="text-gray-600">Please wait while we fetch your order information...</p>
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
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Order Not Found</h1>
              <p className="text-gray-600 mb-6">{error}</p>
              
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/products')}
                  className="w-full bg-travel-blue text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Continue Shopping
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

  if (!orderData) {
    return (
      <Layout title="Order Not Found - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-gray-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Order Not Found</h1>
            <p className="text-gray-600 mb-8">We couldn't find an order with ID: {orderId}</p>
            <button
              onClick={() => router.push('/products')}
              className="bg-travel-blue text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Order ${orderData.orderNumber} - Travel Data WiFi`}>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-travel-blue hover:text-blue-700 mb-4"
            >
              <MapPin className="h-4 w-4" />
              <span>Back</span>
            </button>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Order {orderData.orderNumber}</h1>
                <p className="text-gray-600 mt-2">
                  Placed on {new Date(orderData.orderDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              
              {statusInfo && (
                <div className={`flex items-center space-x-3 px-4 py-2 rounded-lg ${statusInfo.color}`}>
                  <StatusIcon className="h-5 w-5" />
                  <span className="font-medium">{statusInfo.title}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Order Status & Details */}
            <div className="lg:col-span-2 space-y-8">
              {/* Status Timeline */}
              <div className="bg-white rounded-lg shadow-sm p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Status</h2>
                
                <div className="space-y-6">
                  {/* Current Status */}
                  {statusInfo && (
                    <div className="flex items-start space-x-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${statusInfo.color}`}>
                        <StatusIcon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{statusInfo.title}</h3>
                        <p className="text-gray-600 mt-1">{statusInfo.description}</p>
                        {orderData.estimatedDelivery && orderData.status !== 'delivered' && (
                          <p className="text-sm text-gray-500 mt-2">
                            <Calendar className="h-4 w-4 inline mr-1" />
                            Estimated delivery: {orderData.estimatedDelivery}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tracking Information */}
                  {orderData.trackingNumber && (
                    <div className="border-t pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">Tracking Number</h4>
                          <p className="text-travel-blue font-mono text-lg">{orderData.trackingNumber}</p>
                          <p className="text-sm text-gray-600 mt-1">Carrier: {orderData.shippingCarrier}</p>
                        </div>
                        <button
                          onClick={() => window.open(`https://www.ups.com/track?loc=en_US&tracknum=${orderData.trackingNumber}`, '_blank')}
                          className="bg-travel-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Track Package
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div className="bg-white rounded-lg shadow-sm p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Items Ordered</h2>
                
                <div className="space-y-6">
                  {orderData.items?.map((item: any, index: number) => (
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
                
                <div className="border-t pt-6 mt-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Order Total</span>
                    <span className="text-2xl font-bold text-travel-blue">${orderData.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              {orderData.shippingAddress && (
                <div className="bg-white rounded-lg shadow-sm p-8">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                    <MapPin className="h-5 w-5" />
                    <span>Shipping Address</span>
                  </h2>
                  
                  <div className="text-gray-700">
                    <p className="font-medium">
                      {orderData.shippingAddress.firstName} {orderData.shippingAddress.lastName}
                    </p>
                    <p>{orderData.shippingAddress.address1}</p>
                    {orderData.shippingAddress.address2 && (
                      <p>{orderData.shippingAddress.address2}</p>
                    )}
                    <p>
                      {orderData.shippingAddress.city}, {orderData.shippingAddress.state} {orderData.shippingAddress.zipCode}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              {/* Order Summary */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Number</span>
                    <span className="font-medium">{orderData.orderNumber}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Total</span>
                    <span className="font-semibold text-travel-blue">${orderData.total.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status</span>
                    <span className="font-medium capitalize">{orderData.status}</span>
                  </div>
                </div>
              </div>

              {/* Customer Support */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Mail className="h-4 w-4 text-travel-blue" />
                    <a href="mailto:support@traveldatawifi.com" className="text-travel-blue hover:underline">
                      support@traveldatawifi.com
                    </a>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Phone className="h-4 w-4 text-travel-blue" />
                    <a href="tel:1-800-943-4781" className="text-travel-blue hover:underline">
                      1-800-WIFI-RV
                    </a>
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 mt-4">
                  Customer support is available Monday-Friday, 9 AM - 6 PM CST
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => window.location.href = '/products'}
                  className="w-full bg-travel-blue text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Continue Shopping
                </button>
                
                <button
                  onClick={() => window.location.href = '/support/contact'}
                  className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Contact Support
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default OrderStatusPage;