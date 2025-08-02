// src/pages/support/index.tsx
// Travel Data WiFi Support Page with Zoho Desk ASAP Integration

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { HelpCircle, MessageCircle, Mail } from 'lucide-react';

const SupportPage: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    // Initialize Zoho ASAP when component mounts
    const initializeZohoASAP = () => {
      // Check if ASAP is ready
      if ((window as any).ZohoDeskAsapReady) {
        (window as any).ZohoDeskAsapReady(() => {
          console.log('✅ Zoho ASAP is ready');
          
          // Configure ASAP settings
          if ((window as any).ZohoDeskAsap) {
            const ZohoDeskAsap = (window as any).ZohoDeskAsap;
            
            // Hide the default launcher since we'll use custom buttons
            ZohoDeskAsap.invoke("hide", "app.launcher");
            
            // Set light/dark mode based on user preference
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
            
            // Add tracking for when users open/close the widget
            ZohoDeskAsap.on("onAppOpen", () => {
              console.log('📊 ASAP widget opened');
              // You can add analytics tracking here
            });
            
            ZohoDeskAsap.on("onAppClose", () => {
              console.log('📊 ASAP widget closed');
              // You can add analytics tracking here
            });
          }
        });
      }
    };

    // Initialize ASAP when script loads
    initializeZohoASAP();
  }, []);

  // Function to open ASAP widget with specific view
  const openHelpWidget = (view?: string) => {
    if ((window as any).ZohoDeskAsapReady && (window as any).ZohoDeskAsap) {
      (window as any).ZohoDeskAsapReady(() => {
        const ZohoDeskAsap = (window as any).ZohoDeskAsap;
        if (view) {
          // Route to specific page
          ZohoDeskAsap.invoke("routeTo", { page: view });
        } else {
          // Just open the widget
          ZohoDeskAsap.invoke("open");
        }
      });
    }
  };

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
              
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                Our RV internet experts are here to help you succeed
              </p>
            </div>
          </div>
        </div>

        {/* Support Options */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Browse Help Articles */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-logo-teal hover:shadow-lg transition-all duration-300 cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-full bg-blue-100">
                  <HelpCircle className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Browse Help Articles
              </h3>
              
              <p className="text-gray-600 mb-4">
                Search our knowledge base for setup guides, troubleshooting tips, and how-to articles
              </p>
              
              <button
                onClick={() => openHelpWidget("kb.category.list")}
                className="w-full py-3 px-4 rounded-lg font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white"
              >
                Browse Articles
              </button>
            </div>

            {/* Contact Support */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-logo-teal hover:shadow-lg transition-all duration-300 cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-full bg-logo-ocean/10">
                  <Mail className="h-6 w-6 text-logo-ocean" />
                </div>
                <span className="text-sm text-green-600 font-medium">Available</span>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Contact Support
              </h3>
              
              <p className="text-gray-600 mb-4">
                Submit a support ticket and get personalized help from our RV internet experts
              </p>
              
              <div className="text-sm text-gray-500 mb-4">
                <p className="font-medium">Response within 2 hours</p>
              </div>
              
              <button
                onClick={() => openHelpWidget("ticket.form")}
                className="w-full py-3 px-4 rounded-lg font-medium transition-colors bg-logo-ocean hover:bg-logo-teal text-white"
              >
                Submit Ticket
              </button>
            </div>

            {/* Live Chat */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-logo-teal hover:shadow-lg transition-all duration-300 cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-full bg-logo-signal/10">
                  <MessageCircle className="h-6 w-6 text-logo-signal" />
                </div>
                <span className="text-sm text-green-600 font-medium">Available Now</span>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Live Chat
              </h3>
              
              <p className="text-gray-600 mb-4">
                Get instant help from our support team via live chat
              </p>
              
              <div className="text-sm text-gray-500 mb-4">
                <p className="font-medium">Daily 10AM-10PM EST</p>
              </div>
              
              <button
                onClick={() => openHelpWidget()}
                className="w-full py-3 px-4 rounded-lg font-medium transition-colors bg-logo-signal hover:bg-logo-forest text-white"
              >
                Start Chat
              </button>
            </div>
          </div>

          {/* Quick Access Section */}
          <div className="mt-12 bg-white rounded-lg shadow-sm border p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Quick Help</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => openHelpWidget("kb.category.detail")}
                className="p-4 text-left border rounded-lg hover:border-logo-teal hover:bg-gray-50 transition-all"
              >
                <h3 className="font-semibold text-gray-900">Setup Guides</h3>
                <p className="text-sm text-gray-600">Getting started tutorials</p>
              </button>
              
              <button
                onClick={() => openHelpWidget("kb.category.detail")}
                className="p-4 text-left border rounded-lg hover:border-logo-teal hover:bg-gray-50 transition-all"
              >
                <h3 className="font-semibold text-gray-900">Troubleshooting</h3>
                <p className="text-sm text-gray-600">Fix connectivity issues</p>
              </button>
              
              <button
                onClick={() => openHelpWidget("community.category.list")}
                className="p-4 text-left border rounded-lg hover:border-logo-teal hover:bg-gray-50 transition-all"
              >
                <h3 className="font-semibold text-gray-900">Community</h3>
                <p className="text-sm text-gray-600">User discussions</p>
              </button>
              
              <button
                onClick={() => openHelpWidget("ticket.form")}
                className="p-4 text-left border rounded-lg hover:border-logo-teal hover:bg-gray-50 transition-all"
              >
                <h3 className="font-semibold text-gray-900">Contact Us</h3>
                <p className="text-sm text-gray-600">Get personalized help</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Zoho ASAP Widget Script */}
      {process.env.NEXT_PUBLIC_ZOHO_ASAP_WIDGET_URL && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.ZohoHCAsap = window.ZohoHCAsap || function(a, b) {
                ZohoHCAsap[a] = b;
              };
              (function() {
                var d = document;
                var s = d.createElement("script");
                s.type = "text/javascript";
                s.defer = true;
                s.src = "${process.env.NEXT_PUBLIC_ZOHO_ASAP_WIDGET_URL}";
                d.getElementsByTagName("head")[0].appendChild(s);
              })();
            `
          }}
        />
      )}
    </Layout>
  );
};

export default SupportPage;