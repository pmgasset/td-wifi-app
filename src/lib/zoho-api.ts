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

    try {
      const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
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

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Zoho access token:', error);
      throw new Error('Authentication failed');
    }
  }

  async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
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
      throw new Error(`Zoho API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getProducts(): Promise<ZohoProduct[]> {
    try {
      const response = await this.apiRequest(`/stores/${process.env.ZOHO_STORE_ID}/products`);
      return response.products || [];
    } catch (error) {
      console.error('Failed to fetch products:', error);
      // Return mock data for development
      return this.getMockProducts();
    }
  }

  async getProduct(productId: string): Promise<ZohoProduct | null> {
    try {
      const response = await this.apiRequest(`/stores/${process.env.ZOHO_STORE_ID}/products/${productId}`);
      return response.product || null;
    } catch (error) {
      console.error('Failed to fetch product:', error);
      return this.getMockProducts().find(p => p.product_id === productId) || null;
    }
  }

  async createOrder(orderData: Partial<ZohoOrder>): Promise<ZohoOrder> {
    try {
      const response = await this.apiRequest(`/stores/${process.env.ZOHO_STORE_ID}/orders`, {
        method: 'POST',
        body: JSON.stringify(orderData),
      });
      return response.order;
    } catch (error) {
      console.error('Failed to create order:', error);
      throw error;
    }
  }

  private getMockProducts(): ZohoProduct[] {
    return [
      {
        product_id: 'tdw-hotspot-pro',
        product_name: 'Travel Data Hotspot Pro',
        product_description: 'High-performance 5G mobile hotspot perfect for RV travel and remote work. Supports up to 32 devices with 18-hour battery life.',
        product_price: 299.99,
        product_images: ['/images/hotspot-pro-1.jpg', '/images/hotspot-pro-2.jpg'],
        inventory_count: 50,
        product_category: 'Mobile Hotspots',
        seo_url: 'travel-data-hotspot-pro'
      },
      {
        product_id: 'tdw-sim-unlimited',
        product_name: 'Unlimited Data SIM Card',
        product_description: 'Truly unlimited 4G/5G data SIM card with no throttling. Works with any unlocked device. Perfect for extended RV trips.',
        product_price: 69.99,
        product_images: ['/images/sim-card-1.jpg'],
        inventory_count: 100,
        product_category: 'SIM Cards',
        seo_url: 'unlimited-data-sim-card'
      },
      {
        product_id: 'tdw-booster-kit',
        product_name: 'Signal Booster Kit',
        product_description: 'Complete cellular signal booster kit for RVs and vehicles. Amplifies weak signals for better connectivity in remote areas.',
        product_price: 449.99,
        product_images: ['/images/booster-kit-1.jpg', '/images/booster-kit-2.jpg'],
        inventory_count: 25,
        product_category: 'Signal Boosters',
        seo_url: 'signal-booster-kit'
      }
    ];
  }
}

export const zohoAPI = new ZohoCommerceAPI();
export type { ZohoProduct, ZohoOrder };
