// src/pages/checkout-enhanced.tsx
/**
 * Enhanced Checkout Page with Direct Stripe Integration
 * 
 * MAJOR IMPROVEMENTS:
 * 1. Direct Stripe payment - customers never leave your website
 * 2. Simplified single-step checkout flow  
 * 3. Real-time payment processing
 * 4. Enhanced UX with better loading states
 * 5. No external redirects or complex Zoho payment flows
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft,
  User,
  MapPin,
  CreditCard,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  UserPlus,
  Package
} from 'lucide-react';

import Layout from '../components/Layout';
import { useCart } from '../context/CartContext';
import StripePaymentForm from '../components/StripePaymentForm';

export default function EnhancedCheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  
  // Checkout flow states
  const [currentStep, setCurrentStep] = useState('details'); // 'details', 'payment', 'success'
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  
  // Form data
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
  
  const [createAccount, setCreateAccount] = useState(false);
  const [customerPassword, setCustomerPassword] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  // Validation
  const [validationErrors, setValidationErrors] = useState([]);

  // Redirect if cart is empty
  useEffect(() => {
    if (!items || items.length === 0) {
      router.push('/cart');
    }
  }, [items, router]);

  // Calculate totals
  const subtotal = items?.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0) || 0;
  
  const tax = Math.round(subtotal * 0.0875 * 100) / 100; // 8.75% tax
  const shipping = subtotal >= 100 ? 0 : 9.99;
  const orderTotal = Math.round((subtotal + tax + shipping) * 100) / 100;

  /**
   * Handle checkout details submission
   */
  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      toast.error('Please fix the errors below');
      return;
    }
    
    setValidationErrors([]);
    setIsProcessing(true);
    
    try {
      console.log('🔄 Creating Stripe checkout session...');
      
      // Call our new direct Stripe checkout API
      const response = await fetch('/api/checkout/stripe-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerInfo,
          shippingAddress,
          cartItems: items.map(item => ({
            product_id: item.id || item.product_id,
            product_name: item.name || item.product_name,
            product_price: item.price || item.product_price,
            quantity: item.quantity,
            sku: item.sku || item.product_sku
          })),
          orderNotes,
          createAccount,
          customerPassword: createAccount ? customerPassword : null
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.details || result.error || 'Checkout failed');
      }
      
      console.log('✅ Stripe checkout session created:', result);
      
      // Show success message based on account creation
      if (result.customer.accountCreated) {
        toast.success('Account created! Complete your payment below.');
      } else if (result.customer.customerId) {
        toast.success('Welcome back! Complete your payment below.');
      } else {
        toast.success('Order prepared! Complete your payment below.');
      }
      
      // Store payment data and move to payment step
      setPaymentData(result);
      setCurrentStep('payment');
      
    } catch (error) {
      console.error('❌ Checkout error:', error);
      toast.error(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle successful payment
   */
  const handlePaymentSuccess = (paymentIntent) => {
    console.log('✅ Payment successful:', paymentIntent.id);
    toast.success('Payment successful! Redirecting to confirmation...');
    
    // Clear cart
    clearCart();
    
    // Redirect to success page with payment details
    setTimeout(() => {
      router.push(`/checkout/success?payment_intent=${paymentIntent.id}&order_id=${paymentData.order.orderId}`);
    }, 2000);
    
    setCurrentStep('success');
  };

  /**
   * Handle payment error
   */
  const handlePaymentError = (error) => {
    console.error('❌ Payment error:', error);
    toast.error(error.message || 'Payment failed. Please try again.');
  };

  /**
   * Form validation
   */
  const validateForm = () => {
    const errors = [];
    
    // Customer info validation
    if (!customerInfo.firstName.trim()) errors.push('First name is required');
    if (!customerInfo.lastName.trim()) errors.push('Last name is required');
    if (!customerInfo.email.trim()) errors.push('Email is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
      errors.push('Valid email address is required');
    }
    
    // Shipping address validation
    if (!shippingAddress.address1.trim()) errors.push('Street address is required');
    if (!shippingAddress.city.trim()) errors.push('City is required');
    if (!shippingAddress.state.trim()) errors.push('State is required');
    if (!shippingAddress.zipCode.trim()) errors.push('ZIP code is required');
    
    // Account creation validation
    if (createAccount) {
      if (!customerPassword.trim()) errors.push('Password is required for account creation');
      if (customerPassword.length < 6) errors.push('Password must be at least 6 characters');
    }
    
    // Terms validation
    if (!agreeToTerms) errors.push('You must agree to the terms and conditions');
    
    return errors;
  };

  /**
   * Handle back to cart
   */
  const handleBackToCart = () => {
    router.push('/cart');
  };

  // Loading state
  if (!items || items.length === 0) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading checkout...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={handleBackToCart}
              className="flex items-center text-blue-600 hover:text-blue-700 mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cart
            </button>
            
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Secure Checkout
              </h1>
              <p className="text-gray-600">
                Complete your purchase without leaving our website
              </p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-8">
              <div className={`flex items-center space-x-2 ${
                currentStep === 'details' ? 'text-blue-600' : 
                currentStep === 'payment' || currentStep === 'success' ? 'text-green-600' : 'text-gray-400'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep === 'details' ? 'bg-blue-600 text-white' :
                  currentStep === 'payment' || currentStep === 'success' ? 'bg-green-600 text-white' : 'bg-gray-300'
                }`}>
                  {currentStep === 'payment' || currentStep === 'success' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span>1</span>
                  )}
                </div>
                <span className="font-medium">Details</span>
              </div>
              
              <div className={`w-16 h-0.5 ${
                currentStep === 'payment' || currentStep === 'success' ? 'bg-green-600' : 'bg-gray-300'
              }`}></div>
              
              <div className={`flex items-center space-x-2 ${
                currentStep === 'payment' ? 'text-blue-600' :
                currentStep === 'success' ? 'text-green-600' : 'text-gray-400'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep === 'payment' ? 'bg-blue-600 text-white' :
                  currentStep === 'success' ? 'bg-green-600 text-white' : 'bg-gray-300'
                }`}>
                  {currentStep === 'success' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span>2</span>
                  )}
                </div>
                <span className="font-medium">Payment</span>
              </div>
              
              <div className={`w-16 h-0.5 ${
                currentStep === 'success' ? 'bg-green-600' : 'bg-gray-300'
              }`}></div>
              
              <div className={`flex items-center space-x-2 ${
                currentStep === 'success' ? 'text-green-600' : 'text-gray-400'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep === 'success' ? 'bg-green-600 text-white' : 'bg-gray-300'
                }`}>
                  {currentStep === 'success' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span>3</span>
                  )}
                </div>
                <span className="font-medium">Complete</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Column - Forms/Payment */}
            <div className="space-y-6">
              
              {/* STEP 1: Customer Details Form */}
              {currentStep === 'details' && (
                <>
                  {/* Validation Errors */}
                  {validationErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                        <h3 className="text-red-800 font-medium">Please fix the following errors:</h3>
                      </div>
                      <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
                        {validationErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <form onSubmit={handleDetailsSubmit} className="space-y-6">
                    
                    {/* Customer Information */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <User className="h-5 w-5 mr-2 text-blue-600" />
                        Customer Information
                      </h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            First Name *
                          </label>
                          <input
                            type="text"
                            value={customerInfo.firstName}
                            onChange={(e) => setCustomerInfo({...customerInfo, firstName: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Last Name *
                          </label>
                          <input
                            type="text"
                            value={customerInfo.lastName}
                            onChange={(e) => setCustomerInfo({...customerInfo, lastName: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email Address *
                          </label>
                          <input
                            type="email"
                            value={customerInfo.email}
                            onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                        Shipping Address
                      </h2>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Street Address *
                          </label>
                          <input
                            type="text"
                            value={shippingAddress.address1}
                            onChange={(e) => setShippingAddress({...shippingAddress, address1: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Apartment, suite, etc. (optional)
                          </label>
                          <input
                            type="text"
                            value={shippingAddress.address2}
                            onChange={(e) => setShippingAddress({...shippingAddress, address2: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              City *
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.city}
                              onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              State *
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.state}
                              onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              ZIP Code *
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.zipCode}
                              onChange={(e) => setShippingAddress({...shippingAddress, zipCode: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Account Creation Option */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <UserPlus className="h-5 w-5 mr-2 text-blue-600" />
                        Account Options
                      </h2>
                      
                      <div className="space-y-4">
                        <label className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={createAccount}
                            onChange={(e) => setCreateAccount(e.target.checked)}
                            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              Create an account for faster future checkout
                            </span>
                            <p className="text-sm text-gray-600">
                              Save your information for next time and track your orders
                            </p>
                          </div>
                        </label>
                        
                        {createAccount && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Password *
                            </label>
                            <input
                              type="password"
                              value={customerPassword}
                              onChange={(e) => setCustomerPassword(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required={createAccount}
                              minLength={6}
                              placeholder="Minimum 6 characters"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Order Notes */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Order Notes (Optional)
                      </h2>
                      <textarea
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Any special instructions for your order..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                      />
                    </div>

                    {/* Terms and Submit */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <label className="flex items-start space-x-3 mb-4">
                        <input
                          type="checkbox"
                          checked={agreeToTerms}
                          onChange={(e) => setAgreeToTerms(e.target.checked)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-600">
                          I agree to the{' '}
                          <a href="/terms" target="_blank" className="text-blue-600 hover:underline">
                            Terms of Service
                          </a>{' '}
                          and{' '}
                          <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">
                            Privacy Policy
                          </a>
                        </span>
                      </label>
                      
                      <button
                        type="submit"
                        disabled={isProcessing || !agreeToTerms}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Preparing Checkout...</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4" />
                            <span>Continue to Payment</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* STEP 2: Payment */}
              {currentStep === 'payment' && paymentData && (
                <StripePaymentForm
                  clientSecret={paymentData.payment.clientSecret}
                  orderDetails={paymentData.order}
                  customerInfo={customerInfo}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              )}

              {/* STEP 3: Success */}
              {currentStep === 'success' && (
                <div className="bg-white rounded-lg shadow-md p-8 text-center">
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Order Complete!
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Thank you for your purchase. You will receive a confirmation email shortly.
                  </p>
                  <button
                    onClick={() => router.push('/')}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Continue Shopping
                  </button>
                </div>
              )}
            </div>

            {/* Right Column - Order Summary */}
            <div className="bg-white rounded-lg shadow-md p-6 h-fit">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Package className="h-5 w-5 mr-2 text-blue-600" />
                Order Summary
              </h2>
              
              {/* Cart Items */}
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4">
                    <img
                      src={item.image || '/images/placeholder.jpg'}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                      <p className="text-sm font-medium text-gray-900">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <span className="text-gray-900">
                    {shipping > 0 ? `$${shipping.toFixed(2)}` : 'FREE'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="text-gray-900">${tax.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-lg font-semibold">
                  <span className="text-gray-900">Total</span>
                  <span className="text-blue-600">${orderTotal.toFixed(2)}</span>
                </div>
              </div>
              
              {/* Security Notice */}
              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <div className="font-medium mb-1">Secure Direct Payment</div>
                    <div>No redirects - complete your purchase safely on our website with Stripe's secure payment processing.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}