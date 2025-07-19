// ===== src/lib/product-image-manager.ts ===== (Completely unique file name)
// Product image management with multiple fallback strategies and caching

interface ImageFetchOptions {
  sizes?: string[];
  fallbackToPlaceholder?: boolean;
  maxRetries?: number;
}

interface ProductImageData {
  url: string;
  size?: string;
  source: 'storefront' | 'editpage' | 'cdn_construction' | 'inventory' | 'placeholder';
  isWorking?: boolean;
}

interface InventoryProductData {
  item_id: string;
  documents?: Array<{
    document_id: string;
    document_name?: string;
    file_name?: string;
    file_url?: string;
    download_url?: string;
  }>;
  image_id?: string;
}

interface TokenResponseData {
  access_token: string;
  expires_in?: number;
}

export class ProductImageManager {
  private cachedAccessToken: string | null = null;
  private tokenExpiryTime: number = 0;
  private imageDataCache = new Map<string, ProductImageData[]>();

  constructor(
    private zohoClientId: string,
    private zohoClientSecret: string,
    private zohoRefreshToken: string,
    private zohoStoreId: string,
    private zohoStoreDomain: string = 'traveldatawifi.zohostore.com'
  ) {}

  /**
   * Get product images with multiple fallback strategies
   */
  async fetchProductImages(
    productId: string, 
    options: ImageFetchOptions = {}
  ): Promise<ProductImageData[]> {
    const cacheKey = `${productId}_${JSON.stringify(options)}`;
    
    // Check cache first - this saves API calls and improves performance
    if (this.imageDataCache.has(cacheKey)) {
      const cachedResults = this.imageDataCache.get(cacheKey)!;
      console.log(`🎯 Cache hit for product ${productId} - returning ${cachedResults.length} cached images`);
      return cachedResults;
    }

    console.log(`🖼️ Fetching images for product ${productId}...`);

    const imageStrategies = [
      () => this.fetchFromStorefrontAPI(productId, options),
      () => this.fetchFromEditpageAPI(productId, options),
      () => this.fetchFromCDNConstruction(productId, options),
      () => this.fetchFromInventoryAPI(productId, options)
    ];

    let allImageResults: ProductImageData[] = [];

    for (const strategy of imageStrategies) {
      try {
        const images = await strategy();
        if (images.length > 0) {
          allImageResults = [...allImageResults, ...images];
          console.log(`✅ Found ${images.length} images using ${images[0]?.source} strategy`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Image strategy failed:`, errorMessage);
        continue;
      }
    }

    // Remove duplicates and sort by preference
    const uniqueImages = this.removeDuplicateImages(allImageResults);
    const sortedImages = this.sortImagesBySourcePreference(uniqueImages);

    // Validate URLs (optional, can be expensive)
    const validatedImages = await this.validateImageURLs(sortedImages);

    // Cache results to avoid future API calls
    this.imageDataCache.set(cacheKey, validatedImages);
    console.log(`💾 Cached ${validatedImages.length} images for product ${productId}`);

    return validatedImages;
  }

  /**
   * Strategy 1: Storefront API (most reliable for public images)
   */
  private async fetchFromStorefrontAPI(
    productId: string, 
    options: ImageFetchOptions
  ): Promise<ProductImageData[]> {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('No access token available');

    const url = `https://commerce.zoho.com/storefront/api/v1/products/${productId}?format=json`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'domain-name': this.zohoStoreDomain,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Storefront API failed: ${response.status}`);
    }

    const data = await response.json() as { payload?: { product?: any } };
    const product = data.payload?.product;
    
    if (!product) {
      throw new Error('No product data in storefront response');
    }

    const images: ProductImageData[] = [];

    // Extract from images array
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img: any) => {
        const imageUrl = this.makeFullURL(img.url || img.image_url);
        if (imageUrl) {
          images.push({
            url: this.removeSizeRestrictions(imageUrl),
            source: 'storefront'
          });
        }
      });
    }

    // Extract from documents array
    if (product.documents && Array.isArray(product.documents)) {
      product.documents.forEach((doc: any) => {
        if (this.isImageFile(doc)) {
          const imageUrl = this.makeFullURL(doc.image_url || doc.url);
          if (imageUrl) {
            images.push({
              url: this.removeSizeRestrictions(imageUrl),
              source: 'storefront'
            });
          }
        }
      });
    }

    // Extract from variants
    if (product.variants && Array.isArray(product.variants)) {
      product.variants.forEach((variant: any) => {
        if (variant.images && Array.isArray(variant.images)) {
          variant.images.forEach((img: any) => {
            const imageUrl = this.makeFullURL(img.url || img.image_url);
            if (imageUrl) {
              images.push({
                url: this.removeSizeRestrictions(imageUrl),
                source: 'storefront'
              });
            }
          });
        }
      });
    }

    return images;
  }

