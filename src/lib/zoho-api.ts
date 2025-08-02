// src/lib/zoho-api.ts - Updated to use centralized token manager
// REMOVED: Local token caching - now uses tokenManager.getAccessToken('commerce')

import { tokenManager } from './enhanced-token-manager';

interface ZohoProduct {
  product_id: string;
  product_name: string;
  product_description: string;
  product_price: number;
  product_images: string[];
  inventory_count: number;
  product_category: string;
  seo_url: string;
  sku?: string;
  documents?: Array<{
    document_id: string;
    file_name: string;
    document_name?: string;
  }>;
  variants?: Array<{
    documents?: Array<{
      document_id: string;
      file_name: string;
    }>;
  }>;
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

class ZohoCommerceAPI {
  private baseURL: string;
  private storeId: string;

  constructor() {
    // Use the working API base URL from your project
    this.baseURL = 'https://www.zohoapis.com/commerce/v1';
    
    this.storeId = process.env.ZOHO_STORE_ID || '';
    if (!this.storeId) {
      console.warn('ZOHO_STORE_ID not set - Commerce API calls may fail');
    }
  }

  /**
   * Get access token using centralized token manager
   * REMOVED: Local token caching and refresh logic
   */
  async getAccessToken(): Promise<string> {
    try {
      // Use centralized token manager instead of local caching
      return await tokenManager.getAccessToken('commerce');
    } catch (error) {
      console.error('Failed to get access token from token manager:', error);
      throw new Error(`Token manager error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make authenticated request to Zoho Commerce API
   */
  async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.storeId) {
      throw new Error('ZOHO_STORE_ID is required for Commerce API calls');
    }

    try {
      const token = await this.getAccessToken();
      
      // Construct full URL with store ID
      const url = `${this.baseURL}${endpoint}`;

      console.log(`📡 Making Commerce API request: ${endpoint}`);

      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
          'X-com-zoho-store-organizationid': this.storeId,
          ...options.headers,
        },
        // Add timeout to prevent hanging requests
        signal: options.signal || AbortSignal.timeout(30000) // 30 second timeout
      });

      const responseText = await response.text();

      if (!response.ok) {
        // Check if it's a rate limit error
        if (response.status === 429) {
          throw new Error(`Rate limit exceeded. Please wait before making more requests.`);
        }
        
        // Check for authentication errors
        if (response.status === 401) {
          console.warn('Commerce API authentication failed - token may be expired');
          // Clear token cache and retry once
          tokenManager.clearCache('commerce');
          throw new Error(`Authentication failed: ${response.status} - ${responseText}`);
        }
        
        throw new Error(`Commerce API error: ${response.status} - ${responseText}`);
      }

      let jsonResponse;
      try {
        jsonResponse = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response from Commerce API: ${responseText.substring(0, 200)}...`);
      }

      // Handle API-level errors (some APIs return 200 with error codes)
      if (jsonResponse.error_code && jsonResponse.error_code !== 0) {
        throw new Error(`Commerce API error: ${jsonResponse.error_message} (Code: ${jsonResponse.error_code})`);
      }

      console.log(`✅ Commerce API request successful: ${endpoint}`);
      return jsonResponse;

    } catch (error) {
      console.error(`❌ Commerce API request failed: ${endpoint}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        storeId: this.storeId ? 'set' : 'missing'
      });
      throw error;
    }
  }

  /**
   * Get all products from Commerce API
   */
  async getProducts(): Promise<ZohoProduct[]> {
    try {
      console.log('🛒 Fetching products from Zoho Commerce API...');
      
      // Try the working endpoint pattern from your project
      const response = await this.apiRequest(`/stores/${this.storeId}/products`);
      const products = response.products || response.data || [];
      
      console.log(`📊 Retrieved ${products.length} products from Commerce API`);
      
      // Log products with documents/images for debugging
      const productsWithDocuments = products.filter((product: ZohoProduct) => 
        product.documents && product.documents.length > 0
      );
      console.log(`🖼️  ${productsWithDocuments.length} products have documents/images`);
      
      return products;
    } catch (error) {
      console.error('❌ Failed to get commerce products:', error);
      
      // Provide helpful error context
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          throw new Error('Commerce API rate limited. Please wait before retrying.');
        }
        if (error.message.includes('store') || error.message.includes('Store')) {
          throw new Error('Invalid store ID or store not found. Check ZOHO_STORE_ID environment variable.');
        }
        if (error.message.includes('Authentication failed')) {
          throw new Error('Zoho Commerce authentication failed. Check OAuth credentials.');
        }
      }
      
      throw error;
    }
  }

  /**
   * Get a specific product by ID
   */
  async getProduct(productId: string): Promise<ZohoProduct | null> {
    try {
      console.log(`🔍 Fetching commerce product: ${productId}`);
      const response = await this.apiRequest(`/stores/${this.storeId}/products/${productId}`);
      const product = response.product || response.data || null;
      
      if (product) {
        console.log(`✅ Found commerce product: ${product.product_name} (${product.sku})`);
      } else {
        console.log(`❌ Commerce product not found: ${productId}`);
      }
      
      return product;
    } catch (error) {
      console.error(`❌ Failed to get commerce product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Create an order (for future use)
   */
  async createOrder(orderData: Partial<ZohoOrder>): Promise<string> {
    try {
      console.log('📝 Creating order in Commerce API...');
      const response = await this.apiRequest(`/stores/${this.storeId}/orders`, {
        method: 'POST',
        body: JSON.stringify(orderData)
      });
      
      const orderId = response.order?.order_id || response.order_id;
      console.log(`✅ Order created: ${orderId}`);
      return orderId;
    } catch (error) {
      console.error('❌ Failed to create order:', error);
      throw error;
    }
  }

  /**
   * Get store information
   */
  async getStoreInfo(): Promise<any> {
    try {
      console.log('🏪 Fetching store information...');
      const response = await this.apiRequest(`/stores/${this.storeId}`);
      const store = response.store || response.data;
      
      if (store) {
        console.log(`✅ Store info: ${store.store_name || 'Unknown'}`);
      }
      
      return store;
    } catch (error) {
      console.error('❌ Failed to get store info:', error);
      throw error;
    }
  }

  /**
   * Health check for the Commerce API
   */
  async healthCheck(): Promise<{ status: string; message: string; timestamp: string }> {
    try {
      // Simple API call to check connectivity
      await this.apiRequest(`/stores/${this.storeId}?fields=store_id,store_name`);
      
      return {
        status: 'healthy',
        message: 'Commerce API is accessible',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get API usage statistics from token manager
   */
  getUsageStats() {
    const tokenStats = tokenManager.getStatus();
    
    return {
      service: 'commerce',
      token_manager_stats: tokenStats,
      store_id: this.storeId ? 'configured' : 'missing',
      base_url: this.baseURL
    };
  }

  /**
   * Alternative endpoint test (for debugging)
   */
  async testAlternativeEndpoints(): Promise<any> {
    const endpoints = [
      `/stores/${this.storeId}/products`,
      `/products`,
      `/stores`
    ];

    const results = {};

    for (const endpoint of endpoints) {
      try {
        console.log(`🧪 Testing endpoint: ${endpoint}`);
        const response = await this.apiRequest(endpoint);
        results[endpoint] = {
          success: true,
          dataCount: response.products?.length || response.stores?.length || 0,
          hasData: !!(response.products || response.stores || response.data)
        };
      } catch (error) {
        results[endpoint] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return results;
  }
}

// Export singleton instance
export const zohoAPI = new ZohoCommerceAPI();

// Export types for other modules
export type { ZohoProduct, ZohoOrder };