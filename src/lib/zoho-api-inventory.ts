// src/lib/zoho-api-inventory.ts - Updated to use centralized token manager
// REMOVED: globalTokenCache - now uses tokenManager.getAccessToken('inventory')

import { tokenManager } from './enhanced-token-manager';

interface ZohoInventoryItem {
  item_id: string;
  name: string;
  sku?: string;
  description?: string;
  rate: string | number;
  status: string;
  stock_on_hand?: string | number;
  available_stock?: string | number;
  reserved_stock?: string | number;
  cf_display_in_app?: string | boolean;
  cf_display_in_app_unformatted?: boolean;
  images?: Array<{
    image_id: string;
    image_name: string;
    image_document_id: string;
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
   * Get access token using centralized token manager
   * REMOVED: Local globalTokenCache implementation
   */
  async getAccessToken(): Promise<string> {
    try {
      // Use centralized token manager instead of local cache
      return await tokenManager.getAccessToken('inventory');
    } catch (error) {
      console.error('Failed to get access token from token manager:', error);
      throw new Error(`Token manager error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make authenticated request to Zoho Inventory API
   */
  async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.organizationId) {
      throw new Error('ZOHO_INVENTORY_ORGANIZATION_ID is required');
    }

    try {
      const token = await this.getAccessToken();
      
      // Add organization_id to URL
      const separator = endpoint.includes('?') ? '&' : '?';
      const url = `${this.baseURL}${endpoint}${separator}organization_id=${this.organizationId}`;

      console.log(`📡 Making Inventory API request: ${endpoint}`);

      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        // Add timeout to prevent hanging requests
        signal: options.signal || AbortSignal.timeout(30000) // 30 second timeout
      });

      const responseText = await response.text();

      if (!response.ok) {
        // Check if it's a rate limit error
        if (response.status === 429) {
          throw new Error(`Rate limit exceeded. Please wait before making more requests.`);
        }
        
        // Check for authentication errors
        if (response.status === 401) {
          console.warn('Authentication failed - token may be expired');
          // Clear token cache and retry once
          tokenManager.clearCache('inventory');
          throw new Error(`Authentication failed: ${response.status} - ${responseText}`);
        }
        
        throw new Error(`Inventory API error: ${response.status} - ${responseText}`);
      }

      let jsonResponse;
      try {
        jsonResponse = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}...`);
      }

      if (jsonResponse.code && jsonResponse.code !== 0) {
        throw new Error(`Inventory API error: ${jsonResponse.message} (Code: ${jsonResponse.code})`);
      }

      console.log(`✅ Inventory API request successful: ${endpoint}`);
      return jsonResponse;

    } catch (error) {
      console.error(`❌ Inventory API request failed: ${endpoint}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: this.organizationId ? 'set' : 'missing'
      });
      throw error;
    }
  }

  /**
   * Get all items/products from Inventory
   * This includes custom fields which are not available in Commerce API
   */
  async getInventoryProducts(): Promise<ZohoInventoryItem[]> {
    try {
      console.log('📦 Fetching products from Zoho Inventory API...');
      
      // Request documents and custom field data for each item
      const response = await this.apiRequest(
        '/items?custom_fields=true&include=documents'
      );
      const items = response.items || [];
      
      console.log(`📊 Retrieved ${items.length} items from Inventory API`);
      
      // Log custom fields info for debugging
      const itemsWithCustomFields = items.filter((item: ZohoInventoryItem) => 
        item.custom_fields && item.custom_fields.length > 0
      );
      console.log(`🏷️  ${itemsWithCustomFields.length} items have custom fields`);
      
      return items;
    } catch (error) {
      console.error('❌ Failed to get inventory products:', error);
      
      // Provide helpful error context
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          throw new Error('Inventory API rate limited. Please wait before retrying.');
        }
        if (error.message.includes('organization_id')) {
          throw new Error('Invalid organization ID. Check ZOHO_INVENTORY_ORGANIZATION_ID environment variable.');
        }
        if (error.message.includes('Authentication failed')) {
          throw new Error('Zoho authentication failed. Check OAuth credentials.');
        }
      }
      
      throw error;
    }
  }

  /**
   * Get a specific item by ID
   */
  async getInventoryProduct(itemId: string): Promise<ZohoInventoryItem | null> {
    try {
      console.log(`🔍 Fetching inventory item: ${itemId}`);
      const response = await this.apiRequest(`/items/${itemId}`);
      const item = response.item || null;
      
      if (item) {
        console.log(`✅ Found inventory item: ${item.name} (${item.sku})`);
      } else {
        console.log(`❌ Inventory item not found: ${itemId}`);
      }
      
      return item;
    } catch (error) {
      console.error(`❌ Failed to get inventory product ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Search items by SKU (useful for mapping)
   */
  async searchItemsBySku(sku: string): Promise<ZohoInventoryItem[]> {
    try {
      console.log(`🔍 Searching inventory items by SKU: ${sku}`);
      
      // Use search endpoint with SKU filter
      const response = await this.apiRequest(`/items?sku=${encodeURIComponent(sku)}`);
      const items = response.items || [];
      
      console.log(`📊 Found ${items.length} items with SKU: ${sku}`);
      return items;
    } catch (error) {
      console.error(`❌ Failed to search items by SKU ${sku}:`, error);
      throw error;
    }
  }

  /**
   * Get inventory stock levels for multiple items
   */
  async getStockLevels(itemIds: string[]): Promise<Record<string, any>> {
    const stockLevels: Record<string, any> = {};
    
    try {
      // Batch request for stock levels
      const promises = itemIds.map(async (itemId) => {
        try {
          const item = await this.getInventoryProduct(itemId);
          if (item) {
            stockLevels[itemId] = {
              stock_on_hand: item.stock_on_hand || 0,
              available_stock: item.available_stock || 0,
              reserved_stock: item.reserved_stock || 0
            };
          }
        } catch (error) {
          console.warn(`Failed to get stock for item ${itemId}:`, error);
          stockLevels[itemId] = { error: 'Failed to fetch' };
        }
      });

      await Promise.allSettled(promises);
      
      console.log(`📊 Retrieved stock levels for ${Object.keys(stockLevels).length} items`);
      return stockLevels;
    } catch (error) {
      console.error('❌ Failed to get stock levels:', error);
      throw error;
    }
  }

  /**
   * Health check for the Inventory API
   */
  async healthCheck(): Promise<{ status: string; message: string; timestamp: string }> {
    try {
      // Simple API call to check connectivity
      await this.apiRequest('/items?per_page=1');
      
      return {
        status: 'healthy',
        message: 'Inventory API is accessible',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get API usage statistics from token manager
   */
  getUsageStats() {
    const tokenStats = tokenManager.getStatus();
    
    return {
      service: 'inventory',
      token_manager_stats: tokenStats,
      organization_id: this.organizationId ? 'configured' : 'missing',
      base_url: this.baseURL
    };
  }
}

// Export singleton instance
export const zohoInventoryAPI = new ZohoInventoryAPI();

// Export types for other modules
export type { ZohoInventoryItem, ZohoInventoryResponse };