// ===== src/lib/zoho-api.ts =====
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

class ZohoCommerceAPI {
  private baseURL = 'https://commerce.zoho.com/api/v1';
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
        throw new Error(`Zoho auth failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token received from Zoho');
      }

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer
      
      return this.accessToken!
    } catch (error) {
      console.error('Failed to get Zoho access token:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!process.env.ZOHO_STORE_ID) {
      throw new Error('ZOHO_STORE_ID environment variable is required');
    }

    const token = await this.getAccessToken();
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zoho API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async getProducts(): Promise<ZohoProduct[]> {
    const response = await this.apiRequest(`/stores/${process.env.ZOHO_STORE_ID}/products`);
    return response.products || [];
  }

  async getProduct(productId: string): Promise<ZohoProduct | null> {
    try {
      const response = await this.apiRequest(`/stores/${process.env.ZOHO_STORE_ID}/products/${productId}`);
      return response.product || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async createOrder(orderData: Partial<ZohoOrder>): Promise<ZohoOrder> {
    const response = await this.apiRequest(`/stores/${process.env.ZOHO_STORE_ID}/orders`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
    return response.order;
  }
}

export const zohoAPI = new ZohoCommerceAPI();
export type { ZohoProduct, ZohoOrder };