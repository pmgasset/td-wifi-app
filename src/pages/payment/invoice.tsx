// ===== src/pages/payment/invoice.tsx ===== (FIXED TypeScript Types)
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useCartStore } from '../../store/cart';
import { 
  CreditCard, 
  Lock, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ArrowLeft,
  Shield,
  ExternalLink,
  Package,
  User,
  MapPin,
  DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

// Define the order details interface
interface OrderDetails {
  order_id: string;
  order_number: string;
  total: number;
  currency: string;
  customer_email: string;
  customer_name: string;
  status: string;
}

const InvoicePaymentPage = () => {
  const router = useRouter();
  const { clearCart } = useCartStore();
  
  const {
    order_id,
    order_number,
    amount,
    currency = 'USD',
    customer_email,
    customer_name,
    return_url,
    request_id
  } = router.query;
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  // ✅ FIXED: Properly typed useState with interface
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch order details on component mount
  useEffect(() => {
    if (order_id) {
      fetchOrderDetails();
    }
  }, [order_id]);

  const fetchOrderDetails = async () => {
    try {
      console.log('Fetching order details for:', order_id);
      
      const response = await fetch(`/api/orders/${order_id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrderDetails(data);
        console.log('Order details loaded:', data);
      } else {
        console.log('Order details not found, using URL parameters');
        // ✅ FIXED: Now TypeScript knows this object matches OrderDetails interface
        setOrderDetails({
          order_id: Array.isArray(order_id) ? order_id[0] : order_id || '',
          order_number: Array.isArray(order_number) ? order_number[0] : order_number || `ORDER-${order_id}`,
          total: parseFloat(Array.isArray(amount) ? amount[0] : amount as string) || 0,
          currency: Array.isArray(currency) ? currency[0] : currency,
          customer_email: Array.isArray(customer_email) ? customer_email[0] : customer_email || '',
          customer_name: Array.isArray(customer_name) ? customer_name[0] : customer_name || '',
          status: 'pending_payment'
        });
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      toast.error('Could not load order details');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    
    try {
      console.log('Processing payment for order:', order_id);
      
      // For now, simulate payment processing
      // In production, this would integrate with a real payment processor
      
      const paymentData = {
        order_id,
        amount: parseFloat(Array.isArray(amount) ? amount[0] : amount as string),
        currency,
        payment_method: paymentMethod,
        customer_email,
        request_id
      };

      console.log('Payment data:', paymentData);

      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In a real implementation, you would:
      // 1. Process payment through Stripe, Square, PayPal, etc.
      // 2. Update order status in Zoho Commerce
      // 3. Send confirmation emails
      // 4. Update inventory

      // For now, just mark as successful
      toast.success('Payment processed successfully!');
      clearCart();

      // Redirect to success page
      const successUrl = return_url ? 
        `${return_url}?order_id=${order_id}&payment_status=completed` :
        `/checkout/success?order_id=${order_id}&payment_status=completed`;
      
      router.push(successUrl);

    } catch (error) {
      console.error('Payment processing error:', error);
      toast.error('Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: Array.isArray(currency) ? currency[0] : currency || 'USD'
    }).format(num);
  };

  if (loading) {
    return (
      <Layout title="Loading Payment - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-travel-blue mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Payment Details</h2>
            <p className="text-gray-600">Please wait...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Secure Payment - Travel Data WiFi">
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-green-500 mr-2" />
              <Lock className="h-6 w-6 text-gray-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Secure Payment</h1>
            <p className="text-gray-600">Complete your order securely</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Order Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Package className="h-5 w-5 mr-2" />
                Order Summary
              </h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b">
                  <span className="text-sm text-gray-600">Order Number</span>
                  <span className="font-medium">{orderDetails?.order_number || order_number}</span>
                </div>
                
                <div className="flex justify-between items-center pb-4 border-b">
                  <span className="text-sm text-gray-600">Customer</span>
                  <span className="font-medium">{orderDetails?.customer_name || customer_name}</span>
                </div>
                
                <div className="flex justify-between items-center pb-4 border-b">
                  <span className="text-sm text-gray-600">Email</span>
                  <span className="font-medium">{orderDetails?.customer_email || customer_email}</span>
                </div>
                
                <div className="flex justify-between items-center text-lg font-semibold pt-4">
                  <span>Total Amount</span>
                  <span className="text-travel-blue">
                    {formatCurrency(orderDetails?.total || Array.isArray(amount) ? amount[0] : amount || 0)}
                  </span>
                </div>
              </div>

              {/* Order Status */}
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                  <span className="text-sm text-yellow-800">
                    Order Status: {orderDetails?.status || 'Pending Payment'}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Payment Method
              </h2>

              {/* Payment Method Selection */}
              <div className="space-y-4 mb-6">
                <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-4 w-4 text-travel-blue focus:ring-travel-blue border-gray-300"
                  />
                  <CreditCard className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900">Credit/Debit Card</div>
                    <div className="text-sm text-gray-500">Visa, Mastercard, American Express</div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="paypal"
                    checked={paymentMethod === 'paypal'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-4 w-4 text-travel-blue focus:ring-travel-blue border-gray-300"
                  />
                  <ExternalLink className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-gray-900">PayPal</div>
                    <div className="text-sm text-gray-500">Pay with your PayPal account</div>
                  </div>
                </label>
              </div>

              {/* Card Details Form (shown when card is selected) */}
              {paymentMethod === 'card' && (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Card Number
                    </label>
                    <input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CVV
                      </label>
                      <input
                        type="text"
                        placeholder="123"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      defaultValue={Array.isArray(customer_name) ? customer_name[0] : customer_name as string}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* Payment Button */}
              <button
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full bg-travel-blue text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4" />
                    <span>Pay {formatCurrency(orderDetails?.total || Array.isArray(amount) ? amount[0] : amount || 0)}</span>
                  </>
                )}
              </button>

              {/* Security Notice */}
              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <div className="font-medium mb-1">Secure Payment</div>
                    <div>Your payment information is encrypted and secure. We never store your card details.</div>
                  </div>
                </div>
              </div>

              {/* Back Link */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => router.back()}
                  className="text-travel-blue hover:text-blue-700 font-medium flex items-center justify-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Checkout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default InvoicePaymentPage;