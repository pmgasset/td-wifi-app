// src/pages/api/simple-debug.js - Direct API call to debug custom fields

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== SIMPLE DEBUG - DIRECT API CALL ===');

    // Check environment variables first
    const envCheck = {
      ZOHO_INVENTORY_ORGANIZATION_ID: !!process.env.ZOHO_INVENTORY_ORGANIZATION_ID,
      ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
      ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET
    };

    console.log('Environment check:', envCheck);

    if (!process.env.ZOHO_INVENTORY_ORGANIZATION_ID) {
      return res.status(500).json({
        error: 'ZOHO_INVENTORY_ORGANIZATION_ID not set',
        env_check: envCheck
      });
    }

    // Get access token directly
    console.log('Getting access token...');
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
      const tokenError = await tokenResponse.text();
      return res.status(500).json({
        error: 'Failed to get access token',
        details: tokenError,
        status: tokenResponse.status
      });
    }

    const tokenData = await tokenResponse.json();
    console.log('✓ Got access token');

    // Make direct API call to Zoho Inventory
    const inventoryUrl = `https://www.zohoapis.com/inventory/v1/items?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`;
    console.log('Calling Inventory API:', inventoryUrl);

    const inventoryResponse = await fetch(inventoryUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!inventoryResponse.ok) {
      const inventoryError = await inventoryResponse.text();
      return res.status(500).json({
        error: 'Inventory API call failed',
        details: inventoryError,
        status: inventoryResponse.status,
        url: inventoryUrl
      });
    }

    const inventoryData = await inventoryResponse.json();
    console.log('✓ Got inventory data');

    if (inventoryData.code && inventoryData.code !== 0) {
      return res.status(500).json({
        error: 'Inventory API returned error',
        code: inventoryData.code,
        message: inventoryData.message
      });
    }

    const items = inventoryData.items || [];
    console.log(`Found ${items.length} items`);

    // Analyze first 5 items for custom fields
    const analysis = {
      total_items: items.length,
      items_with_custom_fields: 0,
      all_custom_fields: [],
      sample_items: []
    };

    items.slice(0, 10).forEach((item, index) => {
      console.log(`\n--- Item ${index + 1}: ${item.name} ---`);
      console.log('Item keys:', Object.keys(item));
      console.log('Has custom_fields:', 'custom_fields' in item);
      console.log('Custom fields value:', item.custom_fields);
      console.log('Custom fields type:', typeof item.custom_fields);
      
      const itemInfo = {
        item_id: item.item_id,
        name: item.name,
        has_custom_fields_key: 'custom_fields' in item,
        custom_fields_value: item.custom_fields,
        custom_fields_type: typeof item.custom_fields,
        custom_fields_length: Array.isArray(item.custom_fields) ? item.custom_fields.length : 'Not array',
        all_keys: Object.keys(item)
      };

      if (item.custom_fields && Array.isArray(item.custom_fields) && item.custom_fields.length > 0) {
        analysis.items_with_custom_fields++;
        console.log('Custom fields found:', item.custom_fields);
        
        item.custom_fields.forEach(field => {
          analysis.all_custom_fields.push({
            item_id: item.item_id,
            item_name: item.name,
            customfield_id: field.customfield_id,
            label: field.label,
            field_name: field.field_name,
            value: field.value,
            value_type: typeof field.value,
            data_type: field.data_type
          });
        });
        
        itemInfo.custom_fields_details = item.custom_fields;
      }

      analysis.sample_items.push(itemInfo);
    });

    console.log('\n=== ANALYSIS COMPLETE ===');
    console.log(`Total items: ${analysis.total_items}`);
    console.log(`Items with custom fields: ${analysis.items_with_custom_fields}`);
    console.log(`Total custom fields found: ${analysis.all_custom_fields.length}`);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      env_check: envCheck,
      ...analysis,
      raw_api_response_keys: Object.keys(inventoryData),
      raw_first_item: items.length > 0 ? items[0] : null
    });

  } catch (error) {
    console.error('Simple debug failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}