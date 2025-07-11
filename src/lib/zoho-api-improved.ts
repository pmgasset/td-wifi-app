// ===== src/lib/zoho-api-improved.ts =====
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

interface ZohoApiConfig {
  baseURL: string;
  region?: 'com' | 'eu' | 'in' | 'com.au';
  version?: 'v1' | 'v2';
}

class ImprovedZohoCommerceAPI {
  private config: ZohoApiConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config?: Partial<ZohoApiConfig>) {
    // Auto-detect region from client ID or use provided config
    const detectedRegion = this.detectRegion();
    
    this.config = {
      baseURL: config?.baseURL || this.getBaseURLForRegion(detectedRegion),
      region: config?.region || detectedRegion,
      version: config?.version || 'v1'
    };

    console.log('Zoho API initialized with config:', this.config);
  }

  private detectRegion(): 'com' | 'eu' | 'in' | 'com.au' {
    const clientId = process.env.ZOHO_CLIENT_ID || '';
    
    if (clientId.includes('.eu')) return 'eu';
    if (clientId.includes('.in')) return 'in';
    if (clientId.includes('.com.au')) return 'com.au';
    return 'com'; // default
  }

  private getBaseURLForRegion(region: string): string {
    const baseUrls = {
      com: 'https://www.zohoapis.com/commerce/v1',
      eu: 'https://www.zohoapis.eu/commerce/v1',
      in: 'https://www.zohoapis.in/commerce/v1',
      'com.au': 'https://www.zohoapis.com.au/commerce/v1'
    };
    
    return baseUrls[region as keyof typeof baseUrls] || baseUrls.com;
  }

  private getAuthURLForRegion(region: string): string {
    const authUrls = {
      com: 'https://accounts.zoho.com/oauth/v2/token',
      eu: 'https://accounts.zoho.eu/oauth/v2/token',
      in: 'https://accounts.zoho.in/oauth/v2/token',
      'com.au': 'https://accounts.zoho.com.au/oauth/v2/token'
    };
    
    return authUrls[region as keyof typeof authUrls] || authUrls.com;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const requiredEnvVars = ['ZOHO_REFRESH_TOKEN', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    try {
      const authURL = this.getAuthURLForRegion(this.config.region || 'com');
      
      console.log(`Attempting authentication with: ${authURL}`);
      
      const response = await fetch(authURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
          client_id: process.env.ZOHO_CLIENT_ID!,
          client_secret: process.env.ZOHO_CLIENT_SECRET!,
          grant_type: 'refresh_token',
        }),
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        console.error('Auth response error:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText,
          headers: Object.fromEntries([...response.headers.entries()])
        });
        throw new Error(`Authentication failed: ${response.status} ${response.statusText} - ${responseText}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Invalid JSON response from auth server: ${responseText}`);
      }
      
      if (!data.access_token) {
        console.error('No access token in response:', data);
        throw new Error(`No access token received. Response: ${JSON.stringify(data)}`);
      }

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer
      
      console.log('✓ Authentication successful');
      return data.access_token;
    } catch (error) {
      console.error('Authentication failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
      throw new Error(`Authentication failed: ${errorMessage}`);
    }
  }

  async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!process.env.ZOHO_STORE_ID) {
      throw new Error('ZOHO_STORE_ID environment variable is required');
    }

    const token = await this.getAccessToken();
    const url = `${this.config.baseURL}${endpoint}`;

    console.log(`Making API request to: ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('API request failed:', {
        url,
        status: response.status,
        statusText: response.statusText,
        response: responseText,
        headers: Object.fromEntries([...response.headers.entries()])
      });
      
      throw new Error(`Zoho API error: ${response.status} ${response.statusText} - ${responseText}`);
    }

    try {
      return JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
  }

  // Try multiple endpoint patterns for getting products
  async getProducts(): Promise<ZohoProduct[]> {
    const storeId = process.env.ZOHO_STORE_ID;
    
    const endpointVariations = [
      `/stores/${storeId}/products`,
      `/products`,
      `/store/products`,
      `/organizations/${storeId}/products`,
      `/v1/stores/${storeId}/products`,
    ];

    let lastError: Error | null = null;

    for (const endpoint of endpointVariations) {
      try {
        console.log(`Trying products endpoint: ${endpoint}`);
        const response = await this.apiRequest(endpoint);
        
        // Handle different response structures
        const products = response.products || response.data || response;
        
        if (Array.isArray(products)) {
          console.log(`✓ Successfully fetched ${products.length} products from ${endpoint}`);
          return products;
        } else {
          console.log(`Unexpected response structure from ${endpoint}:`, response);
        }
      } catch (error) {
        console.log(`✗ Failed ${endpoint}:`, error instanceof Error ? error.message : error);
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
    }

    throw lastError || new Error('All product endpoint variations failed');
  }

  async getProduct(productId: string): Promise<ZohoProduct | null> {
    const storeId = process.env.ZOHO_STORE_ID;
    
    const endpointVariations = [
      `/stores/${storeId}/products/${productId}`,
      `/products/${productId}`,
      `/store/products/${productId}`,
    ];

    for (const endpoint of endpointVariations) {
      try {
        console.log(`Trying product endpoint: ${endpoint}`);
        const response = await this.apiRequest(endpoint);
        
        const product = response.product || response.data || response;
        if (product && product.product_id) {
          console.log(`✓ Successfully fetched product from ${endpoint}`);
          return product;
        }
      } catch (error) {
        console.log(`✗ Failed ${endpoint}:`, error instanceof Error ? error.message : error);
        if (error instanceof Error && error.message.includes('404')) {
          continue;
        }
        // For non-404 errors, we might want to throw immediately
      }
    }

    return null;
  }

  async createOrder(orderData: Partial<ZohoOrder>): Promise<ZohoOrder> {
    const storeId = process.env.ZOHO_STORE_ID;
    const response = await this.apiRequest(`/stores/${storeId}/orders`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
    return response.order || response.data || response;
  }

  // Utility method to test different API configurations
  async testConfiguration(): Promise<{success: boolean, endpoint?: string, error?: string}> {
    try {
      const products = await this.getProducts();
      return {
        success: true,
        endpoint: this.config.baseURL
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Export both the class and a default instance
export { ImprovedZohoCommerceAPI };

// Create instances for different configurations to test
export const zohoAPIImproved = new ImprovedZohoCommerceAPI();

// Alternative configurations to try
export const zohoAPIAlternatives = [
  new ImprovedZohoCommerceAPI({ baseURL: 'https://commerce.zoho.com/api/v1' }),
  new ImprovedZohoCommerceAPI({ baseURL: 'https://www.zohoapis.com/commerce/v1' }),
  new ImprovedZohoCommerceAPI({ baseURL: 'https://commerce.zoho.eu/api/v1' }),
  new ImprovedZohoCommerceAPI({ baseURL: 'https://commerce.zoho.in/api/v1' }),
];

export type { ZohoProduct, ZohoOrder };