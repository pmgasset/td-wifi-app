// src/components/ZohoASAPWidget.tsx
// Improved Zoho ASAP Widget Component with proper error handling and state management

import React, { useEffect, useState, useCallback } from 'react';

// Declare global types for Zoho ASAP
declare global {
  interface Window {
    ZohoDeskAsapReady?: (callback: () => void) => void;
    ZohoDeskAsap?: {
      invoke: (action: string, params?: any) => void;
      set: (key: string, value: any) => void;
      on: (event: string, callback: () => void) => void;
    };
    ZohoHCAsap?: (a: string, b: any) => void;
  }
}

export interface ZohoASAPConfig {
  colorMode?: 'light' | 'dark';
  tabRenames?: Record<string, string>;
  tabOrder?: string[];
  ticketFormTitle?: string;
  hideTabs?: string[];
  hideDefaultLauncher?: boolean;
}

export interface ZohoASAPWidgetProps {
  widgetUrl?: string;
  config?: ZohoASAPConfig;
  onReady?: (ready: boolean) => void;
  onError?: (error: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface ZohoASAPWidgetState {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_CONFIG: ZohoASAPConfig = {
  colorMode: 'light',
  hideDefaultLauncher: true,
  tabRenames: {
    "Home": "Support Home",
    "Knowledge Base": "Help Articles",
    "Ticket": "Contact Support",
    "Community": "User Community"
  },
  tabOrder: [
    "Home",
    "Knowledge Base",
    "Ticket",
    "Community"
  ],
  ticketFormTitle: "Contact Travel Data WiFi Support"
};

const ZohoASAPWidget: React.FC<ZohoASAPWidgetProps> = ({
  widgetUrl = process.env.NEXT_PUBLIC_ZOHO_ASAP_WIDGET_URL,
  config = {},
  onReady,
  onError,
  onOpen,
  onClose
}) => {
  const [state, setState] = useState<ZohoASAPWidgetState>({
    isReady: false,
    isLoading: true,
    error: null
  });

  const updateState = useCallback((updates: Partial<ZohoASAPWidgetState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  useEffect(() => {
    if (!widgetUrl) {
      const error = 'NEXT_PUBLIC_ZOHO_ASAP_WIDGET_URL not configured';
      console.error('❌', error);
      updateState({ isLoading: false, error });
      onError?.(error);
      return;
    }

    console.log('🚀 Initializing Zoho ASAP widget...');
    
    // Initialize Zoho HC Asap first (required before script load)
    window.ZohoHCAsap = window.ZohoHCAsap || function(a: string, b: any) {
      (window.ZohoHCAsap as any)[a] = b;
    };

    // Check if script is already loaded
    const existingScript = document.querySelector(`script[src="${widgetUrl}"]`);
    if (existingScript) {
      console.log('⚠️ Zoho ASAP script already exists, checking readiness...');
      checkReadiness();
      return;
    }

    // Create and load the ASAP script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.defer = true;
    script.src = widgetUrl;
    script.id = 'zoho-asap-script';

    // Set up load event handlers
    script.onload = () => {
      console.log('✅ Zoho ASAP script loaded successfully');
      checkReadiness();
    };

    script.onerror = (error) => {
      console.error('❌ Failed to load Zoho ASAP script:', error);
      const errorMsg = 'Failed to load support widget script';
      updateState({ isLoading: false, error: errorMsg });
      onError?.(errorMsg);
    };

    // Add script to head
    document.head.appendChild(script);

    // Function to check if ASAP is ready
    function checkReadiness() {
      const maxAttempts = 50; // 5 seconds with 100ms intervals
      let attempts = 0;

      const checkInterval = setInterval(() => {
        attempts++;
        
        if (window.ZohoDeskAsapReady && window.ZohoDeskAsap) {
          console.log('✅ Zoho ASAP is ready!');
          clearInterval(checkInterval);
          configureASAP();
        } else if (attempts >= maxAttempts) {
          console.error('❌ Zoho ASAP failed to initialize within timeout');
          clearInterval(checkInterval);
          const errorMsg = 'Support widget failed to initialize within timeout';
          updateState({ isLoading: false, error: errorMsg });
          onError?.(errorMsg);
        } else {
          console.log(`⏳ Waiting for Zoho ASAP... (${attempts}/${maxAttempts})`);
        }
      }, 100);
    }

    // Configure ASAP when ready
    function configureASAP() {
      if (!window.ZohoDeskAsapReady || !window.ZohoDeskAsap) {
        const errorMsg = 'ASAP not available for configuration';
        console.error('❌', errorMsg);
        updateState({ isLoading: false, error: errorMsg });
        onError?.(errorMsg);
        return;
      }

      window.ZohoDeskAsapReady(() => {
        try {
          console.log('🔧 Configuring Zoho ASAP...');
          const ZohoDeskAsap = window.ZohoDeskAsap!;
          const finalConfig = { ...DEFAULT_CONFIG, ...config };
          
          // Hide the default launcher if requested
          if (finalConfig.hideDefaultLauncher) {
            ZohoDeskAsap.invoke("hide", "app.launcher");
          }
          
          // Apply configuration
          if (finalConfig.colorMode) {
            ZohoDeskAsap.set("app.colorMode", finalConfig.colorMode);
          }
          
          if (finalConfig.tabRenames) {
            ZohoDeskAsap.set("app.tabs.renameTabs", finalConfig.tabRenames);
          }
          
          if (finalConfig.tabOrder) {
            ZohoDeskAsap.set("app.tabs.reorderTabs", finalConfig.tabOrder);
          }
          
          if (finalConfig.ticketFormTitle) {
            ZohoDeskAsap.set("ticket.form.title", finalConfig.ticketFormTitle);
          }
          
          if (finalConfig.hideTabs && finalConfig.hideTabs.length > 0) {
            ZohoDeskAsap.set("app.tabs.hideTabs", finalConfig.hideTabs);
          }
          
          // Set up event tracking
          ZohoDeskAsap.on("onAppOpen", () => {
            console.log('📊 ASAP widget opened');
            onOpen?.();
            
            // Add Google Analytics tracking if available
            if (typeof gtag !== 'undefined') {
              gtag('event', 'asap_widget_opened', {
                'event_category': 'support',
                'event_label': 'zoho_asap'
              });
            }
          });
          
          ZohoDeskAsap.on("onAppClose", () => {
            console.log('📊 ASAP widget closed');
            onClose?.();
            
            // Add Google Analytics tracking if available
            if (typeof gtag !== 'undefined') {
              gtag('event', 'asap_widget_closed', {
                'event_category': 'support',
                'event_label': 'zoho_asap'
              });
            }
          });

          // Mark as ready
          updateState({ isReady: true, isLoading: false, error: null });
          onReady?.(true);
          console.log('✅ Zoho ASAP configuration complete');
          
        } catch (error) {
          const errorMsg = `Configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error('❌ ASAP configuration failed:', error);
          updateState({ isLoading: false, error: errorMsg });
          onError?.(errorMsg);
        }
      });
    }

    // Cleanup function
    return () => {
      const script = document.getElementById('zoho-asap-script');
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [widgetUrl, config, onReady, onError, onOpen, onClose, updateState]);

  // This component doesn't render anything visible
  // The ASAP widget is managed by Zoho's scripts
  return null;
};

// Helper functions to control ASAP widget with better error handling
export const openASAPWidget = (view?: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!window.ZohoDeskAsapReady || !window.ZohoDeskAsap) {
      console.warn('⚠️ Zoho ASAP not ready yet');
      resolve(false);
      return;
    }

    window.ZohoDeskAsapReady(() => {
      try {
        const ZohoDeskAsap = window.ZohoDeskAsap!;
        
        if (view) {
          console.log(`🚀 Opening ASAP widget with view: ${view}`);
          ZohoDeskAsap.invoke("routeTo", { page: view });
        } else {
          console.log('🚀 Opening ASAP widget (default view)');
          ZohoDeskAsap.invoke("open");
        }
        resolve(true);
      } catch (error) {
        console.error('❌ Failed to open ASAP widget:', error);
        
        // Fallback: try to just open the main widget
        try {
          window.ZohoDeskAsap!.invoke("open");
          resolve(true);
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
          resolve(false);
        }
      }
    });
  });
};

export const closeASAPWidget = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!window.ZohoDeskAsapReady || !window.ZohoDeskAsap) {
      console.warn('⚠️ Zoho ASAP not ready yet');
      resolve(false);
      return;
    }

    window.ZohoDeskAsapReady(() => {
      try {
        window.ZohoDeskAsap!.invoke("close");
        resolve(true);
      } catch (error) {
        console.error('❌ Failed to close ASAP widget:', error);
        resolve(false);
      }
    });
  });
};

export const showASAPLauncher = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!window.ZohoDeskAsapReady || !window.ZohoDeskAsap) {
      console.warn('⚠️ Zoho ASAP not ready yet');
      resolve(false);
      return;
    }

    window.ZohoDeskAsapReady(() => {
      try {
        window.ZohoDeskAsap!.invoke("show", "app.launcher");
        resolve(true);
      } catch (error) {
        console.error('❌ Failed to show ASAP launcher:', error);
        resolve(false);
      }
    });
  });
};

export const hideASAPLauncher = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!window.ZohoDeskAsapReady || !window.ZohoDeskAsap) {
      console.warn('⚠️ Zoho ASAP not ready yet');
      resolve(false);
      return;
    }

    window.ZohoDeskAsapReady(() => {
      try {
        window.ZohoDeskAsap!.invoke("hide", "app.launcher");
        resolve(true);
      } catch (error) {
        console.error('❌ Failed to hide ASAP launcher:', error);
        resolve(false);
      }
    });
  });
};

// Hook to use ASAP widget state
export const useZohoASAP = () => {
  const [state, setState] = useState<ZohoASAPWidgetState>({
    isReady: false,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    const checkASAPState = () => {
      const isReady = !!(window.ZohoDeskAsapReady && window.ZohoDeskAsap);
      setState(prev => ({
        ...prev,
        isReady,
        isLoading: false,
        error: isReady ? null : 'ASAP not available'
      }));
    };

    // Check immediately
    checkASAPState();

    // Check periodically for changes
    const interval = setInterval(checkASAPState, 1000);

    return () => clearInterval(interval);
  }, []);

  const openWidget = useCallback(async (view?: string) => {
    return await openASAPWidget(view);
  }, []);

  const closeWidget = useCallback(async () => {
    return await closeASAPWidget();
  }, []);

  return {
    ...state,
    openWidget,
    closeWidget,
    showLauncher: showASAPLauncher,
    hideLauncher: hideASAPLauncher
  };
};

// Constants for common views
export const ASAP_VIEWS = {
  HOME: 'home',
  KNOWLEDGE_BASE: 'kb.category.list',
  SUBMIT_TICKET: 'ticket.form',
  COMMUNITY: 'community.category.list',
  ARTICLE_DETAIL: 'kb.article.detail',
  CATEGORY_DETAIL: 'kb.category.detail'
} as const;

export type ASAPView = typeof ASAP_VIEWS[keyof typeof ASAP_VIEWS];

export default ZohoASAPWidget;