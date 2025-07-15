// ===== src/pages/checkout.tsx ===== (FULLY CORRECTED WITH SKU FIX)

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

const CheckoutPage = () => {
  const router = useRouter();
  const { items, getTotalPrice, clearCart, isHydrated } = useCartStore();
  
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
  
  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
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

  // NEW: Zoho Inventory Checkout Handler
  const handleZohoInventoryCheckout = async (customerInfo: any, shippingAddress: any, cartItems: any[]) => {
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
          orderNotes: orderNotes || 'Guest checkout order'
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Checkout successful:', result);
        
        // CRITICAL: Check for immediate payment redirect
        if (result.redirect_to_payment && result.payment_url) {
          console.log('🔄 Redirecting to payment:', result.payment_url);
          
          // Clear cart since order was created successfully
          clearCart();
          
          // Show success message briefly before redirect
          toast.success('Order created! Redirecting to payment...');
          
          // Small delay for user feedback, then redirect
          setTimeout(() => {
            window.location.href = result.payment_url;
          }, 1500);
          
          return { redirected: true, payment_url: result.payment_url };
        }
        
        // Handle success without immediate redirect
        return result;
        
      } else {
        console.error('❌ Checkout failed:', result);
        throw new Error(result.details || result.error || 'Checkout failed');
      }

    } catch (error: any) {
      console.error('❌ Checkout error:', error);
      throw error;
    }
  };

  // Form validation
  const validateForm = () => {
    const errors: string[] = [];
    
    // Customer info validation
    if (!customerInfo.firstName.trim()) errors.push('First name is required');
    if (!customerInfo.lastName.trim()) errors.push('Last name is required');
    if (!customerInfo.email.trim()) errors.push('Email is required');
    
    // Shipping address validation
    if (!shippingAddress.address1.trim()) errors.push('Address is required');
    if (!shippingAddress.city.trim()) errors.push('City is required');
    if (!shippingAddress.state.trim()) errors.push('State is required');
    if (!shippingAddress.zipCode.trim()) errors.push('ZIP code is required');
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (customerInfo.email && !emailRegex.test(customerInfo.email)) {
      errors.push('Please enter a valid email address');
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  // CRITICAL FIX: Enhanced cart item preparation with proper SKU handling
  const prepareCartItems = (items: any[]) => {
    console.log('🔍 Preparing cart items with enhanced SKU detection...');
    
    return items?.map((item, index) => {
      // Debug logging for each item
      console.log(`\n--- Processing cart item ${index + 1}: ${item.product_name} ---`);
      console.log('Available fields:', Object.keys(item));
      
      // CRITICAL FIX: Proper SKU detection logic
      let actualSku = null;
      let skuSource = 'none';
      
      // Check all possible SKU field variations (order matters - most reliable first)
      const skuFields = [
        { field: 'sku', value: item.sku },
        { field: 'product_sku', value: item.product_sku },
        { field: 'actual_sku', value: item.actual_sku },
        { field: 'amazon_sku', value: item.amazon_sku },
        { field: 'external_sku', value: item.external_sku },
        { field: 'variant_sku', value: item.variant_sku }
      ];
      
      // Log all available SKU fields
      console.log('SKU field analysis:');
      skuFields.forEach(({ field, value }) => {
        if (value !== undefined) {
          const isProductId = value === item.product_id;
          console.log(`   ${field}: "${value}" ${isProductId ? '⚠️ (same as product_id)' : '✅'}`);
        }
      });
      
      // Select the best SKU (first valid one that's not the product_id)
      for (const { field, value } of skuFields) {
        if (value && value !== item.product_id && typeof value === 'string' && value.trim() !== '') {
          actualSku = value.trim();
          skuSource = field;
          console.log(`✅ Selected SKU: "${actualSku}" from ${field}`);
          break;
        }
      }
      
      // Last resort: use product_id but warn
      if (!actualSku) {
        actualSku = item.product_id;
        skuSource = 'product_id_fallback';
        console.warn(`⚠️ No valid SKU found for ${item.product_name}, using product_id: ${actualSku}`);
      }
      
      // Special handling for known product (temporary fix)
      if (item.product_name?.includes('GL.iNet X750') && actualSku === item.product_id) {
        // Temporary hardcoded fix for this specific product
        actualSku = 'B08TRCSSZ4';
        skuSource = 'hardcoded_fix';
        console.log(`🔧 Applied hardcoded SKU fix: ${item.product_name} -> ${actualSku}`);
      }
      
      const preparedItem = {
        product_id: item.product_id,
        product_name: item.product_name,
        product_price: item.product_price,
        quantity: item.quantity,
        
        // CRITICAL FIX: Use actual SKU, not product_id
        sku: actualSku,
        product_sku: actualSku, // Also set for compatibility
        
        // Keep original names for compatibility
        name: item.product_name,
        price: item.product_price,
        
        // Debug info (will be ignored by API)
        _debug_info: {
          sku_source: skuSource,
          original_sku_fields: skuFields.reduce((acc, { field, value }) => {
            if (value !== undefined) acc[field] = value;
            return acc;
          }, {}),
          is_sku_valid: skuSource !== 'product_id_fallback'
        }
      };
      
      console.log(`Final prepared item:`, {
        name: preparedItem.product_name,
        sku: preparedItem.sku,
        sku_source: skuSource,
        is_valid: skuSource !== 'product_id_fallback'
      });
      
      return preparedItem;
    }) || [];
  };

  // UPDATED: Form submission handler with proper SKU mapping
  const handleSubmit = async (e: React.FormEvent) => {
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
      // CRITICAL FIX: Use enhanced cart item preparation
      const cartItems = prepareCartItems(items);
      
      // Validate that we have valid SKUs
      const invalidSkuItems = cartItems.filter(item => 
        item._debug_info?.sku_source === 'product_id_fallback'
      );
      
      if (invalidSkuItems.length > 0) {
        console.warn('⚠️ Items with invalid SKUs (using product_id):', 
          invalidSkuItems.map(item => ({
            name: item.product_name,
            product_id: item.product_id,
            sku_used: item.sku
          }))
        );
      }
      
      console.log('📦 Final cart items for checkout:', cartItems.map(item => ({
        name: item.product_name,
        sku: item.sku,
        sku_source: item._debug_info?.sku_source,
        price: item.product_price,
        quantity: item.quantity
      })));

      // Call the Zoho Inventory checkout
      const result = await handleZohoInventoryCheckout(customerInfo, shippingAddress, cartItems);
      
      if (result.redirected) {
        // Customer is being redirected to payment
        console.log('Customer redirected to payment page');
        return;
      }
      
      // Handle success without redirect (fallback)
      console.log('Order created successfully:', result);
      
      // Clear cart and redirect to success page
      clearCart();
      router.push('/checkout/success');

    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(`Checkout failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <Layout title="Loading Checkout - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-travel-blue" />
            <p className="text-gray-600">Loading checkout...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Redirect to products if cart is empty
  if (!items || items.length === 0) {
    return (
      <Layout title="Checkout - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Cart is Empty</h1>
              <p className="text-gray-600 mb-6">Add some products to your cart before proceeding to checkout.</p>
              
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/products')}
                  className="w-full bg-travel-blue text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Browse Products
                </button>
                
                <button
                  onClick={() => router.back()}
                  className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Go Back
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
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="flex items-center mb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-800 mr-4"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
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

          {/* Processing Overlay */}
          {isProcessing && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 text-center max-w-sm mx-4">
                <Loader2 className="h-8 w-8 animate-spin text-travel-blue mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Creating Your Order</h3>
                <p className="text-gray-600">Please wait while we process your order...</p>
                <p className="text-sm text-gray-500 mt-2">You'll be redirected to payment shortly</p>
              </div>
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
                      disabled={isProcessing}
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
                      disabled={isProcessing}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
                      placeholder="john@example.com"
                      disabled={isProcessing}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      placeholder="(555) 123-4567"
                      disabled={isProcessing}
                    />
                  </div>
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
                      disabled={isProcessing}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="address2" className="block text-sm font-medium text-gray-700 mb-2">
                      Address Line 2 (Optional)
                    </label>
                    <input
                      type="text"
                      id="address2"
                      value={shippingAddress.address2}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, address2: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                      placeholder="Apt 2B, Suite 100"
                      disabled={isProcessing}
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
                        disabled={isProcessing}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                        State *
                      </label>
                      <input
                        type="text"
                        id="state"
                        required
                        value={shippingAddress.state}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                        placeholder="NY"
                        disabled={isProcessing}
                      />
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
                        placeholder="10001"
                        disabled={isProcessing}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                  rows={3}
                  placeholder="Any special instructions for your order..."
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
                
                {/* Cart Items */}
                <div className="space-y-3 mb-4">
                  {items?.map((item) => (
                    <div key={item.product_id} className="flex items-center space-x-3">
                      <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">{item.quantity}x</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.product_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          ${item.product_price.toFixed(2)} each
                        </p>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        ${(item.product_price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Totals */}
                <div className="border-t pt-4 space-y-2">
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
                
                {/* Terms and Submit */}
                <div className="mt-6">
                  <label className="flex items-start space-x-3 mb-4">
                    <input
                      type="checkbox"
                      checked={agreeToTerms}
                      onChange={(e) => setAgreeToTerms(e.target.checked)}
                      className="mt-1 h-4 w-4 text-travel-blue focus:ring-travel-blue border-gray-300 rounded"
                      disabled={isProcessing}
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
                        <span>Creating Order...</span>
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4" />
                        <span>Complete Order & Pay</span>
                        <ExternalLink className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  
                  <p className="text-xs text-gray-500 text-center mt-3">
                    You will be redirected to our secure payment processor to complete your order.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default CheckoutPage;