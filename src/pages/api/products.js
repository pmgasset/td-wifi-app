// ===== src/pages/api/products.js ===== (Updated version)
import { zohoInventoryAPI } from '../../lib/zoho-api-inventory';
import { zohoEnhancedImageClient } from '../../lib/zoho-enhanced-image-client';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 Starting enhanced products API with improved image handling...');
    
    const startTime = Date.now();

    // Step 1: Get products from Inventory API (has custom fields)
    console.log('📦 Fetching products from Zoho Inventory API...');
    const inventoryProducts = await zohoInventoryAPI.getInventoryProducts();
    console.log(`✅ Retrieved ${inventoryProducts.length} total inventory products`);

    // Step 2: Filter by cf_display_in_app custom field
    console.log('🔍 Filtering products by cf_display_in_app field...');
    const filteredProducts = filterProductsByDisplayInApp(inventoryProducts);
    console.log(`✅ Found ${filteredProducts.length} products with display_in_app=true`);

    // Step 3: Get images for each product using enhanced image client
    console.log('🖼️ Fetching images using enhanced image client...');
    const productsWithImages = await addImagesToProducts(filteredProducts);
    console.log(`✅ Added images to ${productsWithImages.length} products`);

    // Step 4: Transform to expected frontend format
    console.log('🔄 Transforming products to frontend format...');
    const transformedProducts = transformProducts(productsWithImages);

    // Step 5: Filter out inactive products
    const activeProducts = transformedProducts.filter(product => 
      product.status === 'active' || product.status === 'Active' || !product.status
    );

    const processingTime = Date.now() - startTime;
    console.log(`✅ Products API completed in ${processingTime}ms`);

    // Provide detailed statistics
    const imageStats = generateImageStatistics(activeProducts);

    res.status(200).json({ 
      products: activeProducts,
      meta: {
        total_inventory_products: inventoryProducts.length,
        display_in_app_products: filteredProducts.length,
        active_display_products: activeProducts.length,
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
        api_version: '2.0_enhanced_images',
        ...imageStats
      }
    });

  } catch (error) {
    console.error('❌ Enhanced Products API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch products with enhanced images',
      details: error.message,
      timestamp: new Date().toISOString(),
      errorType: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Filter products based on cf_display_in_app custom field
 */
function filterProductsByDisplayInApp(products) {
  console.log(`🔍 Filtering ${products.length} products for display_in_app=true`);
  
  return products.filter(product => {
    // Handle both formatted and unformatted custom field values
    const displayInAppString = product.cf_display_in_app;
    const displayInAppBoolean = product.cf_display_in_app_unformatted;
    
    const isDisplayInApp = 
      displayInAppBoolean === true ||
      displayInAppString === 'true' ||
      displayInAppString === 'True' ||
      displayInAppString === 'TRUE' ||
      displayInAppString === '1' ||
      displayInAppString === 1;
    
    if (isDisplayInApp) {
      console.log(`✅ Including ${product.item_id} (${product.name}) - cf_display_in_app: ${displayInAppString || displayInAppBoolean}`);
    }
    
    return isDisplayInApp;
  });
}

/**
 * Add images to products using the enhanced image client
 */
async function addImagesToProducts(products) {
  console.log(`🖼️ Processing images for ${products.length} products...`);
  
  const productsWithImages = [];
  let successCount = 0;
  let errorCount = 0;

  for (const product of products) {
    try {
      // Use the enhanced image client to get images with fallbacks
      const images = zohoEnhancedImageClient ? 
        await zohoEnhancedImageClient.getProductImages(product.item_id, {
          sizes: ['original', 'large', 'medium'],
          fallbackToPlaceholder: false,
          maxRetries: 2
        }) : [];

      // Filter to only working images
      const workingImages = images
        .filter(img => img.isWorking !== false)
        .map(img => img.url);

      const enhancedProduct = {
        ...product,
        enhanced_images: images, // Full image data with metadata
        product_images: workingImages, // Just the URLs for compatibility
        image_count: workingImages.length,
        image_sources: images.map(img => img.source),
        has_images: workingImages.length > 0
      };

      productsWithImages.push(enhancedProduct);
      successCount++;

      if (workingImages.length > 0) {
        console.log(`✅ ${product.item_id}: Found ${workingImages.length} images from sources: ${[...new Set(images.map(img => img.source))].join(', ')}`);
      } else {
        console.log(`⚠️ ${product.item_id}: No working images found`);
      }

    } catch (error) {
      console.error(`❌ Failed to get images for product ${product.item_id}:`, error.message);
      
      // Add product without images rather than failing completely
      productsWithImages.push({
        ...product,
        enhanced_images: [],
        product_images: [],
        image_count: 0,
        image_sources: [],
        has_images: false,
        image_error: error.message
      });
      
      errorCount++;
    }
  }

  console.log(`📊 Image processing results: ${successCount} success, ${errorCount} errors`);
  return productsWithImages;
}Images(product.item_id, {
        sizes: ['original', 'large', 'medium'],
        fallbackToPlaceholder: false,
        maxRetries: 2
      });

      // Filter to only working images
      const workingImages = images
        .filter(img => img.isWorking !== false)
        .map(img => img.url);

      const enhancedProduct = {
        ...product,
        enhanced_images: images, // Full image data with metadata
        product_images: workingImages, // Just the URLs for compatibility
        image_count: workingImages.length,
        image_sources: images.map(img => img.source),
        has_images: workingImages.length > 0
      };

      productsWithImages.push(enhancedProduct);
      successCount++;

      if (workingImages.length > 0) {
        console.log(`✅ ${product.item_id}: Found ${workingImages.length} images from sources: ${[...new Set(images.map(img => img.source))].join(', ')}`);
      } else {
        console.log(`⚠️ ${product.item_id}: No working images found`);
      }

    } catch (error) {
      console.error(`❌ Failed to get images for product ${product.item_id}:`, error.message);
      
      // Add product without images rather than failing completely
      productsWithImages.push({
        ...product,
        enhanced_images: [],
        product_images: [],
        image_count: 0,
        image_sources: [],
        has_images: false,
        image_error: error.message
      });
      
      errorCount++;
    }
  }

  console.log(`📊 Image processing results: ${successCount} success, ${errorCount} errors`);
  return productsWithImages;
}

