// ===== src/components/CheckoutForm.js =====

import React, { useState } from 'react';
import { Loader2, CreditCard, CheckCircle, AlertCircle, ShoppingCart } from 'lucide-react';

export default function CheckoutForm({ cartItems, onSuccess, onError }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState('ready');
  const [statusMessage, setStatusMessage] = useState('');
  
  // Form state
  const [customerInfo, setCustomerInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  
  const [shippingAddress, setShippingAddress] = useState({
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US'
  });

  const updateCheckoutStatus = (status, message) => {
    setCheckoutStatus(status);
    setStatusMessage(message);
  };

const handleZohoInventoryCheckoutComponent = async () => {
  setIsProcessing(true);
  updateCheckoutStatus('processing', 'Creating your order...');

  try {
    console.log('🛒 Starting Zoho Inventory checkout...');

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
      
      // CRITICAL FIX: Enhanced payment redirect handling
      const paymentUrl = result.checkout_url || result.payment_url;
      
      if (result.redirect_to_payment && paymentUrl) {
        console.log('🔄 Redirecting to payment:', paymentUrl);
        
        updateCheckoutStatus('redirecting', 'Redirecting to secure payment...');
        
        // Call success callback if provided
        if (onSuccess) {
          onSuccess(result);
        }
        
        // Enhanced redirect with error handling
        setTimeout(() => {
          try {
            if (isValidUrl(paymentUrl)) {
              window.location.href = paymentUrl;
            } else {
              throw new Error('Invalid payment URL');
            }
          } catch (redirectError) {
            console.error('❌ Redirect failed:', redirectError);
            updateCheckoutStatus('error', 'Redirect failed. Please contact support.');
            if (onError) {
              onError(new Error('Payment redirect failed'));
            }
          }
        }, 1500);
        
        return;
      }
      
      // Fallback: Show success without redirect
      updateCheckoutStatus('success', `Order ${result.invoice_number} created successfully!`);
      
      if (onSuccess) {
        onSuccess(result);
      }

    } else {
      console.error('❌ Checkout failed:', result);
      const errorMessage = result.details || result.error || 'Checkout failed';
      updateCheckoutStatus('error', errorMessage);
      
      if (onError) {
        onError(new Error(errorMessage));
      }
    }

  } catch (error) {
    console.error('❌ Checkout error:', error);
    updateCheckoutStatus('error', `Checkout failed: ${error.message}`);
    
    if (onError) {
      onError(error);
    }
  } finally {
    setIsProcessing(false);
  }
};

/**
 * ENHANCED: Main form submission handler
 * Add this to your checkout form's onSubmit
 */
const handleEnhancedSubmit = async (e) => {
  e.preventDefault();
  
  if (!validateForm()) {
    toast.error('Please fix the validation errors');
    return;
  }

  if (!agreeToTerms) {
    toast.error('Please agree to the terms and conditions');
    return;
  }

  setIsProcessing(true);
  
  try {
    // Prepare cart items with enhanced validation
    const cartItems = prepareCartItems(items);
    
    // Validate cart items
    if (!cartItems || cartItems.length === 0) {
      throw new Error('Cart is empty');
    }
    
    // Check for invalid items
    const invalidItems = cartItems.filter(item => 
      !item.product_price || item.product_price <= 0 ||
      !item.quantity || item.quantity <= 0
    );
    
    if (invalidItems.length > 0) {
      throw new Error('Some items in your cart have invalid pricing or quantities');
    }
    
    console.log('📦 Validated cart items:', cartItems.length);
    
    // Call the enhanced checkout handler
    const result = await handleZohoInventoryCheckout(customerInfo, shippingAddress, cartItems);
    
    if (!result.redirected) {
      // Handle success without redirect (shouldn't happen but just in case)
      console.log('Order created successfully:', result);
      clearCart();
      router.push('/checkout/success');
    }

  } catch (error) {
    console.error('❌ Form submission error:', error);
    toast.error(`Checkout failed: ${error.message}`);
  } finally {
    setIsProcessing(false);
  }
};

// Export the enhanced functions
export {
  handleZohoInventoryCheckout,
  handleZohoInventoryCheckoutComponent,
  handleEnhancedSubmit,
  isValidUrl,
  showPaymentLinkFallback
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    const requiredFields = {
      'First Name': customerInfo.firstName,
      'Last Name': customerInfo.lastName,
      'Email': customerInfo.email,
      'Address': shippingAddress.address1,
      'City': shippingAddress.city,
      'State': shippingAddress.state,
      'ZIP Code': shippingAddress.zipCode
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value || value.trim() === '')
      .map(([field, _]) => field);

    if (missingFields.length > 0) {
      updateCheckoutStatus('error', `Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerInfo.email)) {
      updateCheckoutStatus('error', 'Please enter a valid email address');
      return;
    }

    await handleZohoInventoryCheckout();
  };

  const handleReset = () => {
    setCheckoutStatus('ready');
    setStatusMessage('');
    setIsProcessing(false);
  };

  // Status display component
  const StatusDisplay = () => {
    const statusConfig = {
      processing: {
        icon: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-800'
      },
      redirecting: {
        icon: <Loader2 className="h-5 w-5 animate-spin text-purple-500" />,
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        textColor: 'text-purple-800'
      },
      success: {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-800'
      },
      error: {
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800'
      }
    };

    const config = statusConfig[checkoutStatus];
    if (!config || checkoutStatus === 'ready') return null;

    return (
      <div className={`p-4 rounded-lg ${config.bgColor} border ${config.borderColor} mb-6`}>
        <div className="flex items-center">
          {config.icon}
          <span className={`ml-2 ${config.textColor} font-medium`}>{statusMessage}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <ShoppingCart className="h-6 w-6 mr-2" />
          Complete Your Order
        </h2>

        <StatusDisplay />

        {checkoutStatus === 'ready' || checkoutStatus === 'error' ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerInfo.firstName}
                    onChange={(e) => setCustomerInfo({...customerInfo, firstName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerInfo.lastName}
                    onChange={(e) => setCustomerInfo({...customerInfo, lastName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Shipping Address</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={shippingAddress.address1}