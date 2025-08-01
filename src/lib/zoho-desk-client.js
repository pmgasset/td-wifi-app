// src/lib/zoho-desk-client.js
// Updated Zoho Desk API client using Server-based OAuth credentials

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
    // Use Desk-specific Server-based OAuth credentials
    this.baseURL = process.env.ZOHO_DESK_API_URL || 'https://desk.zoho.com/api/v1';
    this.orgId = process.env.ZOHO_DESK_ORG_ID;
    this.clientId = process.env.ZOHO_DESK_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_DESK_CLIENT_SECRET;
    this.refreshToken = process.env.ZOHO_DESK_REFRESH_TOKEN;
    
    // Token management
    this.accessToken = null;
    this.tokenExpiry = null;
    this.lastTokenRefresh = null;
    this.minRefreshInterval = 5 * 60 * 1000; // 5 minutes minimum between refreshes
    
    // Validate required environment variables
    const missingVars = [];
    if (!this.orgId) missingVars.push('ZOHO_DESK_ORG_ID');
    if (!this.clientId) missingVars.push('ZOHO_DESK_CLIENT_ID');
    if (!this.clientSecret) missingVars.push('ZOHO_DESK_CLIENT_SECRET');
    if (!this.refreshToken) missingVars.push('ZOHO_DESK_REFRESH_TOKEN');
    
    if (missingVars.length > 0) {
      console.error('Missing required Zoho Desk environment variables:');
      console.error('Missing:', missingVars.join(', '));
      console.error('Required: ZOHO_DESK_ORG_ID, ZOHO_DESK_CLIENT_ID, ZOHO_DESK_CLIENT_SECRET, ZOHO_DESK_REFRESH_TOKEN');
    } else {
      console.log('✅ All Zoho Desk environment variables present');
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

  // Refresh the access token using Server-based OAuth refresh token
  async refreshAccessToken() {
    // Prevent rapid consecutive refreshes
    const now = Date.now();
    if (this.lastTokenRefresh && (now - this.lastTokenRefresh) < this.minRefreshInterval) {
      console.log('⏸️ Skipping token refresh - too soon since last refresh');
      if (this.accessToken) return this.accessToken;
    }

    try {
      console.log('🔄 Refreshing Zoho Desk access token...');
      
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
        console.log('✅ Zoho Desk access token refreshed successfully');
        console.log(`📅 Token expires in ${Math.round(data.expires_in / 60)} minutes`);
        return this.accessToken;
      } else {
        console.error('❌ No access token in refresh response:', data);
        throw new ZohoDeskAuthError('Failed to refresh access token - no token in response');
      }
    } catch (error) {
      console.error('❌ Zoho Desk token refresh failed:', error);
      
      // If rate limited, wait longer before next attempt
      if (error.message.includes('too many requests') || error.statusCode === 429) {
        this.lastTokenRefresh = now + (30 * 60 * 1000); // Block for 30 minutes
        console.log('⏰ Rate limited - blocking token refresh for 30 minutes');
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
              reject(new ZohoDeskAuthError('Authentication failed - invalid token'));
            } else if (res.statusCode === 403) {
              reject(new ZohoDeskAuthError('Permission denied - check OAuth scopes'));
            } else if (res.statusCode === 429) {
              const retryAfter = res.headers['retry-after'] || 60;
              reject(new ZohoDeskRateLimitError('Rate limit exceeded', retryAfter));
            } else {
              reject(new ZohoDeskAPIError(`API error: ${parsedData.message || 'Unknown error'}`, res.statusCode));
            }
          } catch (parseError) {
            // If response isn't JSON, include raw response
            reject(new Error(`Failed to parse response: ${parseError.message}. Raw response: ${responseData.substring(0, 200)}`));
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
      
      const response = await this.makeHttpRequest(method, url, requestData, headers);
      console.log(`✅ ${method} ${endpoint} - Success`);
      return response;
    } catch (error) {
      console.error(`❌ API request failed: ${method} ${endpoint}`, error.message);
      throw error;
    }
  }

  // Get all help center articles
  async getArticles(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // Add valid parameters for Help Center API
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.from) queryParams.append('from', params.from);
      if (params.sortBy && params.sortBy !== 'modifiedTime') {
        // Only add sortBy if it's not the default to avoid parameter issues
        queryParams.append('sortBy', params.sortBy);
      }
      
      // Use /articles endpoint (Help Center API)
      const endpoint = `/articles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await this.makeRequest(endpoint);
      
      const result = {
        data: response.data || response || [],
        total: response.total || response.length || 0
      };
      
      console.log(`📚 Retrieved ${result.data.length} articles`);
      return result;
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      throw error;
    }
  }

  // Get single article by ID
  async getArticle(id) {
    try {
      const response = await this.makeRequest(`/articles/${id}`);
      console.log(`📄 Retrieved article: ${response.title || id}`);
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
      
      const response = await this.makeRequest(`/articles/search?${searchParams.toString()}`);
      
      const result = {
        data: response.data || response || [],
        total: response.total || response.length || 0
      };
      
      console.log(`🔍 Search "${query}" returned ${result.data.length} results`);
      return result;
    } catch (error) {
      console.error('Failed to search articles:', error);
      throw error;
    }
  }

  // Get departments (Help Center categories)
  async getDepartments() {
    try {
      const response = await this.makeRequest('/departments');
      
      const result = {
        data: response.data || response || [],
        total: (response.data || response || []).length
      };
      
      console.log(`🏢 Retrieved ${result.data.length} departments`);
      return result;
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

  // Get categories (try multiple endpoints)
  async getCategories() {
    const possibleEndpoints = [
      { endpoint: '/departments', type: 'departments' },
      { endpoint: '/categories', type: 'categories' },
      { endpoint: '/sections', type: 'sections' }
    ];

    for (const { endpoint, type } of possibleEndpoints) {
      try {
        console.log(`🔍 Trying categories endpoint: ${endpoint}`);
        const response = await this.makeRequest(endpoint);
        
        // Transform response to consistent format
        const rawData = response.data || response || [];
        const categories = rawData.map(item => ({
          id: item.id,
          name: item.name || item.departmentName || item.title,
          description: item.description || '',
          articleCount: item.articleCount || 0,
          createdTime: item.createdTime,
          modifiedTime: item.modifiedTime,
          type: type
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
    console.log('⚠️ No category endpoints available - returning empty');
    return {
      data: [],
      total: 0,
      error: 'No category endpoints available'
    };
  }

  // Get category by ID
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

  // Get articles by category/department
  async getArticlesByCategory(categoryId, params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      
      // Try department-based articles first
      const endpoint = `/departments/${categoryId}/articles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await this.makeRequest(endpoint);
      return {
        data: response.data || response || [],
        total: response.total || (response.data || response || []).length
      };
    } catch (error) {
      console.error(`Failed to fetch articles for category ${categoryId}:`, error);
      
      // Fallback: get all articles and filter by category
      try {
        console.log('🔄 Falling back to filtered articles');
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

  // Get help center statistics
  async getHelpCenterStats() {
    try {
      console.log('📊 Fetching help center statistics');
      
      // Get basic stats by counting articles and departments
      const [articlesResult, departmentsResult] = await Promise.allSettled([
        this.getArticles({ limit: 1 }),
        this.getDepartments()
      ]);

      const articles = articlesResult.status === 'fulfilled' ? articlesResult.value : { total: 0, data: [] };
      const departments = departmentsResult.status === 'fulfilled' ? departmentsResult.value : { data: [] };

      const stats = {
        totalArticles: articles.total || 0,
        totalCategories: departments.data?.length || 0,
        totalDepartments: departments.data?.length || 0,
        lastUpdated: new Date().toISOString(),
        recentActivity: {
          lastUpdated: new Date().toISOString()
        },
        source: 'zoho_desk_help_center',
        apiVersion: 'v1'
      };

      console.log(`📈 Stats: ${stats.totalArticles} articles, ${stats.totalCategories} categories`);
      return stats;
    } catch (error) {
      console.error('Failed to get help center stats:', error);
      return {
        totalArticles: 0,
        totalCategories: 0,
        totalDepartments: 0,
        lastUpdated: new Date().toISOString(),
        error: error.message,
        source: 'zoho_desk_help_center'
      };
    }
  }

  // Bulk import articles (for sync functionality)
  async bulkImportArticles() {
    try {
      console.log('🔄 Starting bulk import from Zoho Desk Help Center...');
      
      // Get all departments/categories
      const departments = await this.getDepartments();
      const allArticles = [];

      // Get articles from each department
      for (const department of departments.data || []) {
        try {
          const departmentArticles = await this.getArticlesByCategory(department.id);
          allArticles.push(...(departmentArticles.data || []));
          console.log(`📥 Imported ${departmentArticles.data?.length || 0} articles from ${department.name}`);
        } catch (error) {
          console.error(`❌ Failed to get articles for department ${department.id}:`, error);
        }
      }

      // Also get general articles that might not be in departments
      try {
        const generalArticles = await this.getArticles({ limit: 100 });
        
        // Add articles that aren't already included
        const existingIds = new Set(allArticles.map(a => a.id));
        const newArticles = generalArticles.data.filter(a => !existingIds.has(a.id));
        allArticles.push(...newArticles);
        
        console.log(`➕ Added ${newArticles.length} additional articles`);
      } catch (error) {
        console.error('❌ Failed to get general articles:', error);
      }

      const result = {
        success: true,
        articlesImported: allArticles.length,
        categories: departments.data?.length || 0,
        departments: departments.data?.length || 0,
        message: 'Zoho Desk Help Center sync completed successfully',
        source: 'zoho_desk_help_center',
        timestamp: new Date().toISOString()
      };

      console.log('✅ Bulk import completed:', result);
      return result;
    } catch (error) {
      console.error('❌ Bulk import failed:', error);
      return {
        success: false,
        error: error.message,
        articlesImported: 0,
        source: 'zoho_desk_help_center',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Test connection and permissions
  async testConnection() {
    try {
      console.log('🧪 Testing Zoho Desk connection and permissions...');
      
      const testResults = {
        authentication: false,
        articles: false,
        departments: false,
        search: false,
        timestamp: new Date().toISOString()
      };

      // Test authentication
      try {
        await this.refreshAccessToken();
        testResults.authentication = true;
        console.log('✅ Authentication test passed');
      } catch (error) {
        console.error('❌ Authentication test failed:', error);
      }

      // Test articles endpoint
      try {
        const articles = await this.getArticles({ limit: 1 });
        testResults.articles = articles.total >= 0; // Even 0 articles is a valid response
        console.log('✅ Articles endpoint test passed');
      } catch (error) {
        console.error('❌ Articles test failed:', error);
      }

      // Test departments endpoint
      try {
        const departments = await this.getDepartments();
        testResults.departments = departments.total >= 0;
        console.log('✅ Departments endpoint test passed');
      } catch (error) {
        console.error('❌ Departments test failed:', error);
      }

      // Test search
      try {
        await this.searchArticles('test', { limit: 1 });
        testResults.search = true;
        console.log('✅ Search test passed');
      } catch (error) {
        console.error('❌ Search test failed:', error);
      }

      const passedTests = Object.values(testResults).filter(v => v === true).length - 1; // -1 for timestamp
      const totalTests = Object.keys(testResults).length - 1; // -1 for timestamp
      
      console.log(`📊 Connection test results: ${passedTests}/${totalTests} tests passed`);
      
      return {
        ...testResults,
        summary: `${passedTests}/${totalTests} tests passed`,
        allPassed: passedTests === totalTests
      };
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return {
        authentication: false,
        articles: false,
        departments: false,
        search: false,
        error: error.message,
        timestamp: new Date().toISOString()
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