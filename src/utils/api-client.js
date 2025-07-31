// src/utils/api-client.js
// Fixed API client with proper public/private endpoint handling

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
    
    // Define which endpoints are public (don't require authentication)
    this.publicEndpoints = [
      '/knowledge-base/articles',
      '/knowledge-base/categories', 
      '/knowledge-base/stats',
      '/knowledge-base/search',
      '/knowledge-base/health',
      '/test',
      '/knowledge-base/debug'
    ];
  }

  // Check if endpoint requires authentication
  isPublicEndpoint(endpoint) {
    return this.publicEndpoints.some(publicPath => 
      endpoint.startsWith(publicPath) || endpoint.includes('/knowledge-base/')
    );
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
      requireAuth = null, // Allow explicit override
      ...otherOptions
    } = options;

    // Determine if this endpoint needs authentication
    const needsAuth = requireAuth !== null ? requireAuth : !this.isPublicEndpoint(endpoint);

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

    // Add authentication headers only for protected endpoints
    if (needsAuth) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }

      // Add user identification if available
      const userId = localStorage.getItem('user_id');
      if (userId) {
        config.headers['X-User-ID'] = userId;
      }
    }

    // Apply request interceptors
    config = await this.applyRequestInterceptors(config);

    // Build URL
    const url = this.buildURL(endpoint, params);

    try {
      console.log(`🌐 ${method.toUpperCase()} ${url}${needsAuth ? ' [AUTH]' : ' [PUBLIC]'}`);
      
      const response = await fetch(url, config);
      
      // Create response object with additional metadata
      const responseObj = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        ok: response.ok,
        data: null,
        request: {
          method: config.method,
          url: url,
          needsAuth: needsAuth
        }
      };

      // Parse response data
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseObj.data = await response.json();
      } else {
        responseObj.data = await response.text();
      }

      // Apply response interceptors
      const finalResponse = await this.applyResponseInterceptors(responseObj);

      // Handle non-OK responses
      if (!response.ok) {
        const errorMessage = finalResponse.data?.message || 
                           finalResponse.data?.error || 
                           `Request failed: ${response.status} ${response.statusText}`;
        
        throw new APIError(errorMessage, response.status, finalResponse);
      }

      return finalResponse;

    } catch (error) {
      // Handle network errors
      if (error.name === 'AbortError') {
        throw new APIError('Request timeout', 408, null);
      }
      
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
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

// Add response interceptor for logging and error handling
apiClient.addResponseInterceptor(async (response) => {
  // Log response for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`📥 ${response.status} ${response.request.url}`, 
      response.data && typeof response.data === 'object' ? 
        Object.keys(response.data) : response.data?.substring?.(0, 100));
  }

  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.data?.retryAfter || 60;
    console.warn(`Rate limited. Retry after ${retryAfter} seconds.`);
  }

  // Handle authentication errors ONLY for protected endpoints
  if (response.status === 401 && response.request.needsAuth) {
    console.warn('Authentication failed for protected endpoint. Redirecting to login...');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    
    // Only redirect if we're on a protected page
    if (window.location.pathname.includes('/dashboard') || 
        window.location.pathname.includes('/admin')) {
      // Could trigger login redirect here
      // window.location.href = '/login';
    }
  }

  // For public endpoints with 401, log but don't redirect
  if (response.status === 401 && !response.request.needsAuth) {
    console.warn('Public endpoint returned 401 - this might indicate a server configuration issue');
  }

  return response;
});

// Export API client and error class
export { apiClient, APIError };

// Export convenience functions for knowledge base operations (all public)
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
  healthCheck: () => apiClient.get('/knowledge-base/health'),

  // Protected endpoints (require authentication)
  syncWithZoho: () => apiClient.post('/knowledge-base/sync', null, { requireAuth: true }),

  // Contact/Support (might be public or protected depending on implementation)
  submitContactForm: (data) => apiClient.post('/support/contact', data),
  submitFeedback: (articleId, feedback) => apiClient.post(`/knowledge-base/articles/${articleId}/feedback`, feedback)
};

// Export default client
export default apiClient;