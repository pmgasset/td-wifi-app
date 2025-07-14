// ===== src/lib/zoho-api.ts ===== (ENHANCED VERSION WITH CUSTOMER SUPPORT)
interface ZohoCustomer {
  customer_id?: string;
  contact_id?: string;
  id?: string;
  name: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  billing_address?: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  created_time?: string;
  status?: string;
}

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

interface ZohoOrder {
  salesorder_id?: string;
  order_id?: string;
  id?: string;
  customer_id?: string;
  customer_email: string;
  customer_name: string;
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
}

class EnhancedZohoCommerceAPI {
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

  // ===== CUSTOMER MANAGEMENT METHODS =====

  /**
   * Create a new customer in Zoho Commerce
   * Tries multiple possible endpoints to find the working one
   */
  async createCustomer(customerData: Partial<ZohoCustomer>): Promise<ZohoCustomer | null> {
    const customerEndpoints = [
      '/customers',
      '/contacts', 
      '/people',
      '/buyers'
    ];

    console.log('Attempting to create customer:', customerData);

    for (const endpoint of customerEndpoints) {
      try {
        console.log(`Trying customer creation at: ${endpoint}`);
        
        const response = await this.apiRequest(endpoint, {
          method: 'POST',
          body: JSON.stringify(customerData)
        });

        console.log(`✅ Customer created successfully at ${endpoint}:`, response);
        
        // Return the customer data with standardized ID
        const customer = response.customer || response.contact || response.person || response.buyer || response;
        
        return {
          ...customer,
          customer_id: customer.customer_id || customer.contact_id || customer.id || customer.person_id || customer.buyer_id
        };

      } catch (error) {
        console.log(`❌ Customer creation failed at ${endpoint}:`, error instanceof Error ? error.message : error);
        continue;
      }
    }

    console.log('❌ All customer creation endpoints failed');
    return null;
  }

  /**
   * Search for existing customer by email
   */
  async findCustomerByEmail(email: string): Promise<ZohoCustomer | null> {
    const searchEndpoints = [
      `/customers?email=${encodeURIComponent(email)}`,
      `/contacts?email=${encodeURIComponent(email)}`,
      `/customers/search?email=${encodeURIComponent(email)}`,
      `/contacts/search?email=${encodeURIComponent(email)}`
    ];

    for (const endpoint of searchEndpoints) {
      try {
        console.log(`Searching for customer at: ${endpoint}`);
        
        const response = await this.apiRequest(endpoint);
        
        const customers = response.customers || 
                         response.contacts || 
                         response.data || 
                         (Array.isArray(response) ? response : []);
        
        if (customers.length > 0) {
          const customer = customers[0];
          console.log(`✅ Found existing customer:`, customer);
          
          return {
            ...customer,
            customer_id: customer.customer_id || customer.contact_id || customer.id
          };
        }

      } catch (error) {
        console.log(`❌ Customer search failed at ${endpoint}:`, error instanceof Error ? error.message : error);
        continue;
      }
    }

    console.log('❌ Customer not found with any search method');
    return null;
  }

  /**
   * Get or create customer - tries to find existing first, creates if not found
   */
  async getOrCreateCustomer(customerData: Partial<ZohoCustomer>): Promise<{ customer: ZohoCustomer | null; created: boolean }> {
    if (!customerData.email) {
      throw new Error('Email is required to get or create customer');
    }

    // First try to find existing customer
    console.log('Step 1: Looking for existing customer...');
    const existingCustomer = await this.findCustomerByEmail(customerData.email);
    
    if (existingCustomer) {
      console.log('✅ Using existing customer:', existingCustomer.customer_id);
      return { customer: existingCustomer, created: false };
    }

    // Create new customer if not found
    console.log('Step 2: Creating new customer...');
    const newCustomer = await this.createCustomer(customerData);
    
    if (newCustomer) {
      console.log('✅ Created new customer:', newCustomer.customer_id);
      return { customer: newCustomer, created: true };
    }

    console.log('❌ Could not create customer');
    return { customer: null, created: false };
  }

  // ===== ENHANCED ORDER METHODS =====

  /**
   * Create order with automatic customer handling
   */
  async createOrderWithCustomer(orderData: Partial<ZohoOrder>, customerInfo?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  }, shippingAddress?: any): Promise<{ order: ZohoOrder; customer?: ZohoCustomer; customerCreated?: boolean }> {
    
    let customer: ZohoCustomer | null = null;
    let customerCreated = false;

    // Try to create/find customer if customer info provided
    if (customerInfo) {
      console.log('Attempting to get or create customer...');
      
      try {
        const customerData: Partial<ZohoCustomer> = {
          name: `${customerInfo.firstName} ${customerInfo.lastName}`,
          email: customerInfo.email,
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          phone: customerInfo.phone || '',
          ...(shippingAddress && {
            billing_address: {
              address1: shippingAddress.address1,
              address2: shippingAddress.address2 || '',
              city: shippingAddress.city,
              state: shippingAddress.state,
              zip: shippingAddress.zipCode,
              country: shippingAddress.country || 'US'
            }
          })
        };

        const customerResult = await this.getOrCreateCustomer(customerData);
        customer = customerResult.customer;
        customerCreated = customerResult.created;

      } catch (customerError) {
        console.log('⚠️ Customer creation failed, proceeding without customer_id:', customerError instanceof Error ? customerError.message : customerError);
      }
    }

    // Create order data with customer_id if available
    const finalOrderData = {
      ...orderData,
      ...(customer?.customer_id && { customer_id: customer.customer_id })
    };

    console.log(`Creating order ${customer ? 'WITH' : 'WITHOUT'} customer_id...`);
    
    // Create the order
    const order = await this.createOrder(finalOrderData);
    
    return {
      order,
      customer: customer || undefined,
      customerCreated
    };
  }

  // ===== EXISTING METHODS (ENHANCED) =====

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

  async createOrder(orderData: Partial<ZohoOrder>): Promise<ZohoOrder> {
    console.log('Creating order in Zoho with data:', JSON.stringify(orderData, null, 2));
    
    const response = await this.apiRequest('/salesorders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
    
    console.log('Zoho order creation response:', JSON.stringify(response, null, 2));
    return response.salesorder || response;
  }

  // ===== DIAGNOSTIC METHODS =====

  /**
   * Test customer endpoints to see which ones work
   */
  async testCustomerEndpoints(): Promise<{ working: string[]; failed: string[] }> {
    const endpoints = ['/customers', '/contacts', '/people', '/buyers'];
    const working: string[] = [];
    const failed: string[] = [];

    for (const endpoint of endpoints) {
      try {
        await this.apiRequest(endpoint);
        working.push(endpoint);
        console.log(`✅ ${endpoint} - accessible`);
      } catch (error) {
        failed.push(endpoint);
        console.log(`❌ ${endpoint} - failed:`, error instanceof Error ? error.message : error);
      }
    }

    return { working, failed };
  }
}

export const enhancedZohoAPI = new EnhancedZohoCommerceAPI();
export type { ZohoCustomer, ZohoProduct, ZohoOrder };