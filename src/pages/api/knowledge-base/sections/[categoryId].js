// src/pages/api/knowledge-base/sections/[categoryId].js
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
    const { categoryId } = req.query;
    
    if (!categoryId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Category ID is required'
      });
    }

    console.log(`🌍 Public access: GET /api/knowledge-base/sections/${categoryId}`);
    
    const cacheKey = `sections:category:${categoryId}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      console.log('📦 Returning cached sections');
      return res.json(cached);
    }

    console.log(`🔍 Fetching sections for category ${categoryId} from Zoho Desk`);
    const sections = await zohoDeskClient.getSections(categoryId);
    
    const sanitizedSections = {
      data: (sections.data || []).map(section => ({
        id: section.id,
        name: section.name,
        description: section.description || '',
        categoryId: section.categoryId || categoryId,
        articleCount: section.articleCount || 0,
        createdTime: section.createdTime,
        modifiedTime: section.modifiedTime,
        visibility: section.visibility || 'PUBLIC',
        status: section.status || 'ACTIVE'
      })),
      total: sections.data?.length || 0,
      categoryId
    };

    // Cache for 1 hour
    await cache.set(cacheKey, sanitizedSections, 3600);
    
    console.log(`✅ Successfully fetched ${sanitizedSections.data.length} sections for category ${categoryId}`);
    
    res.json(sanitizedSections);
  } catch (error) {
    console.error(`Sections API error for category ${req.query.categoryId}:`, error);
    handleZohoDeskError(error, res);
  }
}