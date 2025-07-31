// src/pages/api/knowledge-base/health.js
const { ZohoDeskClient } = require('../../../lib/zoho-desk-client');

// Initialize Zoho Desk client
const zohoDeskClient = new ZohoDeskClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}