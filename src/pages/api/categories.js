// ===== src/pages/api/categories.js ===== (Create this new file)
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  console.log('Categories API called:', req.method, req.url);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Fetching categories from Zoho Commerce...');
    
    const response = await zohoAPI.apiRequest('/categories');
    const categories = response.categories || [];
    
    console.log(`Successfully fetched ${categories.length} categories`);
    
    // Transform categories to include useful fields
    const transformedCategories = categories.map((category) => ({
      ...category,
      // Add URL-friendly slug if not present
      slug: category.url || category.name?.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      // Ensure we have a proper category path
      path: `/categories/${category.url || category.name?.toLowerCase().replace(/[^a-z0-9]/g, '-')}/${category.category_id}`
    }));
    
    // Filter active categories only
    const activeCategories = transformedCategories.filter((category) => 
      category.status !== 'inactive'
    );
    
    console.log(`Filtered to ${activeCategories.length} active categories`);
    
    if (activeCategories.length > 0) {
      console.log('Sample category structure:', {
        id: activeCategories[0].category_id,
        name: activeCategories[0].name,
        slug: activeCategories[0].slug,
        path: activeCategories[0].path
      });
    }
    
    res.status(200).json({ 
      categories: activeCategories,
      meta: {
        total: categories.length,
        active: activeCategories.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Categories API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch categories from Zoho Commerce',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}