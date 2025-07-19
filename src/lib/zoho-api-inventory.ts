// src/lib/zoho-api-inventory.ts - Zoho Inventory API client with token caching

interface ZohoInventoryItem {
  item_id: string;
  name: string;
  description?: string;
  rate?: number;
  min_rate?: number;
  max_rate?: number;
  purchase_rate?: number;
  status: 'active' | 'inactive';
  item_type: 'inventory' | 'sales' | 'purchases' | 'sales_and_purchases';
  product_type: 'goods' | 'service';
  sku?: string;
  stock_on_hand?: string | number;
  available_stock?: string | number;
  reorder_level?: number;
  category_id?: string;
  category_name?: string;
  group_id?: string;
  group_name?: string;
  tax_id?: string;
  tax_name?: string;
  tax_percentage?: number;
  image_id?: string;
  image_name?: string;
  image_type?: string;
  documents?: Array<{
    document_id: string;
    file_name: string;
    file_type: string;
    file_url?: string;
    download_url?: string;
    attachment_order: number;
  }>;
  custom_fields?: Array<{
    customfield_id: string;
    value: string | boolean | number;
    label?: string;
    field_name?: string;
    data_type?: string;
  }>;
  created_time?: string;
  last_modified_time?: string;
  vendor_id?: string;
  vendor_name?: string;
  locations?: Array<{
    location_id: string;
    location_name: string;
    status: string;
    location_stock_on_hand: string;
    location_available_stock: string;
  }>;
}

interface ZohoInventoryResponse<T> {
  code: number;
  message: string;
  items?: T[];
  item?: T;
}

// Global token cache to share across all instances
let globalTokenCache: {
  accessToken: string | null;
  expiryTime: number;
} = {
  accessToken: null,
  expiryTime: 0
};

class ZohoInventoryAPI {
  private baseURL: string;
  private organizationId: string;

  constructor() {
    this.baseURL = 'https://www.zohoapis.com/inventory/v1';
    
    this.organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID || '';
    if (!this.organizationId) {
      console.warn('ZOHO_INVENTORY_ORGANIZATION_ID not set - Inventory API calls will fail');
    }
  }

