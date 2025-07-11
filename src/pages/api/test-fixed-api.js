// ===== src/pages/api/test-fixed-api.js =====
import { zohoAPI } from '../../lib/zoho-api-fixed';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TESTING FIXED ZOHO COMMERCE API ===');
    console.log('Organization ID:', process.env.ZOHO_STORE_ID);
    console.log('API Base URL: https://commerce.zoho.com/store/api/v1');

    // Run the comprehensive debug
    const debugResult = await zohoAPI.debugSetup();
    
    console.log('Debug result:', debugResult);

    let imageAnalysis = null;
    
    // If we successfully got products, analyze the image structure
    if (debugResult.productsAccess && debugResult.sampleProduct) {
      const product = debugResult.sampleProduct;
      
      console.log('Analyzing product structure for images...');
      console.log('Sample product keys:', Object.keys(product));
      console.log('Full sample product:', JSON.stringify(product, null, 2));
      
      imageAnalysis = {
        productId: product.product_id,
        productName: product.product_name,
        
        // Check for different image field variations
        hasProductImages: 'product_images' in product,
        productImagesType: typeof product.product_images,
        productImagesValue: product.product_images,
        
        hasImages: 'images' in product,
        imagesType: typeof product.images,
        imagesValue: product.images,
        
        hasImage: 'image' in product,
        imageType: typeof product.image,
        imageValue: product.image,
        
        hasImageUrl: 'image_url' in product,
        imageUrlValue: product.image_url,
        
        hasPhoto: 'photo' in product,
        photoValue: product.photo,
        
        hasThumbnail: 'thumbnail' in product,
        thumbnailValue: product.thumbnail,
        
        // Check for Zoho-specific image fields
        hasDocuments: 'documents' in product,
        documentsValue: product.documents,
        
        hasGallery: 'gallery' in product,
        galleryValue: product.gallery,
        
        hasMedia: 'media' in product,
        mediaValue: product.media,
        
        // All product fields for investigation
        allProductFields: Object.keys(product),
        
        // Look for any field that might contain URLs
        urlFields: Object.keys(product).filter(key => 
          typeof product[key] === 'string' && 
          (product[key].includes('http') || product[key].includes('image') || product[key].includes('photo'))
        ).map(key => ({
          field: key,
          value: product[key]
        }))
      };

      console.log('Image analysis complete:', imageAnalysis);
    }

    // Generate recommendations based on results
    const recommendations = [];
    
    if (!debugResult.auth) {
      recommendations.push('❌ Authentication failed - check your Zoho credentials');
    } else {
      recommendations.push('✅ Authentication working with new API setup');
    }

    if (!debugResult.storeMetaAccess) {
      recommendations.push('❌ Store meta access failed');
    } else {
      recommendations.push('✅ Store meta access working - correct organization ID confirmed');
    }

    if (!debugResult.productsAccess) {
      recommendations.push('❌ Products access failed');
    } else {
      recommendations.push(`✅ Products access working - found ${debugResult.productCount} products`);
      
      if (imageAnalysis) {
        const imageFields = Object.keys(imageAnalysis).filter(key => 
          key.includes('has') && imageAnalysis[key] === true
        );
        
        if (imageFields.length > 0) {
          recommendations.push(`🖼️ Found image-related fields: ${imageFields.join(', ')}`);
          
          // Check which fields actually contain image URLs
          const fieldsWithUrls = imageAnalysis.urlFields;
          if (fieldsWithUrls.length > 0) {
            recommendations.push(`🎯 Found URL fields: ${fieldsWithUrls.map(f => f.field).join(', ')}`);
          }
        } else {
          recommendations.push('⚠️ No obvious image fields found - check product configuration in Zoho');
        }
      }
    }

    // Check successful endpoints
    if (debugResult.allEndpointTests) {
      const successfulEndpoints = Object.entries(debugResult.allEndpointTests)
        .filter(([name, test]) => test.success)
        .map(([name, test]) => name);
      
      if (successfulEndpoints.length > 0) {
        recommendations.push(`✅ Working endpoints: ${successfulEndpoints.join(', ')}`);
      }
    }

    const nextSteps = [];
    
    if (debugResult.productsAccess) {
      nextSteps.push('1. Replace your current zoho-api.ts with the fixed version');
      nextSteps.push('2. Update your imports to use the new API client');
      nextSteps.push('3. Test your products page');
      
      if (imageAnalysis && imageAnalysis.urlFields.length > 0) {
        nextSteps.push('4. Update ProductImage component to use the correct image field');
        nextSteps.push(`5. Use field: ${imageAnalysis.urlFields[0].field} for product images`);
      } else {
        nextSteps.push('4. Check product setup in Zoho Commerce admin to add images');
      }
    } else {
      nextSteps.push('1. Verify organization ID is correct');
      nextSteps.push('2. Check API permissions in Zoho');
      nextSteps.push('3. Ensure Zoho Commerce store is properly configured');
    }

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      organizationId: process.env.ZOHO_STORE_ID,
      apiBaseUrl: 'https://commerce.zoho.com/store/api/v1',
      debugResult,
      imageAnalysis,
      recommendations,
      nextSteps,
      success: debugResult.auth && debugResult.productsAccess
    });

  } catch (error) {
    console.error('Test failed:', error);
    return res.status(500).json({
      error: 'API test failed',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}