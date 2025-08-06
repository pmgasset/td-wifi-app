// src/pages/support/index.tsx
// Travel Data WiFi Support Page with Zoho Desk ASAP Integration - FIXED

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { HelpCircle, MessageCircle, Mail, Loader2 } from 'lucide-react';

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

const SupportPage: React.FC = () => {
  const router = useRouter();
  const [asapReady, setAsapReady] = useState(false);
  const [asapLoading, setAsapLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Enhanced initialization with better error handling and timing
  useEffect(() => {
    const widgetUrl = process.env.NEXT_PUBLIC_ZOHO_ASAP_WIDGET_URL;
    
    if (!widgetUrl) {
      console.error('❌ NEXT_PUBLIC_ZOHO_ASAP_WIDGET_URL not configured');
      setLoadError('Support widget not configured');
      setAsapLoading(false);
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
      setLoadError('Failed to load support widget');
      setAsapLoading(false);
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
          setLoadError('Support widget failed to initialize');
          setAsapLoading(false);
        } else {
          console.log(`⏳ Waiting for Zoho ASAP... (${attempts}/${maxAttempts})`);
        }
      }, 100);
    }

    // Configure ASAP when ready
    function configureASAP() {
      if (!window.ZohoDeskAsapReady || !window.ZohoDeskAsap) {
        console.error('❌ ASAP not available for configuration');
        setLoadError('Support widget configuration failed');
        setAsapLoading(false);
        return;
      }

      window.ZohoDeskAsapReady(() => {
        try {
          console.log('🔧 Configuring Zoho ASAP...');
          const ZohoDeskAsap = window.ZohoDeskAsap!;
          
          // Hide the default launcher since we'll use custom buttons
          ZohoDeskAsap.invoke("hide", "app.launcher");
          
          // Set light mode
          ZohoDeskAsap.set("app.colorMode", "light");
          
          // Customize tab names for Travel Data WiFi branding
          ZohoDeskAsap.set("app.tabs.renameTabs", {
            "Home": "Support Home",
            "Knowledge Base": "Help Articles", 
            "Ticket": "Contact Support",
            "Community": "User Community"
          });
          
          // Reorder tabs to prioritize help articles
          ZohoDeskAsap.set("app.tabs.reorderTabs", [
            "Home",
            "Knowledge Base", 
            "Ticket",
            "Community"
          ]);
          
          // Set custom title for ticket form
          ZohoDeskAsap.set("ticket.form.title", "Contact Travel Data WiFi Support");
          
          // Add event tracking
          ZohoDeskAsap.on("onAppOpen", () => {
            console.log('📊 ASAP widget opened');
            // Add analytics tracking here if needed
          });
          
          ZohoDeskAsap.on("onAppClose", () => {
            console.log('📊 ASAP widget closed');
            // Add analytics tracking here if needed
          });

          // Mark as ready
          setAsapReady(true);
          setAsapLoading(false);
          setLoadError(null);
          console.log('✅ Zoho ASAP configuration complete');
          
        } catch (error) {
          console.error('❌ ASAP configuration failed:', error);
          setLoadError(`Configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setAsapLoading(false);
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
  }, []);

  // Safe function to open ASAP widget with comprehensive error handling
  const openHelpWidget = useCallback((view?: string) => {
    if (!asapReady) {
      console.warn('⚠️ Zoho ASAP not ready yet, cannot open widget');
      // Show user-friendly message
      alert('Support widget is still loading. Please try again in a moment.');
      return;
    }

    if (!window.ZohoDeskAsapReady || !window.ZohoDeskAsap) {
      console.error('❌ Zoho ASAP not available');
      alert('Support widget is not available. Please refresh the page and try again.');
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
      } catch (error) {
        console.error('❌ Failed to open ASAP widget:', error);
        
        // Fallback: try to just open the main widget
        try {
          window.ZohoDeskAsap!.invoke("open");
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
          alert('Unable to open support widget. Please refresh the page and try again.');
        }
      }
    });
  }, [asapReady]);

  // Specific handler functions for different support options
  const handleStartChat = useCallback(() => openHelpWidget(), [openHelpWidget]);
  const handleKnowledgeBase = useCallback(() => openHelpWidget('kb.category.list'), [openHelpWidget]);
  const handleSubmitTicket = useCallback(() => openHelpWidget('ticket.form'), [openHelpWidget]);

  return (
    <Layout 
      title="Support Center - Travel Data WiFi"
      description="Get expert help with your mobile internet setup. Access our knowledge base, contact support, and find solutions for RV internet connectivity."
    >
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="bg-logo-teal/10 rounded-full p-4">
                  <HelpCircle className="h-12 w-12 text-logo-teal" />
                </div>
              </div>
              
              <h1 className="text-4xl lg:text-5xl font-bold mb-6 text-gray-900">
                Need Personal Help?
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
                Our expert support team is here to help you get connected and stay connected 
                while traveling. Get instant answers or personalized assistance.
              </p>

              {/* Loading State */}
              {asapLoading && (
                <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg inline-block">
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <span className="text-blue-700 font-medium">Loading support widget...</span>
                  </div>
                </div>
              )}

              {/* Error State */}
              {loadError && (
                <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg inline-block">
                  <div className="text-red-700">
                    <strong>Support Widget Error:</strong> {loadError}
                  </div>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="mt-2 text-red-600 underline hover:text-red-800"
                  >
                    Refresh Page
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Support Options */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-3 gap-8">
            
            {/* Live Chat */}
            <div className="bg-white rounded-xl shadow-sm border p-8 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 rounded-full p-3">
                  <MessageCircle className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-sm text-green-600 font-medium">Available Now</span>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Live Chat
              </h3>
              
              <p className="text-gray-600 mb-4 flex-grow leading-relaxed">
                Get instant help from our support team via live chat
              </p>
              
              <div className="text-sm text-gray-500 mb-6">
                <p className="font-medium">Daily 10AM-10PM EST</p>
              </div>
              
              <button
                onClick={handleStartChat}
                disabled={!asapReady}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors mt-auto ${
                  asapReady 
                    ? 'bg-logo-signal hover:bg-logo-forest text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {asapReady ? 'Start Chat' : 'Loading...'}
              </button>
            </div>

            {/* Knowledge Base */}
            <div className="bg-white rounded-xl shadow-sm border p-8 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 rounded-full p-3">
                  <HelpCircle className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Help Articles
              </h3>
              
              <p className="text-gray-600 mb-4 flex-grow leading-relaxed">
                Browse our comprehensive knowledge base for instant solutions
              </p>
              
              <button
                onClick={handleKnowledgeBase}
                disabled={!asapReady}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors mt-auto ${
                  asapReady 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {asapReady ? 'Browse Articles' : 'Loading...'}
              </button>
            </div>

            {/* Contact Support */}
            <div className="bg-white rounded-xl shadow-sm border p-8 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-purple-100 rounded-full p-3">
                  <Mail className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Submit Ticket
              </h3>
              
              <p className="text-gray-600 mb-4 flex-grow leading-relaxed">
                Create a support ticket for detailed technical assistance
              </p>
              
              <button
                onClick={handleSubmitTicket}
                disabled={!asapReady}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors mt-auto ${
                  asapReady 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {asapReady ? 'Create Ticket' : 'Loading...'}
              </button>
            </div>
          </div>
        </div>

        {/* Debug Information (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-gray-100 rounded-lg p-4">
              <h4 className="font-bold text-gray-900 mb-2">Debug Info (Development Only)</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>ASAP Ready: {asapReady ? '✅' : '❌'}</div>
                <div>Loading: {asapLoading ? '⏳' : '✅'}</div>
                <div>Error: {loadError || 'None'}</div>
                <div>Widget URL: {process.env.NEXT_PUBLIC_ZOHO_ASAP_WIDGET_URL ? '✅' : '❌'}</div>
                <div>ZohoDeskAsapReady: {typeof window !== 'undefined' && window.ZohoDeskAsapReady ? '✅' : '❌'}</div>
                <div>ZohoDeskAsap: {typeof window !== 'undefined' && window.ZohoDeskAsap ? '✅' : '❌'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SupportPage;