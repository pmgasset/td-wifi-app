// src/lib/zoho-desk-client.js
// Updated Zoho Desk API client for Help Center integration

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
    // Environment variables validation - Updated to use ZOHO_DESK_ORG_ID
    this.baseURL = process.env.ZOHO_DESK_API_URL || 'https://desk.zoho.com/api/v1';
    this.orgId = process.env.ZOHO_DESK_ORG_ID; // Changed from ZOHO_ORG_ID
    this.clientId = process.env.ZOHO_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    
    // Token management
    this.accessToken = null;
    this.tokenExpiry = null;
    this.lastTokenRefresh = null;
    this.minRefreshInterval = 5 * 60 * 1000; // 5 minutes minimum between refreshes
    
    // Validate required environment variables
    if (!this.orgId || !this.clientId || !this.clientSecret || !this.refreshToken) {
      console.error('Missing required Zoho Desk environment variables');
      console.error('Required: ZOHO_DESK_ORG_ID, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN');
    }
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
    // Prevent rapid consecutive refreshes
    const now = Date.now();
    if (this.lastTokenRefresh && (now - this.lastTokenRefresh) < this.minRefreshInterval) {
      console.log('Skipping token refresh - too soon since last refresh');
      if (this.accessToken) return this.accessToken;
    }

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
        this.lastTokenRefresh = now;
        console.log('Access token refreshed successfully');
      } else {
        throw new ZohoDeskAuthError('Failed to refresh access token');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      
      // If rate limited, wait longer before next attempt
      if (error.message.includes('too many requests')) {
        this.lastTokenRefresh = now + (30 * 60 * 1000); // Block for 30 minutes
      }
      
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
            } else if (res.statusCode === 403) {
              reject(new ZohoDeskAuthError('Permission denied - check OAuth scopes'));
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

  // Get all help center articles (Help Center API)
  async getArticles(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // Add valid parameters for Help Center API
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.from) queryParams.append('from', params.from);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      
      // Use /articles endpoint (Help Center API)
      const endpoint = `/articles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
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

  // Get single article by ID (Help Center API)
  async getArticle(id) {
    try {
      // Use /articles endpoint instead of /kbArticles
      const response = await this.makeRequest(`/articles/${id}`);
      return { data: response };
    } catch (error) {
      console.error(`Failed to fetch article ${id}:`, error);
      throw error;
    }
  }

  // Search articles (Help Center API)
  async searchArticles(query, params = {}) {
    try {
      const searchParams = new URLSearchParams({
        searchStr: query
      });
      
      if (params.limit) searchParams.append('limit', params.limit);
      if (params.sortBy) searchParams.append('sortBy', params.sortBy);
      
      // Use /articles/search endpoint
      const response = await this.makeRequest(`/articles/search?${searchParams.toString()}`);
      return {
        data: response.data || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('Failed to search articles:', error);
      throw error;
    }
  }

  // Get departments (Help Center may organize by departments instead of categories)
  async getDepartments() {
    try {
      const response = await this.makeRequest('/departments');
      return {
        data: response.data || [],
        total: response.data?.length || 0
      };
    } catch (error) {
      console.error('Failed to fetch departments:', error);
      // Return empty if departments aren't available
      return {
        data: [],
        total: 0,
        error: error.message
      };
    }
  }

  // Fallback method for categories - try multiple endpoints
  async getCategories() {
    const possibleEndpoints = [
      '/departments',     // Help Center might use departments
      '/categories',      // Generic categories
      '/sections'         // Or sections
    ];

    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`Trying categories endpoint: ${endpoint}`);
        const response = await this.makeRequest(endpoint);
        
        // Transform response to consistent format
        const data = response.data || [];
        const categories = data.map(item => ({
          id: item.id,
          name: item.name || item.departmentName,
          description: item.description || '',
          articleCount: item.articleCount || 0,
          createdTime: item.createdTime,
          modifiedTime: item.modifiedTime
        }));

        console.log(`✅ Found ${categories.length} categories using ${endpoint}`);
        return {
          data: categories,
          total: categories.length
        };
      } catch (error) {
        console.log(`❌ Failed with ${endpoint}: ${error.message}`);
        continue;
      }
    }

    // If no category endpoint works, return empty
    console.log('No category endpoints available - returning empty');
    return {
      data: [],
      total: 0,
      error: 'No category endpoints available'
    };
  }

  // Get category by ID (try multiple endpoints)
  async getCategory(id) {
    const possibleEndpoints = [
      `/departments/${id}`,
      `/categories/${id}`,
      `/sections/${id}`
    ];

    for (const endpoint of possibleEndpoints) {
      try {
        const response = await this.makeRequest(endpoint);
        return { data: response };
      } catch (error) {
        continue;
      }
    }

    throw new Error(`Category ${id} not found in any endpoint`);
  }

  // Get sections (might be available in Help Center)
  async getSections(categoryId) {
    try {
      const response = await this.makeRequest(`/departments/${categoryId}/sections`);
      return {
        data: response.data || [],
        total: response.data?.length || 0
      };
    } catch (error) {
      console.error(`Failed to fetch sections for category ${categoryId}:`, error);
      return {
        data: [],
        total: 0,
        error: error.message
      };
    }
  }

  // Get articles by department (Help Center approach)
  async getArticlesByCategory(categoryId, params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      
      // Try department-based articles first
      const endpoint = `/departments/${categoryId}/articles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await this.makeRequest(endpoint);
      return {
        data: response.data || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error(`Failed to fetch articles for category ${categoryId}:`, error);
      
      // Fallback: get all articles and filter by category
      try {
        const allArticles = await this.getArticles(params);
        const filteredArticles = allArticles.data.filter(article => 
          article.departmentId === categoryId || 
          article.categoryId === categoryId
        );
        
        return {
          data: filteredArticles,
          total: filteredArticles.length
        };
      } catch (fallbackError) {
        throw error; // Throw original error
      }
    }
  }

  // Get articles by section
  async getArticlesBySection(sectionId, params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      
      const endpoint = `/sections/${sectionId}/articles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await this.makeRequest(endpoint);
      return {
        data: response.data || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error(`Failed to fetch articles for section ${sectionId}:`, error);
      return {
        data: [],
        total: 0,
        error: error.message
      };
    }
  }

  // Get help center statistics
  async getHelpCenterStats() {
    try {
      // Get basic stats by counting articles and departments
      const [articles, departments] = await Promise.allSettled([
        this.getArticles({ limit: 1 }),
        this.getDepartments()
      ]);

      const articlesResult = articles.status === 'fulfilled' ? articles.value : { total: 0, data: [] };
      const departmentsResult = departments.status === 'fulfilled' ? departments.value : { data: [] };

      return {
        totalArticles: articlesResult.total || 0,
        totalCategories: departmentsResult.data?.length || 0,
        totalDepartments: departmentsResult.data?.length || 0,
        lastUpdated: new Date().toISOString(),
        recentActivity: {
          lastUpdated: new Date().toISOString()
        },
        source: 'help_center'
      };
    } catch (error) {
      console.error('Failed to get help center stats:', error);
      return {
        totalArticles: 0,
        totalCategories: 0,
        totalDepartments: 0,
        lastUpdated: new Date().toISOString(),
        error: error.message,
        source: 'help_center'
      };
    }
  }

  // Bulk import articles (for sync functionality)
  async bulkImportArticles() {
    try {
      console.log('Starting bulk import from Help Center...');
      
      // Get all departments/categories
      const departments = await this.getDepartments();
      const allArticles = [];

      // Get articles from each department
      for (const department of departments.data || []) {
        try {
          const departmentArticles = await this.getArticlesByCategory(department.id);
          allArticles.push(...(departmentArticles.data || []));
          console.log(`Imported ${departmentArticles.data?.length || 0} articles from ${department.name}`);
        } catch (error) {
          console.error(`Failed to get articles for department ${department.id}:`, error);
        }
      }

      // Also get general articles that might not be in departments
      try {
        const generalArticles = await this.getArticles({ limit: 100 });
        
        // Add articles that aren't already included
        const existingIds = new Set(allArticles.map(a => a.id));
        const newArticles = generalArticles.data.filter(a => !existingIds.has(a.id));
        allArticles.push(...newArticles);
        
        console.log(`Added ${newArticles.length} additional articles`);
      } catch (error) {
        console.error('Failed to get general articles:', error);
      }

      return {
        success: true,
        articlesImported: allArticles.length,
        categories: departments.data?.length || 0,
        departments: departments.data?.length || 0,
        message: 'Help Center sync completed successfully',
        source: 'help_center'
      };
    } catch (error) {
      console.error('Bulk import failed:', error);
      return {
        success: false,
        error: error.message,
        articlesImported: 0,
        source: 'help_center'
      };
    }
  }

  // Test Help Center connectivity
  async testConnection() {
    try {
      const testResults = {
        authentication: false,
        articles: false,
        departments: false,
        search: false
      };

      // Test authentication
      try {
        await this.refreshAccessToken();
        testResults.authentication = true;
      } catch (error) {
        console.error('Authentication test failed:', error);
      }

      // Test articles endpoint
      try {
        await this.getArticles({ limit: 1 });
        testResults.articles = true;
      } catch (error) {
        console.error('Articles test failed:', error);
      }

      // Test departments endpoint
      try {
        await this.getDepartments();
        testResults.departments = true;
      } catch (error) {
        console.error('Departments test failed:', error);
      }

      // Test search
      try {
        await this.searchArticles('test', { limit: 1 });
        testResults.search = true;
      } catch (error) {
        console.error('Search test failed:', error);
      }

      return testResults;
    } catch (error) {
      console.error('Connection test failed:', error);
      return {
        authentication: false,
        articles: false,
        departments: false,
        search: false,
        error: error.message
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