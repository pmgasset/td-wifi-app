// src/pages/support/index.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import '../../types/zoho-salesiq'; // Import type declarations
import { 
  Search, 
  HelpCircle, 
  BookOpen, 
  MessageCircle, 
  Users, 
  TrendingUp,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  ArrowRight,
  FileText,
  Zap,
  Settings,
  Shield,
  Wifi,
  ChevronRight,
  ArrowLeft,
  Send,
  User,
  AlertCircle,
  Upload,
  X,
  Eye,
  ThumbsUp,
  Tag,
  Filter,
  Star
} from 'lucide-react';

// Import support components with correct path (from root components directory)
import SupportDashboard from '../../components/support/SupportDashboard';

const SupportPage: React.FC = () => {
  const router = useRouter();
  const { view, category } = router.query;

  const [searchQuery, setSearchQuery] = useState('');
  const [isEmailFormOpen, setIsEmailFormOpen] = useState(false);
  const [emailFormData, setEmailFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  // Updated contact options - removed phone support, enabled email and chat
  const contactOptions = [
    {
      title: 'Email Support',
      description: '24/7 email support with detailed responses',
      icon: Mail,
      contact: 'support@traveldatawifi.com',
      hours: 'Response within 2 hours',
      color: 'bg-logo-ocean text-white',
      action: 'Send Email',
      enabled: true
    },
    {
      title: 'Live Chat',
      description: 'Instant help from our support team',
      icon: MessageCircle,
      contact: 'Available now',
      hours: 'Daily 10AM-10PM EST',
      color: 'bg-logo-signal text-white',
      action: 'Start Chat',
      enabled: true
    }
  ];

  // Handle email form submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSubmitting(true);

    try {
      const response = await fetch('/api/support/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...emailFormData,
          type: 'email_support',
          timestamp: new Date().toISOString()
        }),
      });

      if (response.ok) {
        setEmailSubmitted(true);
        setEmailFormData({ name: '', email: '', subject: '', message: '' });
        setTimeout(() => {
          setIsEmailFormOpen(false);
          setEmailSubmitted(false);
        }, 3000);
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again or contact us directly at support@traveldatawifi.com');
    } finally {
      setEmailSubmitting(false);
    }
  };

  // Handle live chat initialization
  const handleStartChat = () => {
    // Initialize Zoho SalesIQ chat widget
    if (typeof window !== 'undefined') {
      // Check if Zoho SalesIQ is loaded
      if (window.$zoho?.salesiq?.chat) {
        window.$zoho.salesiq.chat.start();
      } else {
        // Fallback - load and initialize Zoho SalesIQ
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.src = 'https://salesiq.zoho.com/widget';
        script.onload = () => {
          if (window.$zoho?.salesiq) {
            if (window.$zoho.salesiq.ready) {
              window.$zoho.salesiq.ready();
            }
            setTimeout(() => {
              if (window.$zoho?.salesiq?.chat) {
                window.$zoho.salesiq.chat.start();
              }
            }, 1000);
          }
        };
        document.head.appendChild(script);
      }
    }
  };

  // Handle contact option click
  const handleContactClick = (option: any) => {
    if (!option.enabled) return;
    
    if (option.title === 'Email Support') {
      setIsEmailFormOpen(true);
    } else if (option.title === 'Live Chat') {
      handleStartChat();
    }
  };

  return (
    <Layout 
      title="Support Center - Travel Data WiFi"
      description="Get expert help with your mobile internet setup. Access our knowledge base, contact support, and find solutions for RV internet connectivity."
    >
      <div className="min-h-screen bg-gray-50">
        {/* Simplified Hero Section - Removed banner and stats */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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

              {/* Search Bar */}
              <div className="max-w-2xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search for help articles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-logo-teal focus:border-transparent"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        router.push(`/support?view=search&q=${encodeURIComponent(searchQuery)}`);
                      }
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        if (searchQuery.trim()) {
                          router.push(`/support?view=search&q=${encodeURIComponent(searchQuery)}`);
                        }
                      }}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-logo-teal text-white px-4 py-2 rounded-md hover:bg-logo-ocean transition-colors"
                    >
                      Search
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8 overflow-x-auto">
              <button
                onClick={() => router.push('/support')}
                className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  !view || view === 'home'
                    ? 'border-logo-teal text-logo-teal'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <HelpCircle className="inline h-4 w-4 mr-1" />
                Support Home
              </button>
              
              <button
                onClick={() => router.push('/support?view=articles')}
                className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  view === 'articles'
                    ? 'border-logo-teal text-logo-teal'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BookOpen className="inline h-4 w-4 mr-1" />
                Knowledge Base
              </button>
              
              <button
                onClick={() => router.push('/support?view=contact')}
                className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  view === 'contact'
                    ? 'border-logo-teal text-logo-teal'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <MessageCircle className="inline h-4 w-4 mr-1" />
                Contact Support
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!view || view === 'home' ? (
            <>
              {/* Contact Options - Updated with removed phone support and enabled buttons */}
              <div className="mb-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {contactOptions.map((option, index) => (
                    <div
                      key={index}
                      className={`relative p-6 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                        option.enabled 
                          ? 'hover:border-logo-teal hover:shadow-lg transform hover:-translate-y-1' 
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      onClick={() => handleContactClick(option)}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-full ${option.color}`}>
                          <option.icon className="h-6 w-6" />
                        </div>
                        {option.enabled && (
                          <span className="text-sm text-green-600 font-medium">Available</span>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {option.title}
                      </h3>
                      
                      <p className="text-gray-600 mb-4">
                        {option.description}
                      </p>
                      
                      <div className="text-sm text-gray-500 mb-4">
                        <p className="font-medium">{option.contact}</p>
                        <p>{option.hours}</p>
                      </div>
                      
                      <button
                        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                          option.enabled
                            ? `${option.color} hover:opacity-90 text-white`
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                        disabled={!option.enabled}
                      >
                        {option.action}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Browse Knowledge Base */}
              <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Browse Knowledge Base</h2>
                  <Link
                    href="/support?view=articles"
                    className="text-logo-teal hover:text-logo-ocean font-medium flex items-center"
                  >
                    View All Articles
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </div>
                
                <p className="text-gray-600 mb-6">
                  Find answers to common questions and step-by-step guides
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Link
                    href="/support?view=articles&category=setup"
                    className="p-4 border rounded-lg hover:border-logo-teal hover:shadow-md transition-all"
                  >
                    <Settings className="h-6 w-6 text-blue-600 mb-2" />
                    <h3 className="font-semibold text-gray-900">Getting Started</h3>
                    <p className="text-sm text-gray-600">Setup guides and tutorials</p>
                  </Link>
                  
                  <Link
                    href="/support?view=articles&category=troubleshooting"
                    className="p-4 border rounded-lg hover:border-logo-teal hover:shadow-md transition-all"
                  >
                    <AlertCircle className="h-6 w-6 text-red-600 mb-2" />
                    <h3 className="font-semibold text-gray-900">Troubleshooting</h3>
                    <p className="text-sm text-gray-600">Fix common issues</p>
                  </Link>
                  
                  <Link
                    href="/support?view=articles&category=tips"
                    className="p-4 border rounded-lg hover:border-logo-teal hover:shadow-md transition-all"
                  >
                    <Star className="h-6 w-6 text-yellow-600 mb-2" />
                    <h3 className="font-semibold text-gray-900">Tips & Tricks</h3>
                    <p className="text-sm text-gray-600">Optimize your setup</p>
                  </Link>
                </div>
              </div>
            </>
          ) : view === 'articles' ? (
            <SupportDashboard />
          ) : view === 'contact' ? (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm border p-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Contact Support</h2>
                
                {/* Contact options repeated here for contact view */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {contactOptions.map((option, index) => (
                    <div
                      key={index}
                      className={`p-6 rounded-lg border-2 transition-all duration-300 cursor-pointer ${
                        option.enabled 
                          ? 'hover:border-logo-teal hover:shadow-lg' 
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      onClick={() => handleContactClick(option)}
                    >
                      <div className="flex items-center mb-4">
                        <div className={`p-2 rounded-full ${option.color} mr-3`}>
                          <option.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{option.title}</h3>
                          <p className="text-sm text-gray-600">{option.hours}</p>
                        </div>
                      </div>
                      
                      <button
                        className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                          option.enabled
                            ? `${option.color} hover:opacity-90 text-white`
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                        disabled={!option.enabled}
                      >
                        {option.action}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : view === 'search' ? (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm border p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Search Results</h2>
                <p className="text-gray-600">
                  Searching for: <span className="font-medium">"{router.query.q}"</span>
                </p>
                {/* Search results would be loaded here */}
                <div className="mt-8 text-center text-gray-500">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Search functionality coming soon</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Email Support Modal */}
        {isEmailFormOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Send Email</h3>
                  <button
                    onClick={() => setIsEmailFormOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {emailSubmitted ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Email Sent!</h4>
                    <p className="text-gray-600">
                      We'll respond within 2 hours during business hours.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={emailFormData.name}
                        onChange={(e) => setEmailFormData({...emailFormData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-logo-teal focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={emailFormData.email}
                        onChange={(e) => setEmailFormData({...emailFormData, email: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-logo-teal focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subject *
                      </label>
                      <input
                        type="text"
                        required
                        value={emailFormData.subject}
                        onChange={(e) => setEmailFormData({...emailFormData, subject: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-logo-teal focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Message *
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={emailFormData.message}
                        onChange={(e) => setEmailFormData({...emailFormData, message: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-logo-teal focus:border-transparent"
                        placeholder="Describe your issue or question..."
                      />
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsEmailFormOpen(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={emailSubmitting}
                        className="flex-1 px-4 py-2 bg-logo-ocean text-white rounded-md hover:bg-logo-teal transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        {emailSubmitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Email
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Zoho SalesIQ Script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function(){
              var $zoho = $zoho || {};
              $zoho.salesiq = $zoho.salesiq || {
                widgetcode: "${process.env.NEXT_PUBLIC_ZOHO_SALESIQ_WIDGET_CODE || 'YOUR_WIDGET_CODE_HERE'}",
                values: {},
                ready: function() {
                  console.log('Zoho SalesIQ ready');
                }
              };
              var d = document;
              var s = d.createElement("script");
              s.type = "text/javascript";
              s.id = "zsiqscript";
              s.defer = true;
              s.src = "https://salesiq.zoho.com/widget";
              var t = d.getElementsByTagName("script")[0];
              t.parentNode.insertBefore(s, t);
              window.$zoho = $zoho;
            })();
          `
        }}
      />
    </Layout>
  );
};

export default SupportPage;