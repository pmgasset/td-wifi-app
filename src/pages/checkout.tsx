// ===== src/pages/checkout.tsx (Updated for Zoho Hosted Only) =====
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
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
  ExternalLink,
  Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

const CheckoutPage: React.FC = () => {
  const router = useRouter();
  const { items, getTotalPrice, clearCart } = useCartStore();
  
  // Form state - only collect shipping info since payment is handled by Zoho
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
  
  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      router.push('/products');
    }
  }, [items.length, router]);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
  const shipping = subtotal >= 100 ? 0 : 9.99;
  const tax = Math.round(subtotal * 0.0875 * 100) / 100; // 8.75% tax rate
  const total = subtotal + shipping + tax;

  // US States for dropdown
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
          cartItems: items,
          orderNotes,
          checkoutType: 'hosted' // Force hosted checkout
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        if (result.details && Array.isArray(result.details)) {
          setValidationErrors(result.details);
        }
        throw new Error(result.error || 'Checkout failed');
      }
      
      // Redirect to Zoho's hosted checkout page
      if (result.checkout_url) {
        toast.success('Redirecting to secure checkout...');
        window.location.href = result.checkout_url;
      } else {
        throw new Error('No checkout URL received from Zoho');
      }
      
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Something went wrong. Please try again.');
      setIsProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <Layout title="Checkout - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
            <p className="text-gray-600 mb-6">Add some products to get started</p>
            <button
              onClick={() => router.push('/products')}
              className="bg-travel-blue text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse Products
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Secure Checkout - Travel Data WiFi">
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-travel-blue hover:text-blue-700 mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Cart</span>
            </button>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Secure Checkout</h1>
                <p className="text-gray-600 mt-2">Powered by Zoho Commerce</p>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Shield className="h-5 w-5 text-green-500" />
                <span>256-bit SSL Encrypted</span>
              </div>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h3 className="text-red-800 font-medium">Please fix the following errors:</h3>
                  <ul className="mt-2 text-red-700 list-disc list-inside">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Customer Information */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>Contact Information</span>
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={customerInfo.email}
                        onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="john@example.com"
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={customerInfo.firstName}
                        onChange={(e) => setCustomerInfo({...customerInfo, firstName: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="John"
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                    <MapPin className="h-5 w-5" />
                    <span>Shipping Address</span>
                  </h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        required
                        value={shippingAddress.address1}
                        onChange={(e) => setShippingAddress({...shippingAddress, address1: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="123 Main Street"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Apartment, Suite, etc. (Optional)
                      </label>
                      <input
                        type="text"
                        value={shippingAddress.address2}
                        onChange={(e) => setShippingAddress({...shippingAddress, address2: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="Apt 4B"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          City *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingAddress.city}
                          onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        >
                          <option value="">Select State</option>
                          {states.map(state => (
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                          placeholder="78701"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Notes */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Notes (Optional)</h2>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
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
                          <span>Redirecting to Secure Checkout...</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-5 w-5" />
                          <span>Continue to Secure Payment - ${total.toFixed(2)}</span>
                        </>
                      )}
                    </button>

                    <div className="text-center text-sm text-gray-600">
                      You will be redirected to Zoho Commerce's secure checkout page to complete your payment
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
                
                {/* Order Totals */}
                <div className="space-y-2 mb-6 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
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
                  <div className="mb-6 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-travel-blue">
                      Add ${(100 - subtotal).toFixed(2)} more for free shipping!
                    </p>
                  </div>
                )}
                
                {/* Security Features */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                    <Shield className="h-4 w-4" />
                    <span>Secure Checkout</span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>✓ Powered by Zoho Commerce</p>
                    <p>✓ PCI DSS Compliant</p>
                    <p>✓ 256-bit SSL Encrypted</p>
                    <p>✓ Multiple Payment Options</p>
                    <p>✓ No payment data stored on our servers</p>
                  </div>
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