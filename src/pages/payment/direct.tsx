// ===== src/pages/payment/direct.tsx ===== (CREATE THIS FILE)
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useCartStore } from '../../store/cart';
import { 
  CreditCard, 
  Lock, 
  Loader2,
  Shield,
  Package,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

const DirectPaymentPage = () => {
  const router = useRouter();
  const { clearCart } = useCartStore();
  
  const {
    order_id,
    amount,
    currency = 'USD',
    customer_email,
    method,
    request_id
  } = router.query;
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (order_id) {
      fetchOrderDetails();
    }
  }, [order_id]);

  const fetchOrderDetails = async () => {
    try {
      const response = await fetch(`/api/orders/${order_id}`);
      if (response.ok) {
        const data = await response.json();
        setOrderDetails(data);
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    
    try {
      // Process payment through your preferred payment processor
      // This is where you'd integrate with Stripe, Square, PayPal, etc.
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('Payment processed successfully!');
      clearCart();
      
      router.push(`/checkout/success?order_id=${order_id}&payment_status=completed&method=direct`);
      
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency as string || 'USD'
    }).format(num);
  };

  if (loading) {
    return (
      <Layout title="Loading Payment - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-travel-blue" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Direct Payment - Travel Data WiFi">
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="text-center mb-8">
              <Package className="h-16 w-16 text-travel-blue mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Direct Payment</h1>
              <p className="text-gray-600">Complete your payment for order #{order_id}</p>
            </div>

            <div className="space-y-6">
              {/* Order Summary */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Order Summary</h2>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order ID:</span>
                    <span className="font-medium">{order_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">{customer_email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Method:</span>
                    <span className="font-medium capitalize">{method} Order</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                    <span>Total:</span>
                    <span className="text-travel-blue">{formatCurrency(amount || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Notice */}
              <div className="bg-blue-50 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <div className="font-medium mb-1">Payment Processing</div>
                    <div>This is a direct order created through Zoho Commerce. In a production environment, this would integrate with your payment processor of choice (Stripe, Square, PayPal, etc.).</div>
                  </div>
                </div>
              </div>

              {/* Payment Button */}
              <button
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full bg-travel-blue text-white py-4 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" />
                    <span>Pay {formatCurrency(amount || 0)}</span>
                  </>
                )}
              </button>

              {/* Security Badge */}
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <Shield className="h-4 w-4" />
                <span>Secure 256-bit SSL encryption</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DirectPaymentPage;
