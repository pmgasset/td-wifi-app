// ===== src/pages/api/diagnose-image-issues.js =====
// Comprehensive diagnostic tool to identify and fix Zoho image issues

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Starting comprehensive image diagnostic...');
    
    const results = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        zohoStoreId: process.env.ZOHO_STORE_ID ? 'present' : 'missing',
        zohoClientId: process.env.ZOHO_CLIENT_ID ? 'present' : 'missing',
        zohoRefreshToken: process.env.ZOHO_REFRESH_TOKEN ? 'present' : 'missing'
      },
      tests: {},
      recommendations: [],
      workingSolutions: []
    };

    // Get access token
    const token = await getAccessToken();
    if (!token) {
      return res.status(500).json({
        error: 'Failed to get Zoho access token',
        details: 'Check your ZOHO credentials'
      });
    }

    // Test 1: Get a product with known images from Inventory API
    console.log('\n=== TEST 1: INVENTORY API PRODUCTS ===');
    const inventoryProducts = await testInventoryAPI(token);
    results.tests.inventoryAPI = inventoryProducts;

    // Find a product ID that has documents/images
    const productWithImages = inventoryProducts.products?.find(p => 
      p.documents && p.documents.length > 0
    );

    if (!productWithImages) {
      results.recommendations.push('❌ No products with documents found in Inventory API');
      results.recommendations.push('🔧 Check if products have images uploaded in Zoho Inventory');
      return res.status(200).json(results);
    }

    const testProductId = productWithImages.item_id;
    console.log(`Using product ID ${testProductId} for image testing`);

    // Test 2: Multiple Commerce API endpoints
    console.log('\n=== TEST 2: COMMERCE API ENDPOINTS ===');
    const commerceTests = await testCommerceEndpoints(token, testProductId);
    results.tests.commerceAPI = commerceTests;

    // Test 3: Direct CDN image construction
    console.log('\n=== TEST 3: CDN IMAGE CONSTRUCTION ===');
    const cdnTests = await testCDNImageConstruction(productWithImages);
    results.tests.cdnConstruction = cdnTests;

    // Test 4: Live site image analysis
    console.log('\n=== TEST 4: LIVE SITE ANALYSIS ===');
    const liveAnalysis = await analyzeLiveSiteImages();
    results.tests.liveSiteAnalysis = liveAnalysis;

    // Generate recommendations based on results
    generateRecommendations(results);

    return res.status(200).json(results);

  } catch (error) {
    console.error('Diagnostic failed:', error);
    return res.status(500).json({
      error: 'Diagnostic failed',
      details: error.message,
      stack: error.stack
    });
  }
}

async function getAccessToken() {
  try {
    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    return null;
  }
}

