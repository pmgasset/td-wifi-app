// src/middleware/auth-bypass.js
// Middleware to bypass authentication for public knowledge base endpoints

/**
 * Authentication bypass middleware for knowledge base endpoints
 * This ensures knowledge base endpoints are publicly accessible
 */
export function withPublicAccess(handler) {
  return async function publicHandler(req, res) {
    // Set CORS headers to allow public access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-ID');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Add public access indicators to request
    req.isPublicEndpoint = true;
    req.skipAuth = true;
    
    // Log public access
    console.log(`🌍 Public access: ${req.method} ${req.url}`);
    
    try {
      return await handler(req, res);
    } catch (error) {
      console.error('Public endpoint error:', error);
      
      // Return user-friendly error for public endpoints
      return res.status(500).json({
        error: 'Service temporarily unavailable',
        message: 'Please try again in a few moments',
        public: true,
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Conditional authentication middleware
 * Applies authentication only to protected endpoints
 */
export function withConditionalAuth(handler, options = {}) {
  const { requireAuth = false, publicPaths = [] } = options;
  
  return async function conditionalAuthHandler(req, res) {
    const isPublicPath = publicPaths.some(path => req.url?.startsWith(path));
    const needsAuth = requireAuth && !isPublicPath;
    
    // Skip authentication for public paths
    if (isPublicPath) {
      req.isPublicEndpoint = true;
      req.skipAuth = true;
      console.log(`🌍 Public path access: ${req.method} ${req.url}`);
      return await handler(req, res);
    }
    
    // Apply authentication for protected endpoints
    if (needsAuth) {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please provide a valid authorization token'
        });
      }
      
      // Extract and validate token (implement your token validation logic here)
      const token = authHeader.substring(7);
      req.user = await validateToken(token);
      
      if (!req.user) {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'The provided authorization token is invalid or expired'
        });
      }
    }
    
    return await handler(req, res);
  };
}

/**
 * Token validation function (implement based on your auth system)
 */
async function validateToken(token) {
  try {
    // Implement your token validation logic here
    // This is a placeholder that always returns null (no auth required for now)
    return null;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

/**
 * Error handler wrapper for public endpoints
 */
export function withPublicErrorHandling(handler) {
  return async function publicErrorHandler(req, res) {
    try {
      return await handler(req, res);
    } catch (error) {
      console.error(`Public endpoint error ${req.url}:`, error);
      
      // Return user-friendly errors for public endpoints
      const statusCode = error.status || error.statusCode || 500;
      const message = getPublicErrorMessage(statusCode, error);
      
      return res.status(statusCode).json({
        error: 'Service Error',
        message,
        public: true,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && {
          details: error.message,
          stack: error.stack
        })
      });
    }
  };
}

/**
 * Get user-friendly error messages for public endpoints
 */
function getPublicErrorMessage(statusCode, error) {
  switch (statusCode) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'This content requires authentication.';
    case 403:
      return 'Access to this content is restricted.';
    case 404:
      return 'The requested content could not be found.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
    default:
      return 'Service temporarily unavailable. Please try again in a few moments.';
  }
}

/**
 * Combined middleware for knowledge base endpoints
 */
export function withKnowledgeBaseAccess(handler) {
  return withPublicErrorHandling(
    withPublicAccess(handler)
  );
}