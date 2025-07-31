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
  // Set CORS headers for public access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Article ID is required'
      });
    }

    console.log(`🌍 Public access: GET /api/knowledge-base/articles/${id}`);
    
    const cacheKey = `article:${id}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      console.log('📦 Returning cached article');
      return res.json(cached);
    }

    console.log(`🔍 Fetching article ${id} from Zoho Desk`);
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
      content: article.data.answer || article.data.content || '',
      summary: article.data.summary || article.data.answer || article.data.title,
      categoryId: article.data.categoryId,
      sectionId: article.data.sectionId,
      tags: article.data.tags || [],
      status: article.data.status,
      visibility: article.data.visibility || 'PUBLIC',
      createdTime: article.data.createdTime,
      modifiedTime: article.data.modifiedTime,
      viewCount: article.data.viewCount || 0,
      helpfulCount: article.data.helpfulCount || article.data.likeCount || 0,
      unhelpfulCount: article.data.unhelpfulCount || article.data.dislikeCount || 0,
      language: article.data.language || 'en',
      attachments: article.data.attachments || [],
      author: article.data.author || null,
      lastModifiedBy: article.data.lastModifiedBy || null
    };

    // Cache for 30 minutes
    await cache.set(cacheKey, sanitizedArticle, 1800);
    
    console.log(`✅ Successfully fetched article: ${sanitizedArticle.title}`);
    
    res.json(sanitizedArticle);
  } catch (error) {
    console.error(`Article detail API error for ID ${req.query.id}:`, error);
    handleZohoDeskError(error, res);
  }
}