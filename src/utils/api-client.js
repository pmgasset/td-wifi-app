// utils/api-client.js
// Frontend API client for knowledge base endpoints

class APIClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
    this.interceptors = {
      request: [],
      response: []
    };
  }

  // Add request interceptor
  addRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor);
  }

  // Add response interceptor
  addResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor);
  }

  // Apply request interceptors
  async applyRequestInterceptors(config) {
    let modifiedConfig = { ...config };
    
    for (const interceptor of this.interceptors.request) {
      modifiedConfig = await interceptor(modifiedConfig);
    }
    
    return modifiedConfig;
  }

  // Apply response interceptors
  async applyResponseInterceptors(response) {
    let modifiedResponse = response;
    
    for (const interceptor of this.interceptors.response) {
      modifiedResponse = await interceptor(modifiedResponse);
    }
    
    return modifiedResponse;
  }

  // Build URL with query parameters
  buildURL(endpoint, params = {}) {
    const url = new URL(`${this.baseURL}${endpoint}`, window.location.origin);
    
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        url.searchParams.append(key, params[key]);
      }
    });
    
    return url.toString();
  }

  // Make HTTP request
  async request(method, endpoint, options = {}) {
    const {
      params = {},
      data = null,
      headers = {},
      timeout = 30000,
      ...otherOptions
    } = options;

    // Prepare request config
    let config = {
      method: method.toUpperCase(),
      headers: {
        ...this.defaultHeaders,
        ...headers
      },
      signal: AbortSignal.timeout(timeout),
      ...otherOptions
    };

    // Add body for POST/PUT/PATCH requests
    if (data && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
      config.body = JSON.stringify(data);
    }

    // Apply request interceptors
    config = await this.applyRequestInterceptors(config);

    // Build URL
    const url = this.buildURL(endpoint, params);

    try {
      console.log(`🌐 ${method.toUpperCase()} ${url}`);
      
      const response = await fetch(url, config);
      
      // Create response object
      let responseObj = {
        data: null,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config,
        request: { url }
      };

      // Parse response body
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseObj.data = await response.json();
      } else {
        responseObj.data = await response.text();
      }

      // Apply response interceptors
      responseObj = await this.applyResponseInterceptors(responseObj);

      // Handle non-2xx responses
      if (!response.ok) {
        const error = new APIError(
          responseObj.data?.message || `Request failed with status ${response.status}`,
          response.status,
          responseObj
        );
        throw error;
      }

      return responseObj;
    } catch (error) {
      // Handle different types of errors
      if (error.name === 'AbortError') {
        throw new APIError('Request timeout', 408, null);
      }
      
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new APIError('Network error. Please check your connection.', 0, null);
      }

      // Re-throw API errors
      if (error instanceof APIError) {
        throw error;
      }

      // Handle other errors
      throw new APIError(error.message || 'Unknown error occurred', 0, null);
    }
  }

  // GET request
  async get(endpoint, options = {}) {
    return this.request('GET', endpoint, options);
  }

  // POST request
  async post(endpoint, data = null, options = {}) {
    return this.request('POST', endpoint, { ...options, data });
  }

  // PUT request
  async put(endpoint, data = null, options = {}) {
    return this.request('PUT', endpoint, { ...options, data });
  }

  // PATCH request
  async patch(endpoint, data = null, options = {}) {
    return this.request('PATCH', endpoint, { ...options, data });
  }

  // DELETE request
  async delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, options);
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.get('/knowledge-base/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }
}

// Custom error class for API errors
class APIError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.response = response;
  }
}

// Create and configure API client instance
const apiClient = new APIClient();

// Add request interceptor for authentication
apiClient.addRequestInterceptor(async (config) => {
  // Add authentication headers if available
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  // Add user identification if available
  const userId = localStorage.getItem('user_id');
  if (userId) {
    config.headers['X-User-ID'] = userId;
  }

  return config;
});

// Add response interceptor for error handling
apiClient.addResponseInterceptor(async (response) => {
  // Log response for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`📥 ${response.status} ${response.request.url}`, response.data);
  }

  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.data?.retryAfter || 60;
    console.warn(`Rate limited. Retry after ${retryAfter} seconds.`);
    
    // Could implement automatic retry logic here
    // For now, just pass through the error
  }

  // Handle authentication errors
  if (response.status === 401) {
    console.warn('Authentication failed. Redirecting to login...');
    // Could trigger login redirect here
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
  }

  return response;
});

// Export API client and error class
export { apiClient, APIError };

// Export convenience functions for knowledge base operations
export const knowledgeBaseAPI = {
  // Articles
  getArticles: (params) => apiClient.get('/knowledge-base/articles', { params }),
  getArticle: (id) => apiClient.get(`/knowledge-base/articles/${id}`),
  searchArticles: (query, params = {}) => apiClient.get('/knowledge-base/search', { 
    params: { q: query, ...params } 
  }),

  // Categories
  getCategories: () => apiClient.get('/knowledge-base/categories'),
  getCategory: (id) => apiClient.get(`/knowledge-base/categories/${id}`),
  getSections: (categoryId) => apiClient.get(`/knowledge-base/sections/${categoryId}`),

  // Stats and management
  getStats: () => apiClient.get('/knowledge-base/stats'),
  syncWithZoho: () => apiClient.post('/knowledge-base/sync'),
  healthCheck: () => apiClient.get('/knowledge-base/health'),

  // Contact/Support
  submitContactForm: (data) => apiClient.post('/support/contact', data),
  submitFeedback: (articleId, feedback) => apiClient.post(`/knowledge-base/articles/${articleId}/feedback`, feedback)
};

// Export default client
export default apiClient;