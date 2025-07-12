// ===== src/pages/api/analyze-live-images.js =====
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== ANALYZING LIVE SITE IMAGES ===');

    const results = {
      timestamp: new Date().toISOString(),
      livePageAnalysis: {},
      imagePatterns: [],
      apiComparison: {},
      recommendations: []
    };

    // Step 1: Fetch the live page HTML to analyze image structure
    console.log('Fetching live page HTML...');
    try {
      const livePageResponse = await fetch('https://www.traveldatawifi.com/categories/4g-5g-router/2948665000025595042');
      const htmlContent = await livePageResponse.text();
      
      results.livePageAnalysis = {
        success: true,
        statusCode: livePageResponse.status,
        contentLength: htmlContent.length,
        hasContent: htmlContent.length > 1000
      };

      if (livePageResponse.ok) {
        // Extract image URLs from HTML
        const imageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        const images = [];
        let match;
        
        while ((match = imageRegex.exec(htmlContent)) !== null) {
          const imageUrl = match[1];
          // Filter for product images (skip logos, icons, etc.)
          if (imageUrl.includes('product') || 
              imageUrl.includes('image') || 
              imageUrl.includes('photo') ||
              imageUrl.includes('zoho') ||
              imageUrl.includes('commerce') ||
              (!imageUrl.includes('logo') && !imageUrl.includes('icon'))) {
            images.push({
              url: imageUrl,
              fullUrl: imageUrl.startsWith('http') ? imageUrl : `https://www.traveldatawifi.com${imageUrl}`,
              isRelative: !imageUrl.startsWith('http'),
              domain: imageUrl.startsWith('http') ? new URL(imageUrl).hostname : 'traveldatawifi.com'
            });
          }
        }

        results.livePageAnalysis.images = images;
        results.livePageAnalysis.imageCount = images.length;
        
        console.log(`Found ${images.length} potential product images`);

        // Analyze image URL patterns
        const urlPatterns = new Set();
        images.forEach(img => {
          if (img.url.includes('/product-images/')) urlPatterns.add('product-images');
          if (img.url.includes('/documents/')) urlPatterns.add('documents');
          if (img.url.includes('/files/')) urlPatterns.add('files');
          if (img.url.includes('/media/')) urlPatterns.add('media');
          if (img.url.includes('/uploads/')) urlPatterns.add('uploads');
          if (img.url.includes('zoho')) urlPatterns.add('zoho-hosted');
          if (img.url.includes('cdn')) urlPatterns.add('cdn');
        });

        results.imagePatterns = Array.from(urlPatterns);
        console.log('Image URL patterns found:', Array.from(urlPatterns));

        // Extract any data attributes or JavaScript that might show image loading
        const scriptRegex = /<script[^>]*>(.*?)<\/script>/gis;
        const scripts = [];
        let scriptMatch;
        
        while ((scriptMatch = scriptRegex.exec(htmlContent)) !== null) {
          const scriptContent = scriptMatch[1];
          if (scriptContent.includes('image') || 
              scriptContent.includes('product') || 
              scriptContent.includes('document') ||
              scriptContent.includes('zoho')) {
            scripts.push(scriptContent.substring(0, 500)); // First 500 chars
          }
        }

        results.livePageAnalysis.relevantScripts = scripts;
        console.log(`Found ${scripts.length} relevant scripts`);

      } else {
        console.log(`Failed to fetch live page: ${livePageResponse.status}`);
      }

    } catch (error) {
      results.livePageAnalysis = {
        success: false,
        error: error.message
      };
      console.log(`Failed to analyze live page: ${error.message}`);
    }

    // Step 2: Test if we can access the images directly from our API
    console.log('\n=== TESTING IMAGE ACCESS PATTERNS ===');
    
    if (results.livePageAnalysis.images && results.livePageAnalysis.images.length > 0) {
      // Try to access the first few images to test patterns
      const testImages = results.livePageAnalysis.images.slice(0, 3);
      
      for (const image of testImages) {
        try {
          console.log(`Testing image access: ${image.fullUrl}`);
          
          const imageResponse = await fetch(image.fullUrl, { method: 'HEAD' });
          
          results.imagePatterns.push({
            url: image.url,
            fullUrl: image.fullUrl,
            accessible: imageResponse.ok,
            status: imageResponse.status,
            contentType: imageResponse.headers.get('content-type'),
            headers: Object.fromEntries([...imageResponse.headers.entries()])
          });
          
          console.log(`Image ${imageResponse.ok ? 'accessible' : 'not accessible'}: ${imageResponse.status}`);
          
        } catch (error) {
          console.log(`Error testing image: ${error.message}`);
        }
      }
    }

    // Step 3: Compare with our API data for the same products
    console.log('\n=== COMPARING WITH API DATA ===');
    
    try {
      // Get the products from our API
      const apiResponse = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/products`);
      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        const categoryProducts = apiData.products.filter(p => p.category_id === '2948665000025595042');
        
        results.apiComparison = {
          success: true,
          apiProductCount: categoryProducts.length,
          products: categoryProducts.map(product => ({
            product_id: product.product_id,
            name: product.name || product.product_name,
            hasDocuments: !!product.documents,
            documentsCount: product.documents?.length || 0,
            documents: product.documents || [],
            hasProductImages: !!product.product_images,
            productImagesCount: product.product_images?.length || 0,
            productImages: product.product_images || [],
            allImageRelatedFields: Object.keys(product).filter(key => 
              key.toLowerCase().includes('image') || 
              key.toLowerCase().includes('document') ||
              key.toLowerCase().includes('photo') ||
              key.toLowerCase().includes('picture')
            ).map(key => ({ field: key, value: product[key] }))
          }))
        };
        
        console.log(`API returned ${categoryProducts.length} products for comparison`);
        
      } else {
        results.apiComparison = {
          success: false,
          error: `API returned ${apiResponse.status}`
        };
      }
    } catch (error) {
      results.apiComparison = {
        success: false,
        error: error.message
      };
    }

    // Step 4: Generate specific recommendations
    console.log('\n=== GENERATING RECOMMENDATIONS ===');
    
    if (results.livePageAnalysis.success && results.livePageAnalysis.imageCount > 0) {
      results.recommendations.push(`✅ Found ${results.livePageAnalysis.imageCount} images on live site`);
      
      if (results.imagePatterns.length > 0) {
        results.recommendations.push(`🔍 Image URL patterns: ${results.imagePatterns.join(', ')}`);
      }
      
      // Check if images are served from Zoho or local
      const hasZohoImages = results.livePageAnalysis.images.some(img => 
        img.fullUrl.includes('zoho') || img.fullUrl.includes('commerce')
      );
      
      if (hasZohoImages) {
        results.recommendations.push('🔗 Images appear to be served from Zoho Commerce');
        results.recommendations.push('🔧 Try using the Zoho image URLs directly in your API');
      } else {
        results.recommendations.push('🔗 Images appear to be served locally or from CDN');
        results.recommendations.push('🔧 Check if images are processed/cached locally');
      }
      
      // Provide specific image URLs for testing
      if (results.livePageAnalysis.images.length > 0) {
        results.recommendations.push('🎯 Test these image URLs in your app:');
        results.livePageAnalysis.images.slice(0, 3).forEach((img, index) => {
          results.recommendations.push(`   ${index + 1}. ${img.fullUrl}`);
        });
      }
      
    } else {
      results.recommendations.push('❌ Could not analyze live site images');
    }

    if (results.apiComparison.success) {
      const productsWithDocuments = results.apiComparison.products.filter(p => p.documentsCount > 0);
      if (productsWithDocuments.length > 0) {
        results.recommendations.push(`✅ API shows ${productsWithDocuments.length} products with documents`);
      } else {
        results.recommendations.push('❌ API shows no products with documents - this is the disconnect!');
        results.recommendations.push('🔧 Need to find the correct API endpoint that returns image data');
      }
    }

    return res.status(200).json({
      ...results,
      summary: {
        liveImagesFound: results.livePageAnalysis.imageCount || 0,
        imagePatterns: results.imagePatterns.length,
        apiProductsAnalyzed: results.apiComparison.success ? results.apiComparison.apiProductCount : 0,
        needsInvestigation: (results.livePageAnalysis.imageCount || 0) > 0 && 
                           (!results.apiComparison.success || 
                            results.apiComparison.products.every(p => p.documentsCount === 0))
      },
      nextSteps: [
        '1. Test the image URLs found on the live site',
        '2. Check if there\'s a different API endpoint for images',
        '3. Look for image processing in the live site code',
        '4. Try accessing Zoho\'s storefront API instead of admin API'
      ]
    });

  } catch (error) {
    console.error('Live site analysis failed:', error);
    return res.status(500).json({
      error: 'Live site analysis failed',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}