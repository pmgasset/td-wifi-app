// src/pages/api/geocode-address.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;

  if (!query || query.length < 3) {
    return res.status(400).json({ error: 'Query must be at least 3 characters' });
  }

  try {
    // Use Mapbox Geocoding API for address suggestions
    const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;
    
    if (!MAPBOX_ACCESS_TOKEN) {
      console.warn('Mapbox access token not configured, using mock data');
      // Return mock suggestions for development
      const mockSuggestions = [
        {
          description: `${query}, Austin, TX 78701, United States`,
          place_id: 'mock_1',
          structured_formatting: {
            main_text: query,
            secondary_text: 'Austin, TX 78701, United States'
          }
        },
        {
          description: `${query}, Dallas, TX 75201, United States`,
          place_id: 'mock_2',
          structured_formatting: {
            main_text: query,
            secondary_text: 'Dallas, TX 75201, United States'
          }
        },
        {
          description: `${query}, Phoenix, AZ 85001, United States`,
          place_id: 'mock_3',
          structured_formatting: {
            main_text: query,
            secondary_text: 'Phoenix, AZ 85001, United States'
          }
        }
      ];
      
      return res.status(200).json({ suggestions: mockSuggestions });
    }

    // Make request to Mapbox Geocoding API
    const encodedQuery = encodeURIComponent(query);
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=us&types=address,postcode&limit=5&autocomplete=true`;
    
    console.log('Making Mapbox geocoding request for:', query);
    
    const response = await fetch(mapboxUrl);

    if (!response.ok) {
      throw new Error(`Mapbox Geocoding API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Mapbox response features count:', data.features?.length || 0);

    // Transform Mapbox response to match our expected format
    const suggestions = (data.features || []).map((feature, index) => {
      const placeName = feature.place_name || '';
      const context = feature.context || [];
      
      // Extract main components for better display
      let mainText = feature.text || query;
      let secondaryText = '';
      
      // Build secondary text from context (city, state, postal code)
      const contextParts = [];
      context.forEach(ctx => {
        if (ctx.id.startsWith('place.')) {
          contextParts.push(ctx.text); // City
        } else if (ctx.id.startsWith('region.')) {
          contextParts.push(ctx.short_code?.replace('US-', '') || ctx.text); // State
        } else if (ctx.id.startsWith('postcode.')) {
          contextParts.push(ctx.text); // ZIP
        }
      });
      
      // Add country if not already present
      if (!placeName.includes('United States')) {
        contextParts.push('United States');
      }
      
      secondaryText = contextParts.join(', ');
      
      // If we have address number/street, use that as main text
      if (feature.address) {
        mainText = `${feature.address} ${feature.text}`;
      }
      
      return {
        description: placeName,
        place_id: feature.id || `mapbox_${index}`,
        structured_formatting: {
          main_text: mainText,
          secondary_text: secondaryText
        },
        // Include coordinates for potential future use
        coordinates: feature.center,
        // Include full feature data for debugging
        mapbox_data: {
          bbox: feature.bbox,
          center: feature.center,
          place_type: feature.place_type,
          relevance: feature.relevance
        }
      };
    });
    
    console.log('Transformed suggestions count:', suggestions.length);
    
    return res.status(200).json({ 
      suggestions: suggestions.slice(0, 5), // Limit to 5 suggestions
      provider: 'mapbox'
    });

  } catch (error) {
    console.error('Mapbox geocoding error:', error);
    
    // Fallback to basic suggestions if API fails
    const fallbackSuggestions = [
      {
        description: `${query}, United States`,
        place_id: 'fallback_1',
        structured_formatting: {
          main_text: query,
          secondary_text: 'United States'
        }
      }
    ];
    
    return res.status(200).json({ 
      suggestions: fallbackSuggestions,
      provider: 'fallback',
      error: 'Mapbox API unavailable'
    });
  }
}