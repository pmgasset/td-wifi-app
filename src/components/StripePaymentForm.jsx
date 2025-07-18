// src/components/StripePaymentForm.jsx
/**
 * Direct Stripe Payment Form Component
 * 
 * This component handles the payment UI directly on your website.
 * No redirects - customers complete payment without leaving your site!
 */

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { 
  CreditCard, 
  Lock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Shield
} from 'lucide-react';

// Initialize Stripe (replace with your publishable key)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

/**
 * Main Stripe Payment Form Wrapper
 */
export default function StripePaymentForm({ 
  clientSecret, 
  orderDetails, 
  customerInfo,
  onSuccess,
  onError 
}) {
  if (!clientSecret) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-red-800">Payment setup required</span>
        </div>
      </div>
    );
  }

  const appearance = {
    theme: 'stripe',
    variables: {
      colorPrimary: '#2563eb', // Travel blue
      colorBackground: '#ffffff',
      colorText: '#1f2937',
      colorDanger: '#dc2626',
      fontFamily: 'Inter, system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '8px'
    },
    rules: {
      '.Tab': {
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      },
      '.Tab:hover': {
        borderColor: '#2563eb'
      }
    }
  };

  const options = {
    clientSecret,
    appearance,
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
          <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
          Complete Your Payment
        </h2>
        <p className="text-gray-600">
          Secure payment powered by Stripe
        </p>
      </div>

      <Elements options={options} stripe={stripePromise}>
        <CheckoutForm 
          orderDetails={orderDetails}
          customerInfo={customerInfo}
          onSuccess={onSuccess}
          onError={onError}
        />
      </Elements>
    </div>
  );
}

/**
 * Checkout Form Component (Inside Stripe Elements)
 */
function CheckoutForm({ orderDetails, customerInfo, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!stripe) return;

    // Check if payment intent status
    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    );

    if (!clientSecret) return;

    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      switch (paymentIntent.status) {
        case 'succeeded':
          setMessage('Payment succeeded!');
          if (onSuccess) onSuccess(paymentIntent);
          break;
        case 'processing':
          setMessage('Your payment is processing.');
          break;
        case 'requires_payment_method':
          setMessage('Your payment was not successful, please try again.');
          break;
        default:
          setMessage('Something went wrong.');
          break;
      }
    });
  }, [stripe, onSuccess]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      console.error('Stripe not loaded');
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success`,
          receipt_email: customerInfo.email,
        },
      });

      if (error) {
        if (error.type === 'card_error' || error.type === 'validation_error') {
          setMessage(error.message);
        } else {
          setMessage('An unexpected error occurred.');
        }
        
        if (onError) onError(error);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        setMessage('Payment succeeded!');
        if (onSuccess) onSuccess(paymentIntent);
      }
    } catch (error) {
      console.error('Payment error:', error);
      setMessage('Payment failed. Please try again.');
      if (onError) onError(error);
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-3">Order Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Order Number:</span>
            <span className="font-medium">{orderDetails.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal:</span>
            <span>${orderDetails.subtotal?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Tax:</span>
            <span>${orderDetails.tax?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Shipping:</span>
            <span>
              {orderDetails.shipping > 0 
                ? `$${orderDetails.shipping.toFixed(2)}` 
                : 'FREE'
              }
            </span>
          </div>
          <div className="border-t pt-2 flex justify-between font-semibold text-lg">
            <span>Total:</span>
            <span className="text-blue-600">${orderDetails.total?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment Element */}
      <div className="space-y-4">
        <PaymentElement 
          id="payment-element"
          onReady={() => setIsReady(true)}
          options={{
            layout: 'tabs'
          }}
        />
      </div>

      {/* Error/Success Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center space-x-2 ${
          message.includes('succeeded') 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {message.includes('succeeded') ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <span className={
            message.includes('succeeded') ? 'text-green-800' : 'text-red-800'
          }>
            {message}
          </span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || !isReady || isLoading}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing Payment...</span>
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            <span>Pay ${orderDetails.total?.toFixed(2)}</span>
          </>
        )}
      </button>

      {/* Security Notice */}
      <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
        <Shield className="h-4 w-4" />
        <span>Secured by Stripe • Your payment info is encrypted & secure</span>
      </div>
    </form>
  );
}

/**
 * Simplified Payment Status Component
 */
export function PaymentStatus({ status, message, orderDetails }) {
  const getStatusIcon = () => {
    switch (status) {
      case 'succeeded':
        return <CheckCircle className="h-8 w-8 text-green-600" />;
      case 'processing':
        return <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-8 w-8 text-red-600" />;
      default:
        return <CreditCard className="h-8 w-8 text-gray-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'succeeded':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'processing':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'failed':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className={`rounded-lg border p-6 ${getStatusColor()}`}>
      <div className="text-center">
        <div className="flex justify-center mb-4">
          {getStatusIcon()}
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {status === 'succeeded' && 'Payment Successful!'}
          {status === 'processing' && 'Payment Processing...'}
          {status === 'failed' && 'Payment Failed'}
          {!status && 'Payment Required'}
        </h3>
        {message && (
          <p className="text-sm mb-4">{message}</p>
        )}
        {orderDetails && status === 'succeeded' && (
          <div className="text-sm">
            <p>Order Number: <strong>{orderDetails.orderNumber}</strong></p>
            <p>Amount: <strong>${orderDetails.total?.toFixed(2)}</strong></p>
          </div>
        )}
      </div>
    </div>
  );
}