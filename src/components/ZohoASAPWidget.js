// src/components/ZohoASAPWidget.js
// Simple JavaScript component for Zoho ASAP integration

import React, { useEffect } from 'react';

const ZohoASAPWidget = ({ 
  widgetUrl = process.env.NEXT_PUBLIC_ZOHO_ASAP_WIDGET_URL,
  autoHideLauncher = true,
  customizations = {}
}) => {
  
  useEffect(() => {
    // Only initialize if we have a widget URL
    if (!widgetUrl) {
      console.warn('⚠️ Zoho ASAP widget URL not provided. Set NEXT_PUBLIC_ZOHO_ASAP_WIDGET_URL environment variable.');
      return;
    }

    // Create and load the ASAP script
    const script = document.createElement('script');
    script.innerHTML = `
      window.ZohoHCAsap = window.ZohoHCAsap || function(a, b) {
        ZohoHCAsap[a] = b;
      };
      (function() {
        var d = document;
        var s = d.createElement("script");
        s.type = "text/javascript";
        s.defer = true;
        s.src = "${widgetUrl}";
        d.getElementsByTagName("head")[0].appendChild(s);
      })();
    `;
    
    document.head.appendChild(script);

    // Set up ASAP configuration when ready
    const configureASAP = () => {
      if (window.ZohoDeskAsapReady && window.ZohoDeskAsap) {
        window.ZohoDeskAsapReady(() => {
          console.log('✅ Zoho ASAP widget ready');
          
          // Hide default launcher if requested
          if (autoHideLauncher) {
            window.ZohoDeskAsap.invoke("hide", "app.launcher");
          }
          
          // Apply default customizations
          const defaultCustomizations = {
            colorMode: 'light',
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
          
          const config = { ...defaultCustomizations, ...customizations };
          
          // Apply customizations
          if (config.colorMode) {
            window.ZohoDeskAsap.set("app.colorMode", config.colorMode);
          }
          
          if (config.tabRenames) {
            window.ZohoDeskAsap.set("app.tabs.renameTabs", config.tabRenames);
          }
          
          if (config.tabOrder) {
            window.ZohoDeskAsap.set("app.tabs.reorderTabs", config.tabOrder);
          }
          
          if (config.ticketFormTitle) {
            window.ZohoDeskAsap.set("ticket.form.title", config.ticketFormTitle);
          }
          
          if (config.hideTabs && config.hideTabs.length > 0) {
            window.ZohoDeskAsap.set("app.tabs.hideTabs", config.hideTabs);
          }
          
          // Set up event tracking
          window.ZohoDeskAsap.on("onAppOpen", () => {
            console.log('📊 ASAP widget opened');
            // Add your analytics tracking here
            if (typeof gtag !== 'undefined') {
              gtag('event', 'asap_widget_opened', {
                'event_category': 'support',
                'event_label': 'zoho_asap'
              });
            }
          });
          
          window.ZohoDeskAsap.on("onAppClose", () => {
            console.log('📊 ASAP widget closed');
            // Add your analytics tracking here  
            if (typeof gtag !== 'undefined') {
              gtag('event', 'asap_widget_closed', {
                'event_category': 'support',
                'event_label': 'zoho_asap'
              });
            }
          });
        });
      }
    };

    // Configure ASAP when script loads
    const checkInterval = setInterval(() => {
      if (window.ZohoDeskAsapReady) {
        configureASAP();
        clearInterval(checkInterval);
      }
    }, 100);

    // Cleanup
    return () => {
      clearInterval(checkInterval);
      // Remove script if component unmounts
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [widgetUrl, autoHideLauncher, customizations]);

  // This component doesn't render anything visible
  // The ASAP widget is managed by Zoho's scripts
  return null;
};

// Helper functions to control ASAP widget
export const openASAPWidget = (view = null) => {
  if (window.ZohoDeskAsapReady && window.ZohoDeskAsap) {
    window.ZohoDeskAsapReady(() => {
      if (view) {
        window.ZohoDeskAsap.invoke("routeTo", { page: view });
      } else {
        window.ZohoDeskAsap.invoke("open");
      }
    });
  } else {
    console.warn('Zoho ASAP not ready yet');
  }
};

export const closeASAPWidget = () => {
  if (window.ZohoDeskAsapReady && window.ZohoDeskAsap) {
    window.ZohoDeskAsapReady(() => {
      window.ZohoDeskAsap.invoke("close");
    });
  }
};

export const showASAPLauncher = () => {
  if (window.ZohoDeskAsapReady && window.ZohoDeskAsap) {
    window.ZohoDeskAsapReady(() => {
      window.ZohoDeskAsap.invoke("show", "app.launcher");
    });
  }
};

export const hideASAPLauncher = () => {
  if (window.ZohoDeskAsapReady && window.ZohoDeskAsap) {
    window.ZohoDeskAsapReady(() => {
      window.ZohoDeskAsap.invoke("hide", "app.launcher");
    });
  }
};

// Constants for common views
export const ASAP_VIEWS = {
  HOME: 'home',
  KNOWLEDGE_BASE: 'kb.category.list',
  SUBMIT_TICKET: 'ticket.form',
  COMMUNITY: 'community.category.list',
  ARTICLE_DETAIL: 'kb.article.detail',
  CATEGORY_DETAIL: 'kb.category.detail'
};

export default ZohoASAPWidget;