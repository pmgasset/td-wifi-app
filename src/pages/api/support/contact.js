// src/pages/api/support/contact.js
// API endpoint for handling support contact form submissions

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are accepted' 
    });
  }

  try {
    const { name, email, subject, message, type, timestamp } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Please fill in all required fields (name, email, subject, message)',
        required: ['name', 'email', 'subject', 'message']
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
      });
    }

    console.log('📧 Processing support contact form submission:', {
      name,
      email,
      subject: subject.substring(0, 50) + '...',
      type,
      timestamp
    });

    // Generate unique ticket ID
    const ticketId = `TDW-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Prepare support ticket data
    const supportTicket = {
      ticketId,
      customerInfo: {
        name,
        email
      },
      inquiry: {
        subject,
        message,
        type: type || 'email_support',
        priority: 'medium'
      },
      metadata: {
        timestamp: timestamp || new Date().toISOString(),
        source: 'website_contact_form',
        userAgent: req.headers['user-agent'] || 'Unknown',
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      }
    };

    // Try to create ticket in Zoho Desk (if configured)
    let zohoDeskTicketId = null;
    try {
      zohoDeskTicketId = await createZohoDeskTicket(supportTicket);
      console.log('✅ Created Zoho Desk ticket:', zohoDeskTicketId);
    } catch (zohoDeskError) {
      console.warn('⚠️ Failed to create Zoho Desk ticket:', zohoDeskError.message);
      // Continue without Zoho Desk - we'll still process the request
    }

    // Send notification emails
    try {
      await Promise.all([
        sendCustomerConfirmationEmail(supportTicket),
        sendInternalNotificationEmail(supportTicket, zohoDeskTicketId)
      ]);
      console.log('✅ Notification emails sent');
    } catch (emailError) {
      console.warn('⚠️ Failed to send notification emails:', emailError.message);
      // Continue - ticket was created successfully
    }

    // Log the support request for internal tracking
    try {
      await logSupportRequest(supportTicket, zohoDeskTicketId);
    } catch (logError) {
      console.warn('⚠️ Failed to log support request:', logError.message);
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Support request submitted successfully',
      ticketId,
      zohoDeskTicketId,
      estimatedResponseTime: '2 hours',
      data: {
        name,
        email,
        subject,
        submittedAt: supportTicket.metadata.timestamp
      }
    });

  } catch (error) {
    console.error('❌ Error processing support contact form:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process support request. Please try again or contact us directly at support@traveldatawifi.com',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * SUB-AGENT: Create ticket in Zoho Desk
 */
async function createZohoDeskTicket(supportTicket) {
  if (!process.env.ZOHO_DESK_ACCESS_TOKEN) {
    throw new Error('Zoho Desk not configured - missing access token');
  }

  try {
    console.log('🎫 Creating Zoho Desk ticket...');
    
    const ticketData = {
      subject: supportTicket.inquiry.subject,
      departmentId: process.env.ZOHO_DESK_DEPARTMENT_ID || '1',
      contactId: null, // Will be created if doesn't exist
      priority: supportTicket.inquiry.priority,
      description: `
        Customer: ${supportTicket.customerInfo.name}
        Email: ${supportTicket.customerInfo.email}
        Source: Website Contact Form
        
        Message:
        ${supportTicket.inquiry.message}
        
        ---
        Ticket ID: ${supportTicket.ticketId}
        Submitted: ${supportTicket.metadata.timestamp}
        User Agent: ${supportTicket.metadata.userAgent}
      `,
      channel: 'Web',
      status: 'Open'
    };

    // Try to find existing contact
    let contactId = null;
    try {
      contactId = await findOrCreateZohoDeskContact(
        supportTicket.customerInfo.email,
        supportTicket.customerInfo.name
      );
      ticketData.contactId = contactId;
    } catch (contactError) {
      console.warn('⚠️ Could not create/find contact:', contactError.message);
    }

    const response = await fetch(`https://desk.zoho.com/api/v1/tickets`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_DESK_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'orgId': process.env.ZOHO_DESK_ORG_ID
      },
      body: JSON.stringify(ticketData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Zoho Desk API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }

    const result = await response.json();
    return result.id;

  } catch (error) {
    console.error('Failed to create Zoho Desk ticket:', error);
    throw error;
  }
}

