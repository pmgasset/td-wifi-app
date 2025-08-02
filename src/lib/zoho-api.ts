// ===== src/lib/zoho-api.ts ===== (UPDATED TO USE STOREFRONT API FOR IMAGES)
class ZohoCommerceAPI {
  private baseURL = 'https://commerce.zoho.com/store/api/v1';
  private storefrontURL = 'https://commerce.zoho.com/storefront/api/v1';

  async getAccessToken(): Promise<string> {
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

  async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
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

  // NEW: Storefront API request method for getting products with images
  async storefrontRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.storefrontURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
        'domain-name': 'www.traveldatawifi.com', // Your store domain
        ...options.headers,
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`Storefront API error: ${response.status} - ${responseText}`);
    }

    try {
      const jsonResponse = JSON.parse(responseText);
      return jsonResponse;
    } catch (parseError) {
      throw new Error(`Invalid JSON from storefront: ${responseText}`);
    }
  }

  async getProducts(): Promise<any[]> {
    try {
      console.log('🛍️ Getting products from Store API for basic data...');
      // Get basic product data from Store API
      const storeResponse = await this.apiRequest('/products');
      const storeProducts = storeResponse.products || [];
      console.log(`✅ Retrieved ${storeProducts.length} products from Store API`);

      console.log('🖼️ Getting product images from Storefront API...');
      // Get product images from Storefront API for each product
      const productsWithImages = await Promise.all(
        storeProducts.map(async (product) => {
          try {
            // Get images from Storefront API
            const storefrontData = await this.storefrontRequest(`/products/${product.product_id}?format=json`);
            const storefrontProduct = storefrontData?.payload?.product || storefrontData?.product || storefrontData;
            
            if (storefrontProduct) {
              // Extract images from Storefront API response
              const images = this.extractStorefrontImages(storefrontProduct);
              
              if (images.length > 0) {
                console.log(`✅ Found ${images.length} images for ${product.name} via Storefront API`);
              }
              
              return {
                ...product,
                product_name: product.name || product.product_name,
                product_price: product.min_rate || product.max_rate || product.product_price || 0,
                product_images: images, // Use Storefront API images
                inventory_count: this.parseStock(product.overall_stock),
                product_category: product.category_name || product.product_category || '',
                seo_url: product.url || product.seo_url || product.product_id,
                image_source: 'storefront_api' // Debug info
              };
            }
            
            // Fallback to Store API images if Storefront fails
            return {
              ...product,
              product_name: product.name || product.product_name,
              product_price: product.min_rate || product.max_rate || product.product_price || 0,
              product_images: this.extractImages(product), // Fallback to Store API
              inventory_count: this.parseStock(product.overall_stock),
              product_category: product.category_name || product.product_category || '',
              seo_url: product.url || product.seo_url || product.product_id,
              image_source: 'store_api_fallback' // Debug info
            };
            
          } catch (error) {
            console.warn(`⚠️ Storefront API failed for product ${product.product_id}, using Store API data:`, error.message);
            
            // Fallback to Store API data only
            return {
              ...product,
              product_name: product.name || product.product_name,
              product_price: product.min_rate || product.max_rate || product.product_price || 0,
              product_images: this.extractImages(product), // Store API images as fallback
              inventory_count: this.parseStock(product.overall_stock),
              product_category: product.category_name || product.product_category || '',
              seo_url: product.url || product.seo_url || product.product_id,
              image_source: 'store_api_only' // Debug info
            };
          }
        })
      );

      console.log('✅ Successfully merged Store API + Storefront API data');
      return productsWithImages;
      
    } catch (error) {
      console.error('❌ Failed to get products:', error);
      throw error;
    }
  }

  // NEW: Extract images from Storefront API response
  extractStorefrontImages(product: any): string[] {
    const images: string[] = [];

    // Method 1: Direct images array (from Storefront API)
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach(img => {
        if (typeof img === 'string') {
          images.push(`https://commerce.zoho.com${img}`);
        } else if (img.url) {
          images.push(`https://commerce.zoho.com${img.url}`);
        }
      });
    }

    // Method 2: Documents array (primary image source in Storefront API)
    if (product.documents && Array.isArray(product.documents)) {
      console.log(`Found ${product.documents.length} documents for storefront extraction`);
      product.documents.forEach(doc => {
        if (doc.file_name && this.isImageFile(doc.file_name) && doc.document_id) {
          // Construct full-size Zoho CDN URL (remove size restrictions)
          const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${doc.document_id}?storefront_domain=www.traveldatawifi.com`;
          images.push(imageUrl);
          console.log(`✓ Constructed Storefront CDN image: ${imageUrl}`);
        }
      });
    }

    // Method 3: Variant images (from Storefront API)
    if (product.variants && Array.isArray(product.variants)) {
      product.variants.forEach(variant => {
        if (variant.images && Array.isArray(variant.images)) {
          variant.images.forEach(img => {
            if (typeof img === 'string') {
              images.push(`https://commerce.zoho.com${img}`);
            } else if (img.url) {
              images.push(`https://commerce.zoho.com${img.url}`);
            }
          });
        }
        
        // Variant documents
        if (variant.documents && Array.isArray(variant.documents)) {
          variant.documents.forEach(doc => {
            if (doc.file_name && this.isImageFile(doc.file_name) && doc.document_id) {
              const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${doc.document_id}?storefront_domain=www.traveldatawifi.com`;
              images.push(imageUrl);
              console.log(`✓ Constructed variant CDN image: ${imageUrl}`);
            }
          });
        }
      });
    }

    // Remove duplicates and return
    const uniqueImages = [...new Set(images)];
    console.log(`🖼️ Extracted ${uniqueImages.length} unique images from Storefront API`);
    return uniqueImages;
  }

  // Legacy Store API image extraction (fallback)
  extractImages(product: any): string[] {
    const images: string[] = [];

    // Try various Store API image sources
    if (product.documents && Array.isArray(product.documents)) {
      product.documents.forEach(doc => {
        if (doc.file_name && this.isImageFile(doc.file_name) && doc.document_id) {
          // Use basic CDN URL for Store API
          const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${doc.document_id}/400x400?storefront_domain=www.traveldatawifi.com`;
          images.push(imageUrl);
        }
      });
    }

    return [...new Set(images)];
  }

  isImageFile(filename: string): boolean {
    if (!filename || typeof filename !== 'string') return false;
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const lowerFilename = filename.toLowerCase();
    
    return imageExtensions.some(ext => lowerFilename.endsWith(ext));
  }

  parseStock(stockValue: any): number {
    if (stockValue === null || stockValue === undefined || stockValue === '') {
      return 0;
    }
    
    const parsed = typeof stockValue === 'string' ? 
      parseFloat(stockValue) : Number(stockValue);
    return isNaN(parsed) ? 0 : parsed;
  }

  async getProduct(productId: string): Promise<any | null> {
    try {
      // Try Storefront API first for complete image data
      try {
        console.log(`🖼️ Getting product ${productId} from Storefront API...`);
        const storefrontData = await this.storefrontRequest(`/products/${productId}?format=json`);
        const storefrontProduct = storefrontData?.payload?.product || storefrontData?.product || storefrontData;
        
        if (storefrontProduct && storefrontProduct.product_id) {
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
        console.warn(`⚠️ Storefront API failed for product ${productId}:`, storefrontError.message);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to get product ${productId}:`, errorMessage);
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