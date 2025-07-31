// src/pages/api/knowledge-base/articles.js
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
    console.log('🌍 Public access: GET /api/knowledge-base/articles/');
    
    const {
      page = 1,
      limit = 20,
      category,
      section,
      search,
      sortBy = 'modifiedTime'
      // Removed status parameter - not supported by Zoho Desk API
    } = req.query;

    const cacheKey = `articles:${JSON.stringify({page, limit, category, section, search, sortBy})}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      console.log('📦 Returning cached articles');
      return res.json(cached);
    }

    console.log('🔍 Fetching articles with params:', { page, limit, category, section, search, sortBy });

    let articles;
    
    if (search) {
      articles = await zohoDeskClient.searchArticles(search, {
        limit: parseInt(limit),
        sortBy
      });
    } else if (category) {
      articles = await zohoDeskClient.getArticlesByCategory(category, {
        limit: parseInt(limit),
        sortBy
      });
    } else if (section) {
      articles = await zohoDeskClient.getArticlesBySection(section, {
        limit: parseInt(limit),
        sortBy
      });
    } else {
      // Removed status parameter from getArticles call
      articles = await zohoDeskClient.getArticles({
        limit: parseInt(limit),
        sortBy
      });
    }

    // Filter and sanitize article data
    const sanitizedArticles = {
      data: (articles.data || []).map(article => ({
        id: article.id,
        title: article.title,
        summary: article.summary || article.answer || article.title,
        content: article.answer || article.content || '',
        categoryId: article.categoryId,
        sectionId: article.sectionId,
        tags: article.tags || [],
        status: article.status,
        visibility: article.visibility || 'PUBLIC',
        createdTime: article.createdTime,
        modifiedTime: article.modifiedTime,
        viewCount: article.viewCount || 0,
        helpfulCount: article.helpfulCount || article.likeCount || 0,
        unhelpfulCount: article.unhelpfulCount || article.dislikeCount || 0,
        language: article.language || 'en',
        attachments: article.attachments || []
      })),
      total: articles.total || 0,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: (articles.data || []).length === parseInt(limit)
    };

    // Cache for 10 minutes
    await cache.set(cacheKey, sanitizedArticles, 600);
    
    console.log(`✅ Successfully fetched ${sanitizedArticles.data.length} articles`);
    
    res.json(sanitizedArticles);
  } catch (error) {
    console.error('Articles API error:', error);
    handleZohoDeskError(error, res);
  }
}