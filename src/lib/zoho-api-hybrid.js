// ===== src/lib/zoho-api-hybrid.js ===== (CORRECT STOREFRONT API IMPLEMENTATION)

/**
 * Hybrid Zoho Commerce API with CORRECT Storefront API flow
 * Uses Admin API for existing customers, Storefront API for guests
 */

class HybridZohoCommerceAPI {
  constructor() {
    this.adminBaseURL = 'https://commerce.zoho.com/store/api/v1';
    this.storefrontBaseURL = 'https://commerce.zoho.com/storefront/api/v1';
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  // ===== ADMIN API METHODS =====

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!process.env.ZOHO_REFRESH_TOKEN || !process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
      throw new Error('Missing required Zoho environment variables');
    }

    try {
      console.log('Requesting new Zoho access token...');
      
      const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: process.env.ZOHO_REFRESH_TOKEN,
          client_id: process.env.ZOHO_CLIENT_ID,
          client_secret: process.env.ZOHO_CLIENT_SECRET,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Zoho auth failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token received from Zoho');
      }

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
      
      console.log('✓ Zoho access token obtained successfully');
      return data.access_token;
    } catch (error) {
      console.error('Failed to get Zoho access token:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async adminApiRequest(endpoint, options = {}) {
    if (!process.env.ZOHO_STORE_ID) {
      throw new Error('ZOHO_STORE_ID environment variable is required');
    }

    const token = await this.getAccessToken();
    const url = `${this.adminBaseURL}${endpoint}`;

    console.log(`Making Admin API request to: ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
        'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
        ...options.headers,
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Admin API request failed:', {
        url,
        status: response.status,
        statusText: response.statusText,
        response: responseText
      });
      throw new Error(`Admin API error: ${response.status} ${response.statusText} - ${responseText}`);
    }

    try {
      const jsonResponse = JSON.parse(responseText);
      
      if (jsonResponse.code && jsonResponse.code !== 0) {
        throw new Error(`Admin API error: ${jsonResponse.message || 'Unknown error'} (Code: ${jsonResponse.code})`);
      }
      
      return jsonResponse;
    } catch (parseError) {
      if (parseError.message.includes('Admin API error:')) {
        throw parseError;
      }
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
  }

  // ===== STOREFRONT API METHODS (CORRECT IMPLEMENTATION) =====

  async getCSRFToken() {
    try {
      // Generate a basic CSRF token for Storefront API
      return `csrfp=${Date.now()}-${Math.random().toString(36).substring(7)}`;
    } catch (error) {
      console.warn('Could not obtain CSRF token:', error.message);
      return null;
    }
  }

  async storefrontApiRequest(endpoint, options = {}) {
    const url = `${this.storefrontBaseURL}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'domain-name': process.env.ZOHO_STORE_DOMAIN || 'traveldatawifi.zohostore.com',
      'Accept': 'application/json'
    };

    // Add CSRF token for POST requests
    if (options.method === 'POST') {
      const csrfToken = await this.getCSRFToken();
      if (csrfToken) {
        defaultHeaders['X-ZCSRF-TOKEN'] = csrfToken;
      }
    }

    console.log(`Making Storefront API request: ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    const responseText = await response.text();
    console.log(`Storefront API Response (${response.status}):`, responseText.substring(0, 200) + '...');

    if (!response.ok) {
      console.error('Storefront API request failed:', {
        url,
        status: response.status,
        statusText: response.statusText,
        response: responseText
      });
      throw new Error(`Storefront API error: ${response.status} ${response.statusText} - ${responseText}`);
    }

    try {
      const jsonResponse = JSON.parse(responseText);
      
      if (jsonResponse.status_code && jsonResponse.status_code !== '0') {
        throw new Error(`Storefront API error: ${jsonResponse.status_message || 'Unknown error'}`);
      }
      
      return jsonResponse;
    } catch (parseError) {
      if (parseError.message.includes('Storefront API error:')) {
        throw parseError;
      }
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
  }

  // ===== CHECKOUT METHODS (CORRECTED) =====

  // Storefront API guest checkout (CORRECT FLOW)
  async createGuestCheckout(checkoutData) {
    console.log('Creating guest checkout via Storefront API (correct flow)...');
    
    try {
      const { customerInfo, shippingAddress, cartItems, orderNotes } = checkoutData;
      
      let cartId = null;
      let checkoutId = null;

      // STEP 1: Add items to cart (creates anonymous cart)
      console.log('Step 1: Adding items to cart...');
      
      for (const item of cartItems) {
        const addToCartData = {
          product_variant_id: item.variant_id || item.product_id,
          quantity: item.quantity || 1
        };

        const cartResponse = await this.storefrontApiRequest('/cart', {
          method: 'POST',
          body: JSON.stringify(addToCartData)
        });

        // Get cart ID from first item
        if (!cartId) {
          cartId = cartResponse.payload?.cart_id;
          checkoutId = cartId; // Cart ID and checkout ID are the same
          console.log('✓ Cart created:', cartId);
        }
      }

      if (!cartId) {
        throw new Error('Failed to create cart - no cart ID received');
      }

      // STEP 2: Add address to checkout
      console.log('Step 2: Adding address to checkout...');
      
      const addressData = {
        shipping_address: {
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          email_address: customerInfo.email,
          address: shippingAddress.address1,
          address2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.zipCode,
          telephone: customerInfo.phone || '',
          country: shippingAddress.country || 'US',
          same_billing_address: true
        }
      };

      addressData.billing_address = { ...addressData.shipping_address };

      await this.storefrontApiRequest(`/checkout/address?checkout_id=${checkoutId}`, {
        method: 'POST',
        body: JSON.stringify(addressData)
      });

      console.log('✓ Address added to checkout');

      // STEP 3: Handle shipping (optional)
      try {
        const shippingMethodsResponse = await this.storefrontApiRequest(`/checkout?checkout_id=${checkoutId}`, {
          method: 'GET'
        });

        const shippingMethods = shippingMethodsResponse.payload?.checkout?.shipping_methods || [];
        
        if (shippingMethods.length > 0) {
          const selectedShipping = shippingMethods[0];
          
          await this.storefrontApiRequest(`/checkout/shipping-methods?checkout_id=${checkoutId}`, {
            method: 'POST',
            body: JSON.stringify({
              shipping: selectedShipping.shipping_id || selectedShipping.id
            })
          });

          console.log('✓ Shipping method selected');
        }
      } catch (shippingError) {
        console.log('⚠️ Shipping setup skipped:', shippingError.message);
      }

      // STEP 4: Complete order
      console.log('Step 4: Completing order...');
      
      const orderResponse = await this.storefrontApiRequest(`/checkout/offlinepayment?checkout_id=${checkoutId}`, {
        method: 'POST'
      });

      const order = orderResponse.payload;
      
      console.log('✅ Storefront checkout completed');
      
      return {
        ...order,
        cart_id: cartId,
        checkout_id: checkoutId,
        api_type: 'storefront'
      };
      
    } catch (error) {
      console.error('Storefront API guest checkout failed:', error);
      throw error;
    }
  }

  // Admin API order creation (for existing customers with address issues)
  async createOrder(orderData) {
    console.log('Creating order via Admin API...');
    
    try {
      const response = await this.adminApiRequest('/salesorders', {
        method: 'POST',
        body: JSON.stringify(orderData),
      });
      
      return response.salesorder || response;
    } catch (error) {
      console.error('Admin API order creation failed:', error);
      throw error;
    }
  }

  // ===== UNIFIED METHODS =====

  // Legacy method - uses Admin API for backward compatibility
  async apiRequest(endpoint, options = {}) {
    return this.adminApiRequest(endpoint, options);
  }

  // Product methods (use Admin API for comprehensive data)
  async getProducts() {
    try {
      console.log('Fetching products from Admin API...');
      const response = await this.adminApiRequest('/products');
      const products = response.products || [];
      
      console.log(`Retrieved ${products.length} products from Zoho`);
      
      return products.map((product) => ({
        ...product,
        product_name: product.name,
        product_price: product.min_rate || product.max_rate || 0,
        product_images: this.extractImageUrls(product),
        inventory_count: this.parseStock(product.overall_stock),
        product_category: product.category_name || '',
        seo_url: product.url || product.product_id
      }));
    } catch (error) {
      console.error('Failed to get products:', error);
      throw error;
    }
  }

  async getProduct(productId) {
    try {
      console.log(`Fetching product: ${productId}`);
      const response = await this.adminApiRequest(`/products/${productId}`);
      const product = response.product || null;
      
      if (!product) return null;
      
      return {
        ...product,
        product_name: product.name,
        product_price: product.min_rate || product.max_rate || 0,
        product_images: this.extractImageUrls(product),
        inventory_count: this.parseStock(product.overall_stock),
        product_category: product.category_name || '',
        seo_url: product.url || product.product_id
      };
    } catch (error) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        return null;
      }
      throw error;
    }
  }

  // ===== HELPER METHODS =====

  extractImageUrls(product) {
    const images = [];
    
    if (product.documents && Array.isArray(product.documents)) {
      for (const doc of product.documents) {
        if (doc.document_id && doc.file_name) {
          const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${doc.document_id}/400x400?storefront_domain=www.traveldatawifi.com`;
          images.push(imageUrl);
        }
      }
    }
    
    return images;
  }

  parseStock(stockString) {
    if (!stockString) return 0;
    const parsed = parseInt(stockString, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
}

// Create and export the hybrid instance
const hybridZohoAPI = new HybridZohoCommerceAPI();

// Export both old and new interfaces for compatibility
export { hybridZohoAPI as zohoAPI };
export { hybridZohoAPI as hybridZohoAPI };
export default hybridZohoAPI;