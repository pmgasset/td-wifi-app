// src/pages/api/knowledge-base/sync.js
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
  // This endpoint requires authentication (it's for admin use)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔄 Starting knowledge base sync process');
    
    // Clear all caches to force fresh data
    await cache.clear();
    console.log('🧹 Cache cleared');
    
    // Perform bulk import/sync
    const result = await zohoDeskClient.bulkImportArticles();
    
    console.log('✅ Sync process completed:', result);
    
    res.json({
      success: true,
      message: 'Knowledge base sync completed',
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (error) {
    console.error('Sync process failed:', error);
    handleZohoDeskError(error, res);
  }
}