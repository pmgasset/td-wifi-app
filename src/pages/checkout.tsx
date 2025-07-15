// ===== src/pages/checkout.tsx ===== (TYPESCRIPT FIXES APPLIED)

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
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

// TypeScript interfaces
interface CustomerInfo {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface ShippingAddress {
  address1: string;
  address2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface CartItem {
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  sku?: string;
  product_sku?: string;
}

interface CheckoutResult {
  success: boolean;
  redirect_to_payment?: boolean;
  payment_url?: string;
  checkout_url?: string;
  invoice_id?: string;
  invoice_number?: string;
  total_amount?: number;
  request_id?: string;
  error?: string;
  details?: string;
}

const CheckoutPage = () => {
  const router = useRouter();
  const { items, getTotalPrice, clearCart, isHydrated } = useCartStore();
  
  // Component state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Form state
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    email: '',
    firstName: '',
    lastName: '',
    phone: ''
  });
  
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US'
  });
  
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [agreeToTerms, setAgreeToTerms] = useState<boolean>(false);
  
  // UI state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

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

  // Helper function to validate URL
  const isValidUrl = (string: string): boolean => {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };

  // Helper function to show payment link fallback
  const showPaymentLinkFallback = (paymentUrl: string, orderResult: CheckoutResult): void => {
    const fallbackHtml = `
      <div style="
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
        background: rgba(0,0,0,0.8); z-index: 9999; 
        display: flex; align-items: center; justify-content: center;
      ">
        <div style="
          background: white; padding: 2rem; border-radius: 8px; 
          max-width: 500px; margin: 1rem; text-align: center;
        ">
          <h3 style="margin-bottom: 1rem; color: #059669;">Order Created Successfully!</h3>
          <p style="margin-bottom: 1rem;">
            Invoice: ${orderResult.invoice_number || 'N/A'}<br>
            Amount: $${orderResult.total_amount || 'N/A'}
          </p>
          <p style="margin-bottom: 1.5rem;">
            Please click the button below to complete your payment:
          </p>
          <a href="${paymentUrl}" 
             style="
               background: #3B82F6; color: white; padding: 12px 24px; 
               text-decoration: none; border-radius: 6px; display: inline-block;
             "
             target="_blank">
            Complete Payment
          </a>
          <p style="margin-top: 1rem; font-size: 0.875rem; color: #6B7280;">
            A new tab will open with your payment page
          </p>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', fallbackHtml);
    
    // Remove modal after 30 seconds
    setTimeout(() => {
      const modal = document.querySelector('[style*="z-index: 9999"]') as HTMLElement;
      if (modal) modal.remove();
    }, 30000);
  };

  // FIXED: Zoho Inventory Checkout Handler with proper TypeScript types
  const handleZohoInventoryCheckout = async (
    customerInfo: CustomerInfo, 
    shippingAddress: ShippingAddress, 
    cartItems: CartItem[]
  ): Promise<{ redirected: boolean; paymentUrl?: string }> => {
    try {
      console.log('🛒 Starting Zoho Inventory checkout...');
      console.log('📦 Cart items:', cartItems.length);
      console.log('👤 Customer:', customerInfo.email);

      const response = await fetch('/api/guest-checkout-inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerInfo,
          shippingAddress,
          cartItems,
          orderNotes: orderNotes || 'Guest checkout order'
        })
      });

      console.log('📡 API Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const result: CheckoutResult = await response.json();
      console.log('✅ Checkout API Response:', result);

      if (!result.success) {
        console.error('❌ Checkout failed:', result);
        throw new Error(result.details || result.error || 'Checkout failed');
      }

      // CRITICAL FIX: Enhanced payment URL validation and handling
      const paymentUrl = result.checkout_url || result.payment_url;
      
      if (result.redirect_to_payment && paymentUrl) {
        console.log('🔄 Payment URL received:', paymentUrl);
        
        // Validate payment URL
        if (!isValidUrl(paymentUrl)) {
          console.error('❌ Invalid payment URL received:', paymentUrl);
          throw new Error('Invalid payment URL received from server');
        }
        
        // Clear cart since order was created successfully
        clearCart();
        
        // Show success message
        toast.success(`Order ${result.invoice_number || 'created'}! Redirecting to payment...`);
        
        // CRITICAL FIX: Add delay and error handling for redirect
        setTimeout(() => {
          try {
            console.log('🚀 Redirecting to:', paymentUrl);
            window.location.href = paymentUrl;
          } catch (redirectError) {
            console.error('❌ Redirect failed:', redirectError);
            // Fallback: Show payment URL to user
            showPaymentLinkFallback(paymentUrl, result);
          }
        }, 1500);
        
        return { redirected: true, paymentUrl };
      } else {
        console.warn('⚠️ No payment redirect specified in response');
        
        // Handle success without automatic redirect
        if (result.invoice_id) {
          toast.success(`Order created! Invoice: ${result.invoice_number || result.invoice_id}`);
          
          // Manual payment page redirect
          const manualPaymentUrl = `/payment/invoice/${result.invoice_id}?${new URLSearchParams({
            amount: result.total_amount?.toString() || '0',
            currency: 'USD',
            customer_email: customerInfo.email,
            invoice_number: result.invoice_number || '',
            request_id: result.request_id || ''
          }).toString()}`;
          
          console.log('🔄 Redirecting to manual payment page:', manualPaymentUrl);
          router.push(manualPaymentUrl);
          
          return { redirected: true, paymentUrl: manualPaymentUrl };
        } else {
          throw new Error('Order created but no invoice ID received');
        }
      }

    } catch (error: any) {
      console.error('❌ Checkout error:', error);
      
      // Enhanced error handling
      if (error.message.includes('rate limit')) {
        toast.error('Server is busy. Please wait a moment and try again.');
      } else if (error.message.includes('validation')) {
        toast.error('Please check your information and try again.');
      } else if (error.message.includes('inventory')) {
        toast.error('Product availability issue. Please contact support.');
      } else {
        toast.error(`Checkout failed: ${error.message}`);
      }
      
      throw error;
    }
  };

  // Prepare cart items for checkout
  const prepareCartItems = (items: any[]): CartItem[] => {
    return items.map(item => ({
      product_id: item.product_id || item.id,
      product_name: item.product_name || item.name,
      product_price: item.product_price || item.price,
      quantity: item.quantity,
      sku: item.sku || item.product_sku || item.product_id,
      product_sku: item.product_sku || item.sku || item.product_id
    }));
  };

  // Form validation
  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!customerInfo.firstName.trim()) errors.push('First name is required');
    if (!customerInfo.lastName.trim()) errors.push('Last name is required');
    if (!customerInfo.email.trim()) errors.push('Email is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
      errors.push('Valid email address is required');
    }

    if (!shippingAddress.address1.trim()) errors.push('Street address is required');
    if (!shippingAddress.city.trim()) errors.push('City is required');
    if (!shippingAddress.state.trim()) errors.push('State is required');
    if (!shippingAddress.zipCode.trim()) errors.push('ZIP code is required');

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
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
      
      // Call the checkout handler
      const result = await handleZohoInventoryCheckout(customerInfo, shippingAddress, cartItems);
      
      if (!result.redirected) {
        // Handle success without redirect (shouldn't happen but just in case)
        console.log('Order created successfully:', result);
        clearCart();
        router.push('/checkout/success');
      }

    } catch (error: any) {
      console.error('❌ Form submission error:', error);
      toast.error(`Checkout failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle back to cart
  const handleBackToCart = (): void => {
    router.push('/cart');
  };

  // Show loading state
  if (isLoading || !isHydrated) {
    return (
      <Layout title="Loading Checkout - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading checkout...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Redirect to products if cart is empty
  if (!items || items.length === 0) {
    router.push('/');
    return null;
  }

  return (
    <Layout title="Checkout - Travel Data WiFi">
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
                Checkout
              </h1>
              <p className="text-gray-600">
                Complete your order securely
              </p>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <h3 className="text-red-800 font-medium">Please fix the following errors:</h3>
              </div>
              <ul className="text-red-700 text-sm space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Checkout Form */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                <User className="h-5 w-5 inline mr-2" />
                Customer Information
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Customer Info */}
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="h-4 w-4 inline mr-1" />
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
                    <Phone className="h-4 w-4 inline mr-1" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Shipping Address */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    <MapPin className="h-5 w-5 inline mr-2" />
                    Shipping Address
                  </h3>
                  
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

                {/* Order Notes */}
                <div className="border-t pt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Notes (optional)
                  </label>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Any special instructions for your order..."
                  />
                </div>

                {/* Terms and Conditions */}
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    className="mt-1 mr-3"
                    required
                  />
                  <label className="text-sm text-gray-600">
                    I agree to the{' '}
                    <a href="/terms" target="_blank" className="text-blue-600 hover:underline">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">
                      Privacy Policy
                    </a>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Processing Order...
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5 mr-2" />
                      Complete Order
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Order Summary */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                <ShoppingCart className="h-5 w-5 inline mr-2" />
                Order Summary
              </h2>

              {/* Cart Items */}
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.product_id} className="flex items-center space-x-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.product_name}</h3>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${(item.product_price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping:</span>
                  <span>{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax:</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Security Notice */}
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-blue-900 mb-1">Secure Checkout</h4>
                    <p className="text-sm text-blue-700">
                      Your payment information is processed securely. We never store your credit card details.
                    </p>
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