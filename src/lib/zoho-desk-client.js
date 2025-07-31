// src/lib/zoho-desk-client.js
const https = require('https');
const { URLSearchParams } = require('url');

// Custom error classes for better error handling
class ZohoDeskAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ZohoDeskAuthError';
  }
}

class ZohoDeskRateLimitError extends Error {
  constructor(message, retryAfter = 60) {
    super(message);
    this.name = 'ZohoDeskRateLimitError';
    this.retryAfter = retryAfter;
  }
}

class ZohoDeskAPIError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'ZohoDeskAPIError';
    this.statusCode = statusCode;
  }
}

class ZohoDeskClient {
  constructor() {
    // Environment variables validation
    this.baseURL = process.env.ZOHO_DESK_API_URL || 'https://desk.zoho.com/api/v1';
    this.orgId = process.env.ZOHO_ORG_ID;
    this.clientId = process.env.ZOHO_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    
    // Validate required environment variables
    if (!this.orgId || !this.clientId || !this.clientSecret || !this.refreshToken) {
      console.error('Missing required Zoho Desk environment variables');
      console.error('Required: ZOHO_ORG_ID, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN');
    }
    
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Get authentication headers
  async getHeaders() {
    if (!this.accessToken || this.isTokenExpired()) {
      await this.refreshAccessToken();
    }
    
    return {
      'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
      'Content-Type': 'application/json',
      'orgId': this.orgId
    };
  }

  // Check if access token is expired
  isTokenExpired() {
    if (!this.tokenExpiry) return true;
    return Date.now() >= this.tokenExpiry - 300000; // Refresh 5 minutes before expiry
  }

  // Refresh the access token using refresh token
  async refreshAccessToken() {
    try {
      const params = new URLSearchParams({
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token'
      });

      const data = await this.makeHttpRequest('POST', 'https://accounts.zoho.com/oauth/v2/token', params.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded'
      });

      if (data.access_token) {
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in * 1000);
        console.log('Access token refreshed successfully');
      } else {
        throw new ZohoDeskAuthError('Failed to refresh access token');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw new ZohoDeskAuthError(`Token refresh failed: ${error.message}`);
    }
  }

  // Make HTTP request using Node.js https module
  makeHttpRequest(method, url, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: headers
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsedData);
            } else if (res.statusCode === 401) {
              reject(new ZohoDeskAuthError('Authentication failed'));
            } else if (res.statusCode === 429) {
              const retryAfter = res.headers['retry-after'] || 60;
              reject(new ZohoDeskRateLimitError('Rate limit exceeded', retryAfter));
            } else {
              reject(new ZohoDeskAPIError(`API error: ${parsedData.message || 'Unknown error'}`, res.statusCode));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse response: ${parseError.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      if (data && method !== 'GET') {
        req.write(data);
      }

      req.end();
    });
  }

  // Make authenticated API request to Zoho Desk
  async makeRequest(endpoint, method = 'GET', data = null) {
    try {
      const headers = await this.getHeaders();
      const url = `${this.baseURL}${endpoint}`;
      
      let requestData = null;
      if (data && method !== 'GET') {
        requestData = JSON.stringify(data);
      }

      console.log(`🌐 ${method} ${url}`);
      
      return await this.makeHttpRequest(method, url, requestData, headers);
    } catch (error) {
      console.error(`API request failed: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  // Get all knowledge base articles
  async getArticles(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // Add valid parameters only
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.from) queryParams.append('from', params.from);
      
      const endpoint = `/kbArticles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await this.makeRequest(endpoint);
      return {
        data: response.data || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      throw error;
    }
  }

  // Get single article by ID
  async getArticle(id) {
    try {
      const response = await this.makeRequest(`/kbArticles/${id}`);
      return { data: response };
    } catch (error) {
      console.error(`Failed to fetch article ${id}:`, error);
      throw error;
    }
  }

  // Search articles
  async searchArticles(query, params = {}) {
    try {
      const searchParams = new URLSearchParams({
        searchStr: query
      });
      
      if (params.limit) searchParams.append('limit', params.limit);
      if (params.sortBy) searchParams.append('sortBy', params.sortBy);
      
      const response = await this.makeRequest(`/kbArticles/search?${searchParams.toString()}`);
      return {
        data: response.data || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('Failed to search articles:', error);
      throw error;
    }
  }

  // Get all categories
  async getCategories() {
    try {
      const response = await this.makeRequest('/kbCategories');
      return {
        data: response.data || [],
        total: response.data?.length || 0
      };
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      throw error;
    }
  }

  // Get category by ID
  async getCategory(id) {
    try {
      const response = await this.makeRequest(`/kbCategories/${id}`);
      return { data: response };
    } catch (error) {
      console.error(`Failed to fetch category ${id}:`, error);
      throw error;
    }
  }

  // Get sections for a category
  async getSections(categoryId) {
    try {
      const response = await this.makeRequest(`/kbCategories/${categoryId}/kbSections`);
      return {
        data: response.data || [],
        total: response.data?.length || 0
      };
    } catch (error) {
      console.error(`Failed to fetch sections for category ${categoryId}:`, error);
      throw error;
    }
  }

  // Get articles by category
  async getArticlesByCategory(categoryId, params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      
      const endpoint = `/kbCategories/${categoryId}/kbArticles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await this.makeRequest(endpoint);
      return {
        data: response.data || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error(`Failed to fetch articles for category ${categoryId}:`, error);
      throw error;
    }
  }

  // Get articles by section
  async getArticlesBySection(sectionId, params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      
      const endpoint = `/kbSections/${sectionId}/kbArticles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await this.makeRequest(endpoint);
      return {
        data: response.data || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error(`Failed to fetch articles for section ${sectionId}:`, error);
      throw error;
    }
  }

  // Get help center statistics
  async getHelpCenterStats() {
    try {
      const [articles, categories] = await Promise.all([
        this.getArticles({ limit: 1 }),
        this.getCategories()
      ]);

      return {
        totalArticles: articles.total || 0,
        totalCategories: categories.data?.length || 0,
        lastUpdated: new Date().toISOString(),
        recentActivity: {
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Failed to get help center stats:', error);
      return {
        totalArticles: 0,
        totalCategories: 0,
        lastUpdated: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // Bulk import articles (for sync functionality)
  async bulkImportArticles() {
    try {
      const categories = await this.getCategories();
      const allArticles = [];

      for (const category of categories.data || []) {
        try {
          const categoryArticles = await this.getArticlesByCategory(category.id);
          allArticles.push(...(categoryArticles.data || []));
        } catch (error) {
          console.error(`Failed to get articles for category ${category.id}:`, error);
        }
      }

      return {
        success: true,
        articlesImported: allArticles.length,
        categories: categories.data?.length || 0,
        message: 'Sync completed successfully'
      };
    } catch (error) {
      console.error('Bulk import failed:', error);
      return {
        success: false,
        error: error.message,
        articlesImported: 0
      };
    }
  }
}

module.exports = { 
  ZohoDeskClient, 
  ZohoDeskAuthError, 
  ZohoDeskRateLimitError, 
  ZohoDeskAPIError 
};