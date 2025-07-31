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

// Helper functions for category styling
function getCategoryColor(categoryName) {
  const name = categoryName.toLowerCase();
  if (name.includes('setup') || name.includes('getting started')) return 'blue';
  if (name.includes('connect') || name.includes('network') || name.includes('troubleshoot')) return 'red';
  if (name.includes('performance') || name.includes('speed') || name.includes('optimization')) return 'yellow';
  if (name.includes('security') || name.includes('safe')) return 'green';
  if (name.includes('billing') || name.includes('account') || name.includes('payment')) return 'purple';
  return 'gray';
}

function getCategoryIcon(categoryName) {
  const name = categoryName.toLowerCase();
  if (name.includes('setup') || name.includes('getting started')) return 'Settings';
  if (name.includes('connect') || name.includes('network')) return 'Wifi';
  if (name.includes('performance') || name.includes('speed')) return 'Zap';
  if (name.includes('security') || name.includes('safe')) return 'Shield';
  if (name.includes('billing') || name.includes('account')) return 'CreditCard';
  if (name.includes('troubleshoot') || name.includes('help')) return 'Tool';
  return 'HelpCircle';
}

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
    console.log('🌍 Public access: GET /api/knowledge-base/categories/');
    
    const cacheKey = 'categories:all';
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      console.log('📦 Returning cached categories');
      return res.json(cached);
    }

    console.log('🔍 Fetching categories from Zoho Desk');
    const categories = await zohoDeskClient.getCategories();
    
    const sanitizedCategories = {
      data: (categories.data || []).map(category => ({
        id: category.id,
        name: category.name,
        description: category.description || '',
        articleCount: category.articleCount || 0,
        createdTime: category.createdTime,
        modifiedTime: category.modifiedTime,
        color: getCategoryColor(category.name),
        icon: getCategoryIcon(category.name)
      })),
      total: categories.data?.length || 0
    };

    // Cache for 1 hour
    await cache.set(cacheKey, sanitizedCategories, 3600);
    
    console.log(`✅ Successfully fetched ${sanitizedCategories.data.length} categories`);
    
    res.json(sanitizedCategories);
  } catch (error) {
    console.error('Categories API error:', error);
    handleZohoDeskError(error, res);
  }
}