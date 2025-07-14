// ===== src/lib/zoho-api-guest.ts ===== (GUEST-ONLY VERSION)
interface ZohoProduct {
  product_id: string;
  name: string;
  product_description: string;
  description: string;
  min_rate: number;
  max_rate: number;
  documents: Array<{
    document_id: string;
    file_name: string;
    attachment_order: number;
    file_type: string;
    alter_text: string;
    uploaded_on: string;
  }>;
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
  category_id: string;
  url: string;
  overall_stock: string;
  // Compatibility fields
  product_name?: string;
  product_price?: number;
  product_images?: string[];
  inventory_count?: number;
  product_category?: string;
  seo_url?: string;
}

interface ZohoGuestOrder {
  salesorder_id?: string;
  order_id?: string;
  id?: string;
  // ❌ NO customer_id field - this causes the error
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  line_items: Array<{
    item_name: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  total: number;
  sub_total: number;
  tax_total?: number;
  shipping_charge?: number;
  date: string;
  notes?: string;
  shipping_address?: {
    attention: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
  };
  billing_address?: {
    attention: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
  };
  custom_fields?: Array<{
    label: string;
    value: string;
  }>;
}

class GuestOnlyZohoCommerceAPI {
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
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
      
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
      const error = new Error(`Zoho API error: ${response.status} ${response.statusText} - ${responseText}`);
      (error as any).status = response.status;
      (error as any).responseText = responseText;
      throw error;
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

  // ===== GUEST ORDER METHODS =====

  /**
   * Create a guest order (NO customer_id field)
   * This method specifically removes any customer_id to avoid the error
   */
  async createGuestOrder(orderData: Partial<ZohoGuestOrder>): Promise<ZohoGuestOrder> {
    console.log('Creating GUEST order in Zoho (ensuring no customer_id)...');
    
    // ✅ CRITICAL: Remove any customer_id fields that might have been added
    const cleanOrderData = { ...orderData };
    
    // Remove all possible customer ID field variations
    delete (cleanOrderData as any).customer_id;
    delete (cleanOrderData as any).customerId;
    delete (cleanOrderData as any).contact_id;
    delete (cleanOrderData as any).contactId;
    delete (cleanOrderData as any).person_id;
    delete (cleanOrderData as any).personId;
    
    // Log to verify no customer_id is present
    const dataString = JSON.stringify(cleanOrderData);
    if (dataString.includes('customer_id') || dataString.includes('customerId')) {
      console.error('❌ CRITICAL: customer_id still found in order data!');
      console.error('Problematic data:', cleanOrderData);
      throw new Error('customer_id field detected in order data - this will cause API error');
    }
    
    console.log('✅ Verified: No customer_id in order data');
    console.log('Guest order data:', JSON.stringify(cleanOrderData, null, 2));
    
    const response = await this.apiRequest('/salesorders', {
      method: 'POST',
      body: JSON.stringify(cleanOrderData),
    });
    
    console.log('✅ Zoho guest order creation response:', JSON.stringify(response, null, 2));
    return response.salesorder || response;
  }

  // ===== EXISTING PRODUCT METHODS (UNCHANGED) =====

  private extractImageUrls(product: any): string[] {
    const images: string[] = [];
    
    if (product.documents && Array.isArray(product.documents)) {
      for (const doc of product.documents) {
        if (doc.document_id && doc.file_name) {
          const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${doc.document_id}/400x400?storefront_domain=www.traveldatawifi.com`;
          images.push(imageUrl);
        }
      }
    }
    
    if (images.length === 0 && product.variants && Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        if (variant.documents && Array.isArray(variant.documents)) {
          for (const doc of variant.documents) {
            if (doc.document_id && doc.file_name) {
              const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${doc.document_id}/400x400?storefront_domain=www.traveldatawifi.com`;
              images.push(imageUrl);
            }
          }
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

  async getProducts(): Promise<ZohoProduct[]> {
    try {
      const response = await this.apiRequest('/products');
      const products = response.products || [];
      
      return products.map((product: any) => ({
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

  async getProduct(productId: string): Promise<ZohoProduct | null> {
    try {
      const response = await this.apiRequest(`/products/${productId}`);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        return null;
      }
      throw error;
    }
  }

  // ===== LEGACY METHOD (DEPRECATED - USE createGuestOrder) =====

  /**
   * @deprecated Use createGuestOrder() instead
   * This method is kept for backwards compatibility but will remove customer_id
   */
  async createOrder(orderData: Partial<ZohoGuestOrder>): Promise<ZohoGuestOrder> {
    console.log('⚠️ DEPRECATED: createOrder() called - redirecting to createGuestOrder()');
    return this.createGuestOrder(orderData);
  }

  // ===== DIAGNOSTIC METHODS =====

  /**
   * Validate that order data contains no customer_id fields
   */
  validateGuestOrderData(orderData: any): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check for customer ID fields
    const customerIdFields = ['customer_id', 'customerId', 'contact_id', 'contactId', 'person_id', 'personId'];
    
    for (const field of customerIdFields) {
      if (field in orderData) {
        issues.push(`Found prohibited field: ${field}`);
      }
    }
    
    // Check serialized data for customer_id strings
    const dataString = JSON.stringify(orderData);
    if (dataString.includes('customer_id')) {
      issues.push('String "customer_id" found in serialized data');
    }
    
    // Check required fields
    if (!orderData.customer_name) issues.push('Missing required field: customer_name');
    if (!orderData.customer_email) issues.push('Missing required field: customer_email');
    if (!orderData.line_items || orderData.line_items.length === 0) {
      issues.push('Missing or empty line_items array');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

export const guestZohoAPI = new GuestOnlyZohoCommerceAPI();
export type { ZohoProduct, ZohoGuestOrder };