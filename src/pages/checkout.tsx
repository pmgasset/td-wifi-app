// ===== src/pages/checkout.tsx =====
import React from 'react';
import Layout from '../components/Layout';
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
  ArrowLeft,
  Truck,
  Settings,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

const CheckoutPage: React.FC = () => {
  const { items, getTotalPrice, clearCart } = useCartStore();
  
  // Checkout type selection
  const [checkoutType, setCheckoutType] = React.useState<'api' | 'hosted' | 'embedded'>('api');
  
  // Form state
  const [customerInfo, setCustomerInfo] = React.useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: ''
  });
  
  const [shippingAddress, setShippingAddress] = React.useState({
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US'
  });
  
  const [billingAddress, setBillingAddress] = React.useState({
    sameAsShipping: true,
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US'
  });
  
  const [paymentMethod, setPaymentMethod] = React.useState({
    type: 'credit_card',
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    nameOnCard: ''
  });
  
  const [orderNotes, setOrderNotes] = React.useState('');
  const [agreeToTerms, setAgreeToTerms] = React.useState(false);
  
  // UI state
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [orderComplete, setOrderComplete] = React.useState(false);
  const [orderResult, setOrderResult] = React.useState<any>(null);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const [embeddedWidget, setEmbeddedWidget] = React.useState<any>(null);
  
  // Redirect if cart is empty
  React.useEffect(() => {
    if (items.length === 0 && !orderComplete) {
      window.location.href = '/products';
    }
  }, [items.length, orderComplete]);
  
  // Calculate totals
  const subtotal = getTotalPrice();
  const tax = calculateTax(subtotal, shippingAddress.state);
  const shipping = calculateShipping(items, shippingAddress);
  const total = subtotal + tax + shipping;
  
  // US States
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
      const response = await fetch('/api/checkout', {
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
      
      setOrderResult(result);
      setOrderComplete(true);
      clearCart();
      toast.success('Order placed successfully!');
      
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
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
      <Layout title="Order Confirmed - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 py-12">
          <div className="max-w-2xl mx-auto px-4">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Order Confirmed!</h1>
              <p className="text-lg text-gray-600 mb-6">
                Thank you for your order. You'll receive a confirmation email shortly.
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
                </div>
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
      </Layout>
    );
  }
  
  return (
    <Layout title="Checkout - Travel Data WiFi">
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
                <span>Secure Checkout</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Checkout Form */}
            <div className="lg:col-span-2">
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

                {/* Payment Information */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <CreditCard className="h-6 w-6 text-travel-blue" />
                    <h2 className="text-xl font-semibold text-gray-900">Payment Information</h2>
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
                          <span>Complete Order - ${total.toFixed(2)}</span>
                        </>
                      )}
                    </button>
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
                
                {/* Security Notice */}
                <div className="mt-6 flex items-center space-x-2 text-sm text-gray-500">
                  <Lock className="h-4 w-4" />
                  <span>Your payment information is encrypted and secure</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CheckoutPage;