// src/pages/api/debug-commerce.js - Debug Commerce API structure

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== DEBUGGING COMMERCE API STRUCTURE ===');

    // Import Commerce API
    let zohoAPI;
    try {
      const commerceModule = await import('../../lib/zoho-api');
      zohoAPI = commerceModule.zohoAPI;
    } catch (importError) {
      return res.status(500).json({
        error: 'Failed to import Commerce API client',
        details: importError.message
      });
    }

    // Fetch commerce products
    const commerceProducts = await zohoAPI.getProducts();
    console.log(`Fetched ${commerceProducts.length} commerce products`);

    const analysis = {
      total_commerce_products: commerceProducts.length,
      sample_products: [],
      field_analysis: {
        all_unique_fields: new Set(),
        sku_field_variations: [],
        name_field_variations: [],
        id_field_variations: [],
        image_field_variations: []
      },
      products_with_images: 0,
      products_with_sku: 0
    };

    // Analyze first 10 products
    commerceProducts.slice(0, 10).forEach((product, index) => {
      console.log(`\n--- Commerce Product ${index + 1} ---`);
      
      const productInfo = {
        index: index + 1,
        all_fields: Object.keys(product),
        field_values: {}
      };

      // Check all fields for this product
      Object.keys(product).forEach(key => {
        analysis.field_analysis.all_unique_fields.add(key);
        
        // Store the value for key fields
        if (key.toLowerCase().includes('sku') || 
            key.toLowerCase().includes('code') ||
            key.toLowerCase().includes('id') ||
            key.toLowerCase().includes('name') ||
            key.toLowerCase().includes('image')) {
          productInfo.field_values[key] = product[key];
        }
        
        // Track field variations
        const keyLower = key.toLowerCase();
        if (keyLower.includes('sku')) {
          analysis.field_analysis.sku_field_variations.push(key);
        }
        if (keyLower.includes('name')) {
          analysis.field_analysis.name_field_variations.push(key);
        }
        if (keyLower.includes('id')) {
          analysis.field_analysis.id_field_variations.push(key);
        }
        if (keyLower.includes('image')) {
          analysis.field_analysis.image_field_variations.push(key);
        }
      });

      // Check for images
      const hasImages = product.product_images && Array.isArray(product.product_images) && product.product_images.length > 0;
      if (hasImages) {
        analysis.products_with_images++;
        productInfo.images = product.product_images;
        productInfo.image_count = product.product_images.length;
      }

      // Check for SKU-like fields
      const skuFields = ['sku', 'product_sku', 'item_sku', 'code', 'product_code', 'item_code'];
      let foundSKU = false;
      skuFields.forEach(field => {
        if (product[field] && product[field] !== '') {
          foundSKU = true;
          productInfo.sku_field = field;
          productInfo.sku_value = product[field];
        }
      });
      
      if (foundSKU) analysis.products_with_sku++;

      console.log(`Product fields: ${Object.keys(product).join(', ')}`);
      console.log(`Has images: ${hasImages}`);
      console.log(`Found SKU: ${foundSKU}`);
      
      analysis.sample_products.push(productInfo);
    });

    // Convert Sets to Arrays
    analysis.field_analysis.all_unique_fields = Array.from(analysis.field_analysis.all_unique_fields);
    analysis.field_analysis.sku_field_variations = [...new Set(analysis.field_analysis.sku_field_variations)];
    analysis.field_analysis.name_field_variations = [...new Set(analysis.field_analysis.name_field_variations)];
    analysis.field_analysis.id_field_variations = [...new Set(analysis.field_analysis.id_field_variations)];
    analysis.field_analysis.image_field_variations = [...new Set(analysis.field_analysis.image_field_variations)];

    // Test specific products that we know should have images
    const testSKUs = ['900980', 'B0B711GG7N', 'B0B8M5F3VR', 'B09NDDH6S8'];
    const testMatches = [];
    
    testSKUs.forEach(testSKU => {
      const matchingProducts = commerceProducts.filter(product => {
        // Check multiple possible SKU fields
        const skuFields = ['sku', 'product_sku', 'item_sku', 'code', 'product_code', 'item_code'];
        return skuFields.some(field => 
          product[field] && product[field].toString().toLowerCase() === testSKU.toLowerCase()
        );
      });
      
      testMatches.push({
        test_sku: testSKU,
        matches_found: matchingProducts.length,
        matching_products: matchingProducts.map(p => ({
          product_id: p.product_id,
          product_name: p.product_name,
          all_fields: Object.keys(p),
          has_images: !!(p.product_images && p.product_images.length > 0)
        }))
      });
    });

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ...analysis,
      test_sku_matches: testMatches,
      recommendations: [
        analysis.products_with_images > 0 ? 
          `✅ Found ${analysis.products_with_images} products with images in Commerce API` :
          '❌ No products with images found in Commerce API',
        analysis.products_with_sku > 0 ?
          `✅ Found ${analysis.products_with_sku} products with SKU fields` :
          '❌ No products with SKU fields found',
        '🔍 Check the field_analysis section to see what fields are available',
        '🔍 Check test_sku_matches to see if any known SKUs match'
      ]
    });

  } catch (error) {
    console.error('Commerce debug failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}