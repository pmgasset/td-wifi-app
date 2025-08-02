// ===== src/pages/api/fix-zoho-images.js =====
import { zohoAPI } from '../../lib/zoho-api.old';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TESTING CORRECT ZOHO IMAGE ENDPOINTS ===');

    const results = {
      timestamp: new Date().toISOString(),
      tests: {},
      workingImageEndpoints: [],
      imageUrlPattern: null,
      recommendations: []
    };

    // Get access token
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Failed to get access token');
    }

    // Step 1: Get a sample product ID first
    console.log('Getting sample product...');
    const productsResponse = await zohoAPI.apiRequest('/products');
    const sampleProduct = productsResponse.products?.[0];
    const sampleProductId = sampleProduct?.product_id;

    if (!sampleProductId) {
      throw new Error('No products found to test with');
    }

    console.log(`Testing with product ID: ${sampleProductId}`);

    // Step 2: Test the specific images endpoint for this product
    console.log('\n=== TESTING PRODUCT IMAGES ENDPOINT ===');
    
    try {
      const imagesUrl = `https://commerce.zoho.com/store/api/v1/products/${sampleProductId}/images`;
      console.log(`Testing: ${imagesUrl}`);
      
      const imagesResponse = await fetch(imagesUrl, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
          'Content-Type': 'application/json'
        }
      });

      const imagesText = await imagesResponse.text();
      let imagesData = null;
      
      try {
        imagesData = JSON.parse(imagesText);
      } catch {
        imagesData = imagesText;
      }

      results.tests['Product Images Endpoint'] = {
        success: imagesResponse.ok,
        status: imagesResponse.status,
        url: imagesUrl,
        responseKeys: typeof imagesData === 'object' ? Object.keys(imagesData) : [],
        hasImages: !!(imagesData?.images || imagesData?.documents),
        imageCount: (imagesData?.images || imagesData?.documents)?.length || 0,
        imageStructure: imagesData?.images || imagesData?.documents || null,
        fullResponse: imagesData
      };

      if (imagesResponse.ok && (imagesData?.images || imagesData?.documents)) {
        results.workingImageEndpoints.push({
          endpoint: imagesUrl,
          type: 'Product Images API',
          imageCount: (imagesData?.images || imagesData?.documents)?.length || 0,
          images: imagesData?.images || imagesData?.documents || []
        });
        console.log(`✓ Product Images Endpoint - Found ${(imagesData?.images || imagesData?.documents)?.length || 0} images`);
      } else {
        console.log(`✗ Product Images Endpoint - ${imagesResponse.status}: ${imagesResponse.statusText}`);
      }
    } catch (error) {
      results.tests['Product Images Endpoint'] = {
        success: false,
        error: error.message
      };
      console.log(`✗ Product Images Endpoint - Error: ${error.message}`);
    }

    // Step 3: Test the storefront API (which showed images in the search results)
    console.log('\n=== TESTING STOREFRONT API ===');
    
    try {
      const storefrontUrl = `https://commerce.zoho.com/storefront/api/v1/products/${sampleProductId}?format=json`;
      console.log(`Testing: ${storefrontUrl}`);
      
      const storefrontResponse = await fetch(storefrontUrl, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'domain-name': 'your-store.zohostore.com', // This might need your actual domain
          'Content-Type': 'application/json'
        }
      });

      const storefrontText = await storefrontResponse.text();
      let storefrontData = null;
      
      try {
        storefrontData = JSON.parse(storefrontText);
      } catch {
        storefrontData = storefrontText;
      }

      const product = storefrontData?.payload?.product;
      
      results.tests['Storefront API'] = {
        success: storefrontResponse.ok,
        status: storefrontResponse.status,
        url: storefrontUrl,
        hasProduct: !!product,
        productKeys: product ? Object.keys(product) : [],
        hasDocuments: !!(product?.documents),
        documentsCount: product?.documents?.length || 0,
        documents: product?.documents || null,
        hasImages: !!(product?.images),
        imagesCount: product?.images?.length || 0,
        images: product?.images || null,
        hasVariantImages: !!(product?.variants?.[0]?.images),
        variantImages: product?.variants?.[0]?.images || null,
        fullResponse: storefrontData
      };

      if (storefrontResponse.ok && product) {
        let imageCount = 0;
        let images = [];
        
        // Collect images from documents
        if (product.documents && Array.isArray(product.documents)) {
          images.push(...product.documents.map(doc => ({
            type: 'document',
            document_id: doc.document_id,
            name: doc.name,
            url: `/product-images/${doc.document_id}`,
            fullUrl: `https://commerce.zoho.com/product-images/${doc.document_id}`,
            alter_text: doc.alter_text,
            is_featured: doc.is_featured
          })));
          imageCount += product.documents.length;
        }
        
        // Collect images from images array
        if (product.images && Array.isArray(product.images)) {
          images.push(...product.images.map(img => ({
            type: 'image',
            id: img.id,
            url: img.url,
            fullUrl: img.url.startsWith('http') ? img.url : `https://commerce.zoho.com${img.url}`,
            title: img.title,
            alternate_text: img.alternate_text,
            is_featured: img.is_featured
          })));
          imageCount += product.images.length;
        }
        
        // Collect images from variants
        if (product.variants && Array.isArray(product.variants)) {
          product.variants.forEach((variant, index) => {
            if (variant.images && Array.isArray(variant.images)) {
              images.push(...variant.images.map(img => ({
                type: 'variant_image',
                variant_index: index,
                id: img.id,
                url: img.url,
                fullUrl: img.url.startsWith('http') ? img.url : `https://commerce.zoho.com${img.url}`,
                title: img.title,
                alternate_text: img.alternate_text,
                is_featured: img.is_featured
              })));
              imageCount += variant.images.length;
            }
          });
        }
        
        if (imageCount > 0) {
          results.workingImageEndpoints.push({
            endpoint: storefrontUrl,
            type: 'Storefront API',
            imageCount: imageCount,
            images: images
          });
          console.log(`✓ Storefront API - Found ${imageCount} images`);
        } else {
          console.log(`✓ Storefront API - Product found but no images`);
        }
      } else {
        console.log(`✗ Storefront API - ${storefrontResponse.status}: ${storefrontResponse.statusText}`);
      }
    } catch (error) {
      results.tests['Storefront API'] = {
        success: false,
        error: error.message
      };
      console.log(`✗ Storefront API - Error: ${error.message}`);
    }

    // Step 4: Test the editpage endpoint (which might have more complete data)
    console.log('\n=== TESTING EDITPAGE ENDPOINT ===');
    
    try {
      const editpageUrl = `https://commerce.zoho.com/store/api/v1/products/editpage?product_id=${sampleProductId}`;
      console.log(`Testing: ${editpageUrl}`);
      
      const editpageResponse = await fetch(editpageUrl, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-store-organizationid': process.env.ZOHO_STORE_ID,
          'Content-Type': 'application/json'
        }
      });

      const editpageText = await editpageResponse.text();
      let editpageData = null;
      
      try {
        editpageData = JSON.parse(editpageText);
      } catch {
        editpageData = editpageText;
      }

      const product = editpageData?.product;
      
      results.tests['Editpage Endpoint'] = {
        success: editpageResponse.ok,
        status: editpageResponse.status,
        url: editpageUrl,
        hasProduct: !!product,
        productKeys: product ? Object.keys(product) : [],
        hasDocuments: !!(product?.documents),
        documentsCount: product?.documents?.length || 0,
        documents: product?.documents || null,
        fullResponse: editpageData
      };

      if (editpageResponse.ok && product && product.documents && product.documents.length > 0) {
        const images = product.documents.map(doc => ({
          type: 'editpage_document',
          document_id: doc.document_id,
          document_name: doc.document_name,
          file_name: doc.file_name,
          url: doc.image_url || `/product-images/${doc.document_id}`,
          fullUrl: doc.image_url || `https://commerce.zoho.com/product-images/${doc.document_id}`
        }));
        
        results.workingImageEndpoints.push({
          endpoint: editpageUrl,
          type: 'Editpage API',
          imageCount: product.documents.length,
          images: images
        });
        console.log(`✓ Editpage Endpoint - Found ${product.documents.length} documents`);
      } else {
        console.log(`✗ Editpage Endpoint - No documents found or request failed`);
      }
    } catch (error) {
      results.tests['Editpage Endpoint'] = {
        success: false,
        error: error.message
      };
      console.log(`✗ Editpage Endpoint - Error: ${error.message}`);
    }

    // Step 5: Analyze image URL patterns
    console.log('\n=== ANALYZING IMAGE URL PATTERNS ===');
    
    if (results.workingImageEndpoints.length > 0) {
      const allImages = results.workingImageEndpoints.flatMap(endpoint => endpoint.images);
      
      // Find common URL patterns
      const urlPatterns = new Set();
      allImages.forEach(img => {
        if (img.url) {
          if (img.url.includes('/product-images/')) {
            urlPatterns.add('product-images');
          }
          if (img.url.includes('/documents/')) {
            urlPatterns.add('documents');
          }
          if (img.url.includes('zohostore.com')) {
            urlPatterns.add('zohostore-domain');
          }
        }
      });
      
      results.imageUrlPattern = {
        foundPatterns: Array.from(urlPatterns),
        totalImages: allImages.length,
        sampleUrls: allImages.slice(0, 5).map(img => img.fullUrl || img.url)
      };
      
      console.log(`Found ${allImages.length} total images with patterns: ${Array.from(urlPatterns).join(', ')}`);
    }

    // Step 6: Generate recommendations
    console.log('\n=== GENERATING RECOMMENDATIONS ===');
    
    if (results.workingImageEndpoints.length === 0) {
      results.recommendations.push('❌ No image endpoints returned image data');
      results.recommendations.push('🔧 Check if products actually have images uploaded in Zoho Commerce admin');
      results.recommendations.push('🔧 Verify the product ID being tested has images');
    } else {
      results.recommendations.push(`✅ Found ${results.workingImageEndpoints.length} working image endpoint(s)`);
      
      const totalImages = results.workingImageEndpoints.reduce((sum, endpoint) => sum + endpoint.imageCount, 0);
      results.recommendations.push(`🖼️ Total images found: ${totalImages}`);
      
      // Recommend the best endpoint
      const bestEndpoint = results.workingImageEndpoints.reduce((best, current) => 
        current.imageCount > best.imageCount ? current : best
      );
      results.recommendations.push(`🎯 Best endpoint: ${bestEndpoint.type} (${bestEndpoint.imageCount} images)`);
      
      // Provide specific implementation guidance
      if (bestEndpoint.type === 'Storefront API') {
        results.recommendations.push('🔧 Use storefront API for product images - it provides the most complete image data');
        results.recommendations.push('🔧 Images are in both documents[] and images[] arrays');
        results.recommendations.push('🔧 URLs follow pattern: /product-images/{document_id}');
      } else if (bestEndpoint.type === 'Product Images API') {
        results.recommendations.push('🔧 Use dedicated /products/{id}/images endpoint');
      } else if (bestEndpoint.type === 'Editpage API') {
        results.recommendations.push('🔧 Use editpage endpoint for administrative access to images');
      }
    }

    return res.status(200).json({
      ...results,
      summary: {
        productTested: sampleProductId,
        endpointsTested: Object.keys(results.tests).length,
        workingImageEndpoints: results.workingImageEndpoints.length,
        totalImagesFound: results.workingImageEndpoints.reduce((sum, endpoint) => sum + endpoint.imageCount, 0)
      },
      nextSteps: [
        '1. Update your API client to use the working image endpoint',
        '2. Modify image URL extraction to use the correct URL pattern',
        '3. Test with a product that definitely has images in Zoho admin',
        '4. Update ProductImage component to handle the new image structure'
      ]
    });

  } catch (error) {
    console.error('Image fix test failed:', error);
    return res.status(500).json({
      error: 'Image fix test failed',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}

// Helper function to get access token
async function getAccessToken() {
  try {
    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}