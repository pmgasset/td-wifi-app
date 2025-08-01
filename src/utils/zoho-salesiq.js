// src/utils/zoho-salesiq.js
// Zoho SalesIQ live chat integration utility

/**
 * Initialize Zoho SalesIQ widget with configuration
 * Call this in your _app.js or Layout component
 */
export const initializeZohoSalesIQ = (config = {}) => {
  if (typeof window === 'undefined') return;

  // Default configuration
  const defaultConfig = {
    widgetCode: process.env.NEXT_PUBLIC_ZOHO_SALESIQ_WIDGET_CODE || 'YOUR_WIDGET_CODE_HERE',
    language: 'en',
    position: 'right',
    theme: 'modern',
    department: 'Support',
    customFields: {
      source: 'website',
      product: 'Travel Data WiFi'
    }
  };

  const finalConfig = { ...defaultConfig, ...config };

  // Initialize Zoho SalesIQ
  window.$zoho = window.$zoho || {};
  window.$zoho.salesiq = window.$zoho.salesiq || {
    widgetcode: finalConfig.widgetCode,
    values: finalConfig.customFields,
    ready: function() {
      console.log('✅ Zoho SalesIQ widget ready');
      
      // Set department if specified
      if (finalConfig.department) {
        window.$zoho.salesiq.visitor.department(finalConfig.department);
      }

      // Set custom theme
      if (finalConfig.theme === 'custom') {
        window.$zoho.salesiq.theme({
          primary: '#06b6d4',
          secondary: '#1e40af',
          background: '#ffffff',
          text: '#374151'
        });
      }

      // Set operating hours (10AM-10PM EST)
      window.$zoho.salesiq.chat.hours('10:00', '22:00', 'America/New_York');

      // Custom welcome message
      window.$zoho.salesiq.chat.greeting('Hello! How can our RV internet experts help you today?');

      // Set chat window title
      window.$zoho.salesiq.chat.title('Travel Data WiFi Support');

      // Hide chat widget initially if needed
      if (finalConfig.hidden) {
        window.$zoho.salesiq.floatbutton.visible('hide');
      }
    }
  };

  // Load the SalesIQ script
  if (!document.getElementById('zsiqscript')) {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.id = 'zsiqscript';
    script.defer = true;
    script.src = 'https://salesiq.zoho.com/widget';
    script.onload = () => {
      console.log('📞 Zoho SalesIQ script loaded');
    };
    script.onerror = () => {
      console.error('❌ Failed to load Zoho SalesIQ script');
    };
    
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  }
};

/**
 * Start a chat programmatically
 */
export const startChat = (department = null) => {
  if (typeof window === 'undefined' || !window.$zoho?.salesiq) {
    console.warn('Zoho SalesIQ not initialized');
    return false;
  }

  try {
    // Set department if specified
    if (department) {
      window.$zoho.salesiq.visitor.department(department);
    }

    // Show and start chat
    window.$zoho.salesiq.floatbutton.visible('show');
    window.$zoho.salesiq.chat.start();
    
    console.log('🚀 Chat started');
    return true;
  } catch (error) {
    console.error('Failed to start chat:', error);
    return false;
  }
};

/**
 * Hide the chat widget
 */
export const hideChat = () => {
  if (typeof window === 'undefined' || !window.$zoho?.salesiq) return;

  try {
    window.$zoho.salesiq.floatbutton.visible('hide');
    console.log('👻 Chat widget hidden');
  } catch (error) {
    console.error('Failed to hide chat:', error);
  }
};

/**
 * Show the chat widget
 */
export const showChat = () => {
  if (typeof window === 'undefined' || !window.$zoho?.salesiq) return;

  try {
    window.$zoho.salesiq.floatbutton.visible('show');
    console.log('👋 Chat widget shown');
  } catch (error) {
    console.error('Failed to show chat:', error);
  }
};

/**
 * Set visitor information
 */
