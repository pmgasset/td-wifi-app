// ===== src/pages/checkout-enhanced.tsx ===== (UPDATED FOR UNIFIED APPROACH)

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { useCartStore } from '../store/cart';
import { 
  ShoppingCart, 
  MapPin, 
  User, 
  Mail, 
  Phone, 
  AlertCircle, 
  Loader2,
  ArrowLeft,
  Shield,
  UserPlus,
  UserCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';

const EnhancedCheckoutPage = () => {
  const router = useRouter();
  const { items, getTotalPrice, isHydrated } = useCartStore();
  
  // Component state
  const [isLoading, setIsLoading] = useState(true);
  
  // Form state
  const [customerInfo, setCustomerInfo] = useState({
    email: '',
    firstName: '',
    lastName: '',
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
  
  const [orderNotes, setOrderNotes] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  // NEW: Account creation options for unified approach
  const [createAccount, setCreateAccount] = useState(false);
  const [customerPassword, setCustomerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [processStep, setProcessStep] = useState<'form' | 'processing' | 'success'>('form');

  // Wait for cart to hydrate
  useEffect(() => {
    if (isHydrated) {
      setIsLoading(false);
    }
  }, [isHydrated]);

  // Calculate totals
  const subtotal = items?.reduce((sum, item) => sum + (item.product_price * item.quantity), 0) || 0;
  const shipping = subtotal >= 100 ? 0 : 9.99;
  const tax = Math.round(subtotal * 0.0875 * 100) / 100;
  const total = subtotal + shipping + tax;

  // US States
  const states = [
    { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
  ];

  // NEW: Unified checkout submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agreeToTerms) {
      toast.error('Please agree to the terms and conditions');
      return;
    }
    
    // Validate password if creating account
    if (createAccount && (!customerPassword || customerPassword.length < 6)) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    
    setIsProcessing(true);
    setValidationErrors([]);
    setProcessStep('processing');
    
    try {
      console.log('Starting unified checkout...');
      
      // NEW: Prepare unified checkout data
      const checkoutData = {
        customerInfo,
        shippingAddress,
        cartItems: items,
        orderNotes,
        // NEW: Specify checkout type based on user choice
        checkoutType: createAccount ? 'create_account' : 'guest',
        customerPassword: createAccount ? customerPassword : null
      };
      
      // NEW: Use unified endpoint
      const response = await fetch('/api/unified-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkoutData),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        if (result.details && Array.isArray(result.details)) {
          setValidationErrors(result.details);
        }
        throw new Error(result.error || 'Unified checkout failed');
      }
      
      console.log('✅ Unified checkout successful:', result);
      
      // NEW: Handle different customer statuses with appropriate messages
      switch (result.customer_status) {
        case 'new_account':
          toast.success('Account created! Redirecting to payment...');
          break;
        case 'existing_account':
          toast.success('Welcome back! Redirecting to payment...');
          break;
        case 'guest':
          toast.success('Order created! Redirecting to payment...');
          break;
        default:
          toast.success('Order processed! Redirecting to payment...');
      }
      
      setProcessStep('success');
      
      // Redirect to payment page
      if (result.payment_url) {
        setTimeout(() => {
          window.location.href = result.payment_url;
        }, 2000);
      } else {
        throw new Error('No payment URL received');
      }
      
    } catch (error: any) {
      console.error('Unified checkout error:', error);
      toast.error(error.message || 'Something went wrong. Please try again.');
      setProcessStep('form');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle back to cart
  const handleBackToCart = () => {
    router.push('/cart');
  };

  // Show loading state
  if (isLoading || !isHydrated) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-travel-blue" />
            <p className="text-gray-600">Loading checkout...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Redirect if cart is empty
  if (!items || items.length === 0) {
    router.push('/');
    return null;
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={handleBackToCart}
              className="flex items-center text-travel-blue hover:text-blue-700 mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cart
            </button>
            
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Enhanced Checkout
              </h1>
              <p className="text-gray-600">
                Unified checkout with optional account creation
              </p>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <h3 className="text-red-800 font-medium">Please fix the following issues:</h3>
              </div>
              <ul className="list-disc list-inside text-red-700 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Forms */}
            <div className="lg:col-span-2 space-y-8">
              {/* Customer Information */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center mb-4">
                  <User className="h-5 w-5 text-travel-blue mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Customer Information</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      required
                      value={customerInfo.email}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      placeholder="your@email.com"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      required
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      required
                      value={customerInfo.firstName}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      placeholder="John"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      required
                      value={customerInfo.lastName}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      placeholder="Doe"
                    />
                  </div>
                </div>
              </div>

              {/* NEW: Account Creation Section */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center mb-4">
                  <UserPlus className="h-5 w-5 text-travel-blue mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Account Options</h2>
                </div>
                
                <div className="space-y-4">
                  <label className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={createAccount}
                      onChange={(e) => setCreateAccount(e.target.checked)}
                      className="mt-1 h-4 w-4 text-travel-blue focus:ring-travel-blue border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Create an account for faster future checkout</div>
                      <div className="text-sm text-gray-600">
                        Save your information and track your orders easily
                      </div>
                    </div>
                  </label>
                  
                  {createAccount && (
                    <div className="ml-7 space-y-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                          Password *
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            id="password"
                            required={createAccount}
                            value={customerPassword}
                            onChange={(e) => setCustomerPassword(e.target.value)}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                            placeholder="Minimum 6 characters"
                            minLength={6}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Password must be at least 6 characters long
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center mb-4">
                  <MapPin className="h-5 w-5 text-travel-blue mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Shipping Address</h2>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="address1" className="block text-sm font-medium text-gray-700 mb-2">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      id="address1"
                      required
                      value={shippingAddress.address1}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, address1: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      placeholder="123 Main Street"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="address2" className="block text-sm font-medium text-gray-700 mb-2">
                      Apartment, suite, etc.
                    </label>
                    <input
                      type="text"
                      id="address2"
                      value={shippingAddress.address2}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, address2: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      placeholder="Apt 2B"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                        City *
                      </label>
                      <input
                        type="text"
                        id="city"
                        required
                        value={shippingAddress.city}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="New York"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                        State *
                      </label>
                      <select
                        id="state"
                        required
                        value={shippingAddress.state}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      >
                        <option value="">Select State</option>
                        {states.map(state => (
                          <option key={state.code} value={state.code}>
                            {state.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-2">
                        ZIP Code *
                      </label>
                      <input
                        type="text"
                        id="zipCode"
                        required
                        value={shippingAddress.zipCode}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, zipCode: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="12345"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Notes */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center mb-4">
                  <Mail className="h-5 w-5 text-travel-blue mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Order Notes</h2>
                </div>
                
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                  placeholder="Any special instructions for your order..."
                />
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
                <div className="flex items-center mb-4">
                  <ShoppingCart className="h-5 w-5 text-travel-blue mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Order Summary</h2>
                </div>
                
                {/* Cart Items */}
                <div className="space-y-3 mb-6">
                  {items.map((item) => (
                    <div key={item.product_id} className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">
                          {item.product_name}
                        </div>
                        <div className="text-gray-500 text-xs">
                          Qty: {item.quantity}
                        </div>
                      </div>
                      <div className="text-gray-900 font-medium text-sm">
                        ${(item.product_price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Totals */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-gray-900">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping</span>
                    <span className="text-gray-900">
                      {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span className="text-gray-900">${tax.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-lg font-semibold">
                    <span className="text-gray-900">Total</span>
                    <span className="text-travel-blue">${total.toFixed(2)}</span>
                  </div>
                </div>
                
                {/* NEW: Enhanced Features Notice */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <div className="font-medium mb-1">Unified Checkout</div>
                      <div>One endpoint handles both guest and account checkout with Storefront API - no address character limits!</div>
                    </div>
                  </div>
                </div>
                
                {/* Terms and Submit */}
                <div className="mt-6">
                  <label className="flex items-start space-x-3 mb-4">
                    <input
                      type="checkbox"
                      checked={agreeToTerms}
                      onChange={(e) => setAgreeToTerms(e.target.checked)}
                      className="mt-1 h-4 w-4 text-travel-blue focus:ring-travel-blue border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-600">
                      I agree to the{' '}
                      <a href="/terms" target="_blank" className="text-travel-blue hover:underline">
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a href="/privacy" target="_blank" className="text-travel-blue hover:underline">
                        Privacy Policy
                      </a>
                    </span>
                  </label>
                  
                  <button
                    type="submit"
                    disabled={isProcessing || !agreeToTerms}
                    className="w-full bg-travel-blue text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>
                          {createAccount ? 'Creating Account & Order...' : 'Processing Order...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4" />
                        <span>
                          {createAccount ? 'Create Account & Continue' : 'Continue as Guest'}
                        </span>
                      </>
                    )}
                  </button>
                  
                  <p className="text-xs text-gray-500 text-center mt-3">
                    {createAccount 
                      ? "Your customer account will be created automatically. You'll then be redirected to secure payment."
                      : "You'll be redirected to secure payment. No account required."
                    }
                  </p>
                </div>
              </div>
            </div>
          </form>
          
          {/* NEW: Process Steps - Updated for Unified Approach */}
          <div className="mt-12 bg-white rounded-lg shadow-sm p-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">
              Unified Checkout Process
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-blue-600 font-bold">1</span>
                </div>
                <h4 className="font-medium text-gray-900 mb-2">Choose Option</h4>
                <p className="text-sm text-gray-600">
                  Select guest checkout or create account for future convenience
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-green-600 font-bold">2</span>
                </div>
                <h4 className="font-medium text-gray-900 mb-2">Process Order</h4>
                <p className="text-sm text-gray-600">
                  Unified API handles both guest and customer orders seamlessly
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-purple-600 font-bold">3</span>
                </div>
                <h4 className="font-medium text-gray-900 mb-2">Account Setup</h4>
                <p className="text-sm text-gray-600">
                  If selected, your account is created automatically with order
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-orange-600 font-bold">4</span>
                </div>
                <h4 className="font-medium text-gray-900 mb-2">Secure Payment</h4>
                <p className="text-sm text-gray-600">
                  Complete your purchase with our secure payment processor
                </p>
              </div>
            </div>
            
            {/* NEW: Benefits of Unified Approach */}
            <div className="mt-8 pt-8 border-t">
              <h4 className="text-center font-medium text-gray-900 mb-4">Benefits of Our Unified Checkout</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center justify-center space-x-2 text-green-600">
                  <UserCheck className="h-4 w-4" />
                  <span>No address character limits</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-blue-600">
                  <Shield className="h-4 w-4" />
                  <span>Storefront API reliability</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-purple-600">
                  <UserPlus className="h-4 w-4" />
                  <span>Optional account creation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default EnhancedCheckoutPage;