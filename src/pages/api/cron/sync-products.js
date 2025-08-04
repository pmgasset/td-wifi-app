export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Allow providing secret via query parameter for easier manual triggering
  const headerSecret = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-cron-secret'];
  const querySecret = req.query.secret;
  const providedSecret = querySecret || headerSecret;
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Starting product sync...');
    // Actual product synchronization logic would go here
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Product sync failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
