// src/pages/api/knowledge-base/categories.js
const { ZohoDeskClient } = require('../../../lib/zoho-desk-client');
const cache = require('../../../utils/cache-manager');

// Initialize Zoho Desk client
const zohoDeskClient = new ZohoDeskClient();

// Middleware to handle Zoho Desk errors
const handleZohoDeskError = (error, res) => {
  console.error('Zoho Desk API Error:', error);
  
  if (error.name === 'ZohoDeskAuthError') {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Unable to authenticate with Zoho Desk'
    });
  }
  
  if (error.name === 'ZohoDeskRateLimitError') {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: error.retryAfter
    });
  }
  
  return res.status(500).json({
    error: 'Internal server error',
    message: 'Failed to fetch data from knowledge base'
  });
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cacheKey = 'categories:all';
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const categories = await zohoDeskClient.getCategories();
    
    const sanitizedCategories = {
      data: (categories.data || []).map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        articleCount: category.articleCount || 0,
        createdTime: category.createdTime,
        modifiedTime: category.modifiedTime
      })),
      total: categories.data?.length || 0
    };

    // Cache for 1 hour
    await cache.set(cacheKey, sanitizedCategories, 3600);
    
    res.json(sanitizedCategories);
  } catch (error) {
    handleZohoDeskError(error, res);
  }
}