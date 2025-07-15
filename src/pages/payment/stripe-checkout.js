import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { CreditCard, CheckCircle, AlertCircle, Loader2, Shield, ArrowLeft } from 'lucide-react';

export default function StripeCheckoutPage() {
  const router = useRouter();
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Extract URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const data = {
      invoice_id: urlParams.get('invoice_id'),
      invoice_number: urlParams.get('invoice_number'),
      contact_id: urlParams.get('contact_id'),
      amount: parseFloat(urlParams.get('amount')),
      currency: urlParams.get('currency') || 'USD',
      customer_email: urlParams.get('customer_email'),
      customer_name: urlParams.get('customer_name'),
      return_url: urlParams.get('return_url'),
      cancel_url: urlParams.get('cancel_url'),
      request_id: urlParams.get('request_id'),
      api_type: urlParams.get('api_type'),
      payment_gateway: urlParams.get('payment_gateway'),
      sales_order_id: urlParams.get('sales_order_id'),
      organization_id: urlParams.get('organization_id'),
      mode: urlParams.get('mode')
    };

    setInvoiceData(data);
    setLoading(false);
  }, []);

  const createStripePaymentSession = async () => {
    setIsProcessing(true);
    setPaymentStatus('processing');
    
    try {
      console.log('Creating Stripe payment session...');
      
      // Call your backend API to create Stripe payment session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_id: invoiceData.invoice_id,
          amount: invoiceData.amount,
          currency: invoiceData.currency,
          customer_email: invoiceData.customer_email,
          customer_name: invoiceData.customer_name,
          success_url: invoiceData.return_url,
          cancel_url: invoiceData.cancel_url || window.location.href,
          metadata: {
            invoice_number: invoiceData.invoice_number,
            contact_id: invoiceData.contact_id,
            sales_order_id: invoiceData.sales_order_id,
            organization_id: invoiceData.organization_id,
            request_id: invoiceData.request_id
          }
        })
      });

      const sessionData = await response.json();

      if (sessionData.success && sessionData.checkout_url) {
        console.log('✓ Stripe session created, redirecting...');
        
        // Redirect to Stripe Checkout
        window.location.href = sessionData.checkout_url;
      } else {
        throw new Error(sessionData.error || 'Failed to create payment session');
      }
    } catch (error) {
      console.error('Payment session creation error:', error);
      setPaymentStatus('error');
      setIsProcessing(false);
    }
  };

  const handleDirectZohoPayment = () => {
    const zohoPaymentUrl = `https://inventory.zoho.com/app/#/invoices/${invoiceData.invoice_id}/details?organization=${invoiceData.organization_id}`;
    window.open(zohoPaymentUrl, '_blank');
  };

  const handleCancel = () => {
    if (invoiceData.cancel_url) {
      router.push(invoiceData.cancel_url);
    } else {
      router.push('/checkout');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (!invoiceData?.invoice_id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Payment Error</h1>
          <p className="text-gray-600 mb-6">Invalid payment parameters. Please return to checkout and try again.</p>
          <button
            onClick={() => router.push('/checkout')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Return to Checkout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Complete Your Payment</h1>
          <p className="mt-2 text-gray-600">Secure payment powered by Stripe</p>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Invoice Number:</span>
              <span className="font-medium">{invoiceData.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Customer:</span>
              <span className="font-medium">{invoiceData.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium">{invoiceData.customer_email}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Amount:</span>
                <span>${invoiceData.amount?.toFixed(2)} {invoiceData.currency}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Status Messages */}
        {paymentStatus === 'processing' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <Loader2 className="h-5 w-5 text-blue-500 mr-2 animate-spin" />
              <span className="text-blue-800">Creating secure payment session...</span>
            </div>
          </div>
        )}

        {paymentStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-800">Payment setup failed. Please try again or contact support.</span>
            </div>
          </div>
        )}

        {/* Payment Action */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h2>
          
          <div className="space-y-4">
            {/* Primary: Stripe Checkout */}
            <button
              onClick={createStripePaymentSession}
              disabled={isProcessing}
              className="w-full flex items-center justify-center px-6 py-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CreditCard className="h-5 w-5 mr-2" />
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Creating Payment Session...
                </>
              ) : (
                `Pay $${invoiceData.amount?.toFixed(2)} with Stripe`
              )}
            </button>

            {/* Secondary: Direct Zoho Payment */}
            <button
              onClick={handleDirectZohoPayment}
              disabled={isProcessing}
              className="w-full flex items-center justify-center px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CreditCard className="h-5 w-5 mr-2" />
              Pay via Zoho Inventory
            </button>

            {/* Cancel */}
            <button
              onClick={handleCancel}
              disabled={isProcessing}
              className="w-full flex items-center justify-center px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Cancel & Return to Checkout
            </button>
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="text-sm text-green-800">
                <div className="font-medium mb-1">Secure Payment</div>
                <div>Your payment is processed securely through Stripe. We never store your card details.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details (for debugging) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 bg-gray-100 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Debug Info:</h3>
            <pre className="text-xs text-gray-600 overflow-auto">
              {JSON.stringify(invoiceData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}