// ===== src/pages/payment/invoice/[id].js ===== (CREATE THIS FILE)

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import { 
  CreditCard, 
  Lock, 
  Loader2,
  Shield,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

const InvoicePaymentPage = () => {
  const router = useRouter();
  const { id } = router.query; // invoice ID
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      initializePaymentData();
    }
  }, [id]);

  const initializePaymentData = () => {
    try {
      // Extract payment data from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const data = {
        invoice_id: id,
        amount: parseFloat(urlParams.get('amount')) || 0,
        currency: urlParams.get('currency') || 'USD',
        customer_email: urlParams.get('customer_email') || '',
        customer_name: urlParams.get('customer_name') || '',
        invoice_number: urlParams.get('invoice_number') || '',
        request_id: urlParams.get('request_id') || '',
        success_url: urlParams.get('success_url') || '/checkout/success',
        cancel_url: urlParams.get('cancel_url') || '/checkout/cancel'
      };

      if (!data.amount || !data.customer_email) {
        throw new Error('Invalid payment parameters');
      }

      setPaymentData(data);
      setLoading(false);
    } catch (err) {
      console.error('Error initializing payment data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleStripePayment = async () => {
    setIsProcessing(true);
    
    try {
      console.log('🔄 Creating Stripe payment session...');
      
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_id: paymentData.invoice_id,
          amount: paymentData.amount,
          currency: paymentData.currency,
          customer_email: paymentData.customer_email,
          customer_name: paymentData.customer_name,
          success_url: `${window.location.origin}${paymentData.success_url}`,
          cancel_url: `${window.location.origin}${paymentData.cancel_url}`,
          metadata: {
            invoice_number: paymentData.invoice_number,
            request_id: paymentData.request_id
          }
        })
      });

      const sessionData = await response.json();

      if (sessionData.success && sessionData.checkout_url) {
        console.log('✅ Stripe session created, redirecting...');
        toast.success('Redirecting to secure payment...');
        window.location.href = sessionData.checkout_url;
      } else {
        throw new Error(sessionData.error || 'Failed to create payment session');
      }
    } catch (error) {
      console.error('❌ Payment session creation error:', error);
      toast.error('Payment setup failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleZohoPayment = () => {
    // Open Zoho invoice in new tab for direct payment
    const zohoUrl = `https://inventory.zoho.com/app/#/invoices/${paymentData.invoice_id}/details?organization=${process.env.NEXT_PUBLIC_ZOHO_ORGANIZATION_ID}`;
    window.open(zohoUrl, '_blank');
    toast.success('Zoho invoice opened in new tab');
  };

  const handleCancel = () => {
    router.push(paymentData?.cancel_url || '/checkout/cancel');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: paymentData?.currency || 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading payment details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md mx-auto text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Payment Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Return Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={handleCancel}
              className="flex items-center text-blue-600 hover:text-blue-700 mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Checkout
            </button>
            
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Complete Your Payment
              </h1>
              <p className="text-gray-600">
                Invoice {paymentData.invoice_number} - {formatCurrency(paymentData.amount)}
              </p>
            </div>
          </div>

          {/* Payment Options */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Payment Options</h2>
              <p className="text-gray-600">Choose your preferred payment method below</p>
            </div>

            <div className="space-y-4">
              {/* Zoho Payment Option */}
              <div className="border rounded-lg p-4 hover:border-green-500 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <ExternalLink className="h-6 w-6 text-green-600 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-900">Pay via Zoho</h3>
                      <p className="text-sm text-gray-600">Direct payment through Zoho Inventory</p>
                    </div>
                  </div>
                  <button
                    onClick={handleZohoPayment}
                    className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 flex items-center"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Number:</span>
                <span className="font-medium">{paymentData.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Customer Email:</span>
                <span className="font-medium">{paymentData.customer_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Currency:</span>
                <span className="font-medium">{paymentData.currency}</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total Amount:</span>
                  <span className="text-blue-600">{formatCurrency(paymentData.amount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">Secure Payment</h4>
                <p className="text-sm text-blue-700">
                  Your payment information is processed securely using industry-standard encryption. 
                  We never store your credit card details.
                </p>
              </div>
            </div>
          </div>

          {/* Alternative Actions */}
          <div className="text-center space-y-3">
            <p className="text-gray-600">Need help with payment?</p>
            <div className="space-x-4">
              <button
                onClick={() => window.location.href = 'mailto:support@traveldatawifi.com'}
                className="text-blue-600 hover:text-blue-700 underline"
              >
                Contact Support
              </button>
              <button
                onClick={handleCancel}
                className="text-gray-600 hover:text-gray-700 underline"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default InvoicePaymentPage; Stripe Payment Option */}
              <div className="border rounded-lg p-4 hover:border-blue-500 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CreditCard className="h-6 w-6 text-blue-600 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-900">Credit/Debit Card</h3>
                      <p className="text-sm text-gray-600">Secure payment with Stripe</p>
                    </div>
                  </div>
                  <button
                    onClick={handleStripePayment}
                    disabled={isProcessing}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Pay Now
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/*