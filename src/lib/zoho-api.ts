// ===== src/lib/zoho-api.ts ===== (Replace your existing file)
interface ZohoProduct {
  product_id: string;
  name: string; // Note: Zoho uses 'name' not 'product_name'
  product_description: string;
  min_rate: number; // Note: Zoho uses 'min_rate' for price
  max_rate: number;
  documents: Array<{
    document_id: string;
    document_name: string;
    file_name: string;
    file_size: number;
    file_type: string;
    is_default_image: boolean;
    image_url?: string;
  }>; // Zoho uses 'documents' for images
  variants: Array<{
    variant_id: string;
    name: string;
    rate: number;
    stock_on_hand: string;
    available_stock: string;
    documents: Array<any>;
  }>;
  status: string;
  show_in_storefront: boolean;
  category_name: string;
  url: string; // SEO URL
  overall_stock: string;
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
        throw new Error(`Zoho auth failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token received from Zoho');
      }

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer
      
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
      throw new Error(`Zoho API error: ${response.status} ${response.statusText} - ${responseText}`);
    }

    try {
      const jsonResponse = JSON.parse(responseText);
      
      if (jsonResponse.code && jsonResponse.code !== 0) {
        throw new Error(`Zoho API error: ${jsonResponse.message || 'Unknown error'} (Code: ${jsonResponse.code})`);
      }
      
      return jsonResponse;
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message.includes('Zoho API error:')) {
        throw parseError;
      }
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
  }

  async getProducts(): Promise<ZohoProduct[]> {
    try {
      const response = await this.apiRequest('/products');
      const products = response.products || [];
      
      // Transform products to match expected interface
      return products.map((product: any) => ({
        ...product,
        // Map Zoho fields to expected fields for backward compatibility
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

  async getProduct(productId: string): Promise<ZohoProduct | null> {
    try {
      const response = await this.apiRequest(`/products/${productId}`);
      const product = response.product || null;
      
      if (!product) return null;
      
      // Transform product to match expected interface
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        return null;
      }
      throw error;
    }
  }

  // Helper method to extract image URLs from Zoho's documents structure
  private extractImageUrls(product: any): string[] {
    const images: string[] = [];
    
    // Check main product documents
    if (product.documents && Array.isArray(product.documents)) {
      for (const doc of product.documents) {
        if (doc.image_url) {
          images.push(doc.image_url);
        } else if (doc.document_id) {
          // Construct image URL from document ID (this might need adjustment based on Zoho's URL pattern)
          images.push(`https://commerce.zoho.com/store/api/v1/documents/${doc.document_id}/image`);
        }
      }
    }
    
    // Check variant documents as fallback
    if (images.length === 0 && product.variants && Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        if (variant.documents && Array.isArray(variant.documents)) {
          for (const doc of variant.documents) {
            if (doc.image_url) {
              images.push(doc.image_url);
            } else if (doc.document_id) {
              images.push(`https://commerce.zoho.com/store/api/v1/documents/${doc.document_id}/image`);
            }
          }
        }
      }
    }
    
    return images;
  }

  // Helper method to parse stock information
  private parseStock(stockString: string): number {
    if (!stockString) return 0;
    const parsed = parseInt(stockString, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  async createOrder(orderData: Partial<ZohoOrder>): Promise<ZohoOrder> {
    const response = await this.apiRequest('/salesorders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
    return response.salesorder || response;
  }
}

export const zohoAPI = new ZohoCommerceAPI();
export type { ZohoProduct, ZohoOrder };