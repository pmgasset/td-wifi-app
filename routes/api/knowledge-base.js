// routes/api/knowledge-base.js
// API routes for knowledge base functionality

const express = require('express');
const { ZohoDeskClient } = require('../../lib/zoho-desk-client');
const cache = require('../../utils/cache-manager');
const rateLimit = require('../../middleware/rate-limiter');

const router = express.Router();

// Initialize Zoho Desk client
const zohoDeskClient = new ZohoDeskClient();

// Apply rate limiting to all routes
router.use(rateLimit);

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

// GET /api/knowledge-base/articles
// Get all articles with optional filtering
router.get('/articles', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      section,
      search,
      sortBy = 'modifiedTime',
      status = 'PUBLISHED'
    } = req.query;

    const cacheKey = `articles:${JSON.stringify(req.query)}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

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
      articles = await zohoDeskClient.getArticles({
        limit: parseInt(limit),
        sortBy,
        status
      });
    }

    // Filter and sanitize article data
    const sanitizedArticles = {
      data: (articles.data || []).map(article => ({
        id: article.id,
        title: article.title,
        summary: article.summary || article.title,
        content: article.content,
        categoryId: article.categoryId,
        sectionId: article.sectionId,
        tags: article.tags || [],
        status: article.status,
        visibility: article.visibility,
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
      hasMore: (articles.data || []).length === parseInt(limit)
    };

    // Cache for 10 minutes
    await cache.set(cacheKey, sanitizedArticles, 600);
    
    res.json(sanitizedArticles);
  } catch (error) {
    handleZohoDeskError(error, res);
  }
});

// GET /api/knowledge-base/articles/:id
// Get specific article by ID
router.get('/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
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
});

// GET /api/knowledge-base/categories
// Get all categories
router.get('/categories', async (req, res) => {
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
});

// GET /api/knowledge-base/categories/:id
// Get specific category by ID
router.get('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `category:${id}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const category = await zohoDeskClient.getCategory(id);
    
    if (!category || !category.data) {
      return res.status(404).json({
        error: 'Category not found',
        message: `Category with ID ${id} does not exist`
      });
    }

    const sanitizedCategory = {
      id: category.data.id,
      name: category.data.name,
      description: category.data.description,
      articleCount: category.data.articleCount || 0,
      createdTime: category.data.createdTime,
      modifiedTime: category.data.modifiedTime
    };

    // Cache for 1 hour
    await cache.set(cacheKey, sanitizedCategory, 3600);
    
    res.json(sanitizedCategory);
  } catch (error) {
    handleZohoDeskError(error, res);
  }
});

// GET /api/knowledge-base/sections/:categoryId
// Get sections for a specific category
router.get('/sections/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const cacheKey = `sections:category:${categoryId}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const sections = await zohoDeskClient.getSections(categoryId);
    
    const sanitizedSections = {
      data: (sections.data || []).map(section => ({
        id: section.id,
        name: section.name,
        description: section.description,
        categoryId: section.categoryId,
        articleCount: section.articleCount || 0,
        createdTime: section.createdTime,
        modifiedTime: section.modifiedTime
      })),
      total: sections.data?.length || 0,
      categoryId
    };

    // Cache for 1 hour
    await cache.set(cacheKey, sanitizedSections, 3600);
    
    res.json(sanitizedSections);
  } catch (error) {
    handleZohoDeskError(error, res);
  }
});

// GET /api/knowledge-base/search
// Search articles with advanced filtering
router.get('/search', async (req, res) => {
  try {
    const {
      q: query,
      category,
      section,
      limit = 20,
      page = 1
    } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'Search query is required'
      });
    }

    const cacheKey = `search:${JSON.stringify(req.query)}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const searchResults = await zohoDeskClient.searchArticles(query.trim(), {
      limit: parseInt(limit),
      category,
      section
    });

    const sanitizedResults = {
      data: (searchResults.data || []).map(article => ({
        id: article.id,
        title: article.title,
        summary: article.summary || article.title,
        content: article.content,
        categoryId: article.categoryId,
        sectionId: article.sectionId,
        tags: article.tags || [],
        status: article.status,
        relevanceScore: article.relevanceScore || 0,
        createdTime: article.createdTime,
        modifiedTime: article.modifiedTime
      })),
      query: query.trim(),
      total: searchResults.total || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    // Cache search results for 5 minutes
    await cache.set(cacheKey, sanitizedResults, 300);
    
    res.json(sanitizedResults);
  } catch (error) {
    handleZohoDeskError(error, res);
  }
});

// GET /api/knowledge-base/stats
// Get help center statistics
router.get('/stats', async (req, res) => {
  try {
    const cacheKey = 'stats:helpcenter';
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const stats = await zohoDeskClient.getHelpCenterStats();
    
    // Cache stats for 1 hour
    await cache.set(cacheKey, stats, 3600);
    
    res.json(stats);
  } catch (error) {
    handleZohoDeskError(error, res);
  }
});

// POST /api/knowledge-base/sync
// Trigger manual sync of knowledge base
router.post('/sync', async (req, res) => {
  try {
    // Clear all caches
    await cache.clear();
    
    const result = await zohoDeskClient.bulkImportArticles();
    
    res.json({
      success: true,
      message: 'Knowledge base sync completed',
      ...result
    });
  } catch (error) {
    handleZohoDeskError(error, res);
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Try to refresh token to check API connectivity
    await zohoDeskClient.refreshAccessToken();
    
    res.json({
      status: 'healthy',
      service: 'knowledge-base-api',
      timestamp: new Date().toISOString(),
      zohoDesk: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'knowledge-base-api',
      timestamp: new Date().toISOString(),
      zohoDesk: 'disconnected',
      error: error.message
    });
  }
});

module.exports = router;