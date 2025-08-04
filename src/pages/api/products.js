import { Redis } from '@upstash/redis'
import { zohoInventoryAPI } from '../../lib/zoho-api-inventory'
import { zohoAPI } from '../../lib/zoho-api'

const redis = Redis.fromEnv()
const CACHE_KEY = 'products:all'
const CACHE_TTL = 60 * 60 * 24 // 24 hours

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Try Redis cache first
    try {
      const cached = await redis.get(CACHE_KEY)
      if (cached) {
        console.log('✅ Products loaded from Redis cache')
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
        return res.status(200).json(parsed)
      }
      console.log('⚠️ Cache miss - fetching from Zoho APIs')
    } catch (redisError) {
      console.error('Redis error, falling back to Zoho API:', redisError)
    }

    const startTime = Date.now()

    // Step 1: Get products from Inventory API (has custom fields)
    console.log('📦 Fetching products from Zoho Inventory API...')
    const inventoryProducts = await zohoInventoryAPI.getInventoryProducts()
    console.log(`✅ Retrieved ${inventoryProducts.length} total inventory products`)

    // Step 2: Get products from Commerce API (has images)
    console.log('🖼️ Fetching products from Zoho Commerce API for images...')
    const commerceProducts = await zohoAPI.getProducts()
    console.log(`✅ Retrieved ${commerceProducts.length} commerce products`)

    // Step 3: Filter inventory products by cf_display_in_app custom field
    console.log('🔍 Filtering products by cf_display_in_app field...')
    const filteredProducts = filterProductsByDisplayInApp(inventoryProducts)
    console.log(`✅ Found ${filteredProducts.length} products with display_in_app=true`)

    // Step 4: Merge inventory products with commerce images
    console.log('🔄 Merging inventory products with commerce images...')
    const mergedProducts = mergeInventoryWithCommerceImages(filteredProducts, commerceProducts)

    // Step 5: Transform to expected frontend format
    console.log('🎨 Transforming products to frontend format...')
    const transformedProducts = transformProducts(mergedProducts)

    // Step 6: Filter out inactive products
    const activeProducts = transformedProducts.filter(product =>
      product.status === 'active' ||
      product.status === 'Active' ||
      !product.status
    )

    const processingTime = Date.now() - startTime
    console.log(`✅ Products API completed in ${processingTime}ms`)

    // Provide detailed statistics
    const imageStats = generateImageStatistics(activeProducts)

    const responsePayload = {
      products: activeProducts,
      meta: {
        total_inventory_products: inventoryProducts.length,
        display_in_app_products: filteredProducts.length,
        active_display_products: activeProducts.length,
        commerce_products_fetched: commerceProducts.length,
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
        api_version: '1.0_working_restore',
        source: 'zoho',
        ...imageStats
      }
    }

    // Cache the response for future requests
    try {
      await redis.set(CACHE_KEY, JSON.stringify(responsePayload), { ex: CACHE_TTL })
      console.log('🗄️ Cached products in Redis')
    } catch (cacheError) {
      console.error('Failed to cache products in Redis:', cacheError)
    }

    res.status(200).json(responsePayload)

  } catch (error) {
    console.error('❌ Products API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })

    res.status(500).json({
      error: 'Failed to fetch products',
      details: error.message,
      timestamp: new Date().toISOString(),
      errorType: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

/**
 * Filter products based on cf_display_in_app custom field
 */
function filterProductsByDisplayInApp(products) {
  console.log(`🔍 Filtering ${products.length} products for display_in_app=true`)

  return products.filter(product => {
    // Handle both formatted and unformatted custom field values
    const displayInAppString = product.cf_display_in_app
    const displayInAppBoolean = product.cf_display_in_app_unformatted

    const isDisplayInApp =
      displayInAppBoolean === true ||
      displayInAppString === 'true' ||
      displayInAppString === 'True' ||
      displayInAppString === 'TRUE' ||
      displayInAppString === '1' ||
      displayInAppString === 1

    if (isDisplayInApp) {
      console.log(`✅ Including ${product.item_id} (${product.name}) - cf_display_in_app: ${displayInAppString || displayInAppBoolean}`)
    }

    return isDisplayInApp
  })
}

/**
 * Merge inventory products with commerce images using ID matching
 */
function mergeInventoryWithCommerceImages(inventoryProducts, commerceProducts) {
  console.log(`🔗 Merging ${inventoryProducts.length} inventory products with ${commerceProducts.length} commerce products`)

  // Create lookup map for commerce products by product_id
  const commerceByProductId = new Map()
  let totalCommerceImagesFound = 0

  commerceProducts.forEach(commerceProduct => {
    if (commerceProduct.product_id) {
      commerceByProductId.set(commerceProduct.product_id, commerceProduct)

      // Count images by checking both product_images and documents
      const extractedImages = extractCommerceImages(commerceProduct)
      if (extractedImages.length > 0) {
        totalCommerceImagesFound += extractedImages.length
      }
    }
  })

  console.log(`📊 Commerce products mapped: ${commerceByProductId.size}, Total images: ${totalCommerceImagesFound}`)

  // Merge products
  let productIdMatches = 0
  let totalImagesAdded = 0

  const mergedProducts = inventoryProducts.map(inventoryProduct => {
    const matchingCommerceProduct = commerceByProductId.get(inventoryProduct.item_id)

    let commerce_images = []
    let matchStrategy = 'no_match'

    if (matchingCommerceProduct) {
      productIdMatches++
      matchStrategy = 'product_id'

      // Extract images using the working pattern from your project knowledge
      commerce_images = extractCommerceImages(matchingCommerceProduct)
      if (commerce_images.length > 0) {
        // Remove size restrictions to prevent cropping
        commerce_images = transformCommerceImages(commerce_images)
        totalImagesAdded += commerce_images.length
        console.log(`✅ Matched ${inventoryProduct.item_id}: ${commerce_images.length} images`)
      } else {
        console.log(`⚠️ No images extracted for ${inventoryProduct.item_id}`)
      }
    }

    const mergedProduct = {
      ...inventoryProduct,
      commerce_images,
      has_commerce_match: !!matchingCommerceProduct,
      commerce_product_id: matchingCommerceProduct?.product_id || null,
      match_strategy: matchStrategy
    }

    return mergedProduct
  })

  console.log(`\n=== MATCHING SUMMARY ===`)
  console.log(`Product ID matches: ${productIdMatches}`)
  console.log(`Total images added: ${totalImagesAdded}`)

  return mergedProducts
}

/**
 * Extract images using Zoho Commerce CDN pattern
 * Based on your test endpoints: images are in documents array, NOT product_images
 */
function extractCommerceImages(product) {
  const images = []

  console.log(`🔍 Extracting images for product ${product.product_id} (${product.product_name || product.name})`)

  // The key insight from your test endpoints: Images are in documents array!
  if (product.documents && Array.isArray(product.documents)) {
    console.log(`Found ${product.documents.length} documents`)
    product.documents.forEach(doc => {
      if (doc.file_name && isImageFile(doc.file_name) && doc.document_id) {
        // This is the EXACT pattern that works based on your test endpoints
        const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${doc.document_id}/400x400?storefront_domain=www.traveldatawifi.com`
        images.push(imageUrl)
        console.log(`✓ Constructed CDN image: ${imageUrl}`)
      }
    })
  }

  // Check for variants with documents (as shown in your test data)
  if (product.variants && Array.isArray(product.variants)) {
    product.variants.forEach(variant => {
      if (variant.documents && Array.isArray(variant.documents)) {
        variant.documents.forEach(doc => {
          if (doc.file_name && isImageFile(doc.file_name) && doc.document_id) {
            const imageUrl = `https://us.zohocommercecdn.com/product-images/${doc.file_name}/${doc.document_id}/400x400?storefront_domain=www.traveldatawifi.com`
            images.push(imageUrl)
            console.log(`✓ Constructed variant CDN image: ${imageUrl}`)
          }
        })
      }
    })
  }

  // If no images found, log available fields for debugging
  if (images.length === 0 && product.product_id) {
    console.log(`⚠️ No image files found for product ${product.product_id} (${product.product_name || product.name})`)

    const availableFields = Object.keys(product).filter(key =>
      key.toLowerCase().includes('image') ||
      key.toLowerCase().includes('document') ||
      key.toLowerCase().includes('file')
    )
    console.log(`Available image/document fields: ${availableFields.join(', ')}`)

    // Log the actual documents structure
    if (product.documents) {
      console.log(`Documents structure:`, JSON.stringify(product.documents.slice(0, 1), null, 2))
    }
  }

  return [...new Set(images)] // Remove duplicates
}

/**
 * Check if filename is an image file
 */
function isImageFile(filename) {
  if (!filename || typeof filename !== 'string') return false

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']
  const lowerFilename = filename.toLowerCase()

  return imageExtensions.some(ext => lowerFilename.endsWith(ext))
}

/**
 * Transform Commerce API images to provide full-size images
 * Removes size restrictions to prevent cropping - THIS FIXES YOUR CROPPING ISSUE
 */
function transformCommerceImages(commerceImages) {
  if (!commerceImages || !Array.isArray(commerceImages)) {
    return []
  }

  return commerceImages.map(imageUrl => {
    if (typeof imageUrl !== 'string') return imageUrl

    // Check if it's a Zoho Commerce CDN URL that has size parameters
    if (imageUrl.includes('zohocommercecdn.com') && imageUrl.includes('/400x400')) {
      // Remove the size parameter to get full-size image
      const fullSizeUrl = imageUrl.replace('/400x400', '')
      console.log(`🎨 Converted to full-size: ${imageUrl} -> ${fullSizeUrl}`)
      return fullSizeUrl
    } else if (imageUrl.includes('zohocommercecdn.com') && /\/\d+x\d+/.test(imageUrl)) {
      // Remove any size parameter (e.g., /300x300, /600x600, etc.)
      const fullSizeUrl = imageUrl.replace(/\/\d+x\d+/, '')
      console.log(`🎨 Converted to full-size: ${imageUrl} -> ${fullSizeUrl}`)
      return fullSizeUrl
    } else {
      // Return as-is if not a sized Zoho CDN URL
      return imageUrl
    }
  })
}

/**
 * Transform merged products to expected frontend format
 */
function transformProducts(products) {
  return products.map(product => {
    // Transform images to remove size restrictions
    let productImages = []

    if (product.commerce_images && Array.isArray(product.commerce_images) && product.commerce_images.length > 0) {
      productImages = product.commerce_images // Already transformed in merge step
      console.log(`✅ Using ${productImages.length} full-size images for ${product.name}`)
    } else {
      console.log(`⚠️ No commerce images found for ${product.name}`)
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

      // Custom fields (the whole reason we're using Inventory API)
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

      // Debug info (helpful for troubleshooting)
      has_commerce_images: productImages.length > 0,
      has_commerce_match: product.has_commerce_match,
      commerce_product_id: product.commerce_product_id,
      image_source: 'commerce_api_full_size'
    }
  })
}

/**
 * Parse stock information consistently
 */
function parseStock(stockValue) {
  if (stockValue === null || stockValue === undefined || stockValue === '') {
    return 0
  }

  const parsed = typeof stockValue === 'string' ? parseFloat(stockValue) : Number(stockValue)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Generate image statistics for the response
 */
function generateImageStatistics(products) {
  const productsWithImages = products.filter(p => p.has_commerce_images && p.product_images.length > 0)
  const totalImages = products.reduce((sum, p) => sum + (p.product_images?.length || 0), 0)

  return {
    products_with_images: productsWithImages.length,
    products_without_images: products.length - productsWithImages.length,
    total_images_found: totalImages,
    average_images_per_product: products.length > 0 ? (totalImages / products.length).toFixed(2) : 0,
    image_success_rate: products.length > 0 ? ((productsWithImages.length / products.length) * 100).toFixed(1) + '%' : '0%',
    image_source: 'zoho_commerce_cdn'
  }
}

