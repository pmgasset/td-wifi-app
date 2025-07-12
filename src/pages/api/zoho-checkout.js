// ===== src/pages/api/zoho-checkout.js (Updated for Hosted Only) =====
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== ZOHO COMMERCE HOSTED CHECKOUT PROCESSING ===');
    
    const {
      customerInfo,
      shippingAddress,
      cartItems,
      orderNotes,
      checkoutType = 'hosted' // Always use hosted
    } = req.body;

    // Validate required fields
    const validationErrors = validateCheckoutData({
      customerInfo,
      shippingAddress,
      cartItems
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) => 
      sum + (item.product_price * item.quantity), 0
    );
    
    const tax = calculateTax(subtotal, shippingAddress.state);
    const shipping = calculateShipping(cartItems, shippingAddress);
    const total = subtotal + tax + shipping;

    // Always use hosted checkout for security
    return await handleHostedCheckout(req, res, { 
      customerInfo, 
      shippingAddress, 
      cartItems, 
      total, 
      tax,
      shipping,
      orderNotes 
    });

  } catch (error) {
    console.error('Zoho Checkout API Error:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    
    res.status(500).json({
      error: 'Checkout processing failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Handle Zoho Hosted Checkout (redirects to Zoho's secure checkout page)
async function handleHostedCheckout(req, res, data) {
  const { customerInfo, shippingAddress, cartItems, total, tax, shipping, orderNotes } = data;

  try {
    console.log('Creating Zoho hosted checkout session...');

    // Create a checkout session in Zoho Commerce
    const checkoutSessionData = {
      checkout_session: {
        customer: {
          email: customerInfo.email,
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          phone: customerInfo.phone || ''
        },
        line_items: cartItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.product_price,
          product_name: item.product_name,
          description: item.product_description || ''
        })),
        shipping_address: {
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          address1: shippingAddress.address1,
          address2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: shippingAddress.country || 'US',
          phone: customerInfo.phone || ''
        },
        billing_address: {
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          address1: shippingAddress.address1,
          address2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zipCode,
          country: shippingAddress.country || 'US',
          phone: customerInfo.phone || ''
        },
        order_notes: orderNotes || '',
        metadata: {
          source: 'travel-data-wifi-app',
          version: '1.0',
          created_at: new Date().toISOString()
        },
        success_url: `${req.headers.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/checkout?cancelled=true&reason=user_cancelled`,
        payment_methods: ['card', 'paypal', 'apple_pay', 'google_pay'], // Configure based on your Zoho setup
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
        
        // Pricing breakdown
        subtotal: cartItems.reduce((sum, item) => sum + (item.product_price * item.quantity), 0),
        tax_amount: tax,
        shipping_amount: shipping,
        total_amount: total,
        currency: 'USD',
        
        // Additional settings for hosted checkout
        appearance: {
          theme: 'stripe', // or 'modern', 'classic'
          variables: {
            colorPrimary: '#004e89', // travel-blue
            colorBackground: '#ffffff',
            colorText: '#1f2937',
            fontFamily: 'Inter, system-ui, sans-serif',
            borderRadius: '8px'
          }
        },
        
        // Enable specific features
        features: {
          payment_method_types: ['card', 'paypal'],
          shipping_address_collection: false, // We already collected this
          billing_address_collection: 'auto',
          phone_number_collection: false, // We already have this
          terms_of_service: 'required',
          privacy_policy: 'required'
        }
      }
    };

    // Create checkout session via Zoho API
    const checkoutSession = await zohoAPI.apiRequest('/checkout_sessions', {
      method: 'POST',
      body: JSON.stringify(checkoutSessionData)
    });

    console.log('Zoho checkout session created:', {
      session_id: checkoutSession.checkout_session_id,
      checkout_url: checkoutSession.checkout_url,
      expires_at: checkoutSession.expires_at
    });

    // Return the hosted checkout URL for redirect
    return res.status(200).json({
      type: 'hosted',
      success: true,
      checkout_url: checkoutSession.checkout_url,
      session_id: checkoutSession.checkout_session_id,
      expires_at: checkoutSession.expires_at,
      total_amount: total,
      currency: 'USD'
    });

  } catch (error) {
    console.error('Hosted checkout creation failed:', error);
    throw new Error(`Failed to create hosted checkout: ${error.message}`);
  }
}

