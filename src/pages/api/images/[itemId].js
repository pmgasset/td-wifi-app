// src/pages/api/images/[itemId].js - Proxy endpoint to serve Inventory API images

export default async function handler(req, res) {
  const { itemId } = req.query;
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!itemId) {
    return res.status(400).json({ error: 'Item ID is required' });
  }

  try {
    // Get access token
    const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
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

    if (!tokenResponse.ok) {
      throw new Error('Failed to get access token');
    }

    const tokenData = await tokenResponse.json();

    // Fetch image from Zoho Inventory API
    const imageUrl = `https://www.zohoapis.com/inventory/v1/items/${itemId}/image?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`;
    
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${tokenData.access_token}`,
      },
    });

    if (!imageResponse.ok) {
      if (imageResponse.status === 404) {
        return res.status(404).json({ error: 'Image not found' });
      }
      throw new Error(`Image fetch failed: ${imageResponse.status}`);
    }

    // Get the image content type
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    // Set appropriate headers for image caching
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('ETag', `"${itemId}"`);
    
    // Stream the image data to the response
    const imageBuffer = await imageResponse.arrayBuffer();
    res.send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch image',
      details: error.message 
    });
  }
}