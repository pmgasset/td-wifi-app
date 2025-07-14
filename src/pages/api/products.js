// ===== src/pages/api/products.js ===== (FIXED VERSION)
// Try to import the existing API first, with fallback
let zohoAPI;

try {
  // Try the existing API first
  const zohoModule = require('../../lib/zoho-api');
  zohoAPI = zohoModule.zohoAPI;
  console.log('✅ Using existing zoho-api');
} catch (existingError) {
  console.log('⚠️ Existing zoho-api not found, trying alternatives...');
  
  try {
    // Try the guest API as fallback
    const guestModule = require('../../lib/zoho-api-guest');
    zohoAPI = guestModule.guestZohoAPI;
    console.log('✅ Using guest zoho-api as fallback');
  } catch (guestError) {
    console.error('❌ No Zoho API available:', { existingError: existingError.message, guestError: guestError.message });
  }
}

export default async function handler(req, res) {
  console.log('Products API called:', req.method, req.url);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if zohoAPI is available
  if (!zohoAPI) {
    console.error('❌ CRITICAL: zohoAPI is undefined');
    return res.status(500).json({ 
      error: 'Zoho API client not available',
      details: 'The Zoho API client could not be imported. Check that zoho-api.ts exists and exports zohoAPI.',
      timestamp: new Date().toISOString(),
      suggestions: [
        'Ensure src/lib/zoho-api.ts exists',
        'Verify the export statement: export const zohoAPI = new ZohoCommerceAPI();',
        'Check for TypeScript compilation errors',
        'Try creating src/lib/zoho-api-guest.ts as a fallback'
      ]
    });
  }

  // Check if getProducts method exists
  if (!zohoAPI.getProducts || typeof zohoAPI.getProducts !== 'function') {
    console.error('❌ CRITICAL: getProducts method not found on zohoAPI');
    console.log('Available methods:', Object.keys(zohoAPI));
    return res.status(500).json({ 
      error: 'getProducts method not available',
      details: 'The zohoAPI object does not have a getProducts method.',
      availableMethods: Object.keys(zohoAPI),
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log('Fetching products from Zoho Commerce...');
    
    const products = await zohoAPI.getProducts();
    console.log(`Successfully fetched ${products.length} products`);
    
    // Filter out inactive products and products not shown in storefront for public API
    const activeProducts = products.filter(product => {
      // More defensive filtering
      const status = product.status || product.product_status;
      const showInStorefront = product.show_in_storefront !== false && product.storefront_visible !== false;
      
      return status === 'active' && showInStorefront;
    });
    
    console.log(`Filtered to ${activeProducts.length} active storefront products`);
    
    // Add some debug info for the first few products
    if (activeProducts.length > 0) {
      console.log('Sample product structure:', {
        id: activeProducts[0].product_id,
        name: activeProducts[0].product_name || activeProducts[0].name,
        price: activeProducts[0].product_price || activeProducts[0].min_rate,
        hasImages: (activeProducts[0].product_images?.length || 0) > 0,
        imageCount: activeProducts[0].product_images?.length || 0,
        status: activeProducts[0].status,
        showInStorefront: activeProducts[0].show_in_storefront
      });
    }
    
    res.status(200).json({ 
      products: activeProducts,
      meta: {
        total: products.length,
        active: activeProducts.length,
        timestamp: new Date().toISOString(),
        api_client: zohoAPI.constructor.name || 'Unknown'
      }
    });
  } catch (error) {
    console.error('Products API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch products from Zoho Commerce',
      details: error.message,
      timestamp: new Date().toISOString(),
      errorType: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}