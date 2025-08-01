// src/config/support.ts
// Updated support configuration with removed elements and enabled functionality

export const supportConfig = {
  // Contact options - removed phone support, enabled email and chat
  contactOptions: [
    {
      type: 'email',
      title: 'Email Support',
      description: '24/7 email support with detailed responses',
      contact: 'support@traveldatawifi.com',
      hours: 'Response within 2 hours',
      available: true,
      enabled: true,
      priority: 'medium',
      color: 'bg-logo-ocean text-white',
      hoverColor: 'hover:bg-logo-teal',
      icon: 'Mail',
      action: 'Send Email'
    },
    {
      type: 'chat',
      title: 'Live Chat',
      description: 'Instant help from our support team',
      contact: 'Available now',
      hours: 'Daily 10AM-10PM EST', // Updated hours as requested
      available: true,
      enabled: true,
      priority: 'high',
      color: 'bg-logo-signal text-white',
      hoverColor: 'hover:bg-logo-forest',
      icon: 'MessageCircle',
      action: 'Start Chat',
      provider: 'zoho-salesiq'
    }
  ],

  // Removed categories (no longer displayed)
  removedCategories: [
    'setup', // Device Setup
    'connectivity', // Connection Issues  
    'performance', // Speed & Performance
    'security' // Network Security
  ],

  // Simplified navigation - removed specific category links
  navigation: [
    {
      name: 'Support Home',
      href: '/support',
      description: 'Main support dashboard',
      icon: 'HelpCircle'
    },
    {
      name: 'Knowledge Base',
      href: '/support?view=articles',
      description: 'Browse help articles',
      icon: 'BookOpen'
    },
    {
      name: 'Contact Support',
      href: '/support?view=contact',
      description: 'Get personalized help',
      icon: 'MessageCircle'
    }
  ],

  // Generic knowledge base categories (for browsing)
  knowledgeBaseCategories: [
    {
      id: 'setup',
      name: 'Getting Started',
      description: 'Setup guides and tutorials',
      icon: 'Settings',
      color: 'blue'
    },
    {
      id: 'troubleshooting',
      name: 'Troubleshooting',
      description: 'Fix common issues',
      icon: 'AlertCircle',
      color: 'red'
    },
    {
      id: 'tips',
      name: 'Tips & Tricks',
      description: 'Optimize your setup',
      icon: 'Star',
      color: 'yellow'
    }
  ],

  // Zoho SalesIQ configuration
  liveChatConfig: {
    provider: 'zoho-salesiq',
    widgetCode: process.env.NEXT_PUBLIC_ZOHO_SALESIQ_WIDGET_CODE,
    department: 'Support',
    operatingHours: {
      timezone: 'America/New_York',
      dailyStart: '10:00',
      dailyEnd: '22:00',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6] // All days (0=Sunday, 6=Saturday)
    },
    customization: {
      theme: 'custom',
      primaryColor: '#06b6d4',
      secondaryColor: '#1e40af',
      welcomeMessage: 'Hello! How can our RV internet experts help you today?',
      chatTitle: 'Travel Data WiFi Support'
    }
  },

  // Email support configuration
  emailSupportConfig: {
    recipientEmail: 'support@traveldatawifi.com',
    autoReplyEnabled: true,
    estimatedResponseTime: '2 hours',
    businessHours: 'Mon-Fri 9AM-6PM EST',
    categories: [
      { value: 'general', label: 'General Inquiry' },
      { value: 'technical', label: 'Technical Support' },
      { value: 'billing', label: 'Billing & Account' },
      { value: 'setup', label: 'Setup Help' },
      { value: 'other', label: 'Other' }
    ],
    priorities: [
      { value: 'low', label: 'Low', color: 'text-green-600' },
      { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
      { value: 'high', label: 'High', color: 'text-orange-600' },
      { value: 'urgent', label: 'Urgent', color: 'text-red-600' }
    ]
  },

  // API endpoints
  apiEndpoints: {
    contactForm: '/api/support/contact',
    knowledgeBase: '/api/knowledge-base/articles',
    search: '/api/knowledge-base/search'
  },

  // Feature flags
  features: {
    phoneSupport: false, // Disabled as requested
    emailSupport: true,  // Enabled
    liveChat: true,      // Enabled
    knowledgeBase: true,
    searchFunctionality: true,
    ticketTracking: true,
    zohoDeskIntegration: true,
    emailNotifications: true,
    
    // Removed features
    supportCategories: false, // Device setup, connection issues, etc.
    supportStats: false,      // Stats cards (150+ articles, etc.)
    supportBanner: false      // Travel Data WiFi Support Center banner
  },

  // UI customization
  ui: {
    colors: {
      primary: '#06b6d4',    // logo-teal
      secondary: '#1e40af',  // logo-ocean  
      accent: '#10b981',     // logo-signal
      success: '#059669',    // logo-forest
      warning: '#f59e0b',
      error: '#dc2626',
      gray: '#6b7280'
    },
    
    // Removed UI elements
    hideElements: [
      'support-banner',      // Travel Data WiFi Support Center banner
      'stats-cards',         // Statistics cards
      'category-cards',      // Device setup, connection issues, etc.
      'phone-support-card'   // Phone support contact option
    ],
    
    // Updated layout
    layout: {
      heroSimplified: true,  // Simplified hero without banner/stats
      contactOptionsOnly: true, // Only show email and chat options
      searchEnabled: true,   // Keep search functionality
      knowledgeBaseAccess: true // Allow browsing knowledge base
    }
  },

  // Error messages and user feedback
  messages: {
    emailSuccess: 'Email sent successfully! We\'ll respond within 2 hours.',
    emailError: 'Failed to send email. Please try again or contact us directly.',
    chatUnavailable: 'Live chat is currently offline. Please try email support or check back during business hours (10AM-10PM EST).',
    chatError: 'Unable to start chat. Please refresh the page or try email support.',
    searchNoResults: 'No articles found. Try different keywords or contact support for help.',
    generalError: 'Something went wrong. Please try again or contact support directly.'
  }
};

export default supportConfig;