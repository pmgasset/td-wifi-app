// ===== src/lib/zoho-api-corrected.ts =====
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

class CorrectedZohoCommerceAPI {
  // Use the correct US API base URL
  private baseURL = 'https://www.zohoapis.com/commerce/v1';
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
    const token = await this.getAccessToken();
    const url = `${this.baseURL}${endpoint}`;

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
        responseBody: responseText,
        requestHeaders: {
          'Authorization': `Zoho-oauthtoken ${token.substring(0, 10)}...`,
          'Content-Type': 'application/json'
        }
      });
      throw new Error(`Zoho API error: ${response.status} ${response.statusText} - ${responseText}`);
    }

    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', responseText);
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
  }

  // Method to discover and get the correct store ID
  async discoverStores(): Promise<any[]> {
    const orgId = process.env.ZOHO_STORE_ID;
    
    try {
      // Try to get stores list using organization ID
      console.log('Attempting to discover stores...');
      const response = await this.apiRequest(`/organizations/${orgId}/stores`);
      return response.stores || [];
    } catch (error) {
      console.log('Failed to get stores from organization, trying alternatives...');
      
      // Try alternative endpoints
      const alternatives = [
        '/stores',
        '/user/stores'
      ];
      
      for (const alt of alternatives) {
        try {
          const response = await this.apiRequest(alt);
          return response.stores || response || [];
        } catch (altError) {
          console.log(`Alternative ${alt} failed:`, altError instanceof Error ? altError.message : altError);
        }
      }
      
      throw error;
    }
  }

  async getProducts(): Promise<ZohoProduct[]> {
    const storeId = process.env.ZOHO_STORE_ID;

    // First, try using the provided ID as a store ID directly
    try {
      console.log(`Trying direct store access with ID: ${storeId}`);
      const response = await this.apiRequest(`/stores/${storeId}/products`);
      const products = response.products || [];
      console.log(`✓ Found ${products.length} products using direct store access`);
      return products;
    } catch (error) {
      console.log('Direct store access failed, attempting store discovery...');
      
      try {
        // Try to discover stores and use the first one
        const stores = await this.discoverStores();
        
        if (stores.length === 0) {
          throw new Error('No stores found in your Zoho Commerce account');
        }
        
        console.log(`Found ${stores.length} stores, trying the first one...`);
        const firstStore = stores[0];
        const actualStoreId = firstStore.store_id || firstStore.id || firstStore.zoid;
        
        if (!actualStoreId) {
          throw new Error('Could not determine store ID from discovered stores');
        }
        
        console.log(`Using discovered store ID: ${actualStoreId} (${firstStore.store_name || 'Unknown name'})`);
        const response = await this.apiRequest(`/stores/${actualStoreId}/products`);
        const products = response.products || [];
        
        console.log(`✓ Found ${products.length} products using discovered store ID`);
        console.log(`💡 Update your ZOHO_STORE_ID environment variable to: ${actualStoreId}`);
        
        return products;
      } catch (discoveryError) {
        console.error('Store discovery also failed:', discoveryError);
        throw new Error(`Failed to get products. Original error: ${error instanceof Error ? error.message : error}. Discovery error: ${discoveryError instanceof Error ? discoveryError.message : discoveryError}`);
      }
    }
  }

  async getProduct(productId: string): Promise<ZohoProduct | null> {
    const storeId = process.env.ZOHO_STORE_ID;
    
    try {
      const response = await this.apiRequest(`/stores/${storeId}/products/${productId}`);
      return response.product || response || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async createOrder(orderData: Partial<ZohoOrder>): Promise<ZohoOrder> {
    const storeId = process.env.ZOHO_STORE_ID;
    const response = await this.apiRequest(`/stores/${storeId}/orders`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
    return response.order || response;
  }

  // Debug method to test the API setup
  async debugSetup(): Promise<{
    auth: boolean;
    storeAccess: boolean;
    productsAccess: boolean;
    storeInfo?: any;
    productCount?: number;
    sampleProduct?: any;
    recommendedStoreId?: string;
  }> {
    const result = {
      auth: false,
      storeAccess: false,
      productsAccess: false
    } as any;

    try {
      // Test authentication
      await this.getAccessToken();
      result.auth = true;
      console.log('✓ Authentication working');

      // Test store access
      const stores = await this.discoverStores();
      result.storeAccess = true;
      result.storeInfo = stores;
      console.log(`✓ Store access working - found ${stores.length} stores`);

      if (stores.length > 0) {
        const firstStore = stores[0];
        result.recommendedStoreId = firstStore.store_id || firstStore.id || firstStore.zoid;
      }

      // Test products access
      const products = await this.getProducts();
      result.productsAccess = true;
      result.productCount = products.length;
      result.sampleProduct = products[0] || null;
      console.log(`✓ Products access working - found ${products.length} products`);

    } catch (error) {
      console.error('Debug setup failed:', error);
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }
}

export const zohoAPI = new CorrectedZohoCommerceAPI();
export type { ZohoProduct, ZohoOrder };