// src/pages/api/knowledge-base/stats.js
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
    console.log('🌍 Public access: GET /api/knowledge-base/stats/');
    
    const cacheKey = 'stats:helpcenter';
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      console.log('📦 Returning cached stats');
      return res.json(cached);
    }

    console.log('📊 Fetching help center statistics');
    const stats = await zohoDeskClient.getHelpCenterStats();
    
    // Enhance stats with calculated metrics
    const enhancedStats = {
      ...stats,
      metrics: {
        articlesPerCategory: stats.totalCategories > 0 ? 
          Math.round((stats.totalArticles / stats.totalCategories) * 10) / 10 : 0,
        averageArticlesPerCategory: stats.totalCategories > 0 ? 
          Math.round((stats.totalArticles / stats.totalCategories) * 10) / 10 : 0
      },
      trends: {
        period: 'last_30_days',
        status: 'active'
      },
      recentActivity: {
        lastUpdated: new Date().toISOString(),
        ...stats.recentActivity
      }
    };
    
    // Cache stats for 30 minutes (shorter than categories since stats change more frequently)
    await cache.set(cacheKey, enhancedStats, 1800);
    
    console.log('✅ Successfully fetched help center statistics');
    
    res.json(enhancedStats);
  } catch (error) {
    console.error('Stats API error:', error);
    handleZohoDeskError(error, res);
  }
}