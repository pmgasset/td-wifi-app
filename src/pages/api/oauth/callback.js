// src/pages/api/oauth/callback.js
export default function handler(req, res) {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).json({
      error: error,
      description: error_description,
      message: 'OAuth authorization failed'
    });
  }

  if (!code) {
    return res.status(400).json({
      error: 'missing_code',
      message: 'No authorization code received'
    });
  }

  // Display the authorization code for manual exchange
  return res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>OAuth Callback</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .code { background: #f4f4f4; padding: 15px; border-radius: 5px; word-break: break-all; }
        .success { color: green; }
        .step { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1 class="success">✅ OAuth Authorization Successful!</h1>
      
      <div class="step">
        <h3>Step 1: Authorization Code Received</h3>
        <p>Copy this authorization code:</p>
        <div class="code">${code}</div>
      </div>

      <div class="step">
        <h3>Step 2: Exchange for Refresh Token</h3>
        <p>Run this curl command to get your refresh token:</p>
        <div class="code">
curl -X POST "https://accounts.zoho.com/oauth/v2/token" \\<br>
  -d "grant_type=authorization_code" \\<br>
  -d "client_id=1000.CXLJOWXOCFQY5UJSVCI6IHK15UD..." \\<br>
  -d "client_secret=a234a39a980fb28ea920a70c0db798b6e69d7..." \\<br>
  -d "redirect_uri=https://app.traveldatawifi.com/api/oauth/callback" \\<br>
  -d "code=${code}"
        </div>
      </div>

      <div class="step">
        <h3>Step 3: Extract Refresh Token</h3>
        <p>From the curl response, copy the <code>refresh_token</code> value and set it as your <code>ZOHO_DESK_REFRESH_TOKEN</code> environment variable.</p>
      </div>
    </body>
    </html>
  `);
}