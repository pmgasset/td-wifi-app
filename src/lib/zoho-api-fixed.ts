// ===== src/lib/zoho-api-fixed.ts =====
interface ZohoProduct {
  product_id: string;
  product_name: string;
  product_description: string;
  product_price: number;
  product_images: string[];
  inventory_count: number;
  product_category: string;
  seo_url: string;
}

interface ZohoOrder {
  order_id: string;
  customer_email: string;
  order_items: Array<{
    product_id: string;
    quantity: number;
    price: number;
  }>;
  order_total: number;
  shipping_address: any;
}

class FixedZohoCommerceAPI {
  // Correct Zoho Commerce API URL based on documentation
  private baseURL = 'https://commerce.zoho.com/store/api/v1';
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!process.env.ZOHO_REFRESH_TOKEN || !process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
      throw new Error('Missing required Zoho environment variables');
    }

    try {
      console.log('Requesting new access token...');
      
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
        console.error('Auth failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Zoho auth failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.access_token) {
        console.error('No access token in response:', data);
        throw new Error('No access token received from Zoho');
      }

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer
      
      console.log('✓ Access token obtained successfully');
      return data.access_token;
    } catch (error) {
      console.error('Failed to get Zoho access token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Authentication failed: ${errorMessage}`);
    }
  }

  async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!process.env.ZOHO_STORE_ID) {
      throw new Error('ZOHO_STORE_ID environment variable is required');
    }

    const token = await this.getAccessToken();
    const url = `${this.baseURL}${endpoint}`;

    console.log(`Making API request to: ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
        // This is the key header that was missing!
        'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
        ...options.headers,
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('API request failed:', {
        url,
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText,
        organizationId: process.env.ZOHO_STORE_ID
      });
      throw new Error(`Zoho API error: ${response.status} ${response.statusText} - ${responseText}`);
    }

    try {
      const jsonResponse = JSON.parse(responseText);
      
      // Check if Zoho returned an error in the response body
      if (jsonResponse.code && jsonResponse.code !== 0) {
        throw new Error(`Zoho API error: ${jsonResponse.message || 'Unknown error'} (Code: ${jsonResponse.code})`);
      }
      
      return jsonResponse;
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message.includes('Zoho API error:')) {
        throw parseError; // Re-throw Zoho API errors
      }
      console.error('Failed to parse JSON response:', responseText);
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
  }

  async getStoreMeta(): Promise<any> {
    try {
      console.log('Getting store metadata...');
      const response = await this.apiRequest('/storemeta');
      return response.payload || response;
    } catch (error) {
      console.error('Failed to get store metadata:', error);
      throw error;
    }
  }

  async getProducts(): Promise<ZohoProduct[]> {
    try {
      console.log('Fetching products...');
      const response = await this.apiRequest('/products');
      
      // Handle different possible response structures
      const products = response.products || response.payload?.products || response;
      
      if (!Array.isArray(products)) {
        console.log('Unexpected products response structure:', response);
        return [];
      }
      
      console.log(`✓ Successfully fetched ${products.length} products`);
      return products;
    } catch (error) {
      console.error('Failed to get products:', error);
      throw error;
    }
  }

  async getProduct(productId: string): Promise<ZohoProduct | null> {
    try {
      console.log(`Fetching product: ${productId}`);
      const response = await this.apiRequest(`/products/${productId}`);
      
      const product = response.product || response.payload?.product || response;
      return product || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        return null;
      }
      throw error;
    }
  }

  async createOrder(orderData: Partial<ZohoOrder>): Promise<ZohoOrder> {
    const response = await this.apiRequest('/salesorders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
    return response.salesorder || response.payload?.salesorder || response;
  }

  // Test different endpoints to understand the API structure
  async testEndpoints(): Promise<{[key: string]: any}> {
    const results: {[key: string]: any} = {};
    
    const testEndpoints = [
      { name: 'Store Meta', endpoint: '/storemeta' },
      { name: 'Products', endpoint: '/products' },
      { name: 'Categories', endpoint: '/categories' },
      { name: 'Settings', endpoint: '/settings' },
      { name: 'Store Info', endpoint: '/store' }
    ];

    for (const test of testEndpoints) {
      try {
        console.log(`Testing endpoint: ${test.endpoint}`);
        const response = await this.apiRequest(test.endpoint);
        
        results[test.name] = {
          success: true,
          endpoint: test.endpoint,
          responseKeys: Object.keys(response),
          hasProducts: !!(response.products || response.payload?.products),
          productCount: (response.products || response.payload?.products)?.length || 0,
          sample: test.name === 'Products' ? (response.products || response.payload?.products)?.[0] : null
        };
        
        console.log(`✓ ${test.name} - Success`);
      } catch (error) {
        results[test.name] = {
          success: false,
          endpoint: test.endpoint,
          error: error instanceof Error ? error.message : String(error)
        };
        console.log(`✗ ${test.name} - ${error instanceof Error ? error.message : error}`);
      }
    }

    return results;
  }

  // Debug method to verify API setup
  async debugSetup(): Promise<{
    auth: boolean;
    organizationId: string;
    storeMetaAccess: boolean;
    productsAccess: boolean;
    productCount?: number;
    sampleProduct?: any;
    storeInfo?: any;
    allEndpointTests?: any;
  }> {
    const result = {
      auth: false,
      organizationId: process.env.ZOHO_STORE_ID || '',
      storeMetaAccess: false,
      productsAccess: false
    } as any;

    try {
      // Test authentication
      await this.getAccessToken();
      result.auth = true;
      console.log('✓ Authentication working');

      // Test store meta access
      try {
        const storeMeta = await this.getStoreMeta();
        result.storeMetaAccess = true;
        result.storeInfo = storeMeta;
        console.log('✓ Store meta access working');
      } catch (error) {
        console.log('✗ Store meta access failed:', error instanceof Error ? error.message : error);
      }

      // Test products access
      try {
        const products = await this.getProducts();
        result.productsAccess = true;
        result.productCount = products.length;
        result.sampleProduct = products[0] || null;
        console.log(`✓ Products access working - found ${products.length} products`);
      } catch (error) {
        console.log('✗ Products access failed:', error instanceof Error ? error.message : error);
      }

      // Test all endpoints
      result.allEndpointTests = await this.testEndpoints();

    } catch (error) {
      console.error('Debug setup failed:', error);
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }
}

export const zohoAPI = new FixedZohoCommerceAPI();
export type { ZohoProduct, ZohoOrder };