/**
 * Transform products to expected frontend format
 */
function transformProducts(products) {
  return products.map(product => {
    return {
      // Primary product fields
      product_id: product.item_id,
      product_name: product.name,
      product_price: product.rate || 0,
      product_description: product.description || '',
      
      // Enhanced image data
      product_images: product.product_images || [],
      enhanced_images: product.enhanced_images || [],
      image_count: product.image_count || 0,
      image_sources: product.image_sources || [],
      has_images: product.has_images || false,
      
      // Stock/inventory information
      inventory_count: parseStock(product.stock_on_hand || product.available_stock),
      
      // Category information
      product_category: product.category_name || product.group_name || '',
      category_id: product.category_id || product.group_id,
      
      // Product status and visibility
      status: product.status,
      
      // SEO and URL
      seo_url: product.sku || product.item_id,
      
      // Custom fields
      cf_display_in_app: product.cf_display_in_app_unformatted || product.cf_display_in_app,
      
      // Additional fields
      sku: product.sku,
      item_type: product.item_type,
      
      // Pricing details
      rate: product.rate,
      purchase_rate: product.purchase_rate,
      
      // Stock details
      stock_on_hand: product.stock_on_hand,
      available_stock: product.available_stock,
      reorder_level: product.reorder_level,
      
      // Timestamps
      created_time: product.created_time,
      last_modified_time: product.last_modified_time,
      
      // Error handling
      image_error: product.image_error
    };
  });
}

/**
 * Parse stock information consistently
 */
function parseStock(stockValue) {
  if (stockValue === null || stockValue === undefined || stockValue === '') {
    return 0;
  }
  
  const parsed = typeof stockValue === 'string' ? 
    parseFloat(stockValue) : Number(stockValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Generate image statistics for the response
 */
function generateImageStatistics(products) {
  const productsWithImages = products.filter(p => p.has_images);
  const totalImages = products.reduce((sum, p) => sum + (p.image_count || 0), 0);
  
  // Count images by source
  const imageSourceCounts = {};
  products.forEach(product => {
    if (product.image_sources && Array.isArray(product.image_sources)) {
      product.image_sources.forEach(source => {
        imageSourceCounts[source] = (imageSourceCounts[source] || 0) + 1;
      });
    }
  });

  return {
    products_with_images: productsWithImages.length,
    products_without_images: products.length - productsWithImages.length,
    total_images_found: totalImages,
    average_images_per_product: products.length > 0 ? (totalImages / products.length).toFixed(2) : 0,
    image_source_breakdown: imageSourceCounts,
    image_success_rate: products.length > 0 ? 
      ((productsWithImages.length / products.length) * 100).toFixed(1) + '%' : '0%'
  };
}