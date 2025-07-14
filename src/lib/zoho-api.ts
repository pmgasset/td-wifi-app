// ===== src/lib/zoho-api-simple.ts ===== (SIMPLE FALLBACK VERSION)

class SimpleZohoAPI {
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
        throw new Error(`Auth failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token received');
      }

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
      
      return data.access_token;
    } catch (error) {
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!process.env.ZOHO_STORE_ID) {
      throw new Error('ZOHO_STORE_ID required');
    }

    const token = await this.getAccessToken();
    const url = `${this.baseURL}${endpoint}`;

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
      throw new Error(`API error: ${response.status} - ${responseText}`);
    }

    try {
      const jsonResponse = JSON.parse(responseText);
      
      if (jsonResponse.code && jsonResponse.code !== 0) {
        throw new Error(`API error: ${jsonResponse.message} (Code: ${jsonResponse.code})`);
      }
      
      return jsonResponse;
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message.includes('API error:')) {
        throw parseError;
      }
      throw new Error(`Invalid JSON: ${responseText}`);
    }
  }

  async getProducts(): Promise<any[]> {
    try {
      const response = await this.apiRequest('/products');
      const products = response.products || [];
      
      // Transform to match expected format
      return products.map((product: any) => ({
        ...product,
        product_name: product.name || product.product_name,
        product_price: product.min_rate || product.max_rate || product.product_price || 0,
        product_images: this.extractImages(product),
        inventory_count: this.parseStock(product.overall_stock),
        product_category: product.category_name || product.product_category || '',
        seo_url: product.url || product.seo_url || product.product_id
      }));
    } catch (error) {
      console.error('Failed to get products:', error);
      throw error;
    }
  }

  async getProduct(productId: string): Promise<any | null> {
    try {
      const response = await this.apiRequest(`/products/${productId}`);
      const product = response.product || null;
      
      if (!product) return null;
      
      return {
        ...product,
        product_name: product.name || product.product_name,
        product_price: product.min_rate || product.max_rate || product.product_price || 0,
        product_images: this.extractImages(product),
        inventory_count: this.parseStock(product.overall_stock),
        product_category: product.category_name || product.product_category || '',
        seo_url: product.url || product.seo_url || product.product_id
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async createOrder(orderData: any): Promise<any> {
    console.log('Creating order:', JSON.stringify(orderData, null, 2));
    
    // Remove any customer_id fields to avoid the error
    const cleanData = { ...orderData };
    delete cleanData.customer_id;
    delete cleanData.customerId;
    
    const response = await this.apiRequest('/salesorders', {
      method: 'POST',
      body: JSON.stringify(cleanData),
    });
    
    return response.salesorder || response;
  }

  private extractImages(product: any): string[] {
    const images: string[] = [];
    
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

  private parseStock(stockString: string): number {
    if (!stockString) return 0;
    const parsed = parseInt(stockString, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
}

export const zohoAPI = new SimpleZohoAPI();
export const simpleZohoAPI = new SimpleZohoAPI();