// src/pages/api/stripe/webhook.js - Alternative approach: Always create contact first

async function createZohoOrderAfterPayment(orderData, paymentIntent) {
  console.log('🔄 Creating Zoho order after payment confirmation...');
  
  const token = await getZohoAccessToken();
  let customerId = orderData.customerId;
  
  // If no customer ID, create a guest contact first
  if (!customerId) {
    console.log('👤 Creating guest contact for order...');
    
    try {
      const contactData = {
        contact_name: `${orderData.customerInfo.firstName} ${orderData.customerInfo.lastName}`,
        contact_type: 'customer',
        contact_persons: [{
          first_name: orderData.customerInfo.firstName,
          last_name: orderData.customerInfo.lastName,
          email: orderData.customerInfo.email,
          phone: orderData.customerInfo.phone || '',
          is_primary_contact: true
        }]
      };
      
      const contactResponse = await fetch(
        `https://www.zohoapis.com/inventory/v1/contacts?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(contactData)
        }
      );
      
      const contactResult = await contactResponse.json();
      
      if (contactResult.contact?.contact_id) {
        customerId = contactResult.contact.contact_id;
        console.log('✅ Guest contact created:', customerId);
      } else {
        console.warn('⚠️ Guest contact creation failed, proceeding without customer ID');
        console.log('Contact creation response:', JSON.stringify(contactResult, null, 2));
      }
      
    } catch (contactError) {
      console.warn('⚠️ Guest contact creation error:', contactError.message);
    }
  }
  
  // Handle customer addresses
  let billingAddressId = null;
  let shippingAddressId = null;
  
  if (customerId) {
    console.log('📍 Creating customer addresses in Zoho...');
    
    const addressData = {
      attention: `${orderData.customerInfo.firstName} ${orderData.customerInfo.lastName}`,
      address: orderData.shippingAddress.address1.substring(0, 99),
      address_2: orderData.shippingAddress.address2?.substring(0, 99) || '',
      city: orderData.shippingAddress.city,
      state: orderData.shippingAddress.state,
      zip: orderData.shippingAddress.zipCode,
      country: orderData.shippingAddress.country,
      phone: orderData.customerInfo.phone || ''
    };
    
    try {
      const addressResponse = await fetch(
        `https://www.zohoapis.com/inventory/v1/contacts/${customerId}/address?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            billing_address: addressData,
            shipping_address: addressData
          })
        }
      );
      
      const addressResult = await addressResponse.json();
      
      if (addressResult.address) {
        billingAddressId = addressResult.address.billing_address_id;
        shippingAddressId = addressResult.address.shipping_address_id;
        console.log('✅ Customer addresses created');
      }
    } catch (addressError) {
      console.warn('⚠️ Address creation failed:', addressError.message);
    }
  }
  
  // Prepare line items
  const lineItems = orderData.cartItems.map(item => ({
    item_id: item.product_id,
    name: item.product_name,
    rate: parseFloat(item.product_price),
    quantity: parseInt(item.quantity),
    unit: 'qty'
  }));
  
  // Prepare order data
  const salesOrderData = {
    date: new Date().toISOString().split('T')[0],
    shipment_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    line_items: lineItems,
    notes: `Payment completed via Stripe. Payment Intent: ${paymentIntent.id}`,
    terms: 'Paid via Stripe',
    custom_fields: [
      { label: 'Payment Method', value: 'Stripe' },
      { label: 'Payment Intent ID', value: paymentIntent.id },
      { label: 'Request ID', value: orderData.requestId }
    ]
  };

  // Add customer information
  if (customerId) {
    // Use customer_id and addresses
    salesOrderData.customer_id = customerId;
    
    if (billingAddressId && shippingAddressId) {
      salesOrderData.billing_address_id = billingAddressId;
      salesOrderData.shipping_address_id = shippingAddressId;
    } else {
      // Fallback to address object
      salesOrderData.shipping_address = {
        address: orderData.shippingAddress.address1.substring(0, 99),
        city: orderData.shippingAddress.city,
        state: orderData.shippingAddress.state,
        zip: orderData.shippingAddress.zipCode,
        country: orderData.shippingAddress.country
      };
    }
  } else {
    // Fallback: guest order without customer ID
    salesOrderData.customer_name = `${orderData.customerInfo.firstName} ${orderData.customerInfo.lastName}`;
    salesOrderData.shipping_address = {
      address: orderData.shippingAddress.address1.substring(0, 99),
      city: orderData.shippingAddress.city,
      state: orderData.shippingAddress.state,
      zip: orderData.shippingAddress.zipCode,
      country: orderData.shippingAddress.country
    };
    
    // Add customer contact info to custom fields
    salesOrderData.custom_fields.push(
      { label: 'Customer Email', value: orderData.customerInfo.email },
      { label: 'Customer Phone', value: orderData.customerInfo.phone || 'Not provided' }
    );
  }
  
  console.log('📦 Creating sales order in Zoho...');
  console.log('📋 Sales order data:', JSON.stringify(salesOrderData, null, 2));
  
  const response = await fetch(
    `https://www.zohoapis.com/inventory/v1/salesorders?organization_id=${process.env.ZOHO_INVENTORY_ORGANIZATION_ID}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(salesOrderData)
    }
  );
  
  const result = await response.json();
  
  if (!response.ok || !result.salesorder) {
    console.error('❌ Zoho order creation failed. Response:', JSON.stringify(result, null, 2));
    throw new Error(`Zoho order creation failed: ${result.message || JSON.stringify(result)}`);
  }
  
  const orderId = result.salesorder.salesorder_id;
  const orderNumber = result.salesorder.salesorder_number;
  
  console.log('✅ Zoho order created after payment:', { orderId, orderNumber });
  
  return { orderId, orderNumber };
}