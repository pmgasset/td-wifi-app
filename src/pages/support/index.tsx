// src/pages/support/index.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
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
import SupportDashboard from '../../../components/support/SupportDashboard';

const SupportPage: React.FC = () => {
  const router = useRouter();
  const { view, category } = router.query;

  // Quick help categories with your branding
  const quickHelpCategories = [
    {
      id: 'setup',
      title: 'Device Setup',
      description: 'Get your devices up and running quickly',
      icon: Settings,
      color: 'bg-blue-50 text-blue-600 border-blue-200',
      articles: 15,
      popular: true
    },
    {
      id: 'connectivity',
      title: 'Connection Issues',
      description: 'Troubleshoot connectivity problems',
      icon: Wifi,
      color: 'bg-red-50 text-red-600 border-red-200',
      articles: 23,
      popular: true
    },
    {
      id: 'performance',
      title: 'Speed & Performance',
      description: 'Optimize your internet speed',
      icon: Zap,
      color: 'bg-yellow-50 text-yellow-600 border-yellow-200',
      articles: 18,
      popular: false
    },
    {
      id: 'security',
      title: 'Network Security',
      description: 'Keep your connection secure',
      icon: Shield,
      color: 'bg-green-50 text-green-600 border-green-200',
      articles: 12,
      popular: false
    }
  ];

  const supportStats = {
    totalArticles: 150,
    totalCategories: 8,
    avgResponseTime: '< 2 hours',
    satisfactionRate: '98%'
  };

  const contactOptions = [
    {
      title: 'Phone Support',
      description: 'Speak directly with our RV internet experts',
      icon: Phone,
      contact: '1-800-555-0123',
      hours: 'Mon-Fri 8AM-8PM EST',
      color: 'bg-logo-teal text-white',
      action: 'Call Now'
    },
    {
      title: 'Email Support',
      description: '24/7 email support with detailed responses',
      icon: Mail,
      contact: 'support@traveldatawifi.com',
      hours: 'Response within 2 hours',
      color: 'bg-logo-ocean text-white',
      action: 'Send Email'
    },
    {
      title: 'Live Chat',
      description: 'Instant help from our support team',
      icon: MessageCircle,
      contact: 'Available now',
      hours: 'Mon-Sat 9AM-6PM EST',
      color: 'bg-logo-signal text-white',
      action: 'Start Chat'
    }
  ];

  return (
    <Layout 
      title="Support Center - Travel Data WiFi"
      description="Get expert help with your mobile internet setup. Access our knowledge base, contact support, and find solutions for RV internet connectivity."
    >
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-logo-teal via-logo-ocean to-logo-teal text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                  <HelpCircle className="h-12 w-12 text-white" />
                </div>
              </div>
              
              <h1 className="text-4xl lg:text-5xl font-bold mb-6">
                Travel Data WiFi Support Center
              </h1>
              
              <p className="text-xl lg:text-2xl text-teal-100 mb-8 max-w-3xl mx-auto">
                Expert help for your mobile internet needs. Get instant answers, 
                step-by-step guides, and personalized support from RV connectivity specialists.
              </p>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold">{supportStats.totalArticles}+</div>
                  <div className="text-teal-100 text-sm">Help Articles</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold">{supportStats.avgResponseTime}</div>
                  <div className="text-teal-100 text-sm">Response Time</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold">{supportStats.satisfactionRate}</div>
                  <div className="text-teal-100 text-sm">Satisfaction Rate</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold">50K+</div>
                  <div className="text-teal-100 text-sm">Happy Customers</div>
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
                <div className="flex items-center space-x-2">
                  <HelpCircle className="h-4 w-4" />
                  <span>Support Home</span>
                </div>
              </button>

              <button
                onClick={() => router.push('/support?view=articles')}
                className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  view === 'articles'
                    ? 'border-logo-teal text-logo-teal'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4" />
                  <span>Knowledge Base</span>
                </div>
              </button>

              <button
                onClick={() => router.push('/support?view=contact')}
                className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  view === 'contact'
                    ? 'border-logo-teal text-logo-teal'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <MessageCircle className="h-4 w-4" />
                  <span>Contact Us</span>
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Support Dashboard Integration */}
          {(!view || view === 'home' || view === 'articles' || view === 'contact' || view === 'search') && (
            <SupportDashboard />
          )}

          {/* Quick Help Section - Only show on home view */}
          {(!view || view === 'home') && (
            <>
              {/* Quick Help Categories */}
              <div className="mb-16">
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Popular Help Topics
                  </h2>
                  <p className="text-xl text-gray-600">
                    Get quick answers to the most common questions
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {quickHelpCategories.map((category) => (
                    <div
                      key={category.id}
                      className={`relative group cursor-pointer rounded-xl border-2 p-6 hover:shadow-lg transition-all duration-200 ${category.color}`}
                      onClick={() => router.push(`/support?view=articles&category=${category.id}`)}
                    >
                      {category.popular && (
                        <div className="absolute -top-2 -right-2 bg-logo-signal text-white text-xs font-bold px-2 py-1 rounded-full">
                          Popular
                        </div>
                      )}
                      
                      <div className="flex items-center mb-4">
                        <category.icon className="h-8 w-8 mr-3" />
                        <h3 className="text-lg font-semibold">{category.title}</h3>
                      </div>
                      
                      <p className="text-sm mb-4 opacity-80">
                        {category.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {category.articles} articles
                        </span>
                        <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Options */}
              <div className="mb-16">
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Need Personal Help?
                  </h2>
                  <p className="text-xl text-gray-600">
                    Our RV internet experts are here to help you succeed
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {contactOptions.map((option, index) => (
                    <div
                      key={index}
                      className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 hover:shadow-xl transition-shadow"
                    >
                      <div className={`w-16 h-16 ${option.color} rounded-full flex items-center justify-center mb-6`}>
                        <option.icon className="h-8 w-8" />
                      </div>
                      
                      <h3 className="text-xl font-semibold text-gray-900 mb-3">
                        {option.title}
                      </h3>
                      
                      <p className="text-gray-600 mb-4">
                        {option.description}
                      </p>
                      
                      <div className="mb-6">
                        <p className="font-semibold text-gray-900">{option.contact}</p>
                        <p className="text-sm text-gray-500">{option.hours}</p>
                      </div>
                      
                      <button className={`w-full ${option.color} py-3 px-4 rounded-lg font-semibold hover:opacity-90 transition-opacity`}>
                        {option.action}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Success Stories */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Success Stories
                  </h2>
                  <p className="text-gray-600">
                    See how we've helped fellow RV travelers stay connected
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[
                    {
                      name: "Sarah & Mike",
                      location: "Full-time RVers",
                      testimonial: "Travel Data WiFi transformed our remote work setup. Crystal clear video calls from anywhere!",
                      setup: "5G Hotspot + Signal Booster"
                    },
                    {
                      name: "The Johnson Family",
                      location: "Weekend Warriors",
                      testimonial: "Kids can stream, we can work, and everyone stays happy on our camping trips.",
                      setup: "Mobile Hotspot + External Antenna"
                    },
                    {
                      name: "Robert Thompson",
                      location: "Solo Traveler",
                      testimonial: "Best investment for my RV. Reliable internet in places I never thought possible.",
                      setup: "Complete Connectivity Kit"
                    }
                  ].map((story, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center mb-4">
                        <div className="w-12 h-12 bg-logo-teal rounded-full flex items-center justify-center text-white font-bold">
                          {story.name.charAt(0)}
                        </div>
                        <div className="ml-3">
                          <h4 className="font-semibold text-gray-900">{story.name}</h4>
                          <p className="text-sm text-gray-500">{story.location}</p>
                        </div>
                      </div>
                      
                      <p className="text-gray-700 mb-4 italic">
                        "{story.testimonial}"
                      </p>
                      
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">Setup: </span>
                        <span className="text-gray-600">{story.setup}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SupportPage;