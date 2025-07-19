// ===== src/pages/api/validate-image-system.js =====
// Comprehensive validation of the new image system

import { zohoImageClient } from '../../lib/zoho-image-client';
import { zohoInventoryAPI } from '../../lib/zoho-api-inventory';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productId, testAll = 'false' } = req.query;

  try {
    console.log('🧪 Starting image system validation...');
    
    const results = {
      timestamp: new Date().toISOString(),
      testConfig: {
        productId: productId || 'auto-detect',
        testAll: testAll === 'true'
      },
      tests: {},
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        issues: [],
        recommendations: []
      }
    };

    // Test 1: Environment Configuration
    results.tests.environmentConfig = await testEnvironmentConfig();
    updateSummary(results, 'environmentConfig');

    // Test 2: Image Client Initialization
    results.tests.imageClientInit = await testImageClientInitialization();
    updateSummary(results, 'imageClientInit');

    // Test 3: Find test product
    let testProductId = productId;
    if (!testProductId) {
      const productSearch = await findTestProduct();
      results.tests.productSearch = productSearch;
      updateSummary(results, 'productSearch');
      testProductId = productSearch.productId;
    }

    if (!testProductId) {
      results.summary.issues.push('No suitable test product found');
      return res.status(200).json(results);
    }

    // Test 4: Image Retrieval
    results.tests.imageRetrieval = await testImageRetrieval(testProductId);
    updateSummary(results, 'imageRetrieval');

    // Test 5: Image URL Validation
    if (results.tests.imageRetrieval.success && results.tests.imageRetrieval.images.length > 0) {
      results.tests.imageValidation = await testImageUrlValidation(results.tests.imageRetrieval.images);
      updateSummary(results, 'imageValidation');
    }

    // Test 6: Enhanced Products API
    results.tests.enhancedProductsAPI = await testEnhancedProductsAPI();
    updateSummary(results, 'enhancedProductsAPI');

    // Test 7: Performance Testing
    if (testAll === 'true') {
      results.tests.performanceTesting = await testPerformance(testProductId);
      updateSummary(results, 'performanceTesting');
    }

    // Generate final recommendations
    generateFinalRecommendations(results);

    console.log(`✅ Validation completed: ${results.summary.passedTests}/${results.summary.totalTests} tests passed`);

    return res.status(200).json(results);

  } catch (error) {
    console.error('❌ Validation failed:', error);
    return res.status(500).json({
      error: 'Image system validation failed',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}

async function testEnvironmentConfig() {
  const test = {
    name: 'Environment Configuration',
    success: true,
    details: {},
    issues: []
  };

  // Check required environment variables
  const requiredVars = [
    'ZOHO_CLIENT_ID',
    'ZOHO_CLIENT_SECRET', 
    'ZOHO_REFRESH_TOKEN',
    'ZOHO_STORE_ID'
  ];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    test.details[varName] = value ? 'present' : 'missing';
    
    if (!value) {
      test.success = false;
      test.issues.push(`Missing environment variable: ${varName}`);
    }
  }

  // Check optional variables
  const optionalVars = ['ZOHO_STORE_DOMAIN'];
  for (const varName of optionalVars) {
    const value = process.env[varName];
    test.details[varName] = value || 'using_default';
  }

  return test;
}

async function testImageClientInitialization() {
  const test = {
    name: 'Image Client Initialization',
    success: false,
    details: {},
    issues: []
  };

  try {
    // Test if image client can be instantiated
    if (!zohoImageClient) {
      test.issues.push('zohoImageClient is not available');
      return test;
    }

    // Test cache functionality
    const cacheStats = zohoImageClient.getCacheStats();
    test.details.cacheInitialized = true;
    test.details.cacheSize = cacheStats.size;

    test.success = true;
    test.details.clientAvailable = true;

  } catch (error) {
    test.issues.push(`Image client initialization failed: ${error.message}`);
    test.details.error = error.message;
  }

  return test;
}

async function findTestProduct() {
  const test = {
    name: 'Find Test Product',
    success: false,
    productId: null,
    details: {},
    issues: []
  };

  try {
    // Get products from inventory API
    const products = await zohoInventoryAPI.getInventoryProducts();
    test.details.totalProducts = products.length;

    // Find a product that has documents (likely to have images)
    const productWithDocs = products.find(p => 
      p.documents && p.documents.length > 0
    );

    if (productWithDocs) {
      test.success = true;
      test.productId = productWithDocs.item_id;
      test.details.selectedProduct = {
        id: productWithDocs.item_id,
        name: productWithDocs.name,
        documentsCount: productWithDocs.documents.length
      };
    } else {
      // Fall back to any product
      const anyProduct = products[0];
      if (anyProduct) {
        test.productId = anyProduct.item_id;
        test.details.selectedProduct = {
          id: anyProduct.item_id,
          name: anyProduct.name,
          documentsCount: 0
        };
        test.issues.push('Using product without documents for testing');
      } else {
        test.issues.push('No products found in inventory');
      }
    }

  } catch (error) {
    test.issues.push(`Failed to find test product: ${error.message}`);
    test.details.error = error.message;
  }

  return test;
}

async function testImageRetrieval(productId) {
  const test = {
    name: 'Image Retrieval',
    success: false,
    images: [],
    details: {},
    issues: []
  };

  try {
    const startTime = Date.now();
    
    // Test image retrieval with the enhanced client
    const images = await zohoImageClient.getProductImages(productId, {
      sizes: ['original', 'large'],
      fallbackToPlaceholder: false,
      maxRetries: 1
    });

    const endTime = Date.now();

    test.details.retrievalTimeMs = endTime - startTime;
    test.details.totalImagesFound = images.length;
    test.images = images;

    // Analyze results
    const sourceCounts = {};
    const workingImages = images.filter(img => img.isWorking !== false);
    
    images.forEach(img => {
      sourceCounts[img.source] = (sourceCounts[img.source] || 0) + 1;
    });

    test.details.sourceCounts = sourceCounts;
    test.details.workingImages = workingImages.length;
    test.details.workingPercentage = images.length > 0 ? 
      ((workingImages.length / images.length) * 100).toFixed(1) + '%' : '0%';

    if (images.length > 0) {
      test.success = true;
      console.log(`✅ Found ${images.length} images for product ${productId}`);
    } else {
      test.issues.push(`No images found for product ${productId}`);
    }

  } catch (error) {
    test.issues.push(`Image retrieval failed: ${error.message}`);
    test.details.error = error.message;
  }

  return test;
}

async function testImageUrlValidation(images) {
  const test = {
    name: 'Image URL Validation',
    success: false,
    details: {},
    issues: []
  };

  try {
    const validationResults = [];
    const maxTestImages = Math.min(images.length, 3); // Don't test too many

    for (let i = 0; i < maxTestImages; i++) {
      const image = images[i];
      const startTime = Date.now();

      try {
        const response = await fetch(image.url, { 
          method: 'HEAD',
          timeout: 10000 // 10 second timeout
        });

        const endTime = Date.now();

        validationResults.push({
          url: image.url,
          source: image.source,
          status: response.status,
          contentType: response.headers.get('content-type'),
          responseTimeMs: endTime - startTime,
          isValid: response.ok
        });

      } catch (error) {
        validationResults.push({
          url: image.url,
          source: image.source,
          error: error.message,
          isValid: false
        });
      }
    }

    test.details.validationResults = validationResults;
    test.details.totalTested = validationResults.length;
    test.details.validImages = validationResults.filter(r => r.isValid).length;
    test.details.invalidImages = validationResults.filter(r => !r.isValid).length;

    if (validationResults.some(r => r.isValid)) {
      test.success = true;
    } else {
      test.issues.push('No valid image URLs found');
    }

  } catch (error) {
    test.issues.push(`URL validation failed: ${error.message}`);
    test.details.error = error.message;
  }

  return test;
}

async function testEnhancedProductsAPI() {
  const test = {
    name: 'Enhanced Products API',
    success: false,
    details: {},
    issues: []
  };

  try {
    // Make a request to our enhanced products API
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/products`);
    
    if (!response.ok) {
      throw new Error(`Products API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    test.details.totalProducts = data.products?.length || 0;
    test.details.meta = data.meta;
    
    // Analyze image data in response
    const productsWithImages = data.products?.filter(p => p.has_images) || [];
    const totalImages = data.products?.reduce((sum, p) => sum + (p.image_count || 0), 0) || 0;

    test.details.productsWithImages = productsWithImages.length;
    test.details.totalImagesInAPI = totalImages;
    test.details.imageSuccessRate = data.meta?.image_success_rate || '0%';

    // Check for enhanced image data
    const sampleProduct = data.products?.[0];
    if (sampleProduct) {
      test.details.sampleProductStructure = {
        hasProductImages: !!sampleProduct.product_images,
        hasEnhancedImages: !!sampleProduct.enhanced_images,
        hasImageCount: typeof sampleProduct.image_count === 'number',
        hasImageSources: !!sampleProduct.image_sources
      };
    }

    test.success = true;

  } catch (error) {
    test.issues.push(`Enhanced Products API test failed: ${error.message}`);
    test.details.error = error.message;
  }

  return test;
}

async function testPerformance(productId) {
  const test = {
    name: 'Performance Testing',
    success: false,
    details: {},
    issues: []
  };

  try {
    console.log('🚀 Running performance tests...');

    // Test 1: Single product image retrieval speed
    const singleProductStart = Date.now();
    await zohoImageClient.getProductImages(productId);
    const singleProductTime = Date.now() - singleProductStart;

    // Test 2: Cache performance  
    const cachedStart = Date.now();
    await zohoImageClient.getProductImages(productId); // Should be cached
    const cachedTime = Date.now() - cachedStart;

    // Test 3: Multiple products (small batch)
    const multipleStart = Date.now();
    const products = await zohoInventoryAPI.getInventoryProducts();
    const testProducts = products.slice(0, 3); // Test first 3 products
    
    for (const product of testProducts) {
      await zohoImageClient.getProductImages(product.item_id);
    }
    const multipleTime = Date.now() - multipleStart;

    test.details = {
      singleProductTimeMs: singleProductTime,
      cachedRetrievalTimeMs: cachedTime,
      multipleProductsTimeMs: multipleTime,
      averageTimePerProduct: multipleTime / testProducts.length,
      cacheSpeedupFactor: Math.round(singleProductTime / Math.max(cachedTime, 1))
    };

    // Performance benchmarks
    const benchmarks = {
      singleProductAcceptable: singleProductTime < 5000, // 5 seconds
      cacheEffective: cachedTime < singleProductTime / 2,
      multipleProductsReasonable: (multipleTime / testProducts.length) < 3000 // 3 seconds per product
    };

    test.details.benchmarks = benchmarks;
    test.success = Object.values(benchmarks).every(Boolean);

    if (!test.success) {
      test.issues.push('Performance benchmarks not met');
      if (!benchmarks.singleProductAcceptable) {
        test.issues.push(`Single product retrieval too slow: ${singleProductTime}ms`);
      }
      if (!benchmarks.cacheEffective) {
        test.issues.push('Cache not providing significant speedup');
      }
      if (!benchmarks.multipleProductsReasonable) {
        test.issues.push('Multiple product processing too slow');
      }
    }

  } catch (error) {
    test.issues.push(`Performance testing failed: ${error.message}`);
    test.details.error = error.message;
  }

  return test;
}

function updateSummary(results, testName) {
  const test = results.tests[testName];
  if (!test) return;

  results.summary.totalTests++;
  
  if (test.success) {
    results.summary.passedTests++;
  } else {
    results.summary.failedTests++;
    results.summary.issues.push(...(test.issues || []));
  }
}

function generateFinalRecommendations(results) {
  const { summary, tests } = results;
  
  // Success rate analysis
  const successRate = summary.totalTests > 0 ? 
    (summary.passedTests / summary.totalTests * 100).toFixed(1) : 0;

  if (successRate >= 80) {
    summary.recommendations.push('✅ Image system is working well overall');
  } else if (successRate >= 60) {
    summary.recommendations.push('⚠️ Image system has some issues but is functional');
  } else {
    summary.recommendations.push('❌ Image system has significant issues that need attention');
  }

  // Specific recommendations based on test results
  if (!tests.environmentConfig?.success) {
    summary.recommendations.push('🔧 Fix environment variables configuration');
  }

  if (!tests.imageRetrieval?.success) {
    summary.recommendations.push('🔧 Debug image retrieval - check API endpoints and credentials');
  } else if (tests.imageRetrieval?.details?.workingImages === 0) {
    summary.recommendations.push('🔧 Images found but not accessible - check URLs and permissions');
  }

  if (tests.imageValidation && tests.imageValidation.details?.invalidImages > 0) {
    summary.recommendations.push('🔧 Some image URLs are invalid - implement better URL construction');
  }

  if (!tests.enhancedProductsAPI?.success) {
    summary.recommendations.push('🔧 Enhanced Products API needs debugging');
  }

  if (tests.performanceTesting && !tests.performanceTesting.success) {
    summary.recommendations.push('🔧 Optimize performance - consider caching and parallel processing');
  }

  // Success recommendations
  if (tests.imageRetrieval?.success && tests.imageRetrieval?.details?.workingImages > 0) {
    summary.recommendations.push('✅ Deploy the enhanced image system to production');
    summary.recommendations.push('✅ Update frontend components to use enhanced image data');
  }
}