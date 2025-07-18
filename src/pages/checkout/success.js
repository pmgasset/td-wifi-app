// src/pages/checkout/success.js
/**
 * Checkout Success/Confirmation Page
 * 
 * Displays order confirmation details after successful Stripe payment
 * No external redirects - customer stays on your website throughout!
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  CheckCircle,
  Package,
  CreditCard,
  Mail,
  MapPin,
  Calendar,
  Download,
  ArrowRight,
  Loader2,
  AlertCircle,
  Truck
} from 'lucide-react';

// Updated import - using the correct path from your project structure
import Layout from '../components/Layout';

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const { payment_intent, order_id, session_id } = router.query;
  
  const [orderDetails, setOrderDetails] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (payment_intent || order_id || session_id) {
      fetchOrderDetails();
    }
  }, [payment_intent, order_id, session_id]);

  /**
   * Fetch order and payment details
   */
  const fetchOrderDetails = async () => {
    try {
      console.log('Fetching order details...', { payment_intent, order_id, session_id });
      
      const response = await fetch('/api/checkout/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_intent,
          order_id,
          session_id
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch order details');
      }

      setOrderDetails(data.order);
      setPaymentDetails(data.payment);
      
    } catch (error) {
      console.error('Error fetching order details:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate estimated delivery date
   */
  const getEstimatedDelivery = () => {
    const today = new Date();
    const deliveryDate = new Date(today.getTime() + (5 * 24 * 60 * 60 * 1000)); // 5 days from now
    return deliveryDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  /**
   * Handle download receipt
   */
  const handleDownloadReceipt = async () => {
    try {
      const response = await fetch(`/api/orders/${orderDetails.orderId}/receipt`, {
        method: 'GET',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `receipt-${orderDetails.orderNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading receipt:', error);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading your order confirmation...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state
  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md mx-auto text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Unable to Load Order
            </h1>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Order Confirmed!
            </h1>
            <p className="text-lg text-gray-600 mb-4">
              Thank you for your purchase. Your order has been successfully processed.
            </p>
            <div className="inline-flex items-center space-x-2 bg-green-50 text-green-800 px-4 py-2 rounded-lg">
              <Mail className="h-4 w-4" />
              <span className="text-sm font-medium">
                Confirmation email sent to {orderDetails?.customer?.email}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column - Order Details */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Order Summary */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Package className="h-5 w-5 mr-2 text-blue-600" />
                  Order Details
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-600">Order Number</p>
                    <p className="font-semibold text-gray-900">{orderDetails?.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Order Date</p>
                    <p className="font-semibold text-gray-900">
                      {new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="font-semibold text-gray-900">${orderDetails?.total?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Payment Method</p>
                    <p className="font-semibold text-gray-900">
                      {paymentDetails?.paymentMethod || 'Credit Card'}
                      {paymentDetails?.last4 && ` ending in ${paymentDetails.last4}`}
                    </p>
                  </div>
                </div>

                {/* Order Items */}
                {orderDetails?.items && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Items Ordered</h3>
                    <div className="space-y-3">
                      {orderDetails.items.map((item, index) => (
                        <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                          <img
                            src={item.product_images?.[0] || '/images/placeholder.jpg'}
                            alt={item.product_name}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{item.product_name}</h4>
                            <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                            <p className="text-sm font-medium text-gray-900">${item.total?.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Shipping Information */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Truck className="h-5 w-5 mr-2 text-blue-600" />
                  Shipping Information
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Shipping Address</h3>
                    {orderDetails?.shippingAddress && (
                      <div className="text-gray-600">
                        <p>{orderDetails.shippingAddress.address}</p>
                        {orderDetails.shippingAddress.address_2 && (
                          <p>{orderDetails.shippingAddress.address_2}</p>
                        )}
                        <p>
                          {orderDetails.shippingAddress.city}, {orderDetails.shippingAddress.state} {orderDetails.shippingAddress.zip}
                        </p>
                        <p>{orderDetails.shippingAddress.country || 'US'}</p>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Estimated Delivery</h3>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>{orderDetails?.estimatedDelivery || getEstimatedDelivery()}</span>
                    </div>
                    
                    {orderDetails?.trackingNumber && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">Tracking Number</p>
                        <p className="font-mono text-sm font-medium text-gray-900">
                          {orderDetails.trackingNumber}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                  Payment Information
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Payment Status</p>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-green-600">Paid</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Payment ID</p>
                    <p className="font-mono text-sm text-gray-900">
                      {payment_intent || paymentDetails?.paymentIntentId || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Order Breakdown */}
                <div className="mt-4 pt-4 border-t">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>${orderDetails?.subtotal?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax:</span>
                      <span>${orderDetails?.taxAmount?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping:</span>
                      <span>
                        {orderDetails?.shippingCost > 0 
                          ? `$${orderDetails.shippingCost.toFixed(2)}` 
                          : 'FREE'
                        }
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Total:</span>
                      <span>${orderDetails?.total?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Actions & Next Steps */}
            <div className="space-y-6">
              
              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                
                <div className="space-y-3">
                  <button
                    onClick={handleDownloadReceipt}
                    className="w-full flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Receipt</span>
                  </button>
                  
                  <button
                    onClick={() => router.push('/account/orders')}
                    className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Package className="h-4 w-4" />
                    <span>View All Orders</span>
                  </button>
                  
                  <button
                    onClick={() => router.push('/')}
                    className="w-full flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <ArrowRight className="h-4 w-4" />
                    <span>Continue Shopping</span>
                  </button>
                </div>
              </div>

              {/* What's Next */}
              <div className="bg-blue-50 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-blue-900 mb-4">What's Next?</h2>
                
                <div className="space-y-3 text-sm text-blue-800">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Order Processing</p>
                      <p className="text-blue-700">We'll prepare your order for shipment within 1-2 business days.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Shipping Notification</p>
                      <p className="text-blue-700">You'll receive tracking information once your order ships.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Delivery</p>
                      <p className="text-blue-700">Your order will arrive by {getEstimatedDelivery()}.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Support */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h2>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">Order Questions</p>
                    <p className="text-gray-600">Email us at orders@traveldatawifi.com</p>
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-900">Customer Support</p>
                    <p className="text-gray-600">Chat with us or call 1-800-WIFI-123</p>
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-900">Returns & Exchanges</p>
                    <p className="text-gray-600">Visit our returns center for easy exchanges</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}