export const setVisitorInfo = (visitorData) => {
  if (typeof window === 'undefined' || !window.$zoho?.salesiq) return;

  try {
    const { name, email, phone, customFields } = visitorData;
    
    if (name) {
      window.$zoho.salesiq.visitor.name(name);
    }
    
    if (email) {
      window.$zoho.salesiq.visitor.email(email);
    }
    
    if (phone) {
      window.$zoho.salesiq.visitor.phone(phone);
    }

    if (customFields) {
      Object.keys(customFields).forEach(key => {
        window.$zoho.salesiq.visitor.info(key, customFields[key]);
      });
    }

    console.log('👤 Visitor info updated');
  } catch (error) {
    console.error('Failed to set visitor info:', error);
  }
};

/**
 * Check if chat is available (within operating hours)
 */
export const isChatAvailable = () => {
  if (typeof window === 'undefined' || !window.$zoho?.salesiq) return false;

  try {
    // Check current time against EST business hours (10AM-10PM)
    const now = new Date();
    const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const hour = estTime.getHours();
    
    // Available daily 10AM-10PM EST
    return hour >= 10 && hour < 22;
  } catch (error) {
    console.error('Failed to check chat availability:', error);
    return false;
  }
};

/**
 * Get chat status
 */
export const getChatStatus = () => {
  if (typeof window === 'undefined' || !window.$zoho?.salesiq) {
    return 'unavailable';
  }

  try {
    if (isChatAvailable()) {
      return 'available';
    } else {
      return 'offline';
    }
  } catch (error) {
    console.error('Failed to get chat status:', error);
    return 'unknown';
  }
};

/**
 * Set up chat event listeners
 */
export const setChatEventListeners = (callbacks = {}) => {
  if (typeof window === 'undefined') return;

  // Wait for SalesIQ to be ready
  const waitForSalesIQ = () => {
    if (window.$zoho?.salesiq) {
      try {
        // Chat started event
        if (callbacks.onChatStart) {
          window.$zoho.salesiq.chat.onstart = callbacks.onChatStart;
        }

        // Chat ended event
        if (callbacks.onChatEnd) {
          window.$zoho.salesiq.chat.onend = callbacks.onChatEnd;
        }

        // Message received event
        if (callbacks.onMessageReceive) {
          window.$zoho.salesiq.chat.onmessagereceive = callbacks.onMessageReceive;
        }

        // Message sent event
        if (callbacks.onMessageSend) {
          window.$zoho.salesiq.chat.onmessagesend = callbacks.onMessageSend;
        }

        console.log('📡 Chat event listeners set up');
      } catch (error) {
        console.error('Failed to set up chat event listeners:', error);
      }
    } else {
      setTimeout(waitForSalesIQ, 100);
    }
  };

  waitForSalesIQ();
};

/**
 * React hook for Zoho SalesIQ integration
 */
export const useZohoSalesIQ = (config = {}) => {
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [isAvailable, setIsAvailable] = React.useState(false);
  const [chatStatus, setChatStatus] = React.useState('loading');

  React.useEffect(() => {
    // Initialize SalesIQ
    initializeZohoSalesIQ(config);

    // Set up availability check
    const checkAvailability = () => {
      const available = isChatAvailable();
      setIsAvailable(available);
      setChatStatus(getChatStatus());
    };

    // Check immediately and then every minute
    checkAvailability();
    const interval = setInterval(checkAvailability, 60000);

    // Mark as initialized after a short delay
    const initTimeout = setTimeout(() => {
      setIsInitialized(true);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(initTimeout);
    };
  }, []);

  return {
    isInitialized,
    isAvailable,
    chatStatus,
    startChat,
    hideChat,
    showChat,
    setVisitorInfo
  };
};

// Default export for easy importing
export default {
  initialize: initializeZohoSalesIQ,
  startChat,
  hideChat,
  showChat,
  setVisitorInfo,
  isChatAvailable,
  getChatStatus,
  setChatEventListeners,
  useZohoSalesIQ
};