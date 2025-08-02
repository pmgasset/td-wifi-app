// ===== src/pages/api/test-category-products.js ===== (Create this new file)
import { zohoAPI } from '../../lib/zoho-api.old';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TESTING CATEGORY PRODUCTS ===');
    
    const targetCategoryId = '2948665000025595042';
    const targetCategorySlug = '4g-5g-router';

    const results = {
      timestamp: new Date().toISOString(),
      targetCategory: {
        id: targetCategoryId,
        slug: targetCategorySlug
      },
      categoryAnalysis: {},
      productAnalysis: {},
      recommendations: []
    };

    // Step 1: Fetch all categories
    console.log('Fetching categories...');
    try {
      const categoriesResponse = await zohoAPI.apiRequest('/categories');
      const categories = categoriesResponse.categories || [];
      
      results.categoryAnalysis = {
        success: true,
        totalCategories: categories.length,
        categories: categories.map(cat => ({
          category_id: cat.category_id,
          name: cat.name,
          url: cat.url,
          status: cat.status,
          description: cat.description,
          isTarget: cat.category_id === targetCategoryId
        })),
        targetCategoryFound: categories.some(cat => cat.category_id === targetCategoryId),
        targetCategory: categories.find(cat => cat.category_id === targetCategoryId) || null
      };

      console.log(`Found ${categories.length} categories`);
      
      const targetCategory = categories.find(cat => cat.category_id === targetCategoryId);
      if (targetCategory) {
        console.log(`✓ Target category found: ${targetCategory.name}`);
      } else {
        console.log(`✗ Target category ${targetCategoryId} not found`);
      }
      
    } catch (error) {
      results.categoryAnalysis = {
        success: false,
        error: error.message
      };
      console.log(`✗ Categories fetch failed: ${error.message}`);
    }

    // Step 2: Fetch all products and analyze category assignments
    console.log('\nFetching products...');
    try {
      const productsResponse = await zohoAPI.apiRequest('/products');
      const products = productsResponse.products || [];
      
      // Analyze category distribution
      const categoryDistribution = {};
      const productsInTargetCategory = [];
      const productsWithCategories = [];

      products.forEach(product => {
        const categoryId = product.category_id;
        const categoryName = product.category_name;
        
        // Count category distribution
        if (categoryId) {
          categoryDistribution[categoryId] = (categoryDistribution[categoryId] || 0) + 1;
        }
        
        // Check if product is in target category
        if (categoryId === targetCategoryId) {
          productsInTargetCategory.push({
            product_id: product.product_id,
            name: product.name,
            category_id: categoryId,
            category_name: categoryName,
            status: product.status,
            show_in_storefront: product.show_in_storefront
          });
        }
        
        // Collect products with category info
        if (categoryId || categoryName) {
          productsWithCategories.push({
            product_id: product.product_id,
            name: product.name,
            category_id: categoryId,
            category_name: categoryName
          });
        }
      });

      results.productAnalysis = {
        success: true,
        totalProducts: products.length,
        productsWithCategories: productsWithCategories.length,
        categoryDistribution: categoryDistribution,
        productsInTargetCategory: productsInTargetCategory.length,
        targetCategoryProducts: productsInTargetCategory,
        sampleProductsWithCategories: productsWithCategories.slice(0, 10)
      };

      console.log(`Found ${products.length} total products`);
      console.log(`Found ${productsInTargetCategory.length} products in target category`);
      console.log('Category distribution:', categoryDistribution);
      
    } catch (error) {
      results.productAnalysis = {
        success: false,
        error: error.message
      };
      console.log(`✗ Products fetch failed: ${error.message}`);
    }

    // Step 3: Generate recommendations
    console.log('\n=== GENERATING RECOMMENDATIONS ===');
    
    if (!results.categoryAnalysis.success) {
      results.recommendations.push('❌ Could not fetch categories');
    } else if (!results.categoryAnalysis.targetCategoryFound) {
      results.recommendations.push(`❌ Category ${targetCategoryId} not found`);
      results.recommendations.push('🔧 Check if the category ID is correct');
      results.recommendations.push('🔧 Category might be inactive or deleted');
    } else {
      results.recommendations.push(`✅ Target category found: ${results.categoryAnalysis.targetCategory.name}`);
    }

    if (!results.productAnalysis.success) {
      results.recommendations.push('❌ Could not fetch products');
    } else if (results.productAnalysis.productsInTargetCategory === 0) {
      results.recommendations.push(`❌ No products found in category ${targetCategoryId}`);
      results.recommendations.push('🔧 Products might be assigned to different categories');
      results.recommendations.push('🔧 Check product category assignments in Zoho admin');
      
      // Show top categories with products
      const sortedCategories = Object.entries(results.productAnalysis.categoryDistribution)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
      
      if (sortedCategories.length > 0) {
        results.recommendations.push('📊 Top categories with products:');
        sortedCategories.forEach(([catId, count]) => {
          const categoryName = results.categoryAnalysis.categories?.find(c => c.category_id === catId)?.name || 'Unknown';
          results.recommendations.push(`   • ${categoryName} (ID: ${catId}): ${count} products`);
        });
      }
    } else {
      results.recommendations.push(`✅ Found ${results.productAnalysis.productsInTargetCategory} products in target category`);
      results.recommendations.push('🎯 Category page should work with these products');
    }

    // URL testing
    const testUrl = `/categories/${targetCategorySlug}/${targetCategoryId}`;
    results.recommendations.push(`🔗 Test URL: ${testUrl}`);

    return res.status(200).json({
      ...results,
      summary: {
        categoryExists: results.categoryAnalysis.targetCategoryFound,
        categoryName: results.categoryAnalysis.targetCategory?.name || null,
        productsInCategory: results.productAnalysis.productsInTargetCategory || 0,
        testUrl: testUrl
      },
      nextSteps: results.productAnalysis.productsInTargetCategory > 0 ? [
        '1. Create the category page at src/pages/categories/[...slug].tsx',
        '2. Create the categories API at src/pages/api/categories.js',
        `3. Visit ${testUrl} to see the category products`,
        '4. Products should be filtered by the category automatically'
      ] : [
        '1. Check if products are assigned to the correct category in Zoho admin',
        '2. Verify the category ID is correct',
        '3. Ensure products have category_id field populated',
        '4. Test with a category that has products'
      ]
    });

  } catch (error) {
    console.error('Category test failed:', error);
    return res.status(500).json({
      error: 'Category test failed',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}