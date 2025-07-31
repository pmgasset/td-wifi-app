// src/pages/api/knowledge-base/articles/[id].js
const { ZohoDeskClient } = require('../../../../lib/zoho-desk-client');
const cache = require('../../../../utils/cache-manager');

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
    const { id } = req.query;
    const cacheKey = `article:${id}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const article = await zohoDeskClient.getArticle(id);
    
    if (!article || !article.data) {
      return res.status(404).json({
        error: 'Article not found',
        message: `Article with ID ${id} does not exist`
      });
    }

    const sanitizedArticle = {
      id: article.data.id,
      title: article.data.title,
      content: article.data.content,
      summary: article.data.summary,
      categoryId: article.data.categoryId,
      sectionId: article.data.sectionId,
      tags: article.data.tags || [],
      status: article.data.status,
      visibility: article.data.visibility,
      createdTime: article.data.createdTime,
      modifiedTime: article.data.modifiedTime,
      viewCount: article.data.viewCount || 0,
      helpfulCount: article.data.helpfulCount || 0,
      unhelpfulCount: article.data.unhelpfulCount || 0,
      language: article.data.language || 'en',
      attachments: article.data.attachments || []
    };

    // Cache for 30 minutes
    await cache.set(cacheKey, sanitizedArticle, 1800);
    
    res.json(sanitizedArticle);
  } catch (error) {
    handleZohoDeskError(error, res);
  }
}