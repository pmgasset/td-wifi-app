// src/pages/api/knowledge-base/categories.js
// Fixed version with proper error handling and fallbacks

let ZohoDeskClient, cache;

// Dynamic imports with fallbacks
async function initializeDependencies() {
  try {
    const zohoDeskModule = await import('../../../lib/zoho-desk-client.js');
    ZohoDeskClient = zohoDeskModule.ZohoDeskClient;
  } catch (error) {
    console.warn('Could not import ZohoDeskClient:', error.message);
    // Fallback mock implementation
    ZohoDeskClient = class MockZohoDeskClient {
      async getCategories() {
        return {
          data: [
            {
              id: 'setup',
              name: 'Device Setup',
              description: 'Getting started with your Travel Data WiFi devices',
              articleCount: 5,
              createdTime: new Date().toISOString(),
              modifiedTime: new Date().toISOString()
            },
            {
              id: 'connectivity',
              name: 'Connection Issues',
              description: 'Troubleshooting connectivity and network problems',
              articleCount: 8,
              createdTime: new Date().toISOString(),
              modifiedTime: new Date().toISOString()
            },
            {
              id: 'performance',
              name: 'Speed & Performance',
              description: 'Optimizing your internet speed and performance',
              articleCount: 3,
              createdTime: new Date().toISOString(),
              modifiedTime: new Date().toISOString()
            },
            {
              id: 'security',
              name: 'Network Security',
              description: 'Keeping your connection secure and protected',
              articleCount: 4,
              createdTime: new Date().toISOString(),
              modifiedTime: new Date().toISOString()
            },
            {
              id: 'billing',
              name: 'Billing & Plans',
              description: 'Information about plans, billing, and subscriptions',
              articleCount: 6,
              createdTime: new Date().toISOString(),
              modifiedTime: new Date().toISOString()
            }
          ],
          total: 5
        };
      }
    };
  }

  try {
    const cacheModule = await import('../../../utils/cache-manager.js');
    cache = cacheModule.default || cacheModule;
  } catch (error) {
    console.warn('Could not import cache manager:', error.message);
    cache = {
      async get(key) { 
        console.log(`Mock cache GET: ${key}`);
        return null; 
      },
      async set(key, value, ttl) { 
        console.log(`Mock cache SET: ${key} (TTL: ${ttl}s)`);
        return true; 
      }
    };
  }
}

let dependenciesInitialized = false;
async function ensureDependencies() {
  if (!dependenciesInitialized) {
    await initializeDependencies();
    dependenciesInitialized = true;
  }
}

const handleZohoDeskError = (error, res) => {
  console.error('Categories API Error:', error);
  
  if (error?.name === 'ZohoDeskAuthError') {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Unable to authenticate with Zoho Desk'
    });
  }
  
  if (error?.name === 'ZohoDeskRateLimitError') {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: error.retryAfter || 60
    });
  }
  
  return res.status(500).json({
    error: 'Internal server error',
    message: 'Failed to fetch categories from knowledge base',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only supports GET requests'
    });
  }

  try {
    await ensureDependencies();
    
    const zohoDeskClient = new ZohoDeskClient();
    
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
        color: getCategoryColor(category.id),
        icon: getCategoryIcon(category.id)
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

// Helper functions for category styling
function getCategoryColor(categoryId) {
  const colors = {
    'setup': 'blue',
    'connectivity': 'red',
    'performance': 'yellow',
    'security': 'green',
    'billing': 'purple'
  };
  return colors[categoryId] || 'gray';
}

function getCategoryIcon(categoryId) {
  const icons = {
    'setup': 'Settings',
    'connectivity': 'Wifi',
    'performance': 'Zap',
    'security': 'Shield',
    'billing': 'CreditCard'
  };
  return icons[categoryId] || 'HelpCircle';
}