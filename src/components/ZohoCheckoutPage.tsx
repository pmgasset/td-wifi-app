// ===== src/components/ZohoCheckoutPage.tsx (FIXED) =====
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router'; // ✅ Added router import
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
  const router = useRouter(); // ✅ Added router hook
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
  
  // FIXED: Remove automatic redirect, show empty cart message instead
  // OLD CODE (causes hard redirects):
  // useEffect(() => {
  //   if (items.length === 0 && !orderComplete) {
  //     window.location.href = '/products';
  //   }
  // }, [items.length, orderComplete]);

  // Show empty cart message if no items (instead of redirecting)
  if (!items || items.length === 0 && !orderComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Cart is Empty</h1>
            <p className="text-gray-600 mb-6">Add some products to your cart before proceeding to checkout.</p>
            
            <div className="space-y-3">
              {/* ✅ FIXED: Use router.push instead of window.location.href */}
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
    );
  }
  
  // Calculate totals
  const subtotal = getTotalPrice();
  const shipping = subtotal >= 100 ? 0 : 9.99;
  const tax = Math.round(subtotal * 0.0875 * 100) / 100;
  const total = subtotal + shipping + tax;

  // Rest of component implementation...
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {/* Component content */}
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Zoho Checkout</h1>
        {/* Rest of checkout form */}
      </div>
    </div>
  );
};

export default ZohoCheckoutPage;