async function testInventoryAPI(token) {
  try {
    const response = await fetch(
      `https://inventory.zoho.com/api/v1/items?organization_id=${process.env.ZOHO_STORE_ID}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      return { success: false, error: `${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    const productsWithImages = data.items?.filter(item => 
      item.documents && item.documents.length > 0
    );

    return {
      success: true,
      totalProducts: data.items?.length || 0,
      productsWithDocuments: productsWithImages?.length || 0,
      products: data.items || [],
      sampleProductWithImages: productsWithImages?.[0] || null
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testCommerceEndpoints(token, productId) {
  const endpoints = [
    {
      name: 'Commerce Store API',
      url: `https://commerce.zoho.com/store/api/v1/products/${productId}`,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Commerce Editpage API',
      url: `https://commerce.zoho.com/store/api/v1/products/editpage?product_id=${productId}`,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Commerce Storefront API',
      url: `https://commerce.zoho.com/storefront/api/v1/products/${productId}?format=json`,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'domain-name': 'traveldatawifi.zohostore.com',
        'Content-Type': 'application/json'
      }
    }
  ];

  const results = {};

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.name}...`);
      
      const response = await fetch(endpoint.url, {
        method: 'GET',
        headers: endpoint.headers
      });

      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      const product = responseData?.product || responseData?.payload?.product || responseData;
      
      results[endpoint.name] = {
        success: response.ok,
        status: response.status,
        url: endpoint.url,
        hasProduct: !!product,
        imageFields: extractImageFields(product),
        imageCount: countImages(product),
        rawResponse: responseData
      };

      if (response.ok && countImages(product) > 0) {
        console.log(`✅ ${endpoint.name} found ${countImages(product)} images`);
      } else {
        console.log(`❌ ${endpoint.name} - no images found`);
      }

    } catch (error) {
      results[endpoint.name] = {
        success: false,
        error: error.message
      };
      console.log(`❌ ${endpoint.name} failed: ${error.message}`);
    }
  }

  return results;
}

function extractImageFields(product) {
  if (!product) return {};
  
  const imageFields = {};
  
  // Check common image field names
  const fieldNames = ['images', 'product_images', 'documents', 'document_images'];
  fieldNames.forEach(field => {
    if (product[field]) {
      imageFields[field] = {
        type: Array.isArray(product[field]) ? 'array' : typeof product[field],
        count: Array.isArray(product[field]) ? product[field].length : 1,
        value: product[field]
      };
    }
  });

  return imageFields;
}

function countImages(product) {
  if (!product) return 0;
  
  let count = 0;
  
  if (product.images && Array.isArray(product.images)) {
    count += product.images.length;
  }
  
  if (product.product_images && Array.isArray(product.product_images)) {
    count += product.product_images.length;
  }
  
  if (product.documents && Array.isArray(product.documents)) {
    count += product.documents.filter(doc => isImageDocument(doc)).length;
  }

  return count;
}

function isImageDocument(doc) {
  if (!doc) return false;
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  
  if (doc.file_name) {
    return imageExtensions.some(ext => 
      doc.file_name.toLowerCase().includes(ext)
    );
  }
  
  if (doc.document_name) {
    return imageExtensions.some(ext => 
      doc.document_name.toLowerCase().includes(ext)
    );
  }
  
  return false;
}

async function testCDNImageConstruction(product) {
  const cdnPatterns = [
    'https://us.zohocommercecdn.com/product-images/',
    'https://zohocommercecdn.com/product-images/',
    'https://commerce.zoho.com/product-images/',
    'https://traveldatawifi.zohostore.com/product-images/'
  ];

  const results = {
    attemptedUrls: [],
    workingUrls: [],
    patterns: cdnPatterns
  };

  if (!product.documents || !Array.isArray(product.documents)) {
    return { ...results, error: 'No documents array found in product' };
  }

  for (const doc of product.documents) {
    if (!isImageDocument(doc)) continue;

    const filename = doc.file_name || doc.document_name;
    if (!filename) continue;

    for (const pattern of cdnPatterns) {
      const testUrls = [
        `${pattern}${filename}`,
        `${pattern}${filename}/${product.item_id}`,
        `${pattern}${doc.document_id}`,
        `${pattern}${filename}/${product.item_id}/400x400`,
        `${pattern}${filename}?storefront_domain=traveldatawifi.zohostore.com`
      ];

      for (const url of testUrls) {
        results.attemptedUrls.push(url);
        
        try {
          // Quick HEAD request to test if image exists
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) {
            results.workingUrls.push({
              url,
              status: response.status,
              contentType: response.headers.get('content-type')
            });
            console.log(`✅ Working CDN URL: ${url}`);
          }
        } catch (error) {
          // URL doesn't work, continue
        }
      }
    }
  }

  return results;
}

async function analyzeLiveSiteImages() {
  try {
    const response = await fetch('https://app.traveldatawifi.com');
    if (!response.ok) {
      return { success: false, error: 'Could not fetch live site' };
    }

    const html = await response.text();
    
    // Extract image URLs from HTML
    const imageRegex = /<img[^>]+src="([^"]+)"/gi;
    const images = [];
    let match;
    
    while ((match = imageRegex.exec(html)) !== null) {
      images.push(match[1]);
    }

    // Analyze image patterns
    const patterns = {
      zohoCommerce: images.filter(img => img.includes('zoho')),
      localImages: images.filter(img => img.startsWith('/') || img.includes('traveldatawifi')),
      externalCDN: images.filter(img => img.includes('cdn') && !img.includes('zoho')),
      dataUrls: images.filter(img => img.startsWith('data:')),
      other: images.filter(img => !img.includes('zoho') && !img.startsWith('/') && !img.includes('cdn') && !img.startsWith('data:'))
    };

    return {
      success: true,
      totalImages: images.length,
      patterns,
      sampleImages: images.slice(0, 5)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function generateRecommendations(results) {
  const { tests, recommendations, workingSolutions } = results;

  // Check if any Commerce API endpoints work
  const workingCommerceEndpoint = Object.entries(tests.commerceAPI || {})
    .find(([name, result]) => result.success && result.imageCount > 0);

  if (workingCommerceEndpoint) {
    const [endpointName, endpointResult] = workingCommerceEndpoint;
    recommendations.push(`✅ Working endpoint found: ${endpointName}`);
    recommendations.push(`🖼️ Found ${endpointResult.imageCount} images`);
    workingSolutions.push({
      type: 'commerce_api',
      endpoint: endpointName,
      url: endpointResult.url,
      implementation: generateImplementationCode(endpointName, endpointResult)
    });
  }

  // Check CDN construction results
  if (tests.cdnConstruction?.workingUrls?.length > 0) {
    recommendations.push(`✅ Working CDN URLs found: ${tests.cdnConstruction.workingUrls.length}`);
    workingSolutions.push({
      type: 'cdn_construction',
      workingUrls: tests.cdnConstruction.workingUrls,
      implementation: generateCDNImplementationCode()
    });
  }

  // Check live site patterns
  if (tests.liveSiteAnalysis?.success) {
    const { patterns } = tests.liveSiteAnalysis;
    if (patterns.zohoCommerce.length > 0) {
      recommendations.push('🔗 Live site uses Zoho Commerce images');
      recommendations.push('💡 Consider reverse-engineering the live site image URLs');
    }
  }

  // Generate fallback recommendations
  if (workingSolutions.length === 0) {
    recommendations.push('❌ No working image solutions found automatically');
    recommendations.push('🔧 Manual intervention required:');
    recommendations.push('   1. Check if images are actually uploaded in Zoho admin');
    recommendations.push('   2. Verify product IDs match between Inventory and Commerce');
    recommendations.push('   3. Consider using file upload to serve images locally');
    recommendations.push('   4. Contact Zoho support for API documentation');
  }
}

function generateImplementationCode(endpointName, endpointResult) {
  return `
// Implementation for ${endpointName}
async function getProductImages(productId) {
  const response = await fetch('${endpointResult.url.replace(endpointResult.url.split('/').pop(), '${productId}')}', {
    headers: ${JSON.stringify(endpointResult.headers || {}, null, 4)}
  });
  
  const data = await response.json();
  const product = data.product || data.payload?.product || data;
  
  // Extract images based on this endpoint's structure
  return extractImagesFromProduct(product);
}`;
}

function generateCDNImplementationCode() {
  return `
// CDN-based image construction
function constructImageUrls(product) {
  const images = [];
  
  if (product.documents && Array.isArray(product.documents)) {
    product.documents.forEach(doc => {
      if (isImageFile(doc.file_name || doc.document_name)) {
        // Use the working CDN pattern found in diagnostics
        const imageUrl = constructCDNUrl(doc, product.item_id);
        images.push(imageUrl);
      }
    });
  }
  
  return images;
}`;
}