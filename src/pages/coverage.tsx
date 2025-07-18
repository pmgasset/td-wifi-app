// src/pages/coverage.tsx
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { 
  MapPin, Search, CheckCircle, Zap, Signal, Globe, Shield, Phone, Mail,
  ChevronDown, AlertCircle, Loader2, Navigation, Users, Star, Smartphone
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CoverageFormData {
  address: string;
  email: string;
  name: string;
  phone: string;
  primaryUse: string;
  currentProvider: string;
  dataUsage: string;
}

interface AddressSuggestion {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

const CoveragePage = () => {
  const [formData, setFormData] = useState<CoverageFormData>({
    address: '',
    email: '',
    name: '',
    phone: '',
    primaryUse: '',
    currentProvider: '',
    dataUsage: ''
  });

  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [coverageResult, setCoverageResult] = useState<any>(null);

  // Debounced address search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.address.length > 2) {
        searchAddresses(formData.address);
      } else {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [formData.address]);

  const searchAddresses = async (query: string) => {
    setIsLoadingSuggestions(true);
    try {
      const response = await fetch('/api/geocode-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (response.ok) {
        const data = await response.json();
        setAddressSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Address search failed:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const selectAddress = (suggestion: AddressSuggestion) => {
    setFormData(prev => ({ ...prev, address: suggestion.description }));
    setShowSuggestions(false);
    setShowForm(true);
    
    // Automatically scroll to the form after a brief delay
    setTimeout(() => {
      const formElement = document.getElementById('coverage-form');
      if (formElement) {
        formElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      }
    }, 100);
  };

  const handleInputChange = (field: keyof CoverageFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Submit lead to Zoho CRM
      const response = await fetch('/api/coverage-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        setCoverageResult(result);
        toast.success('Coverage check request submitted! We\'ll contact you within 24 hours.');
        
        // Automatically scroll to success section
        setTimeout(() => {
          const successElement = document.getElementById('coverage-success');
          if (successElement) {
            successElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start',
              inline: 'nearest'
            });
          }
        }, 100);
      } else {
        throw new Error(result.error || 'Failed to submit coverage request');
      }
    } catch (error) {
      console.error('Coverage submission failed:', error);
      toast.error('Failed to submit request. Please try again or contact support.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryUseOptions = [
    { value: 'rv-travel', label: 'RV & Camping Travel' },
    { value: 'remote-work', label: 'Remote Work & Business' },
    { value: 'digital-nomad', label: 'Digital Nomad Lifestyle' },
    { value: 'home-backup', label: 'Home Internet Backup' },
    { value: 'rural-internet', label: 'Rural Primary Internet' },
    { value: 'other', label: 'Other' }
  ];

  const dataUsageOptions = [
    { value: 'light', label: 'Light (0-50GB/month) - Email, browsing' },
    { value: 'moderate', label: 'Moderate (50-200GB/month) - Video calls, streaming' },
    { value: 'heavy', label: 'Heavy (200GB+/month) - 4K streaming, large uploads' },
    { value: 'unlimited', label: 'Unlimited - No data limits needed' }
  ];

  const currentProviderOptions = [
    { value: 'none', label: 'No current mobile internet' },
    { value: 'verizon', label: 'Verizon' },
    { value: 'att', label: 'AT&T' },
    { value: 'tmobile', label: 'T-Mobile' },
    { value: 'sprint', label: 'Sprint' },
    { value: 'other-carrier', label: 'Other carrier' },
    { value: 'satellite', label: 'Satellite internet (Starlink, etc.)' }
  ];

  return (
    <Layout 
      title="Coverage Map & Professional Coverage Check - Travel Data WiFi"
      description="Check T-Mobile 5G and 4G coverage at your location. Get a professional coverage analysis and personalized recommendations for your connectivity needs."
      canonical="https://traveldatawifi.com/coverage"
    >
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-logo-ocean via-logo-teal to-logo-signal py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <div className="mb-8">
            <MapPin className="h-16 w-16 mx-auto mb-6 text-yellow-400" />
            <h1 className="text-4xl lg:text-6xl font-bold mb-6">
              Find the Perfect Internet for Your Location
            </h1>
            <p className="text-xl lg:text-2xl text-blue-100 max-w-3xl mx-auto">
              Enter your address for instant coverage analysis and get a personalized 
              recommendation from our connectivity experts.
            </p>
          </div>

          {/* Address Search */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-2xl mx-auto">
            <div className="relative">
              <div className="flex">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Enter your address, city, or ZIP code"
                    className="w-full px-4 py-4 text-lg text-gray-900 bg-white rounded-l-lg border-0 focus:ring-2 focus:ring-logo-signal outline-none"
                  />
                  
                  {isLoadingSuggestions && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  )}

                  {/* Address Suggestions */}
                  {showSuggestions && addressSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-lg shadow-xl z-10 max-h-80 overflow-y-auto">
                      {addressSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => selectAddress(suggestion)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-semibold text-gray-900">
                            {suggestion.structured_formatting.main_text}
                          </div>
                          <div className="text-sm text-gray-600">
                            {suggestion.structured_formatting.secondary_text}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => {
                    if (formData.address) {
                      setShowForm(true);
                      // Automatically scroll to the form after a brief delay
                      setTimeout(() => {
                        const formElement = document.getElementById('coverage-form');
                        if (formElement) {
                          formElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start',
                            inline: 'nearest'
                          });
                        }
                      }, 100);
                    }
                  }}
                  disabled={!formData.address}
                  className="px-8 py-4 bg-logo-signal text-white rounded-r-lg font-bold text-lg hover:bg-logo-forest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Search className="h-6 w-6" />
                </button>
              </div>
            </div>

            <p className="text-blue-100 text-sm mt-4">
              We'll provide instant coverage data and connect you with an expert for personalized recommendations.
            </p>
          </div>
        </div>
      </section>

      {/* Coverage Benefits */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Why Our Coverage Analysis Matters
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Not all coverage maps are created equal. Get the real story about connectivity at your location.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-logo-teal rounded-full flex items-center justify-center mx-auto mb-4">
                <Signal className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Real-World Testing</h3>
              <p className="text-gray-600">
                Our coverage data comes from actual field testing, not just carrier maps. 
                We know what really works.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-logo-ocean rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Expert Consultation</h3>
              <p className="text-gray-600">
                Get personalized recommendations from connectivity experts who understand 
                your specific use case and location challenges.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-logo-signal rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Guaranteed Solutions</h3>
              <p className="text-gray-600">
                We only recommend solutions we're confident will work at your location. 
                No surprises, no disappointments.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Lead Capture Form */}
      {showForm && !coverageResult && (
        <section id="coverage-form" className="py-16 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Great! We found your location.
                </h2>
                <p className="text-gray-600">
                  Now let's get you a personalized coverage analysis and recommendation.
                </p>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <MapPin className="h-4 w-4 inline mr-2" />
                    {formData.address}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-logo-teal focus:border-transparent outline-none"
                      placeholder="John Smith"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-logo-teal focus:border-transparent outline-none"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-logo-teal focus:border-transparent outline-none"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Primary Use Case *
                  </label>
                  <div className="relative">
                    <select
                      required
                      value={formData.primaryUse}
                      onChange={(e) => handleInputChange('primaryUse', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-logo-teal focus:border-transparent outline-none appearance-none bg-white"
                    >
                      <option value="">Select your primary use case</option>
                      {primaryUseOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Internet Provider
                  </label>
                  <div className="relative">
                    <select
                      value={formData.currentProvider}
                      onChange={(e) => handleInputChange('currentProvider', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-logo-teal focus:border-transparent outline-none appearance-none bg-white"
                    >
                      <option value="">Select current provider (optional)</option>
                      {currentProviderOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Expected Data Usage *
                  </label>
                  <div className="relative">
                    <select
                      required
                      value={formData.dataUsage}
                      onChange={(e) => handleInputChange('dataUsage', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-logo-teal focus:border-transparent outline-none appearance-none bg-white"
                    >
                      <option value="">Select your data usage</option>
                      {dataUsageOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">What happens next?</p>
                      <ul className="space-y-1">
                        <li>• We'll analyze T-Mobile coverage at your specific location</li>
                        <li>• A connectivity expert will call you within 24 hours</li>
                        <li>• Get personalized router and plan recommendations</li>
                        <li>• No obligation - free consultation and advice</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-logo-teal to-logo-ocean text-white py-4 px-8 rounded-lg font-bold text-lg hover:from-logo-ocean hover:to-logo-teal transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2 inline" />
                      Submitting Request...
                    </>
                  ) : (
                    'Get My Coverage Analysis →'
                  )}
                </button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Success State */}
      {coverageResult && (
        <section id="coverage-success" className="py-16 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Coverage Request Submitted!
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Thanks {formData.name}! Our connectivity experts are analyzing coverage at your location.
              </p>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
                <h3 className="font-semibold text-green-800 mb-2">What's Next:</h3>
                <ul className="text-left space-y-2 text-green-700">
                  <li>• We'll call you within 24 hours at {formData.phone || 'your provided number'}</li>
                  <li>• Get detailed coverage analysis for {formData.address}</li>
                  <li>• Receive personalized router and plan recommendations</li>
                  <li>• Free consultation with no pressure to buy</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href="/products"
                  className="bg-logo-teal text-white py-3 px-6 rounded-lg font-semibold hover:bg-logo-ocean transition-colors"
                >
                  Browse Products
                </a>
                <a
                  href="/solutions"
                  className="border-2 border-logo-teal text-logo-teal py-3 px-6 rounded-lg font-semibold hover:bg-logo-teal hover:text-white transition-colors"
                >
                  View Solutions
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Network Information */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Powered by T-Mobile's Network
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We use T-Mobile's extensive 5G and 4G LTE network to deliver reliable connectivity nationwide.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Signal className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">5G Ultra Capacity</h3>
              <p className="text-sm text-gray-600">Ultra-fast speeds in major cities and growing</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Nationwide 4G LTE</h3>
              <p className="text-sm text-gray-600">Reliable coverage across all 50 states</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Priority Data</h3>
              <p className="text-sm text-gray-600">No throttling or deprioritization on our plans</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Secure Connection</h3>
              <p className="text-sm text-gray-600">Enterprise-grade security and privacy</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-8">
            {[
              {
                question: "How accurate is your coverage analysis?",
                answer: "Our coverage analysis combines T-Mobile's official coverage maps with real-world testing data from our customers. We provide both theoretical coverage and practical performance expectations."
              },
              {
                question: "Is the coverage consultation really free?",
                answer: "Yes! Our coverage consultation is completely free with no obligation to purchase. We want to make sure you get the right solution for your specific location and needs."
              },
              {
                question: "What if T-Mobile doesn't have good coverage at my location?",
                answer: "We'll be honest about coverage limitations and can recommend alternative solutions or different carriers that might work better for your specific location."
              },
              {
                question: "How long does the consultation take?",
                answer: "Most consultations take 10-15 minutes. Our experts will ask about your location, usage needs, and current challenges to provide the best recommendations."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {faq.question}
                </h3>
                <p className="text-gray-600">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-logo-ocean text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Need Help Right Now?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Our connectivity experts are standing by to help you find the perfect solution.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="tel:1-800-943-4781"
              className="bg-yellow-400 text-gray-900 px-8 py-4 rounded-lg font-bold text-lg hover:bg-yellow-500 transition-colors inline-flex items-center justify-center"
            >
              <Phone className="mr-2 h-5 w-5" />
              Call 1-800-WIFI-RV
            </a>
            
            <a
              href="mailto:coverage@traveldatawifi.com"
              className="border-2 border-white text-white hover:bg-white hover:text-logo-ocean px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 inline-flex items-center justify-center"
            >
              <Mail className="mr-2 h-5 w-5" />
              Email Us
            </a>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default CoveragePage;