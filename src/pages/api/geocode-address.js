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
    // Use Google Places API for address suggestions
    const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!GOOGLE_API_KEY) {
      console.warn('Google Places API key not configured, using mock data');
      // Return mock suggestions for development
      const mockSuggestions = [
        {
          description: `${query}, Austin, TX, USA`,
          place_id: 'mock_1',
          structured_formatting: {
            main_text: query,
            secondary_text: 'Austin, TX, USA'
          }
        },
        {
          description: `${query}, Dallas, TX, USA`,
          place_id: 'mock_2',
          structured_formatting: {
            main_text: query,
            secondary_text: 'Dallas, TX, USA'
          }
        },
        {
          description: `${query}, Phoenix, AZ, USA`,
          place_id: 'mock_3',
          structured_formatting: {
            main_text: query,
            secondary_text: 'Phoenix, AZ, USA'
          }
        }
      ];
      
      return res.status(200).json({ suggestions: mockSuggestions });
    }

    // Make request to Google Places API
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=address&components=country:us&key=${GOOGLE_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${data.status}`);
    }

    const suggestions = data.predictions || [];
    
    return res.status(200).json({ 
      suggestions: suggestions.slice(0, 5) // Limit to 5 suggestions
    });

  } catch (error) {
    console.error('Geocoding error:', error);
    
    // Fallback to basic suggestions if API fails
    const fallbackSuggestions = [
      {
        description: `${query}, USA`,
        place_id: 'fallback_1',
        structured_formatting: {
          main_text: query,
          secondary_text: 'USA'
        }
      }
    ];
    
    return res.status(200).json({ suggestions: fallbackSuggestions });
  }
}