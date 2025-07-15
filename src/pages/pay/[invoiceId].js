/**
 * src/pages/pay/[invoiceId].js - NEW PUBLIC PAYMENT PAGE
 * This creates a public payment page similar to your sample URL format
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, CreditCard, Shield, CheckCircle, AlertCircle } from 'lucide-react';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// Main payment page component
export default function PublicPaymentPage() {
  const router = useRouter();
  const { invoiceId, ...queryParams } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (invoiceId && Object.keys(queryParams).length > 0) {
      // Verify the security token
      const isValidToken = verifyPaymentToken(
        invoiceId,
        queryParams.customer_email,
        queryParams.amount,
        queryParams.token
      );

      if (!isValidToken) {
        setError('Invalid payment link. Please contact support.');
        setLoading(false);
        return;
      }

      setPaymentData({
        invoice_id: invoiceId,
        ...queryParams
      });
      setLoading(false);
    }
  }, [invoiceId, queryParams]);

  const verifyPaymentToken = (invoiceId, email, amount, token) => {
    // Verify token matches what we expect (implement client-side verification)
    // For production, this should also be verified server-side
    return token && token.length === 32; // Basic validation
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen error={error} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md mx-auto pt-16 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-white rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center shadow-lg">
            <CreditCard className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Secure Payment</h1>
          <p className="text-gray-600">Travel Data WiFi</p>
        </div>

        {/* Payment Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          {/* Order Summary */}
          <div className="border-b pb-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Invoice</span>
                <span className="font-medium">{paymentData.invoice_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Customer</span>
                <span className="font-medium">{paymentData.customer_name}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                <span>Total</span>
                <span className="text-green-600">${parseFloat(paymentData.amount).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Stripe Payment Form */}
          <Elements stripe={stripePromise}>
            <PaymentForm paymentData={paymentData} />
          </Elements>
        </div>

        {/* Security Notice */}
        <div className="text-center text-sm text-gray-500">
          <div className="flex items-center justify-center mb-2">
            <Shield className="h-4 w-4 mr-1" />
            Secured by 256-bit SSL encryption
          </div>
          <p>Your payment information is safe and secure</p>
        </div>
      </div>
    </div>
  );
}

// Payment form component
function PaymentForm({ paymentData }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    try {
      // Create payment intent
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(parseFloat(paymentData.amount) * 100), // Convert to cents
          currency: 'usd',
          invoice_id: paymentData.invoice_id,
          customer_email: paymentData.customer_email,
          invoice_number: paymentData.invoice_number
        })
      });

      const { client_secret } = await response.json();

      // Confirm payment
      const { error: stripeError } = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            email: paymentData.customer_email,
            name: paymentData.customer_name
          }
        }
      });

      if (stripeError) {
        setError(stripeError.message);
      } else {
        setSuccess(true);
        // Redirect to success page
        setTimeout(() => {
          window.location.href = paymentData.success_url;
        }, 2000);
      }
    } catch (err) {
      setError('Payment failed. Please try again.');
    }

    setProcessing(false);
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h3>
        <p className="text-gray-600">Redirecting you to confirmation page...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Information
        </label>
        <div className="border rounded-md p-3 bg-gray-50">
          <CardElement 
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': { color: '#aab7c4' }
                }
              }
            }}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
            <div className="ml-3 text-sm text-red-700">{error}</div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {processing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Processing...
          </>
        ) : (
          <>
            <Shield className="h-4 w-4 mr-2" />
            Pay ${parseFloat(paymentData.amount).toFixed(2)}
          </>
        )}
      </button>
    </form>
  );
}

// Loading screen component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading secure payment...</p>
      </div>
    </div>
  );
}

// Error screen component
function ErrorScreen({ error }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Error</h1>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.href = '/'}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          Return Home
        </button>
      </div>
    </div>
  );
}
