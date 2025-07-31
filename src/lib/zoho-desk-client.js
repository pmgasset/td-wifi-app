// lib/zoho-desk-client.js
// Zoho Desk API client for knowledge base integration

class ZohoDeskClient {
  constructor() {
    this.baseUrl = process.env.ZOHO_DESK_API_URL || 'https://desk.zoho.com/api/v1';
    this.orgId = process.env.ZOHO_ORG_ID;
    this.accessToken = null;
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    this.clientId = process.env.ZOHO_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
    
    if (!this.orgId) {
      throw new Error('ZOHO_ORG_ID environment variable is required');
    }
  }

  // Get headers for API requests
  getHeaders() {
    if (!this.accessToken) {
      throw new Error('Access token not available. Please authenticate first.');
    }
    
    return {
      'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
      'Content-Type': 'application/json',
      'orgId': this.orgId
    };
  }

  // Refresh access token using refresh token
  async refreshAccessToken() {
    try {
      const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      throw error;
    }
  }

  // Make authenticated API request with retry logic
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Ensure we have a valid access token
        if (!this.accessToken) {
          await this.refreshAccessToken();
        }

        const response = await fetch(url, {
          ...options,
          headers: {
            ...this.getHeaders(),
            ...options.headers
          }
        });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
          console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          attempt++;
          continue;
        }

        // Handle token expiration
        if (response.status === 401) {
          console.log('Access token expired. Refreshing...');
          await this.refreshAccessToken();
          attempt++;
          continue;
        }

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw error;
        }
        console.log(`Request failed, retrying (${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // Get all knowledge base articles
  async getArticles(params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 50,
      sortBy: params.sortBy || 'modifiedTime',
      ...params
    });

    return await this.makeRequest(`/kbArticles?${queryParams}`);
  }

  // Get article by ID
  async getArticle(articleId) {
    return await this.makeRequest(`/kbArticles/${articleId}`);
  }

  // Search articles
  async searchArticles(query, params = {}) {
    const searchParams = new URLSearchParams({
      searchStr: query,
      limit: params.limit || 20,
      ...params
    });

    return await this.makeRequest(`/kbArticles/search?${searchParams}`);
  }

  // Get all categories
  async getCategories() {
    return await this.makeRequest('/kbCategories');
  }

  // Get category by ID
  async getCategory(categoryId) {
    return await this.makeRequest(`/kbCategories/${categoryId}`);
  }

  // Get sections for a category
  async getSections(categoryId) {
    return await this.makeRequest(`/kbCategories/${categoryId}/kbSections`);
  }

  // Get articles in a specific category
  async getArticlesByCategory(categoryId, params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 50,
      ...params
    });

    return await this.makeRequest(`/kbCategories/${categoryId}/kbArticles?${queryParams}`);
  }

  // Get articles in a specific section
  async getArticlesBySection(sectionId, params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 50,
      ...params
    });

    return await this.makeRequest(`/kbSections/${sectionId}/kbArticles?${queryParams}`);
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
        lastUpdated: new Date().toISOString()
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

  // Bulk import articles (useful for initial setup)
  async bulkImportArticles() {
    try {
      const categories = await this.getCategories();
      const allArticles = [];

      for (const category of categories.data || []) {
        const categoryArticles = await this.getArticlesByCategory(category.id);
        allArticles.push(...(categoryArticles.data || []));
      }

      return {
        success: true,
        articlesImported: allArticles.length,
        categories: categories.data?.length || 0,
        articles: allArticles
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

// Error classes for better error handling
class ZohoDeskError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'ZohoDeskError';
    this.status = status;
    this.response = response;
  }
}

class ZohoDeskAuthError extends ZohoDeskError {
  constructor(message) {
    super(message, 401);
    this.name = 'ZohoDeskAuthError';
  }
}

class ZohoDeskRateLimitError extends ZohoDeskError {
  constructor(message, retryAfter) {
    super(message, 429);
    this.name = 'ZohoDeskRateLimitError';
    this.retryAfter = retryAfter;
  }
}

module.exports = {
  ZohoDeskClient,
  ZohoDeskError,
  ZohoDeskAuthError,
  ZohoDeskRateLimitError
};