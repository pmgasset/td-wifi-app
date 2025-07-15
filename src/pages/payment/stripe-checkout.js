import React, { useState } from 'react';
import { Loader2, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';

// Example checkout handler component that integrates with your Zoho Inventory checkout
export default function CheckoutHandler() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState('ready');

  const handleCheckout = async (customerInfo, shippingAddress, cartItems) => {
    setIsProcessing(true);
    setCheckoutStatus('processing');

    try {
      console.log('Starting Zoho Inventory checkout...');

      const response = await fetch('/api/guest-checkout-inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerInfo,
          shippingAddress,
          cartItems,
          orderNotes: 'Guest checkout order'
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Checkout successful:', result);
        
        // CRITICAL: Check if we should redirect to payment
        if (result.redirect_to_payment && result.payment_url) {
          console.log('🔄 Redirecting to payment:', result.payment_url);
          
          // Immediate redirect to payment page
          window.location.href = result.payment_url;
          return;
        }
        
        // Fallback: Show success message if no redirect
        setCheckoutStatus('success');
        console.log('Order created successfully:', result.invoice_number);
        
      } else {
        throw new Error(result.details || 'Checkout failed');
      }

    } catch (error) {
      console.error('❌ Checkout failed:', error);
      setCheckoutStatus('error');
      setIsProcessing(false);
    }
  };

  // Example usage in your checkout button click
  const handleSubmit = async () => {
    
    // Example customer data - replace with your form data
    const customerInfo = {
      firstName: 'David',
      lastName: 'Prata', 
      email: 'david@prata.llc',
      phone: '4016237143'
    };

    const shippingAddress = {
      address1: '123 Main St',
      city: 'Providence',
      state: 'RI',
      zipCode: '02903',
      country: 'US'
    };

    const cartItems = [
      {
        product_id: 'some-product-id',
        product_name: 'GL.iNet X750 (SPITZ) Router',
        product_price: 149.00,
        quantity: 1
      }
    ];

    await handleCheckout(customerInfo, shippingAddress, cartItems);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Complete Your Order</h2>
      
      {checkoutStatus === 'processing' && (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Creating your order...</p>
            <p className="text-sm text-gray-500 mt-2">You'll be redirected to payment shortly</p>
          </div>
        </div>
      )}

      {checkoutStatus === 'success' && (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-4" />
            <p className="text-gray-600">Order created successfully!</p>
            <p className="text-sm text-gray-500 mt-2">Check your email for payment instructions</p>
          </div>
        </div>
      )}

      {checkoutStatus === 'error' && (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-4" />
            <p className="text-gray-600">Checkout failed</p>
            <p className="text-sm text-gray-500 mt-2">Please try again or contact support</p>
            <button
              onClick={() => setCheckoutStatus('ready')}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {checkoutStatus === 'ready' && (
        <div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Information
              </label>
              <p className="text-sm text-gray-500">
                Replace this with your actual checkout form
              </p>
            </div>
            
            <button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CreditCard className="h-5 w-5 mr-2" />
              {isProcessing ? 'Processing...' : 'Complete Order & Pay'}
            </button>
          </div>
        </div>
      )}

      {/* Integration Instructions */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Integration Notes:</h3>
        <div className="text-xs text-gray-600 space-y-1">
          <p>• Replace handleSubmit with your actual form submission</p>
          <p>• Pass real customer data from your form</p>
          <p>• The checkout will auto-redirect to Stripe payment</p>
          <p>• Success page will handle post-payment flow</p>
        </div>
      </div>
    </div>
  );
}