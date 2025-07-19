// src/pages/api/products.js - COMPLETE REPLACEMENT FILE
// This removes size restrictions and fixes image display issues

import { zohoInventoryAPI } from '../../lib/zoho-api-inventory';
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 Starting products API with full-size image system...');
    
    const startTime = Date.now();

    // Step 1: Get products from Inventory API (has custom fields)
    console.log('📦 Fetching products from Zoho Inventory API...');
    const inventoryProducts = await fetchInventoryProducts();
    console.log(`✅ Retrieved ${inventoryProducts.length} total inventory products`);

    // Step 2: Get products from Commerce API (has images)
    console.log('🖼️ Fetching products from Zoho Commerce API for images...');
    const commerceProducts = await zohoAPI.getProducts();
    console.log(`✅ Retrieved ${commerceProducts.length} commerce products`);

    // Step 3: Filter inventory products by cf_display_in_app custom field
    console.log('🔍 Filtering products by cf_display_in_app field...');
    const filteredProducts = filterProductsByDisplayInApp(inventoryProducts);
    console.log(`✅ Found ${filteredProducts.length} products with display_in_app=true`);

    // Step 4: Merge inventory products with commerce images
    console.log('🔄 Merging inventory products with commerce images...');
    const mergedProducts = mergeInventoryWithCommerceImagesBySKU(filteredProducts, commerceProducts);

    // Step 5: Transform to expected frontend format
    console.log('🎨 Transforming products to frontend format...');
    const transformedProducts = transformProducts(mergedProducts);

    // Step 6: Filter out inactive products
    const activeProducts = transformedProducts.filter(product => 
      product.status === 'active' || product.status === 'Active' || !product.status
    );

    const processingTime = Date.now() - startTime;
    console.log(`✅ Products API completed in ${processingTime}ms`);
    console.log(`Final result: ${activeProducts.length} active products with display_in_app=true`);
    
    // Add debug info for the first few products
    if (activeProducts.length > 0) {
      console.log('Sample product structure:', {
        id: activeProducts[0].product_id,
        name: activeProducts[0].product_name,
        sku: activeProducts[0].sku,
        price: activeProducts[0].product_price,
        hasImages: (activeProducts[0].product_images?.length || 0) > 0,
        imageCount: activeProducts[0].product_images?.length || 0,
        sampleImageUrl: activeProducts[0].product_images?.[0],
        cf_display_in_app: activeProducts[0].cf_display_in_app,
        status: activeProducts[0].status
      });
    }
    
    res.status(200).json({ 
      products: activeProducts,
      meta: {
        total_inventory_products: inventoryProducts.length,
        display_in_app_products: filteredProducts.length,
        active_display_products: activeProducts.length,
        commerce_products_fetched: commerceProducts.length,
        products_with_images: activeProducts.filter(p => p.product_images?.length > 0).length,
        timestamp: new Date().toISOString(),
        api_approach: 'inventory_commerce_hybrid',
        custom_field_filter: 'cf_display_in_app = true',
        matching_strategy: 'SKU',
        image_mode: 'full_size_no_restrictions'
      }
    });
  } catch (error) {
    console.error('Products API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch products',
      details: error.message,
      timestamp: new Date().toISOString(),
      errorType: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Fetch products from Zoho Inventory API
 */
async function fetchInventoryProducts() {
  if (zohoInventoryAPI) {
    return await zohoInventoryAPI.getInventoryProducts();
  }
  
  throw new Error('Zoho Inventory API not available');
}

/**
 * Filter products based on cf_display_in_app custom field
 */
function filterProductsByDisplayInApp(products) {
  console.log(`🔍 Filtering ${products.length} products for display_in_app=true`);
  
  return products.filter(product => {
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
 * Merge inventory products with commerce images using multiple matching strategies
 */
function mergeInventoryWithCommerceImagesBySKU(inventoryProducts, commerceProducts) {
  console.log(`🔗 Merging ${inventoryProducts.length} inventory products with ${commerceProducts.length} commerce products`);
  
  // Create lookup maps for different matching strategies
  const commerceByProductId = new Map();
  const commerceByName = new Map();
  let totalCommerceImagesFound = 0;
  
  commerceProducts.forEach(commerceProduct => {
    // Strategy 1: Match by product ID
    if (commerceProduct.product_id) {
      commerceByProductId.set(commerceProduct.product_id, commerceProduct);
    }
    
    // Strategy 2: Match by name (backup)
    if (commerceProduct.product_name && commerceProduct.product_name.trim() !== '') {
      const nameKey = commerceProduct.product_name.trim().toLowerCase();
      commerceByName.set(nameKey, commerceProduct);
    }
    
    // Count images
    if (commerceProduct.product_images && commerceProduct.product_images.length > 0) {
      totalCommerceImagesFound += commerceProduct.product_images.length;
    }
  });
  
  console.log(`Created lookup maps:`);
  console.log(`- Commerce by Product ID: ${commerceByProductId.size} entries`);
  console.log(`- Commerce by Name: ${commerceByName.size} entries`);
  console.log(`- Total commerce images found: ${totalCommerceImagesFound}`);
  
  // Merge inventory with commerce data
  const mergedProducts = inventoryProducts.map(inventoryProduct => {
    let commerceMatch = null;
    let matchingStrategy = 'none';
    
    // Try matching by product ID first
    if (inventoryProduct.item_id && commerceByProductId.has(inventoryProduct.item_id)) {
      commerceMatch = commerceByProductId.get(inventoryProduct.item_id);
      matchingStrategy = 'product_id';
    }
    
    // Fall back to name matching if no product ID match
    if (!commerceMatch && inventoryProduct.name) {
      const nameKey = inventoryProduct.name.trim().toLowerCase();
      if (commerceByName.has(nameKey)) {
        commerceMatch = commerceByName.get(nameKey);
        matchingStrategy = 'name';
      }
    }
    
    // Extract images from commerce match
    let commerceImages = [];
    if (commerceMatch) {
      console.log(`🔍 Extracting images for product ${inventoryProduct.item_id} (${inventoryProduct.name})`);
      commerceImages = extractCommerceImages(commerceMatch);
    }
    
    return {
      ...inventoryProduct,
      commerce_images: commerceImages,
      has_commerce_match: !!commerceMatch,
      commerce_product_id: commerceMatch?.product_id,
      matching_strategy: matchingStrategy,
      matching_sku: commerceMatch?.sku || commerceMatch?.product_name
    };
  });
  
  const withImages = mergedProducts.filter(p => p.commerce_images?.length > 0);
  console.log(`✅ Merger complete: ${withImages.length}/${mergedProducts.length} products have images`);
  
  return mergedProducts;
}

/**
 * 🎯 CRITICAL FIX: Extract full-size images without any size restrictions
 * This function now removes ALL size parameters from image URLs
 */
function extractCommerceImages(product) {
  const images = [];
  
  // Check for documents array which may contain image filenames
  if (product.documents && Array.isArray(product.documents)) {
    console.log(`Found ${product.documents.length} documents`);
    product.documents.forEach(doc => {
      if (doc.document_name && isImageFile(doc.document_name)) {
        // 🎯 FULL-SIZE: Remove the /400x400 completely for maximum quality
        const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.document_name}/${product.product_id}?storefront_domain=www.traveldatawifi.com`;
        images.push(imageUrl);
        console.log(`✅ Constructed FULL-SIZE CDN image: ${imageUrl}`);
      }
    });
  }
  
  // Check for variants with documents
  if (product.variants && Array.isArray(product.variants)) {
    product.variants.forEach(variant => {
      if (variant.documents && Array.isArray(variant.documents)) {
        variant.documents.forEach(doc => {
          if (doc.document_name && isImageFile(doc.document_name)) {
            // 🎯 FULL-SIZE: No size restrictions on variant images either
            const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.document_name}/${product.product_id}?storefront_domain=www.traveldatawifi.com`;
            images.push(imageUrl);
            console.log(`✅ Constructed FULL-SIZE variant CDN image: ${imageUrl}`);
          }
        });
      }
    });
  }
  
  // Check for document_name field (single image)
  if (product.document_name && isImageFile(product.document_name)) {
    const imageUrl = `https://us.zohocommercecdn.com/product-images/${product.document_name}/${product.product_id}?storefront_domain=www.traveldatawifi.com`;
    images.push(imageUrl);
    console.log(`✅ Constructed FULL-SIZE single CDN image: ${imageUrl}`);
  }
  
  // If no images found, provide debugging info
  if (images.length === 0 && product.product_id) {
    console.log(`⚠️ No image files found for product ${product.product_id} (${product.product_name || product.name})`);
    
    const availableFields = Object.keys(product).filter(key => 
      key.toLowerCase().includes('image') || 
      key.toLowerCase().includes('document') || 
      key.toLowerCase().includes('file')
    );
    console.log(`Available image/document fields: ${availableFields.join(', ')}`);
    
    if (product.documents) {
      console.log(`Documents structure:`, JSON.stringify(product.documents.slice(0, 1), null, 2));
    }
  }
  
  return [...new Set(images)]; // Remove duplicates
}

/**
 * Transform merged products to expected frontend format
 */
function transformProducts(products) {
  return products.map(product => {
    // Get full-size images without any transformation
    let productImages = [];
    
    if (product.commerce_images && Array.isArray(product.commerce_images) && product.commerce_images.length > 0) {
      productImages = product.commerce_images; // Use as-is, they're already full-size
      console.log(`✅ Using ${productImages.length} FULL-SIZE images for ${product.name}`);
    } else {
      console.log(`⚠️ No commerce images found for ${product.name}`);
    }
    
    return {
      // Use Inventory API field names as primary
      product_id: product.item_id,
      product_name: product.name,
      product_price: product.rate || 0,
      product_description: product.description || '',
      
      // Use the full-size images
      product_images: productImages,
      
      // Stock/inventory information from Inventory API
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
      product_type: product.product_type,
      show_in_storefront: product.show_in_storefront,
      
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
      
      // Debug info
      has_commerce_images: productImages.length > 0,
      has_commerce_match: product.has_commerce_match,
      commerce_product_id: product.commerce_product_id,
      matching_sku: product.matching_sku,
      image_source: 'full_size_no_restrictions'
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
  
  const parsed = typeof stockValue === 'string' ? parseFloat(stockValue) : Number(stockValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Check if filename is an image file
 */
function isImageFile(filename) {
  if (!filename || typeof filename !== 'string') return false;
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const lowerFilename = filename.toLowerCase();
  
  return imageExtensions.some(ext => lowerFilename.endsWith(ext));
}