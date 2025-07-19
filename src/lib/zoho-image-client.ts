// ===== src/lib/zoho-image-client.ts =====
// Enhanced image client with multiple fallback strategies

interface ZohoImageOptions {
  sizes?: string[];
  fallbackToPlaceholder?: boolean;
  maxRetries?: number;
}

interface ImageResult {
  url: string;
  size?: string;
  source: 'storefront' | 'editpage' | 'cdn_construction' | 'inventory' | 'placeholder';
  isWorking?: boolean;
}

export class ZohoImageClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private imageCache = new Map<string, ImageResult[]>();

  constructor(
    private clientId: string,
    private clientSecret: string,
    private refreshToken: string,
    private storeId: string,
    private storeDomain: string = 'traveldatawifi.zohostore.com'
  ) {}

  /**
   * Get product images with multiple fallback strategies
   */
  async getProductImages(
    productId: string, 
    options: ZohoImageOptions = {}
  ): Promise<ImageResult[]> {
    const cacheKey = `${productId}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey)!;
    }

    console.log(`🖼️ Getting images for product ${productId}...`);

    const strategies = [
      () => this.getImagesFromStorefront(productId, options),
      () => this.getImagesFromEditpage(productId, options),
      () => this.getImagesFromCDNConstruction(productId, options),
      () => this.getImagesFromInventoryAPI(productId, options)
    ];

    let allImages: ImageResult[] = [];

    for (const strategy of strategies) {
      try {
        const images = await strategy();
        if (images.length > 0) {
          allImages = [...allImages, ...images];
          console.log(`✅ Found ${images.length} images using ${images[0]?.source} strategy`);
        }
      } catch (error) {
        console.warn(`⚠️ Image strategy failed:`, error.message);
        continue;
      }
    }

    // Remove duplicates and sort by preference
    const uniqueImages = this.deduplicateImages(allImages);
    const sortedImages = this.sortImagesByPreference(uniqueImages);

    // Validate URLs (optional, can be expensive)
    const validatedImages = await this.validateImageUrls(sortedImages);

    // Cache results
    this.imageCache.set(cacheKey, validatedImages);

    return validatedImages;
  }

  /**
   * Strategy 1: Storefront API (most reliable for public images)
   */
  private async getImagesFromStorefront(
    productId: string, 
    options: ZohoImageOptions
  ): Promise<ImageResult[]> {
    const token = await this.getAccessToken();
    if (!token) throw new Error('No access token available');

    const url = `https://commerce.zoho.com/storefront/api/v1/products/${productId}?format=json`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'domain-name': this.storeDomain,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Storefront API failed: ${response.status}`);
    }

    const data = await response.json();
    const product = data.payload?.product;
    
    if (!product) {
      throw new Error('No product data in storefront response');
    }

    const images: ImageResult[] = [];

    // Extract from images array
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img: any) => {
        const url = this.ensureFullUrl(img.url || img.image_url);
        if (url) {
          images.push({
            url: this.removeImageSizeRestrictions(url),
            source: 'storefront'
          });
        }
      });
    }

    // Extract from documents array
    if (product.documents && Array.isArray(product.documents)) {
      product.documents.forEach((doc: any) => {
        if (this.isImageDocument(doc)) {
          const url = this.ensureFullUrl(doc.image_url || doc.url);
          if (url) {
            images.push({
              url: this.removeImageSizeRestrictions(url),
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
            const url = this.ensureFullUrl(img.url || img.image_url);
            if (url) {
              images.push({
                url: this.removeImageSizeRestrictions(url),
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
  private async getImagesFromEditpage(
    productId: string, 
    options: ZohoImageOptions
  ): Promise<ImageResult[]> {
    const token = await this.getAccessToken();
    if (!token) throw new Error('No access token available');

    const url = `https://commerce.zoho.com/store/api/v1/products/editpage?product_id=${productId}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'X-com-zoho-store-organizationid': this.storeId,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Editpage API failed: ${response.status}`);
    }

    const data = await response.json();
    const product = data.product;
    
    if (!product) {
      throw new Error('No product data in editpage response');
    }

    const images: ImageResult[] = [];

    // Extract from documents
    if (product.documents && Array.isArray(product.documents)) {
      product.documents.forEach((doc: any) => {
        if (this.isImageDocument(doc)) {
          // Try multiple URL patterns
          const urlOptions = [
            doc.image_url,
            doc.url,
            `https://commerce.zoho.com/product-images/${doc.document_id}`,
            `https://commerce.zoho.com/store/api/v1/documents/${doc.document_id}/image`
          ].filter(Boolean);

          urlOptions.forEach(url => {
            if (url) {
              images.push({
                url: this.removeImageSizeRestrictions(url),
                source: 'editpage'
              });
            }
          });
        }
      });
    }

    return images;
  }

  /**
   * Strategy 3: CDN URL Construction
   */
  private async getImagesFromCDNConstruction(
    productId: string, 
    options: ZohoImageOptions
  ): Promise<ImageResult[]> {
    // First get product data from Inventory API to get document info
    const inventoryProduct = await this.getInventoryProduct(productId);
    if (!inventoryProduct || !inventoryProduct.documents) {
      throw new Error('No inventory product data for CDN construction');
    }

    const images: ImageResult[] = [];
    const cdnPatterns = [
      'https://us.zohocommercecdn.com/product-images/',
      'https://zohocommercecdn.com/product-images/',
      `https://${this.storeDomain}/product-images/`
    ];

    for (const doc of inventoryProduct.documents) {
      if (!this.isImageDocument(doc)) continue;

      const filename = doc.file_name || doc.document_name;
      if (!filename) continue;

      for (const pattern of cdnPatterns) {
        const urlVariations = [
          `${pattern}${filename}`,
          `${pattern}${filename}/${productId}`,
          `${pattern}${doc.document_id}`,
          `${pattern}${filename}/${productId}/original`,
          `${pattern}${filename}?storefront_domain=${this.storeDomain}`
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
  private async getImagesFromInventoryAPI(
    productId: string, 
    options: ZohoImageOptions
  ): Promise<ImageResult[]> {
    const product = await this.getInventoryProduct(productId);
    if (!product) {
      throw new Error('Product not found in Inventory API');
    }

    const images: ImageResult[] = [];

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
      product.documents.forEach((doc: any) => {
        if (this.isImageDocument(doc)) {
          const urls = [doc.file_url, doc.download_url].filter(Boolean);
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
  private async getInventoryProduct(productId: string): Promise<any> {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const response = await fetch(
        `https://inventory.zoho.com/api/v1/items/${productId}?organization_id=${this.storeId}`,
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) return null;
      
      const data = await response.json();
      return data.item;
    } catch (error) {
      return null;
    }
  }

  /**
   * Remove image size restrictions from URLs
   */
  private removeImageSizeRestrictions(url: string): string {
    if (!url) return url;

    // Remove size parameters like /400x400, /300x300, etc.
    return url.replace(/\/\d+x\d+(?=\/|$|\?)/g, '')
              .replace(/[?&]w=\d+/g, '')
              .replace(/[?&]h=\d+/g, '')
              .replace(/[?&]size=\d+x\d+/g, '');
  }

  /**
   * Ensure URL is fully qualified
   */
  private ensureFullUrl(url: string): string {
    if (!url) return url;
    
    if (url.startsWith('/')) {
      return `https://commerce.zoho.com${url}`;
    }
    
    return url;
  }

  /**
   * Check if document is an image
   */
  private isImageDocument(doc: any): boolean {
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
  private deduplicateImages(images: ImageResult[]): ImageResult[] {
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
  private sortImagesByPreference(images: ImageResult[]): ImageResult[] {
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
  private async validateImageUrls(images: ImageResult[]): Promise<ImageResult[]> {
    const validatedImages: ImageResult[] = [];

    // Only validate first few images to avoid too many requests
    const imagesToValidate = images.slice(0, 5);
    
    for (const image of imagesToValidate) {
      try {
        const response = await fetch(image.url, { 
          method: 'HEAD',
          timeout: 5000 // 5 second timeout
        });
        
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
        console.log(`❌ Image validation error: ${image.url} - ${error.message}`);
      }
    }

    // Add remaining images without validation
    validatedImages.push(...images.slice(5));

    return validatedImages;
  }

  /**
   * Get access token with caching
   */
  private async getAccessToken(): Promise<string | null> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        console.error('Failed to refresh token:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + ((data.expires_in || 3600) - 300) * 1000;
      
      return this.accessToken;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }

  /**
   * Clear cache (useful for testing or when data changes)
   */
  clearCache(): void {
    this.imageCache.clear();
    console.log('🗑️ Image cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.imageCache.size,
      keys: Array.from(this.imageCache.keys())
    };
  }
}

// Create singleton instance
export const zohoImageClient = new ZohoImageClient(
  process.env.ZOHO_CLIENT_ID!,
  process.env.ZOHO_CLIENT_SECRET!,
  process.env.ZOHO_REFRESH_TOKEN!,
  process.env.ZOHO_STORE_ID!,
  process.env.ZOHO_STORE_DOMAIN || 'traveldatawifi.com'
);