  /**
   * Get access token using refresh token with caching
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    const now = Date.now();
    if (globalTokenCache.accessToken && now < globalTokenCache.expiryTime) {
      console.log('✓ Using cached Zoho access token');
      return globalTokenCache.accessToken;
    }

    console.log('🔄 Refreshing Zoho access token...');

    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;

    if (!refreshToken || !clientId || !clientSecret) {
      throw new Error('Missing required Zoho OAuth environment variables');
    }

    try {
      const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
      }

      const tokenData = await response.json();
      
      if (!tokenData.access_token) {
        throw new Error(`No access token in response: ${JSON.stringify(tokenData)}`);
      }

      // Cache the token for 50 minutes (expires in 1 hour, so we refresh with buffer)
      globalTokenCache.accessToken = tokenData.access_token;
      globalTokenCache.expiryTime = now + (50 * 60 * 1000); // 50 minutes from now

      console.log('✓ New Zoho access token cached successfully');
      return tokenData.access_token;
    } catch (error) {
      console.error('Failed to get Zoho access token:', error);
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make authenticated request to Zoho Inventory API
   */
  async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.organizationId) {
      throw new Error('ZOHO_INVENTORY_ORGANIZATION_ID is required');
    }

    const token = await this.getAccessToken();
    
    // Add organization_id to URL
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${this.baseURL}${endpoint}${separator}organization_id=${this.organizationId}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      // Check if it's a rate limit error
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded. Please wait before making more requests.`);
      }
      throw new Error(`Inventory API error: ${response.status} - ${responseText}`);
    }

    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    if (jsonResponse.code && jsonResponse.code !== 0) {
      throw new Error(`Inventory API error: ${jsonResponse.message} (Code: ${jsonResponse.code})`);
    }

    return jsonResponse;
  }

  /**
   * Get all items/products from Inventory
   * This includes custom fields which are not available in Commerce API
   */
  async getInventoryProducts(): Promise<ZohoInventoryItem[]> {
    try {
      console.log('Fetching products from Zoho Inventory API...');
      
      const response = await this.apiRequest('/items');
      const items = response.items || [];
      
      console.log(`Retrieved ${items.length} items from Inventory API`);
      
      // Log custom fields info for debugging
      const itemsWithCustomFields = items.filter((item: ZohoInventoryItem) => 
        item.custom_fields && item.custom_fields.length > 0
      );
      console.log(`${itemsWithCustomFields.length} items have custom fields`);
      
      return items;
    } catch (error) {
      console.error('Failed to get inventory products:', error);
      throw error;
    }
  }

  /**
   * Get a specific item by ID
   */
  async getInventoryProduct(itemId: string): Promise<ZohoInventoryItem | null> {
    try {
      const response = await this.apiRequest(`/items/${itemId}`);
      return response.item || null;
    } catch (error) {
      console.error(`Failed to get inventory product ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Filter products by custom field value
   */
  async getProductsByCustomField(fieldName: string, fieldValue: any): Promise<ZohoInventoryItem[]> {
    try {
      // Get all products first (Zoho Inventory API doesn't support custom field filtering in query params)
      const allProducts = await this.getInventoryProducts();
      
      // Filter on the client side
      const filteredProducts = allProducts.filter(product => {
        if (!product.custom_fields || !Array.isArray(product.custom_fields)) {
          return false;
        }
        
        return product.custom_fields.some(field => {
          const fieldLabel = field.label?.toLowerCase();
          const fieldNameLower = field.field_name?.toLowerCase();
          const targetFieldLower = fieldName.toLowerCase();
          
          // Match by label or field name
          const fieldMatches = fieldLabel === targetFieldLower || 
                             fieldNameLower === targetFieldLower ||
                             fieldLabel === `cf_${targetFieldLower}` ||
                             fieldNameLower === `cf_${targetFieldLower}`;
          
          if (!fieldMatches) return false;
          
          // Compare values (handle different data types)
          if (typeof fieldValue === 'boolean') {
            return field.value === fieldValue || 
                   field.value === fieldValue.toString() ||
                   (fieldValue === true && (field.value === '1' || field.value === 1)) ||
                   (fieldValue === false && (field.value === '0' || field.value === 0));
          } else {
            return field.value === fieldValue || field.value === fieldValue.toString();
          }
        });
      });
      
      console.log(`Filtered ${filteredProducts.length} products with ${fieldName}=${fieldValue}`);
      return filteredProducts;
    } catch (error) {
      console.error(`Failed to filter products by ${fieldName}=${fieldValue}:`, error);
      throw error;
    }
  }

  /**
   * Get products that should be displayed in the app
   * Filters by cf_display_in_app = true
   */
  async getDisplayProducts(): Promise<ZohoInventoryItem[]> {
    return this.getProductsByCustomField('display_in_app', true);
  }

  /**
   * Get custom fields configuration
   * This endpoint might need to be discovered through Zoho API documentation
   */
  async getCustomFields(): Promise<any[]> {
    try {
      // This endpoint may vary - check Zoho Inventory API docs for the correct endpoint
      const response = await this.apiRequest('/settings/customfields');
      return response.custom_fields || [];
    } catch (error) {
      console.warn('Could not fetch custom fields configuration:', error);
      return [];
    }
  }

  /**
   * Update custom field value for an item
   */
  async updateItemCustomField(itemId: string, customFields: Array<{customfield_id: string; value: any}>): Promise<boolean> {
    try {
      await this.apiRequest(`/item/${itemId}/customfields`, {
        method: 'PUT',
        body: JSON.stringify(customFields),
      });
      return true;
    } catch (error) {
      console.error(`Failed to update custom fields for item ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Utility method to parse stock values consistently
   */
  parseStock(stockValue: string | number | null | undefined): number {
    if (stockValue === null || stockValue === undefined || stockValue === '') {
      return 0;
    }
    
    const parsed = typeof stockValue === 'string' ? parseFloat(stockValue) : Number(stockValue);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Get item image URL
   * Constructs the correct URL for item images
   */
  getItemImageUrl(itemId: string): string | null {
    if (!itemId) return null;
    return `${this.baseURL}/items/${itemId}/image?organization_id=${this.organizationId}`;
  }

  /**
   * Utility to find custom field value by name
   */
  getCustomFieldValue(item: ZohoInventoryItem, fieldName: string): any {
    if (!item.custom_fields || !Array.isArray(item.custom_fields)) {
      return null;
    }
    
    const field = item.custom_fields.find(f => {
      const fieldLabel = f.label?.toLowerCase();
      const fieldNameLower = f.field_name?.toLowerCase();
      const targetFieldLower = fieldName.toLowerCase();
      
      return fieldLabel === targetFieldLower || 
             fieldNameLower === targetFieldLower ||
             fieldLabel === `cf_${targetFieldLower}` ||
             fieldNameLower === `cf_${targetFieldLower}`;
    });
    
    return field?.value || null;
  }

  /**
   * Compatibility method - transforms inventory items to match expected product format
   */
  async getProducts(): Promise<any[]> {
    try {
      const inventoryItems = await this.getInventoryProducts();
      
      return inventoryItems.map(item => {
        // First include original inventory data
        const baseProduct = { ...item };
        
        // Then override with expected product format fields
        return {
          ...baseProduct,
          // Map to expected product format
          product_id: item.item_id,
          product_name: item.name,
          product_price: item.rate || item.min_rate || 0,
          product_description: item.description || '',
          product_images: this.extractImageUrls(item),
          inventory_count: this.parseStock(item.stock_on_hand),
          product_category: item.category_name || item.group_name || '',
          seo_url: item.sku || item.item_id,
          
          // Custom field convenience
          cf_display_in_app: this.getCustomFieldValue(item, 'display_in_app'),
        };
      });
    } catch (error) {
      console.error('Failed to get products (compatibility method):', error);
      throw error;
    }
  }

  /**
   * Extract image URLs from inventory item
   */
  private extractImageUrls(item: ZohoInventoryItem): string[] {
    const images: string[] = [];
    
    // Add primary image if available
    if (item.image_id) {
      const imageUrl = this.getItemImageUrl(item.item_id);
      if (imageUrl) images.push(imageUrl);
    }
    
    // Add document images
    if (item.documents && Array.isArray(item.documents)) {
      item.documents.forEach(doc => {
        if (doc.file_type && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(doc.file_type.toLowerCase())) {
          if (doc.file_url) images.push(doc.file_url);
          else if (doc.download_url) images.push(doc.download_url);
        }
      });
    }
    
    return images;
  }

  /**
   * Clear the cached token (useful for testing or error recovery)
   */
  static clearTokenCache(): void {
    globalTokenCache.accessToken = null;
    globalTokenCache.expiryTime = 0;
    console.log('✓ Zoho token cache cleared');
  }
}

// Create and export the instance
export const zohoInventoryAPI = new ZohoInventoryAPI();
export { ZohoInventoryAPI };
export type { ZohoInventoryItem };