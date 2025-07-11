// ===== src/pages/api/test-corrected-api.js =====
import { zohoAPI } from '../../lib/zoho-api-corrected';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TESTING CORRECTED ZOHO API ===');
    console.log('Current ZOHO_STORE_ID:', process.env.ZOHO_STORE_ID);

    // Run the debug setup
    const debugResult = await zohoAPI.debugSetup();
    
    console.log('Debug result:', debugResult);

    let imageAnalysis = null;
    
    // If we successfully got products, analyze the image structure
    if (debugResult.productsAccess && debugResult.sampleProduct) {
      const product = debugResult.sampleProduct;
      
      imageAnalysis = {
        productId: product.product_id,
        productName: product.product_name,
        hasProductImages: 'product_images' in product,
        productImagesType: typeof product.product_images,
        productImagesLength: product.product_images?.length || 0,
        productImagesContent: product.product_images || null,
        
        // Check for alternative image fields
        alternativeImageFields: {},
        allProductFields: Object.keys(product)
      };

      // Check for other possible image field names
      const imageFieldNames = ['images', 'image', 'photo', 'picture', 'thumbnail', 'image_url', 'product_image'];
      imageFieldNames.forEach(fieldName => {
        if (fieldName in product) {
          imageAnalysis.alternativeImageFields[fieldName] = product[fieldName];
        }
      });

      console.log('Image analysis:', imageAnalysis);
    }

    const recommendations = [];
    
    if (!debugResult.auth) {
      recommendations.push('❌ Authentication failed - check your Zoho credentials');
    } else {
      recommendations.push('✅ Authentication working');
    }

    if (!debugResult.storeAccess) {
      recommendations.push('❌ Store access failed - check your store setup');
    } else {
      recommendations.push(`✅ Store access working - found ${debugResult.storeInfo?.length || 0} stores`);
      
      if (debugResult.recommendedStoreId && debugResult.recommendedStoreId !== process.env.ZOHO_STORE_ID) {
        recommendations.push(`🔧 IMPORTANT: Update ZOHO_STORE_ID from "${process.env.ZOHO_STORE_ID}" to "${debugResult.recommendedStoreId}"`);
      }
    }

    if (!debugResult.productsAccess) {
      recommendations.push('❌ Products access failed');
    } else {
      recommendations.push(`✅ Products access working - found ${debugResult.productCount} products`);
      
      if (imageAnalysis) {
        if (imageAnalysis.hasProductImages && imageAnalysis.productImagesLength > 0) {
          recommendations.push(`🖼️ Product images found - ${imageAnalysis.productImagesLength} images for sample product`);
        } else if (Object.keys(imageAnalysis.alternativeImageFields).length > 0) {
          recommendations.push(`🔍 Alternative image fields found: ${Object.keys(imageAnalysis.alternativeImageFields).join(', ')}`);
        } else {
          recommendations.push('⚠️ No image fields found in products - images may not be configured');
        }
      }
    }

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      currentStoreId: process.env.ZOHO_STORE_ID,
      debugResult,
      imageAnalysis,
      recommendations,
      nextSteps: debugResult.productsAccess ? [
        '1. If recommended store ID is different, update your ZOHO_STORE_ID environment variable',
        '2. Replace your current zoho-api.ts with the corrected version',
        '3. Test your products page',
        '4. Check if product images are now loading'
      ] : [
        '1. Fix authentication issues first',
        '2. Verify your Zoho Commerce account has stores configured',
        '3. Check API permissions'
      ]
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