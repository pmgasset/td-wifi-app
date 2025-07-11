// ===== src/pages/api/debug-zoho-images.js =====
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== COMPREHENSIVE ZOHO IMAGE DEBUG ===');

    const results = {
      timestamp: new Date().toISOString(),
      apiTests: {},
      productAnalysis: {},
      imageFieldAnalysis: {},
      recommendations: []
    };

    // Step 1: Test different product endpoints to see response variations
    const productEndpoints = [
      { name: 'Standard Products', endpoint: '/products' },
      { name: 'Products with Images', endpoint: '/products?include=images' },
      { name: 'Products with Documents', endpoint: '/products?include=documents' },
      { name: 'Products with Media', endpoint: '/products?include=media' },
      { name: 'Products Full Details', endpoint: '/products?expand=all' },
      { name: 'Products with Files', endpoint: '/products?include=files' }
    ];

    for (const test of productEndpoints) {
      try {
        console.log(`Testing endpoint: ${test.endpoint}`);
        const response = await zohoAPI.apiRequest(test.endpoint);
        
        results.apiTests[test.name] = {
          success: true,
          endpoint: test.endpoint,
          productCount: response.products?.length || 0,
          responseKeys: Object.keys(response),
          firstProductKeys: response.products?.[0] ? Object.keys(response.products[0]) : [],
          hasDocuments: response.products?.[0]?.documents !== undefined,
          documentsStructure: response.products?.[0]?.documents || null,
          hasImages: response.products?.[0]?.images !== undefined,
          imagesStructure: response.products?.[0]?.images || null
        };

        console.log(`✓ ${test.name} - ${response.products?.length || 0} products`);
      } catch (error) {
        results.apiTests[test.name] = {
          success: false,
          endpoint: test.endpoint,
          error: error.message
        };
        console.log(`✗ ${test.name} - ${error.message}`);
      }
    }

    // Step 2: Get a specific product with different approaches
    console.log('\n=== TESTING INDIVIDUAL PRODUCT ENDPOINTS ===');
    
    // First get a product ID from the standard endpoint
    const productsResponse = await zohoAPI.apiRequest('/products');
    const sampleProductId = productsResponse.products?.[0]?.product_id;

    if (sampleProductId) {
      console.log(`Testing individual product: ${sampleProductId}`);
      
      const individualProductTests = [
        { name: 'Direct Product', endpoint: `/products/${sampleProductId}` },
        { name: 'Product with Images', endpoint: `/products/${sampleProductId}?include=images` },
        { name: 'Product with Documents', endpoint: `/products/${sampleProductId}?include=documents` },
        { name: 'Product Full', endpoint: `/products/${sampleProductId}?expand=all` },
        { name: 'Product Edit View', endpoint: `/products/${sampleProductId}/edit` }
      ];

      for (const test of individualProductTests) {
        try {
          console.log(`Testing: ${test.endpoint}`);
          const response = await zohoAPI.apiRequest(test.endpoint);
          
          const product = response.product || response;
          results.productAnalysis[test.name] = {
            success: true,
            endpoint: test.endpoint,
            productKeys: Object.keys(product),
            hasDocuments: 'documents' in product,
            documentsValue: product.documents,
            documentsType: typeof product.documents,
            documentsLength: Array.isArray(product.documents) ? product.documents.length : 'not array',
            
            hasImages: 'images' in product,
            imagesValue: product.images,
            imagesType: typeof product.images,
            
            hasVariants: 'variants' in product,
            variantDocuments: product.variants?.[0]?.documents || null,
            
            // Check for any field that might contain URLs
            urlFields: Object.keys(product).filter(key => {
              const value = product[key];
              return typeof value === 'string' && (
                value.includes('http') || 
                value.includes('.jpg') || 
                value.includes('.png') || 
                value.includes('.jpeg') ||
                value.includes('image') ||
                value.includes('photo')
              );
            }).map(key => ({ field: key, value: product[key] })),
            
            // Look for document-related fields
            documentFields: Object.keys(product).filter(key => 
              key.toLowerCase().includes('document') ||
              key.toLowerCase().includes('file') ||
              key.toLowerCase().includes('media') ||
              key.toLowerCase().includes('attachment')
            ).map(key => ({ field: key, value: product[key] }))
          };

          console.log(`✓ ${test.name} - Product retrieved`);
        } catch (error) {
          results.productAnalysis[test.name] = {
            success: false,
            endpoint: test.endpoint,
            error: error.message
          };
          console.log(`✗ ${test.name} - ${error.message}`);
        }
      }
    }

    // Step 3: Try to access documents/images directly
    console.log('\n=== TESTING DOCUMENT/IMAGE ENDPOINTS ===');
    
    const documentTests = [
      { name: 'All Documents', endpoint: '/documents' },
      { name: 'Product Documents', endpoint: `/products/${sampleProductId}/documents` },
      { name: 'All Images', endpoint: '/images' },
      { name: 'Product Images', endpoint: `/products/${sampleProductId}/images` },
      { name: 'Media Files', endpoint: '/media' },
      { name: 'File Uploads', endpoint: '/files' }
    ];

    for (const test of documentTests) {
      try {
        console.log(`Testing: ${test.endpoint}`);
        const response = await zohoAPI.apiRequest(test.endpoint);
        
        results.imageFieldAnalysis[test.name] = {
          success: true,
          endpoint: test.endpoint,
          responseKeys: Object.keys(response),
          hasData: Object.keys(response).some(key => Array.isArray(response[key]) && response[key].length > 0),
          dataStructure: response
        };

        console.log(`✓ ${test.name} - Response received`);
      } catch (error) {
        results.imageFieldAnalysis[test.name] = {
          success: false,
          endpoint: test.endpoint,
          error: error.message
        };
        console.log(`✗ ${test.name} - ${error.message}`);
      }
    }

    // Step 4: Analyze all successful responses for image patterns
    console.log('\n=== ANALYZING IMAGE PATTERNS ===');
    
    const allSuccessfulResponses = [
      ...Object.values(results.apiTests).filter(test => test.success),
      ...Object.values(results.productAnalysis).filter(test => test.success),
      ...Object.values(results.imageFieldAnalysis).filter(test => test.success)
    ];

    const imagePatterns = {
      documentsFound: false,
      imagesFound: false,
      urlFieldsFound: [],
      documentFieldsFound: [],
      possibleImageEndpoints: []
    };

    allSuccessfulResponses.forEach(response => {
      if (response.hasDocuments) imagePatterns.documentsFound = true;
      if (response.hasImages) imagePatterns.imagesFound = true;
      if (response.urlFields) imagePatterns.urlFieldsFound.push(...response.urlFields);
      if (response.documentFields) imagePatterns.documentFieldsFound.push(...response.documentFields);
    });

    results.imagePatterns = imagePatterns;

    // Step 5: Generate specific recommendations
    console.log('\n=== GENERATING RECOMMENDATIONS ===');
    
    if (imagePatterns.documentsFound) {
      results.recommendations.push('✅ Documents field exists in API response');
    } else {
      results.recommendations.push('❌ No documents field found in any endpoint');
    }

    if (imagePatterns.imagesFound) {
      results.recommendations.push('✅ Images field exists in API response');
    } else {
      results.recommendations.push('❌ No images field found in any endpoint');
    }

    if (imagePatterns.urlFieldsFound.length > 0) {
      results.recommendations.push(`🔗 Found URL fields: ${imagePatterns.urlFieldsFound.map(f => f.field).join(', ')}`);
    } else {
      results.recommendations.push('❌ No URL fields found that might contain image links');
    }

    // Check if we need to try different API approaches
    const workingEndpoints = Object.values(results.apiTests).filter(test => test.success);
    if (workingEndpoints.length === 0) {
      results.recommendations.push('❌ CRITICAL: No product endpoints are working');
    } else {
      results.recommendations.push(`✅ ${workingEndpoints.length} product endpoints working`);
    }

    // Specific recommendations based on findings
    if (!imagePatterns.documentsFound && !imagePatterns.imagesFound) {
      results.recommendations.push('🔧 Try: Check if images need to be specifically requested with query parameters');
      results.recommendations.push('🔧 Try: Use editpage endpoint instead of standard product endpoint');
      results.recommendations.push('🔧 Try: Check if images are stored in a separate microservice');
    }

    return res.status(200).json({
      ...results,
      nextSteps: [
        '1. Check which endpoints returned image data',
        '2. Look at the URL fields to see if they contain image links',
        '3. Try the recommended query parameters if documents field is empty',
        '4. Check if a different API version or endpoint is needed for images'
      ]
    });

  } catch (error) {
    console.error('Debug failed:', error);
    return res.status(500).json({
      error: 'Image debug failed',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}