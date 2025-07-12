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
          description: 'Order status unknown'
        };
    }
  };

  if (!orderData) {
    return (
      <Layout title="Order Status - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-travel-blue mx-auto mb-4" />
            <p className="text-gray-600">Loading order details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const statusInfo = getStatusInfo(orderData.status);
  const StatusIcon = statusInfo.icon;

  return (
    <Layout 
      title={`Order ${orderData.orderNumber} - Travel Data WiFi`}
      description={`Track your Travel Data WiFi order ${orderData.orderNumber}`}
    >
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Order {orderData.orderNumber}</h1>
                <p className="text-gray-600">Placed on {new Date(orderData.orderDate).toLocaleDateString()}</p>
              </div>
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${statusInfo.color}`}>
                <StatusIcon className="h-5 w-5" />
                <span className="font-medium">{statusInfo.title}</span>
              </div>
            </div>
            <p className="text-gray-700">{statusInfo.description}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Order Timeline */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Timeline</h2>
                
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Order Confirmed</h3>
                      <p className="text-sm text-gray-600">Your order has been received and confirmed</p>
                      <p className="text-xs text-gray-500">{new Date(orderData.orderDate).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      ['processing', 'shipped', 'delivered'].includes(orderData.status) 
                        ? 'bg-blue-100' 
                        : 'bg-gray-100'
                    }`}>
                      <Package className={`h-5 w-5 ${
                        ['processing', 'shipped', 'delivered'].includes(orderData.status)
                          ? 'text-blue-600'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Processing</h3>
                      <p className="text-sm text-gray-600">Your order is being prepared for shipment</p>
                      {orderData.status === 'processing' && (
                        <p className="text-xs text-blue-600">Currently in progress</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      ['shipped', 'delivered'].includes(orderData.status)
                        ? 'bg-purple-100'
                        : 'bg-gray-100'
                    }`}>
                      <Truck className={`h-5 w-5 ${
                        ['shipped', 'delivered'].includes(orderData.status)
                          ? 'text-purple-600'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Shipped</h3>
                      <p className="text-sm text-gray-600">Your order is on its way</p>
                      {orderData.status === 'shipped' && orderData.trackingNumber && (
                        <div className="mt-1">
                          <p className="text-xs text-purple-600">
                            Tracking: {orderData.trackingNumber} ({orderData.shippingCarrier})
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      orderData.status === 'delivered'
                        ? 'bg-green-100'
                        : 'bg-gray-100'
                    }`}>
                      <CheckCircle className={`h-5 w-5 ${
                        orderData.status === 'delivered'
                          ? 'text-green-600'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Delivered</h3>
                      <p className="text-sm text-gray-600">
                        Estimated delivery: {orderData.estimatedDelivery}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Items</h2>
                
                <div className="space-y-4">
                  {orderData.items.map((item: any, index: number) => (
                    <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <img 
                        src={item.product_images[0] || '/images/placeholder.jpg'}
                        alt={item.product_name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{item.product_name}</h3>
                        <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        <p className="text-travel-blue font-semibold">${item.price.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Details Sidebar */}
            <div className="space-y-6">
              {/* Order Summary */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span>${(orderData.total - 10).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span>$10.00</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span>${orderData.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Shipping Address</span>
                </h3>
                
                <div className="text-sm text-gray-600">
                  <p className="font-medium text-gray-900">
                    {orderData.shippingAddress.firstName} {orderData.shippingAddress.lastName}
                  </p>
                  <p>{orderData.shippingAddress.address1}</p>
                  <p>
                    {orderData.shippingAddress.city}, {orderData.shippingAddress.state} {orderData.shippingAddress.zipCode}
                  </p>
                </div>
              </div>

              {/* Contact Support */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
                
                <div className="space-y-3 text-sm">
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

export default OrderStatusPage;// ===== src/pages/order/[orderId].tsx =====
import React, { useState } from 'react';
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
  React.useEffect(() => {
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
          description: 'Order status unknown'
        };
    }
  };

  if (!orderData) {
    return (
      <Layout title="Order Status - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-travel-blue mx-auto mb-4" />
            <p className="text-gray-600">Loading order details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const statusInfo = getStatusInfo(orderData.status);
  const StatusIcon = statusInfo.icon;

  return (
    <Layout 
      title={`Order ${orderData.orderNumber} - Travel Data WiFi`}
      description={`Track your Travel Data WiFi order ${orderData.orderNumber}`}
    >
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Order {orderData.orderNumber}</h1>
                <p className="text-gray-600">Placed on {new Date(orderData.orderDate).toLocaleDateString()}</p>
              </div>
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${statusInfo.color}`}>
                <StatusIcon className="h-5 w-5" />
                <span className="font-medium">{statusInfo.title}</span>
              </div>
            </div>
            <p className="text-gray-700">{statusInfo.description}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Order Timeline */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Timeline</h2>
                
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Order Confirmed</h3>
                      <p className="text-sm text-gray-600">Your order has been received and confirmed</p>
                      <p className="text-xs text-gray-500">{new Date(orderData.orderDate).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      ['processing', 'shipped', 'delivered'].includes(orderData.status) 
                        ? 'bg-blue-100' 
                        : 'bg-gray-100'
                    }`}>
                      <Package className={`h-5 w-5 ${
                        ['processing', 'shipped', 'delivered'].includes(orderData.status)
                          ? 'text-blue-600'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Processing</h3>
                      <p className="text-sm text-gray-600">Your order is being prepared for shipment</p>
                      {orderData.status === 'processing' && (
                        <p className="text-xs text-blue-600">Currently in progress</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      ['shipped', 'delivered'].includes(orderData.status)
                        ? 'bg-purple-100'
                        : 'bg-gray-100'
                    }`}>
                      <Truck className={`h-5 w-5 ${
                        ['shipped', 'delivered'].includes(orderData.status)
                          ? 'text-purple-600'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Shipped</h3>
                      <p className="text-sm text-gray-600">Your order is on its way</p>
                      {orderData.status === 'shipped' && orderData.trackingNumber && (
                        <div className="mt-1">
                          <p className="text-xs text-purple-600">
                            Tracking: {orderData.trackingNumber} ({orderData.shippingCarrier})
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      orderData.status === 'delivered'
                        ? 'bg-green-100'
                        : 'bg-gray-100'
                    }`}>
                      <CheckCircle className={`h-5 w-5 ${
                        orderData.status === 'delivered'
                          ? 'text-green-600'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Delivered</h3>
                      <p className="text-sm text-gray-600">
                        Estimated delivery: {orderData.estimatedDelivery}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Items</h2>
                
                <div className="space-y-4">
                  {orderData.items.map((item: any, index: number) => (
                    <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <img 
                        src={item.product_images[0] || '/images/placeholder.jpg'}
                        alt={item.product_name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{item.product_name}</h3>
                        <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        <p className="text-travel-blue font-semibold">${item.price.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Details Sidebar */}
            <div className="space-y-6">
              {/* Order Summary */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span>${(orderData.total - 10).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span>$10.00</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span>${orderData.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Shipping Address</span>
                </h3>
                
                <div className="text-sm text-gray-600">
                  <p className="font-medium text-gray-900">
                    {orderData.shippingAddress.firstName} {orderData.shippingAddress.lastName}
                  </p>
                  <p>{orderData.shippingAddress.address1}</p>
                  <p>
                    {orderData.shippingAddress.city}, {orderData.shippingAddress.state} {orderData.shippingAddress.zipCode}
                  </p>
                </div>
              </div>

              {/* Contact Support */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
                
                <div className="space-y-3 text-sm">
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