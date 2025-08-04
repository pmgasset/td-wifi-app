// ===== src/lib/zoho-api.ts ===== (UPDATED TO USE STOREFRONT API FOR IMAGES)
class ZohoCommerceAPI {
  private baseURL = 'https://commerce.zoho.com/store/api/v1';
  private storefrontURL = 'https://commerce.zoho.com/storefront/api/v1';

  private validateEnvVars(): void {
    const requiredVars = [
      'ZOHO_CLIENT_ID',
      'ZOHO_CLIENT_SECRET',
      'ZOHO_REFRESH_TOKEN'
    ];
    
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }

  async getAccessToken(): Promise<string> {
    this.validateEnvVars();
    
    const credentials = {
      client_id: process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
      refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    };

    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(credentials),
    });

    if (!response.ok) {
      throw new Error(`Auth error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error(`No access token received: ${JSON.stringify(data)}`);
    }

    return data.access_token;
  }

  async apiRequest(endpoint: string, options: RequestInit = {}, retry = true): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.baseURL}${endpoint}`;

    // Create headers using the Headers API
    const headers = new Headers();
    headers.append('Authorization', `Zoho-oauthtoken ${token}`);
    headers.append('Content-Type', 'application/json');
    
    if (process.env.ZOHO_STORE_ID) {
      headers.append('X-com-zoho-store-organizationid', process.env.ZOHO_STORE_ID);
    }

    // Add any existing headers from options
    if (options.headers) {
      const incomingHeaders = new Headers(options.headers);
      incomingHeaders.forEach((value, key) => {
        headers.append(key, value);
      });
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const responseText = await response.text();

    if (!response.ok) {
      // Handle auth errors with single retry
      if (retry && (response.status === 401 || response.status === 403)) {
        console.log('Auth error detected, retrying with new token...');
        return this.apiRequest(endpoint, options, false);
      }
      
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

  // Storefront API request method for getting products with images
  async storefrontRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.storefrontURL}${endpoint}`;

    // Create headers using the Headers API
    const headers = new Headers();
    headers.append('Authorization', `Zoho-oauthtoken ${token}`);
    headers.append('Content-Type', 'application/json');
    headers.append('domain-name', 'www.traveldatawifi.com');
    
    // Add any existing headers from options
    if (options.headers) {
      const incomingHeaders = new Headers(options.headers);
      incomingHeaders.forEach((value, key) => {
        headers.append(key, value);
      });
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`Storefront API error: ${response.status} - ${responseText}`);
    }

    try {
      return JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON from storefront: ${responseText}`);
    }
  }

  async getProducts(): Promise<any[]> {
    try {
      console.log('🛍️ Getting products from Store API for basic data...');
      const storeResponse = await this.apiRequest('/products');
      const storeProducts: any[] = storeResponse.products || [];
      console.log(`✅ Retrieved ${storeProducts.length} products from Store API`);

      console.log('🖼️ Getting product images from Storefront API...');
      const productsWithImages = await Promise.all(
        storeProducts.map(async (product: any) => {
          try {
            const storefrontData = await this.storefrontRequest(`/products/${product.product_id}?format=json`);
            const storefrontProduct = storefrontData?.payload?.product || storefrontData?.product || storefrontData;
            
            if (storefrontProduct) {
              const images = this.extractStorefrontImages(storefrontProduct);
              
              if (images.length > 0) {
                console.log(`✅ Found ${images.length} images for ${product.name} via Storefront API`);
              }
              
              return {
                ...product,
                product_name: product.name || product.product_name,
                product_price: product.min_rate || product.max_rate || product.product_price || 0,
                product_images: images,
                inventory_count: this.parseStock(product.overall_stock),
                product_category: product.category_name || product.product_category || '',
                seo_url: product.url || product.seo_url || product.product_id,
                image_source: 'storefront_api'
              };
            }
            
            return {
              ...product,
              product_name: product.name || product.product_name,
              product_price: product.min_rate || product.max_rate || product.product_price || 0,
              product_images: this.extractImages(product),
              inventory_count: this.parseStock(product.overall_stock),
              product_category: product.category_name || product.product_category || '',
              seo_url: product.url || product.seo_url || product.product_id,
              image_source: 'store_api_fallback'
            };
            
          } catch (error) {
            console.warn(`⚠️ Storefront API failed for product ${product.product_id}: ${(error as Error).message}`);
            
            return {
              ...product,
              product_name: product.name || product.product_name,
              product_price: product.min_rate || product.max_rate || product.product_price || 0,
              product_images: this.extractImages(product),
              inventory_count: this.parseStock(product.overall_stock),
              product_category: product.category_name || product.product_category || '',
              seo_url: product.url || product.seo_url || product.product_id,
              image_source: 'store_api_only'
            };
          }
        })
      );

      console.log('✅ Successfully merged Store API + Storefront API data');
      return productsWithImages;
      
    } catch (error) {
      console.error('❌ Failed to get products:', (error as Error).message);
      throw error;
    }
  }

  // Extract images from Storefront API response
  extractStorefrontImages(product: any): string[] {
    const imageSet = new Set<string>();

    // Helper to add images from arrays
    const addImages = (items: any[]) => {
      items.forEach(item => {
        if (typeof item === 'string') {
          imageSet.add(`https://us.zohocommercecdn.com${item}?storefront_domain=www.traveldatawifi.com`);
        } else if (item?.url) {
          imageSet.add(`https://us.zohocommercecdn.com${item.url}?storefront_domain=www.traveldatawifi.com`);
        }
      });
    };

    // Helper to add images from documents
    const addDocumentImages = (docs: any[]) => {
      docs.forEach(doc => {
        if (doc?.file_name && this.isImageFile(doc.file_name) && doc.document_id) {
          const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${doc.document_id}?storefront_domain=www.traveldatawifi.com`;
          imageSet.add(imageUrl);
        }
      });
    };

    // Product-level images
    if (Array.isArray(product.images)) {
      addImages(product.images);
    }
    
    // Product-level documents
    if (Array.isArray(product.documents)) {
      addDocumentImages(product.documents);
    }

    // Variant-level images and documents
    if (Array.isArray(product.variants)) {
      product.variants.forEach((variant: any) => {
        if (Array.isArray(variant.images)) {
          addImages(variant.images);
        }
        if (Array.isArray(variant.documents)) {
          addDocumentImages(variant.documents);
        }
      });
    }

    return Array.from(imageSet);
  }

  // Legacy Store API image extraction (fallback)
  extractImages(product: any): string[] {
    const images: string[] = [];

    if (Array.isArray(product.documents)) {
      product.documents.forEach((doc: any) => {
        if (doc?.file_name && this.isImageFile(doc.file_name) && doc.document_id) {
          images.push(
            `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${doc.document_id}/400x400?storefront_domain=www.traveldatawifi.com`
          );
        }
      });
    }

    return images;
  }

  isImageFile(filename: string): boolean {
    if (!filename) return false;
    
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filename);
  }

  parseStock(stockValue: any): number {
    if (stockValue === null || stockValue === undefined || stockValue === '') {
      return 0;
    }
    
    const parsed = typeof stockValue === 'string' ? 
      parseFloat(stockValue) : Number(stockValue);
      
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }

  async getProduct(productId: string): Promise<any | null> {
    try {
      // Try Storefront API first for complete image data
      try {
        console.log(`🖼️ Getting product ${productId} from Storefront API...`);
        const storefrontData = await this.storefrontRequest(`/products/${productId}?format=json`);
        const storefrontProduct = storefrontData?.payload?.product || storefrontData?.product || storefrontData;
        
        if (storefrontProduct?.product_id) {
          const images = this.extractStorefrontImages(storefrontProduct);
          
          return {
            ...storefrontProduct,
            product_name: storefrontProduct.name || storefrontProduct.product_name,
            product_price: storefrontProduct.min_rate || storefrontProduct.max_rate || storefrontProduct.product_price || 0,
            product_images: images,
            inventory_count: this.parseStock(storefrontProduct.overall_stock),
            product_category: storefrontProduct.category_name || storefrontProduct.product_category || '',
            seo_url: storefrontProduct.url || storefrontProduct.seo_url || storefrontProduct.product_id,
            image_source: 'storefront_api'
          };
        }
      } catch (storefrontError) {
        console.warn(`⚠️ Storefront API failed for product ${productId}: ${(storefrontError as Error).message}`);
      }
      
      // Fallback to Store API
      console.log(`📦 Getting product ${productId} from Store API as fallback...`);
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
        seo_url: product.url || product.seo_url || product.product_id,
        image_source: 'store_api_fallback'
      };
    } catch (error) {
      console.error(`❌ Failed to get product ${productId}: ${(error as Error).message}`);
      return null;
    }
  }

  async createOrder(orderData: any): Promise<any> {
    const response = await this.apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
    return response.order || response.data || response;
  }
}

export const zohoAPI = new ZohoCommerceAPI();