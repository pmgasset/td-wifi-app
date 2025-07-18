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
          structure