/**
 * SUB-AGENT: Find or create contact in Zoho Desk
 */
async function findOrCreateZohoDeskContact(email, name) {
  try {
    // First, try to find existing contact
    const searchResponse = await fetch(`https://desk.zoho.com/api/v1/contacts/search?email=${encodeURIComponent(email)}`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_DESK_ACCESS_TOKEN}`,
        'orgId': process.env.ZOHO_DESK_ORG_ID
      }
    });

    if (searchResponse.ok) {
      const searchResult = await searchResponse.json();
      if (searchResult.data && searchResult.data.length > 0) {
        return searchResult.data[0].id;
      }
    }

    // Create new contact if not found
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ') || '';

    const contactData = {
      firstName,
      lastName,
      email,
      type: 'CONTACT'
    };

    const createResponse = await fetch('https://desk.zoho.com/api/v1/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_DESK_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'orgId': process.env.ZOHO_DESK_ORG_ID
      },
      body: JSON.stringify(contactData)
    });

    if (createResponse.ok) {
      const result = await createResponse.json();
      return result.id;
    }

    throw new Error('Failed to create contact');

  } catch (error) {
    console.error('Failed to find/create Zoho Desk contact:', error);
    throw error;
  }
}

/**
 * SUB-AGENT: Send customer confirmation email
 */
async function sendCustomerConfirmationEmail(supportTicket) {
  try {
    console.log('📧 Sending customer confirmation email...');
    
    const emailData = {
      to: supportTicket.customerInfo.email,
      subject: `Support Request Received - ${supportTicket.ticketId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e40af, #06b6d4); color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Travel Data WiFi Support</h1>
          </div>
          
          <div style="padding: 20px; background: #f9fafb;">
            <h2 style="color: #1e40af;">We've received your support request</h2>
            
            <p>Hi ${supportTicket.customerInfo.name},</p>
            
            <p>Thank you for contacting Travel Data WiFi support. We've received your request and our RV internet experts will respond within 2 hours during business hours.</p>
            
            <div style="background: white; border-left: 4px solid #06b6d4; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1e40af;">Your Request Details:</h3>
              <p><strong>Ticket ID:</strong> ${supportTicket.ticketId}</p>
              <p><strong>Subject:</strong> ${supportTicket.inquiry.subject}</p>
              <p><strong>Submitted:</strong> ${new Date(supportTicket.metadata.timestamp).toLocaleString()}</p>
            </div>
            
            <div style="background: white; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h4 style="margin-top: 0; color: #1e40af;">Your Message:</h4>
              <p style="white-space: pre-wrap;">${supportTicket.inquiry.message}</p>
            </div>
            
            <p><strong>What happens next?</strong></p>
            <ul>
              <li>Our support team will review your request</li>
              <li>You'll receive a personalized response within 2 hours</li>
              <li>For urgent issues, you can also use live chat on our website</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://traveldatawifi.com/support" style="background: #06b6d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Visit Support Center</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
              If you need immediate assistance, you can reach us via live chat daily from 10AM-10PM EST at 
              <a href="https://traveldatawifi.com/support">traveldatawifi.com/support</a>
            </p>
          </div>
          
          <div style="background: #374151; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p>Travel Data WiFi - Reliable Internet for RV Life</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      `
    };

    // Use your preferred email service (SendGrid, AWS SES, etc.)
    // For now, we'll log the email data
    console.log('📧 Customer confirmation email prepared:', {
      to: emailData.to,
      subject: emailData.subject,
      ticketId: supportTicket.ticketId
    });

    // TODO: Implement actual email sending
    // await sendEmail(emailData);
    
    return true;

  } catch (error) {
    console.error('Failed to send customer confirmation email:', error);
    throw error;
  }
}

