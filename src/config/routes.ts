// src/config/routes.ts
// Support routes configuration for your Next.js application

export const supportRoutes = {
  // Main support routes
  support: '/support',
  supportHome: '/support',
  knowledgeBase: '/support?view=articles',
  contactSupport: '/support?view=contact',
  searchHelp: '/support?view=search',
  
  // Category-specific routes
  deviceSetup: '/support?view=articles&category=setup',
  connectivity: '/support?view=articles&category=connectivity', 
  performance: '/support?view=articles&category=performance',
  security: '/support?view=articles&category=security',
  
  // API routes (for backend integration)
  api: {
    articles: '/api/knowledge-base/articles',
    search: '/api/knowledge-base/search',
    categories: '/api/knowledge-base/categories',
    contact: '/api/support/contact',
    feedback: '/api/knowledge-base/feedback',
    sync: '/api/knowledge-base/sync',
    health: '/api/knowledge-base/health'
  }
};

// Navigation configuration for support sections
export const supportNavigation = [
  {
    name: 'Support Home',
    href: supportRoutes.supportHome,
    description: 'Main support dashboard',
    icon: 'HelpCircle'
  },
  {
    name: 'Knowledge Base',
    href: supportRoutes.knowledgeBase,
    description: 'Browse help articles',
    icon: 'BookOpen'
  },
  {
    name: 'Contact Us',
    href: supportRoutes.contactSupport,
    description: 'Get personalized help',
    icon: 'MessageCircle'
  }
];

// Support categories configuration
export const supportCategories = [
  {
    id: 'setup',
    name: 'Device Setup',
    description: 'Get your devices up and running quickly',
    icon: 'Settings',
    color: 'blue',
    href: supportRoutes.deviceSetup
  },
  {
    id: 'connectivity',
    name: 'Connection Issues', 
    description: 'Troubleshoot connectivity problems',
    icon: 'Wifi',
    color: 'red',
    href: supportRoutes.connectivity
  },
  {
    id: 'performance',
    name: 'Speed & Performance',
    description: 'Optimize your internet speed',
    icon: 'Zap',
    color: 'yellow',
    href: supportRoutes.performance
  },
  {
    id: 'security',
    name: 'Network Security',
    description: 'Keep your connection secure',
    icon: 'Shield',
    color: 'green',
    href: supportRoutes.security
  }
];

// Contact options configuration
export const contactOptions = [
  {
    type: 'phone',
    title: 'Phone Support',
    description: 'Speak directly with our RV internet experts',
    contact: '1-800-555-0123',
    hours: 'Mon-Fri 8AM-8PM EST',
    available: true,
    priority: 'high'
  },
  {
    type: 'email',
    title: 'Email Support',
    description: '24/7 email support with detailed responses',
    contact: 'support@traveldatawifi.com',
    hours: 'Response within 2 hours',
    available: true,
    priority: 'medium'
  },
  {
    type: 'chat',
    title: 'Live Chat',
    description: 'Instant help from our support team',
    contact: 'Available now',
    hours: 'Mon-Sat 9AM-6PM EST',
    available: true,
    priority: 'high'
  }
];

// SEO metadata for support pages
export const supportSEO = {
  support: {
    title: 'Support Center - Travel Data WiFi',
    description: 'Get expert help with your mobile internet setup. Access our knowledge base, contact support, and find solutions for RV internet connectivity.',
    keywords: 'RV internet support, mobile hotspot help, connectivity troubleshooting'
  },
  knowledgeBase: {
    title: 'Knowledge Base - Travel Data WiFi Support',
    description: 'Browse our comprehensive library of setup guides, troubleshooting tips, and tutorials for RV internet solutions.',
    keywords: 'RV internet guides, setup tutorials, troubleshooting help'
  },
  contact: {
    title: 'Contact Support - Travel Data WiFi',
    description: 'Get personalized help from RV internet experts. Phone, email, and chat support available.',
    keywords: 'RV internet support, contact help, technical assistance'
  }
};

export default supportRoutes;