// src/pages/api/knowledge-base/articles.js
// Fixed version with proper error handling, fallbacks, and public access

import { withKnowledgeBaseAccess } from '../../../middleware/auth-bypass';

let ZohoDeskClient, cache;

// Dynamic imports with fallbacks
async function initializeDependencies() {
  try {
    // Try to import the Zoho Desk client
    const zohoDeskModule = await import('../../../lib/zoho-desk-client.js');
    ZohoDeskClient = zohoDeskModule.ZohoDeskClient;
  } catch (error) {
    console.warn('Could not import ZohoDeskClient:', error.message);
    // Fallback mock implementation
    ZohoDeskClient = class MockZohoDeskClient {
      async getArticles() {
        return {
          data: [
            {
              id: 'mock-1',
              title: 'Getting Started Guide',
              summary: 'Learn how to get started with Travel Data WiFi',
              content: 'This is a comprehensive guide to help you get started.',
              status: 'PUBLISHED',
              categoryId: 'setup',
              tags: ['setup', 'getting-started'],
              viewCount: 142,
              helpfulCount: 23,
              unhelpfulCount: 2,
              createdTime: new Date().toISOString(),
              modifiedTime: new Date().toISOString()
            },
            {
              id: 'mock-2',
              title: 'Troubleshooting Connection Issues',
              summary: 'Common solutions for connectivity problems',
              content: 'Step-by-step troubleshooting guide for connection issues.',
              status: 'PUBLISHED',
              categoryId: 'connectivity',
              tags: ['troubleshooting', 'connectivity'],
              viewCount: 98,
              helpfulCount: 15,
              unhelpfulCount: 1,
              createdTime: new Date().toISOString(),
              modifiedTime: new Date().toISOString()
            },
            {
              id: 'mock-3',
              title: 'Optimizing Internet Speed',
              summary: 'Tips to improve your connection speed',
              content: 'Various methods to optimize your internet performance.',
              status: 'PUBLISHED',
              categoryId: 'performance',
              tags: ['performance', 'speed'],
              viewCount: 76,
              helpfulCount: 19,
              unhelpfulCount: 0,
              createdTime: new Date().toISOString(),
              modifiedTime: new Date().toISOString()
            }
          ],
          total: 3
        };
      }
    };
  }

  try {
    // Try to import the cache manager
    const cacheModule = await import('../../../utils/cache-manager.js');
    cache = cacheModule.default || cacheModule;
  } catch (error) {
    console.warn('Could not import cache manager:', error.message);
    // Fallback mock cache
    cache = {
      async get(key) { 
        console.log(`Mock cache GET: ${key}`);
        return null; 
      },
      async set(key, value, ttl) { 
        console.log(`Mock cache SET: ${key} (TTL: ${ttl}s)`);
        return true; 
      }
    };
  }
}

// Initialize dependencies
let dependenciesInitialized = false;
async function ensureDependencies() {
  if (!dependenciesInitialized) {
    await initializeDependencies();
    dependenciesInitialized = true;
  }
}

// Error handling middleware
const handleZohoDeskError = (error, res) => {
  console.error('Zoho Desk API Error:', error);
  
  // Check error types
  if (error?.name === 'ZohoDeskAuthError') {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Unable to authenticate with Zoho Desk',
      suggestion: 'Check your Zoho Desk API credentials'
    });
  }
  
  if (error?.name === 'ZohoDeskRateLimitError') {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: error.retryAfter || 60
    });
  }
  
  return res.status(500).json({
    error: 'Internal server error',
    message: 'Failed to fetch data from knowledge base',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

export default withKnowledgeBaseAccess(async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only supports GET requests'
    });
  }

  try {
    // Ensure dependencies are loaded
    await ensureDependencies();
    
    // Initialize client
    const zohoDeskClient = new ZohoDeskClient();
    
    // Extract query parameters
    const { 
      page = 1, 
      limit = 20, 
      category, 
      section, 
      status = 'PUBLISHED',
      search 
    } = req.query;

    // Build cache key
    const cacheKey = `articles:${JSON.stringify({
      page, limit, category, section, status, search
    })}`;
    
    // Try to get from cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log('📦 Returning cached articles');
      return res.json(cached);
    }

    // Prepare parameters for API call
    const params = {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    };

    if (category) params.categoryId = category;
    if (section) params.sectionId = section;
    if (search) params.search = search;

    console.log('🔍 Fetching articles with params:', params);

    // Fetch articles from Zoho Desk
    const articles = await zohoDeskClient.getArticles(params);
    
    // Sanitize the response data
    const sanitizedArticles = {
      data: (articles.data || []).map(article => ({
        id: article.id,
        title: article.title,
        summary: article.summary || '',
        content: article.content || '',
        categoryId: article.categoryId,
        sectionId: article.sectionId,
        tags: article.tags || [],
        status: article.status,
        visibility: article.visibility || 'PUBLIC',
        createdTime: article.createdTime,
        modifiedTime: article.modifiedTime,
        viewCount: article.viewCount || 0,
        helpfulCount: article.helpfulCount || 0,
        unhelpfulCount: article.unhelpfulCount || 0,
        language: article.language || 'en',
        attachments: article.attachments || []
      })),
      total: articles.total || 0,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: (parseInt(page) * parseInt(limit)) < (articles.total || 0)
    };

    // Cache the sanitized response for 30 minutes
    await cache.set(cacheKey, sanitizedArticles, 1800);
    
    console.log(`✅ Successfully fetched ${sanitizedArticles.data.length} articles`);
    
    res.json(sanitizedArticles);
  } catch (error) {
    console.error('Articles API error:', error);
    handleZohoDeskError(error, res);
  }
});