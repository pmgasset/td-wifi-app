import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Loader2, CreditCard, ExternalLink, Shield, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

/**
 * Enhanced Payment Page with Multiple Reliable Options
 * Supports both Zoho public shared links and fallback payment methods
 */
export default function EnhancedPaymentPage() {
  const router = useRouter();
  const { id: invoiceId, ...queryParams } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('zoho_public');

  useEffect(() => {
    if (invoiceId && Object.keys(queryParams).length > 0) {
      setPaymentData({
        invoice_id: invoiceId,
        ...queryParams
      });
      setLoading(false);
    }
  }, [invoiceId, queryParams]);

  // Enhanced Stripe payment handler
  const handleStripePayment = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      console.log('🔄 Starting enhanced Stripe payment...');
      
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_id: paymentData.invoice_id,
          amount: parseFloat(paymentData.amount),
          currency: paymentData.currency || 'USD',
          customer_email: paymentData.customer_email,
          customer_name: paymentData.customer_name,
          success_url: paymentData.success_url,
          cancel_url: paymentData.cancel_url,
          metadata: {
            invoice_number: paymentData.invoice_number,
            request_id: paymentData.request_id,
            zoho_invoice_id: paymentData.invoice_id,
            zoho_org_id: paymentData.zoho_org_id
          }
        })
      });

      const sessionData = await response.json();

      if (sessionData.success && sessionData.checkout_url) {
        console.log('✅ Stripe session created, redirecting...');
        window.location.href = sessionData.checkout_url;
      } else {
        throw new Error(sessionData.error || 'Failed to create payment session');
      }
    } catch (error) {
      console.error('❌ Stripe payment error:', error);
      setError(`Stripe payment failed: ${error.message}`);
      setIsProcessing(false);
    }
  };

  // Enhanced Zoho public payment handler
  const handleZohoPublicPayment = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      console.log('🔄 Checking for Zoho public shared link...');
      
      // First, try to get or create a public shared link
      const response = await fetch('/api/zoho/create-public-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_id: paymentData.invoice_id,
          customer_email: paymentData.customer_email,
          customer_name: paymentData.customer_name
        })
      });

      const linkData = await response.json();

      if (linkData.success && linkData.public_url) {
        console.log('✅ Public shared link available, redirecting...');
        window.open(linkData.public_url, '_blank');
        
        // Show success message and redirect after a delay
        setTimeout(() => {
          router.push(paymentData.success_url || '/checkout/success');
        }, 3000);
      } else {
        throw new Error(linkData.error || 'Failed to create public payment link');
      }
    } catch (error) {
      console.error('❌ Zoho public payment error:', error);
      setError(`Zoho payment setup failed: ${error.message}`);
      setIsProcessing(false);
    }
  };

  // Zoho portal fallback handler
  const handleZohoPortalPayment = () => {
    const portalUrl = `https://books.zoho.com/portal/invoices/${paymentData.invoice_id}/view?organization=${paymentData.zoho_org_id}&email=${encodeURIComponent(paymentData.customer_email)}`;
    window.open(portalUrl, '_blank');
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading payment options...</p>
        </div>
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Error</h1>
          <p className="text-gray-600 mb-4">Invalid payment information. Please try again.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={handleCancel}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to checkout
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900">Complete Your Payment</h1>
          <p className="text-gray-600 mt-2">
            Choose your preferred payment method to complete your order
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Payment Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Methods */}
        <div className="space-y-4 mb-8">
          {/* Method 1: Zoho Public Payment (Recommended) */}
          <div className="bg-white rounded-lg shadow-sm border-2 border-green-500 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600 mr-4" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Secure Invoice Payment
                    <span className="ml-2 text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">Recommended</span>
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Pay securely through our invoice portal - supports multiple payment methods
                  </p>
                  <div className="flex items-center mt-2 text-sm text-green-600">
                    <Shield className="h-4 w-4 mr-1" />
                    Bank-level security • No account required
                  </div>
                </div>
              </div>
              <button
                onClick={handleZohoPublicPayment}
                disabled={isProcessing}
                className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center font-medium"
              >
                {isProcessing && paymentMethod === 'zoho_public' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Opening...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Pay Now
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Method 2: Stripe Direct Payment */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-blue-600 mr-4" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Credit Card Payment</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Pay directly with your credit or debit card via Stripe
                  </p>
                  <div className="flex items-center mt-2 text-sm text-blue-600">
                    <Shield className="h-4 w-4 mr-1" />
                    PCI compliant • Instant processing
                  </div>
                </div>
              </div>
              <button
                onClick={handleStripePayment}
                disabled={isProcessing}
                className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center font-medium"
              >
                {isProcessing && paymentMethod === 'stripe' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pay with Card
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Method 3: Alternative Zoho Portal */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <ExternalLink className="h-8 w-8 text-gray-600 mr-4" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Customer Portal</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Access your invoice through our customer portal
                  </p>
                  <div className="flex items-center mt-2 text-sm text-gray-500">
                    Account access may be required
                  </div>
                </div>
              </div>
              <button
                onClick={handleZohoPortalPayment}
                className="bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 flex items-center font-medium"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Portal
              </button>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Invoice Number:</span>
              <span className="font-medium">{paymentData.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Customer:</span>
              <span className="font-medium">{paymentData.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium">{paymentData.customer_email}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Amount:</span>
                <span className="text-green-600">{formatCurrency(paymentData.amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center">
            <Shield className="h-4 w-4 mr-1" />
            All payments are secured with 256-bit SSL encryption
          </div>
        </div>
      </div>
    </div>
  );
}