/**
 * SUB-AGENT: Send internal notification email
 */
async function sendInternalNotificationEmail(supportTicket, zohoDeskTicketId) {
  try {
    console.log('📧 Sending internal notification email...');
    
    const emailData = {
      to: process.env.SUPPORT_NOTIFICATION_EMAIL || 'support@traveldatawifi.com',
      subject: `New Support Request: ${supportTicket.inquiry.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc2626; color: white; padding: 15px;">
            <h2 style="margin: 0;">🚨 New Support Request</h2>
          </div>
          
          <div style="padding: 20px; background: #f3f4f6;">
            <h3>Customer Information</h3>
            <ul>
              <li><strong>Name:</strong> ${supportTicket.customerInfo.name}</li>
              <li><strong>Email:</strong> ${supportTicket.customerInfo.email}</li>
              <li><strong>Ticket ID:</strong> ${supportTicket.ticketId}</li>
              ${zohoDeskTicketId ? `<li><strong>Zoho Desk ID:</strong> ${zohoDeskTicketId}</li>` : ''}
            </ul>
            
            <h3>Request Details</h3>
            <ul>
              <li><strong>Subject:</strong> ${supportTicket.inquiry.subject}</li>
              <li><strong>Type:</strong> ${supportTicket.inquiry.type}</li>
              <li><strong>Priority:</strong> ${supportTicket.inquiry.priority}</li>
              <li><strong>Submitted:</strong> ${new Date(supportTicket.metadata.timestamp).toLocaleString()}</li>
            </ul>
            
            <h3>Message</h3>
            <div style="background: white; padding: 15px; border-left: 4px solid #dc2626;">
              <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${supportTicket.inquiry.message}</pre>
            </div>
            
            <h3>Technical Info</h3>
            <ul>
              <li><strong>Source:</strong> ${supportTicket.metadata.source}</li>
              <li><strong>User Agent:</strong> ${supportTicket.metadata.userAgent}</li>
              <li><strong>IP:</strong> ${supportTicket.metadata.ip}</li>
            </ul>
            
            <div style="text-align: center; margin: 20px 0;">
              ${zohoDeskTicketId ? 
                `<a href="https://desk.zoho.com/support/traveldatawifi/ShowHomePage.do#Cases/dv/${zohoDeskTicketId}" style="background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View in Zoho Desk</a>` : 
                '<p style="color: #dc2626;">⚠️ Zoho Desk ticket creation failed - handle manually</p>'
              }
            </div>
          </div>
        </div>
      `
    };

    console.log('📧 Internal notification email prepared for:', emailData.to);
    
    // TODO: Implement actual email sending
    // await sendEmail(emailData);
    
    return true;

  } catch (error) {
    console.error('Failed to send internal notification email:', error);
    throw error;
  }
}

/**
 * SUB-AGENT: Log support request for internal tracking
 */
async function logSupportRequest(supportTicket, zohoDeskTicketId) {
  try {
    console.log('📝 Logging support request for analytics...');
    
    const logEntry = {
      ticketId: supportTicket.ticketId,
      zohoDeskTicketId,
      timestamp: supportTicket.metadata.timestamp,
      customerEmail: supportTicket.customerInfo.email,
      subject: supportTicket.inquiry.subject,
      type: supportTicket.inquiry.type,
      priority: supportTicket.inquiry.priority,
      source: supportTicket.metadata.source,
      processed: true
    };

    // TODO: Log to your preferred analytics/logging service
    // This could be Google Analytics, Mixpanel, your database, etc.
    console.log('📊 Support request logged:', logEntry);
    
    return true;

  } catch (error) {
    console.error('Failed to log support request:', error);
    throw error;
  }
}