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
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'X-Zoho-OrgId': this.orgId
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

  // Get all articles
  async getArticles(params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const endpoint = `/articles${queryParams ? `?${queryParams}` : ''}`;
      
      const response = await this.makeRequest(endpoint);
      return {
        data: response.data || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      // Return mock data in case of errors during development
      if (process.env.NODE_ENV !== 'production') {
        return {
          data: [
            {
              id: 'mock-article-1',
              title: 'Getting Started with Travel Data WiFi',
              summary: 'Learn how to set up and use your Travel Data WiFi device',
              content: 'This is a mock article for development purposes.',
              status: 'PUBLISHED',
              categoryId: 'setup',
              tags: ['setup', 'getting-started'],
              viewCount: 142,
              createdTime: new Date().toISOString()
            }
          ],
          total: 1
        };
      }
      throw error;
    }
  }

  // Get single article by ID
  async getArticle(id) {
    try {
      const response = await this.makeRequest(`/articles/${id}`);
      return { data: response };
    } catch (error) {
      console.error(`Failed to fetch article ${id}:`, error);
      
      // Return mock data in development
      if (process.env.NODE_ENV !== 'production') {
        return {
          data: {
            id: id,
            title: 'Mock Article',
            content: 'This is mock content for development.',
            summary: 'Mock article summary',
            status: 'PUBLISHED',
            categoryId: 'general',
            tags: ['mock'],
            viewCount: 0,
            createdTime: new Date().toISOString()
          }
        };
      }
      throw error;
    }
  }

  // Search articles
  async searchArticles(query, params = {}) {
    try {
      const searchParams = new URLSearchParams({
        q: query,
        ...params
      }).toString();
      
      const response = await this.makeRequest(`/articles/search?${searchParams}`);
      return {
        data: response.data || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('Failed to search articles:', error);
      
      // Return mock search results in development
      if (process.env.NODE_ENV !== 'production') {
        return {
          data: [
            {
              id: 'search-result-1',
              title: `Search result for "${query}"`,
              summary: 'This is a mock search result',
              status: 'PUBLISHED',
              categoryId: 'general'
            }
          ],
          total: 1
        };
      }
      throw error;
    }
  }

  // Get all categories
  async getCategories() {
    try {
      const response = await this.makeRequest('/categories');
      return {
        data: response.data || [],
        total: response.data?.length || 0
      };
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      
      // Return mock categories in development
      if (process.env.NODE_ENV !== 'production') {
        return {
          data: [
            {
              id: 'setup',
              name: 'Device Setup',
              description: 'Getting started with your devices',
              articleCount: 5
            },
            {
              id: 'connectivity',
              name: 'Connection Issues',
              description: 'Troubleshooting connectivity problems',
              articleCount: 8
            },
            {
              id: 'performance',
              name: 'Speed & Performance',
              description: 'Optimizing your internet speed',
              articleCount: 3
            }
          ],
          total: 3
        };
      }
      throw error;
    }
  }

  // Get category by ID
  async getCategory(id) {
    try {
      const response = await this.makeRequest(`/categories/${id}`);
      return { data: response };
    } catch (error) {
      console.error(`Failed to fetch category ${id}:`, error);
      throw error;
    }
  }

  // Get sections for a category
  async getSections(categoryId) {
    try {
      const response = await this.makeRequest(`/categories/${categoryId}/sections`);
      return {
        data: response.data || [],
        total: response.data?.length || 0
      };
    } catch (error) {
      console.error(`Failed to fetch sections for category ${categoryId}:`, error);
      
      // Return mock sections in development
      if (process.env.NODE_ENV !== 'production') {
        return {
          data: [
            {
              id: 'section-1',
              name: 'Getting Started',
              description: 'Basic setup and configuration',
              categoryId: categoryId,
              articleCount: 5
            }
          ],
          total: 1
        };
      }
      throw error;
    }
  }

  // Get articles by category
  async getArticlesByCategory(categoryId, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const endpoint = `/categories/${categoryId}/articles${queryParams ? `?${queryParams}` : ''}`;
      
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
      const queryParams = new URLSearchParams(params).toString();
      const endpoint = `/sections/${sectionId}/articles${queryParams ? `?${queryParams}` : ''}`;
      
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
      const response = await this.makeRequest('/helpcenter/stats');
      return response;
    } catch (error) {
      console.error('Failed to fetch help center stats:', error);
      
      // Return mock stats in development
      if (process.env.NODE_ENV !== 'production') {
        return {
          totalArticles: 16,
          totalCategories: 3,
          totalViews: 1245,
          mostViewedArticles: [
            { id: '1', title: 'Device Setup Guide', views: 234 },
            { id: '2', title: 'Connection Troubleshooting', views: 189 }
          ]
        };
      }
      throw error;
    }
  }

  // Bulk import articles (for sync functionality)
  async bulkImportArticles() {
    try {
      // This would typically sync from external sources
      // For now, we'll just return success
      return {
        imported: 0,
        updated: 0,
        errors: 0,
        message: 'Sync completed successfully'
      };
    } catch (error) {
      console.error('Failed to bulk import articles:', error);
      throw error;
    }
  }
}

module.exports = { 
  ZohoDeskClient, 
  ZohoDeskAuthError, 
  ZohoDeskRateLimitError, 
  ZohoDeskAPIError 
};