  /**
   * Strategy 2: Editpage API (administrative access)
   */
  private async fetchFromEditpageAPI(
    productId: string, 
    options: ImageFetchOptions
  ): Promise<ProductImageData[]> {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('No access token available');

    const url = `https://commerce.zoho.com/store/api/v1/products/editpage?product_id=${productId}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'X-com-zoho-store-organizationid': this.zohoStoreId,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Editpage API failed: ${response.status}`);
    }

    const data = await response.json() as { product?: any };
    const product = data.product;
    
    if (!product) {
      throw new Error('No product data in editpage response');
    }

    const images: ProductImageData[] = [];

    // Extract from documents
    if (product.documents && Array.isArray(product.documents)) {
      product.documents.forEach((doc: any) => {
        if (this.isImageFile(doc)) {
          // Try multiple URL patterns
          const urlOptions = [
            doc.image_url,
            doc.url,
            `https://commerce.zoho.com/product-images/${doc.document_id}`,
            `https://commerce.zoho.com/store/api/v1/documents/${doc.document_id}/image`
          ].filter((url): url is string => Boolean(url) && typeof url === 'string');

          urlOptions.forEach(url => {
            images.push({
              url: this.removeSizeRestrictions(url),
              source: 'editpage'
            });
          });
        }
      });
    }

    return images;
  }

  /**
   * Strategy 3: CDN URL Construction
   */
  private async fetchFromCDNConstruction(
    productId: string, 
    options: ImageFetchOptions
  ): Promise<ProductImageData[]> {
    // First get product data from Inventory API to get document info
    const inventoryProduct = await this.getInventoryProductData(productId);
    if (!inventoryProduct || !inventoryProduct.documents) {
      throw new Error('No inventory product data for CDN construction');
    }

    const images: ProductImageData[] = [];
    const cdnPatterns = [
      'https://us.zohocommercecdn.com/product-images/',
      'https://zohocommercecdn.com/product-images/',
      `https://${this.zohoStoreDomain}/product-images/`
    ];

    for (const doc of inventoryProduct.documents) {
      if (!this.isImageFile(doc)) continue;

      const filename = doc.file_name || doc.document_name;
      if (!filename) continue;

      for (const pattern of cdnPatterns) {
        const urlVariations = [
          `${pattern}${filename}`,
          `${pattern}${filename}/${productId}`,
          `${pattern}${doc.document_id}`,
          `${pattern}${filename}/${productId}/original`,
          `${pattern}${filename}?storefront_domain=${this.zohoStoreDomain}`
        ];

        urlVariations.forEach(url => {
          images.push({
            url,
            source: 'cdn_construction'
          });
        });
      }
    }

    return images;
  }

  /**
   * Strategy 4: Inventory API fallback
   */
  private async fetchFromInventoryAPI(
    productId: string, 
    options: ImageFetchOptions
  ): Promise<ProductImageData[]> {
    const product = await this.getInventoryProductData(productId);
    if (!product) {
      throw new Error('Product not found in Inventory API');
    }

    const images: ProductImageData[] = [];

    // Use image_id if available
    if (product.image_id) {
      const imageUrl = `https://inventory.zoho.com/api/v1/items/${productId}/image`;
      images.push({
        url: imageUrl,
        source: 'inventory'
      });
    }

    // Extract from documents
    if (product.documents && Array.isArray(product.documents)) {
      product.documents.forEach((doc) => {
        if (this.isImageFile(doc)) {
          const urls = [doc.file_url, doc.download_url].filter((url): url is string => Boolean(url));
          urls.forEach(url => {
            images.push({
              url,
              source: 'inventory'
            });
          });
        }
      });
    }

    return images;
  }

  /**
   * Get product from Inventory API
   */
  private async getInventoryProductData(productId: string): Promise<InventoryProductData | null> {
    const token = await this.getValidAccessToken();
    if (!token) return null;

    try {
      const response = await fetch(
        `https://inventory.zoho.com/api/v1/items/${productId}?organization_id=${this.zohoStoreId}`,
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) return null;
      
      const data = await response.json() as { item: InventoryProductData };
      return data.item;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to get inventory product:', errorMessage);
      return null;
    }
  }

  /**
   * Remove image size restrictions from URLs - KEY FEATURE FOR YOUR CROPPING ISSUE
   */
  private removeSizeRestrictions(url: string): string {
    if (!url) return url;

    // Remove size parameters like /400x400, /300x300, etc.
    const originalUrl = url;
    const cleanedUrl = url
      .replace(/\/\d+x\d+(?=\/|$|\?)/g, '') // Remove /400x400 patterns
      .replace(/[?&]w=\d+/g, '') // Remove width parameters
      .replace(/[?&]h=\d+/g, '') // Remove height parameters  
      .replace(/[?&]size=\d+x\d+/g, ''); // Remove size parameters

    if (originalUrl !== cleanedUrl) {
      console.log(`🎨 Removed size restrictions: ${originalUrl} → ${cleanedUrl}`);
    }

    return cleanedUrl;
  }

  /**
   * Ensure URL is fully qualified
   */
  private makeFullURL(url: string): string {
    if (!url) return url;
    
    if (url.startsWith('/')) {
      return `https://commerce.zoho.com${url}`;
    }
    
    return url;
  }

  /**
   * Check if document is an image
   */
  private isImageFile(doc: any): boolean {
    if (!doc) return false;
    
    const filename = doc.file_name || doc.document_name || '';
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    
    return imageExtensions.some(ext => 
      filename.toLowerCase().includes(ext)
    );
  }

  /**
   * Remove duplicate images
   */
  private removeDuplicateImages(images: ProductImageData[]): ProductImageData[] {
    const seen = new Set<string>();
    return images.filter(img => {
      const key = img.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Sort images by preference (storefront > editpage > cdn > inventory)
   */
  private sortImagesBySourcePreference(images: ProductImageData[]): ProductImageData[] {
    const sourceOrder = ['storefront', 'editpage', 'cdn_construction', 'inventory'];
    
    return images.sort((a, b) => {
      const aIndex = sourceOrder.indexOf(a.source);
      const bIndex = sourceOrder.indexOf(b.source);
      return aIndex - bIndex;
    });
  }

  /**
   * Validate image URLs (optional - can be expensive)
   */
  private async validateImageURLs(images: ProductImageData[]): Promise<ProductImageData[]> {
    const validatedImages: ProductImageData[] = [];

    // Only validate first few images to avoid too many requests
    const imagesToValidate = images.slice(0, 5);
    
    for (const image of imagesToValidate) {
      try {
        // Create AbortController for timeout functionality
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(image.url, { 
          method: 'HEAD',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        image.isWorking = response.ok;
        validatedImages.push(image);
        
        if (response.ok) {
          console.log(`✅ Image validated: ${image.url}`);
        } else {
          console.log(`❌ Image failed validation: ${image.url} (${response.status})`);
        }
      } catch (error) {
        image.isWorking = false;
        validatedImages.push(image);
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`❌ Image validation error: ${image.url} - ${errorMessage}`);
      }
    }

    // Add remaining images without validation
    validatedImages.push(...images.slice(5));

    return validatedImages;
  }

  /**
   * Get access token with caching - PREVENTS API RATE LIMITS
   */
  private async getValidAccessToken(): Promise<string | null> {
    // Return cached token if still valid
    if (this.cachedAccessToken && Date.now() < this.tokenExpiryTime) {
      console.log('🎯 Using cached access token');
      return this.cachedAccessToken;
    }

    console.log('🔄 Refreshing access token...');

    try {
      const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: this.zohoRefreshToken,
          client_id: this.zohoClientId,
          client_secret: this.zohoClientSecret,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        console.error('Failed to refresh token:', response.status, response.statusText);
        return null;
      }

      const data = (await response.json()) as TokenResponseData;
      this.cachedAccessToken = data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiryTime = Date.now() + ((data.expires_in || 3600) - 300) * 1000;
      
      console.log('✅ Access token refreshed successfully');
      return this.cachedAccessToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Token refresh error:', errorMessage);
      return null;
    }
  }

  /**
   * Clear cache (useful for testing or when data changes)
   */
  clearImageCache(): void {
    this.imageDataCache.clear();
    console.log('🗑️ Image cache cleared');
  }

  /**
   * Get cache statistics
   */
  getImageCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.imageDataCache.size,
      keys: Array.from(this.imageDataCache.keys())
    };
  }
}

// Create singleton instance with proper environment variable handling
const createProductImageManager = (): ProductImageManager | null => {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const storeId = process.env.ZOHO_STORE_ID;

  if (!clientId || !clientSecret || !refreshToken || !storeId) {
    console.error('Missing required Zoho environment variables for Product Image Manager');
    return null;
  }

  return new ProductImageManager(
    clientId,
    clientSecret,
    refreshToken,
    storeId,
    process.env.ZOHO_STORE_DOMAIN || 'traveldatawifi.zohostore.com'
  );
};

export const productImageManager = createProductImageManager();
export type { ProductImageData, ImageFetchOptions };