// Validation helper
function validateCheckoutData({ customerInfo, shippingAddress, cartItems }) {
  const errors = [];

  // Customer info validation
  if (!customerInfo?.email) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
    errors.push('Please enter a valid email address');
  }
  
  if (!customerInfo?.firstName) errors.push('First name is required');
  if (!customerInfo?.lastName) errors.push('Last name is required');
  
  // Shipping address validation
  if (!shippingAddress?.address1) errors.push('Street address is required');
  if (!shippingAddress?.city) errors.push('City is required');
  if (!shippingAddress?.state) errors.push('State is required');
  if (!shippingAddress?.zipCode) errors.push('ZIP code is required');
  
  if (shippingAddress?.zipCode && !/^\d{5}(-\d{4})?$/.test(shippingAddress.zipCode)) {
    errors.push('Please enter a valid ZIP code');
  }
  
  // Cart validation
  if (!cartItems || cartItems.length === 0) {
    errors.push('Cart is empty');
  }
  
  cartItems?.forEach((item, index) => {
    if (!item.product_id) errors.push(`Item ${index + 1}: Product ID is missing`);
    if (!item.product_name) errors.push(`Item ${index + 1}: Product name is missing`);
    if (!item.quantity || item.quantity < 1) errors.push(`Item ${index + 1}: Invalid quantity`);
    if (!item.product_price || item.product_price < 0) errors.push(`Item ${index + 1}: Invalid price`);
  });

  return errors;
}

// Calculate tax based on state
function calculateTax(subtotal, state) {
  const taxRates = {
    'AL': 0.04,    // Alabama
    'AK': 0.00,    // Alaska
    'AZ': 0.056,   // Arizona
    'AR': 0.065,   // Arkansas
    'CA': 0.0875,  // California
    'CO': 0.029,   // Colorado
    'CT': 0.0635,  // Connecticut
    'DE': 0.00,    // Delaware
    'FL': 0.06,    // Florida
    'GA': 0.04,    // Georgia
    'HI': 0.04,    // Hawaii
    'ID': 0.06,    // Idaho
    'IL': 0.0625,  // Illinois
    'IN': 0.07,    // Indiana
    'IA': 0.06,    // Iowa
    'KS': 0.065,   // Kansas
    'KY': 0.06,    // Kentucky
    'LA': 0.045,   // Louisiana
    'ME': 0.055,   // Maine
    'MD': 0.06,    // Maryland
    'MA': 0.0625,  // Massachusetts
    'MI': 0.06,    // Michigan
    'MN': 0.06875, // Minnesota
    'MS': 0.07,    // Mississippi
    'MO': 0.04225, // Missouri
    'MT': 0.00,    // Montana
    'NE': 0.055,   // Nebraska
    'NV': 0.0685,  // Nevada
    'NH': 0.00,    // New Hampshire
    'NJ': 0.06625, // New Jersey
    'NM': 0.05125, // New Mexico
    'NY': 0.08,    // New York
    'NC': 0.0475,  // North Carolina
    'ND': 0.05,    // North Dakota
    'OH': 0.0575,  // Ohio
    'OK': 0.045,   // Oklahoma
    'OR': 0.00,    // Oregon
    'PA': 0.06,    // Pennsylvania
    'RI': 0.07,    // Rhode Island
    'SC': 0.06,    // South Carolina
    'SD': 0.045,   // South Dakota
    'TN': 0.07,    // Tennessee
    'TX': 0.0625,  // Texas
    'UT': 0.0595,  // Utah
    'VT': 0.06,    // Vermont
    'VA': 0.053,   // Virginia
    'WA': 0.065,   // Washington
    'WV': 0.06,    // West Virginia
    'WI': 0.05,    // Wisconsin
    'WY': 0.04     // Wyoming
  };
  
  const rate = taxRates[state] || 0.05; // Default 5% if state not found
  return Math.round(subtotal * rate * 100) / 100;
}

// Calculate shipping cost
function calculateShipping(items, address) {
  const subtotal = items.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
  
  // Free shipping over $100
  if (subtotal >= 100) {
    return 0;
  }
  
  // Standard shipping rates
  const standardShipping = 9.99;
  
  // Expedited shipping for certain states (optional)
  const expeditedStates = ['CA', 'NY', 'TX', 'FL'];
  if (expeditedStates.includes(address.state)) {
    return standardShipping + 5; // $14.99 for expedited states
  }
  
  return standardShipping;
}

// Calculate estimated delivery date
function calculateEstimatedDelivery(address) {
  const businessDays = ['CA', 'NY', 'TX', 'FL'].includes(address.state) ? 2 : 3;
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + businessDays);
  
  return deliveryDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}