import React, { useState, useEffect } from 'react';
import { useCartStore } from '../store/cart';
import { 
  CreditCard, 
  Lock, 
  ShoppingCart, 
  MapPin, 
  User, 
  Mail, 
  Phone, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  ExternalLink,
  ArrowLeft,
  Truck,
  Settings
} from 'lucide-react';
import toast from 'react-hot-toast';

const ZohoCheckoutPage: React.FC = () => {
  const { items, getTotalPrice, clearCart } = useCartStore();
  
  // Checkout type selection
  const [checkoutType, setCheckoutType] = useState<'api' | 'hosted' | 'embedded'>('api');
  
  // Form state (same as before)
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
  
  const [billingAddress, setBillingAddress] = useState({
    sameAsShipping: true,
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US'
  });
  
  const [paymentMethod, setPaymentMethod] = useState({
    type: 'credit_card',
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    nameOnCard: ''
  });
  
  const [orderNotes, setOrderNotes] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [embeddedWidget, setEmbeddedWidget] = useState<any>(null);
  
  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0 && !orderComplete) {
      window.location.href = '/products';
    }
  }, [items.length, orderComplete]);
  
  // Calculate totals
  const subtotal = getTotalPrice();
  const tax = calculateTax(subtotal, shippingAddress.state);
  const shipping = calculateShipping(items, shippingAddress);
  const total = subtotal + tax + shipping;
  
  // US States (same as before)
  const US_STATES = [
    { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
    { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
  ];
  
  function calculateTax(subtotal: number, state: string) {
    const taxRates: { [key: string]: number } = {
      'CA': 0.0875, 'NY': 0.08, 'TX': 0.0625, 'FL': 0.06, 'WA': 0.065
    };
    const rate = taxRates[state] || 0.05;
    return Math.round(subtotal * rate * 100) / 100;
  }
  
  function calculateShipping(items: any[], address: any) {
    if (subtotal >= 100) return 0;
    return 9.99;
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agreeToTerms) {
      toast.error('Please agree to the terms and conditions');
      return;
    }
    
    setIsProcessing(true);
    setValidationErrors([]);
    
    try {
      const response = await fetch('/api/zoho-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerInfo,
          shippingAddress,
          billingAddress,
          cartItems: items,
          paymentMethod,
          orderNotes,
          checkoutType
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        if (result.details && Array.isArray(result.details)) {
          setValidationErrors(result.details);
        }
        throw new Error(result.error || 'Checkout failed');
      }
      
      // Handle different response types
      if (result.type === 'hosted') {
        // Redirect to Zoho's hosted checkout
        window.location.href = result.checkout_url;
        return;
      } else if (result.type === 'embedded') {
        // Show embedded widget
        setEmbeddedWidget(result);
        loadZohoWidget(result);
        return;
      } else {
        // API checkout completed
        setOrderResult(result);
        setOrderComplete(true);
        clearCart();
        toast.success('Order placed successfully with Zoho Commerce!');
      }
      
    } catch (error: any) {
      console.error('Zoho checkout error:', error);
      toast.error(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const loadZohoWidget = (widgetData: any) => {
    // Load Zoho's embedded checkout widget
    const script = document.createElement('script');
    script.src = 'https://js.zohostatic.com/commerce/checkout/widget.js';
    script.onload = () => {
      // Initialize the widget
      (window as any).ZohoCheckout.init({
        widget_id: widgetData.widget_id,
        widget_token: widgetData.widget_token,
        container_id: 'zoho-checkout-widget',
        config: widgetData.config,
        callbacks: {
          onSuccess: (data: any) => {
            setOrderResult({
              success: true,
              orderId: data.order_id,
              orderNumber: data.order_number,
              total: data.total,
              message: 'Order placed successfully with Zoho Commerce!'
            });
            setOrderComplete(true);
            clearCart();
            toast.success('Order completed successfully!');
          },
          onError: (error: any) => {
            toast.error(`Payment failed: ${error.message}`);
            setIsProcessing(false);
          },
          onCancel: () => {
            toast.error('Payment was cancelled');
            setIsProcessing(false);
          }
        }
      });
    };
    document.head.appendChild(script);
  };
  
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };
  
  // Success page
  if (orderComplete && orderResult) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Order Confirmed!</h1>
            <p className="text-lg text-gray-600 mb-6">
              Your order has been successfully processed through Zoho Commerce. You'll receive a confirmation email shortly.
            </p>
            
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Order Number:</span>
                  <p className="text-gray-900">{orderResult.orderNumber}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Total:</span>
                  <p className="text-gray-900 font-bold">${orderResult.total.toFixed(2)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Payment ID:</span>
                  <p className="text-gray-900">{orderResult.paymentId}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <p className="text-green-600 font-medium">Confirmed</p>
                </div>
              </div>
              
              {orderResult.zohoOrderUrl && (
                <div className="mt-4 pt-4 border-t">
                  <a 
                    href={orderResult.zohoOrderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-travel-blue hover:text-blue-700"
                  >
                    <span>View in Zoho Commerce</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )}
            </div>
            
            <div className="flex space-x-4 justify-center">
              <button
                onClick={() => window.location.href = '/products'}
                className="bg-travel-blue text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Continue Shopping
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Show embedded widget if configured
  if (embeddedWidget) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setEmbeddedWidget(null)}
                  className="flex items-center space-x-2 text-travel-blue hover:text-blue-700"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span>Back to Checkout</span>
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Secure Payment</h1>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Lock className="h-4 w-4" />
                <span>Powered by Zoho Commerce</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 text-center">
              Complete Your Payment
            </h2>
            
            {/* Zoho Embedded Widget Container */}
            <div id="zoho-checkout-widget" className="min-h-96">
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-travel-blue" />
                <span className="ml-3 text-gray-600">Loading secure payment form...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => window.history.back()}
                className="flex items-center space-x-2 text-travel-blue hover:text-blue-700"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Lock className="h-4 w-4" />
              <span>Secure Checkout via Zoho Commerce</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Checkout Form */}
          <div className="lg:col-span-2">
            
            {/* Checkout Type Selection */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <div className="flex items-center space-x-3 mb-6">
                <Settings className="h-6 w-6 text-travel-blue" />
                <h2 className="text-xl font-semibold text-gray-900">Checkout Method</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className={`cursor-pointer border-2 rounded-lg p-4 ${checkoutType === 'api' ? 'border-travel-blue bg-blue-50' : 'border-gray-200'}`}>
                  <input
                    type="radio"
                    name="checkoutType"
                    value="api"
                    checked={checkoutType === 'api'}
                    onChange={(e) => setCheckoutType(e.target.value as any)}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 text-travel-blue" />
                    <h3 className="font-medium">Custom Form</h3>
                    <p className="text-sm text-gray-600 mt-1">Fill out payment details here</p>
                  </div>
                </label>
                
                <label className={`cursor-pointer border-2 rounded-lg p-4 ${checkoutType === 'embedded' ? 'border-travel-blue bg-blue-50' : 'border-gray-200'}`}>
                  <input
                    type="radio"
                    name="checkoutType"
                    value="embedded"
                    checked={checkoutType === 'embedded'}
                    onChange={(e) => setCheckoutType(e.target.value as any)}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <Lock className="h-8 w-8 mx-auto mb-2 text-travel-blue" />
                    <h3 className="font-medium">Embedded</h3>
                    <p className="text-sm text-gray-600 mt-1">Zoho secure widget</p>
                  </div>
                </label>
                
                <label className={`cursor-pointer border-2 rounded-lg p-4 ${checkoutType === 'hosted' ? 'border-travel-blue bg-50' : 'border-gray-200'}`}>
                  <input
                    type="radio"
                    name="checkoutType"
                    value="hosted"
                    checked={checkoutType === 'hosted'}
                    onChange={(e) => setCheckoutType(e.target.value as any)}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <ExternalLink className="h-8 w-8 mx-auto mb-2 text-travel-blue" />
                    <h3 className="font-medium">Hosted</h3>
                    <p className="text-sm text-gray-600 mt-1">Redirect to Zoho</p>
                  </div>
                </label>
              </div>
              
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-travel-blue">
                  {checkoutType === 'api' && 'Complete checkout on this page with Zoho Commerce payment processing.'}
                  {checkoutType === 'embedded' && 'Secure payment widget will be loaded from Zoho Commerce.'}
                  {checkoutType === 'hosted' && 'You will be redirected to Zoho Commerce\'s secure checkout page.'}
                </p>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                      <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                        {validationErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Information */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <User className="h-6 w-6 text-travel-blue" />
                  <h2 className="text-xl font-semibold text-gray-900">Contact Information</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerInfo.firstName}
                      onChange={(e) => setCustomerInfo({...customerInfo, firstName: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerInfo.lastName}
                      onChange={(e) => setCustomerInfo({...customerInfo, lastName: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        required
                        value={customerInfo.email}
                        onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="tel"
                        value={customerInfo.phone}
                        onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Truck className="h-6 w-6 text-travel-blue" />
                  <h2 className="text-xl font-semibold text-gray-900">Shipping Address</h2>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.address1}
                      onChange={(e) => setShippingAddress({...shippingAddress, address1: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      placeholder="123 Main Street"
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      placeholder="Apt 4B"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        value={shippingAddress.city}
                        onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="Austin"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        State *
                      </label>
                      <select
                        required
                        value={shippingAddress.state}
                        onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      >
                        <option value="">Select State</option>
                        {US_STATES.map(state => (
                          <option key={state.code} value={state.code}>{state.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ZIP Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={shippingAddress.zipCode}
                        onChange={(e) => setShippingAddress({...shippingAddress, zipCode: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="78701"
                        pattern="\d{5}(-\d{4})?"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Billing Address */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <MapPin className="h-6 w-6 text-travel-blue" />
                  <h2 className="text-xl font-semibold text-gray-900">Billing Address</h2>
                </div>
                
                <div className="mb-4">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={billingAddress.sameAsShipping}
                      onChange={(e) => setBillingAddress({...billingAddress, sameAsShipping: e.target.checked})}
                      className="h-5 w-5 text-travel-blue focus:ring-travel-blue border-gray-300 rounded"
                    />
                    <span className="text-gray-700">Same as shipping address</span>
                  </label>
                </div>
                
                {!billingAddress.sameAsShipping && (
                  <div className="space-y-4">
                    {/* Billing address fields - same structure as shipping */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        required={!billingAddress.sameAsShipping}
                        value={billingAddress.address1}
                        onChange={(e) => setBillingAddress({...billingAddress, address1: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      />
                    </div>
                    {/* ... other billing fields ... */}
                  </div>
                )}
              </div>

              {/* Payment Information - Only show for API checkout */}
              {checkoutType === 'api' && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <CreditCard className="h-6 w-6 text-travel-blue" />
                    <h2 className="text-xl font-semibold text-gray-900">Payment Information</h2>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Processed by Zoho Commerce
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name on Card *
                      </label>
                      <input
                        type="text"
                        required
                        value={paymentMethod.nameOnCard}
                        onChange={(e) => setPaymentMethod({...paymentMethod, nameOnCard: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="John Doe"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Card Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={paymentMethod.cardNumber}
                        onChange={(e) => setPaymentMethod({...paymentMethod, cardNumber: formatCardNumber(e.target.value)})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="1234 5678 9012 3456"
                        maxLength={19}
                      />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Month *
                        </label>
                        <select
                          required
                          value={paymentMethod.expiryMonth}
                          onChange={(e) => setPaymentMethod({...paymentMethod, expiryMonth: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        >
                          <option value="">MM</option>
                          {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                            <option key={month} value={month.toString().padStart(2, '0')}>
                              {month.toString().padStart(2, '0')}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Year *
                        </label>
                        <select
                          required
                          value={paymentMethod.expiryYear}
                          onChange={(e) => setPaymentMethod({...paymentMethod, expiryYear: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        >
                          <option value="">YYYY</option>
                          {Array.from({length: 10}, (_, i) => new Date().getFullYear() + i).map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          CVV *
                        </label>
                        <input
                          type="text"
                          required
                          value={paymentMethod.cvv}
                          onChange={(e) => setPaymentMethod({...paymentMethod, cvv: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                          placeholder="123"
                          maxLength={4}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Notes */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Notes (Optional)</h3>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                  placeholder="Special delivery instructions, setup preferences, etc."
                />
              </div>

              {/* Terms and Submit */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="space-y-4">
                  <label className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      required
                      checked={agreeToTerms}
                      onChange={(e) => setAgreeToTerms(e.target.checked)}
                      className="h-5 w-5 text-travel-blue focus:ring-travel-blue border-gray-300 rounded mt-0.5"
                    />
                    <span className="text-sm text-gray-700">
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
                    className="w-full bg-travel-blue text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Processing Order...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-5 w-5" />
                        <span>
                          {checkoutType === 'hosted' ? `Continue to Zoho - ${total.toFixed(2)}` :
                           checkoutType === 'embedded' ? `Secure Payment - ${total.toFixed(2)}` :
                           `Complete Order - ${total.toFixed(2)}`}
                        </span>
                      </>
                    )}
                  </button>
                  
                  <div className="text-center">
                    <p className="text-xs text-gray-500">
                      Powered by Zoho Commerce • PCI DSS Compliant • SSL Secured
                    </p>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <ShoppingCart className="h-5 w-5" />
                <span>Order Summary</span>
              </h3>
              
              {/* Cart Items */}
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.product_id} className="flex items-center space-x-4">
                    <div className="relative">
                      <img 
                        src={item.product_images?.[0] || '/images/placeholder.jpg'} 
                        alt={item.product_name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <span className="absolute -top-2 -right-2 bg-travel-blue text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm">{item.product_name}</h4>
                      <p className="text-travel-blue font-semibold">${(item.product_price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Price Breakdown */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? 'Free' : `${shipping.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-lg font-bold text-gray-900">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
              
              {/* Free Shipping Notice */}
              {subtotal < 100 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-travel-blue">
                    Add ${(100 - subtotal).toFixed(2)} more for free shipping!
                  </p>
                </div>
              )}
              
              {/* Zoho Commerce Badge */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                  <Lock className="h-4 w-4" />
                  <span>Secure Checkout</span>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>✓ Powered by Zoho Commerce</p>
                  <p>✓ PCI DSS Compliant</p>
                  <p>✓ SSL Encrypted</p>
                  <p>✓ Multiple Payment Options</p>
                </div>
              </div>
              
              {/* Checkout Method Info */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-travel-blue">
                  <strong>Selected Method:</strong>
                  <br />
                  {checkoutType === 'api' && 'Custom form with Zoho payment processing'}
                  {checkoutType === 'embedded' && 'Zoho embedded secure widget'}
                  {checkoutType === 'hosted' && 'Redirect to Zoho secure checkout'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZohoCheckoutPage;