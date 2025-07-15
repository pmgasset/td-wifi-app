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

  const handleZohoInventoryCheckout = async () => {
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
        
        // CRITICAL: Check for immediate payment redirect
        if (result.redirect_to_payment && result.payment_url) {
          console.log('🔄 Redirecting to payment:', result.payment_url);
          
          updateCheckoutStatus('redirecting', 'Redirecting to secure payment...');
          
          // Call success callback if provided
          if (onSuccess) {
            onSuccess(result);
          }
          
          // Small delay to show the message, then redirect
          setTimeout(() => {
            window.location.href = result.payment_url;
          }, 1500);
          
          return;
        }
        
        // Fallback: No automatic redirect
        console.log('ℹ️ No redirect specified, showing success message');
        updateCheckoutStatus('success', `Order ${result.invoice_number} created successfully!`);
        
        if (onSuccess) {
          onSuccess(result);
        }

      } else {
        throw new Error(result.details || result.error || 'Checkout failed');
      }

    } catch (error) {
      console.error('❌ Checkout failed:', error);
      updateCheckoutStatus('error', `Checkout failed: ${error.message}`);
      
      if (onError) {
        onError(error);
      }
      
      setIsProcessing(false);
    }
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