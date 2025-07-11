// ===== src/pages/index.tsx =====
import React from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import { Wifi, Zap, Shield, MapPin, Star, CheckCircle, ArrowRight, Users, Award, Globe } from 'lucide-react';

const Home: React.FC = () => {
  const heroSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Travel Data WiFi",
    "description": "Premium mobile internet solutions for RV travelers and remote workers",
    "url": "https://traveldatawifi.com",
    "logo": "https://traveldatawifi.com/images/logo.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-555-TRAVEL",
      "contactType": "customer service"
    }
  };

  const features = [
    {
      icon: Zap,
      title: "Lightning Fast 5G",
      description: "Experience blazing speeds up to 8Gbps for seamless streaming, video calls, and remote work",
      color: "from-yellow-400 to-orange-500"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Military-grade encryption and VPN protection keeps your data safe on public networks",
      color: "from-green-400 to-emerald-500"
    },
    {
      icon: Globe,
      title: "Nationwide Coverage",
      description: "Stay connected across all 50 states with our multi-carrier network technology",
      color: "from-blue-400 to-purple-500"
    },
    {
      icon: Wifi,
      title: "Truly Unlimited",
      description: "No throttling, no data caps, no surprises - just unlimited high-speed internet",
      color: "from-purple-400 to-pink-500"
    }
  ];

  const stats = [
    { number: "50,000+", label: "Happy Customers", icon: Users },
    { number: "99.9%", label: "Uptime Guarantee", icon: CheckCircle },
    { number: "24/7", label: "Expert Support", icon: Award },
    { number: "50 States", label: "Coverage Area", icon: MapPin }
  ];

  return (
    <Layout schema={heroSchema}>
      {/* Hero Section with Modern Gradient */}
      <section className="relative overflow-hidden">
        {/* Background with animated gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-travel-blue via-blue-600 to-indigo-700">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-8">
              <Star className="h-5 w-5 text-yellow-400 fill-current" />
              <span className="text-white/90 text-sm font-medium">Trusted by 50,000+ RV Travelers</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 text-shadow">
              Stay Connected{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 animate-pulse-slow">
                Anywhere
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-blue-100 mb-10 max-w-3xl mx-auto leading-relaxed">
              Premium mobile internet solutions designed for RV travelers, digital nomads, and remote workers who demand reliable connectivity on the road
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link 
                href="/products" 
                className="btn-secondary inline-flex items-center space-x-2 text-lg"
              >
                <span>Shop Products</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link 
                href="/guides" 
                className="btn-outline bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white hover:text-travel-blue text-lg"
              >
                Setup Guides
              </Link>
            </div>
            
            {/* Trust indicators */}
            <div className="flex items-center justify-center space-x-8 text-white/80">
              <div className="flex items-center space-x-1">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-sm">Free Shipping</span>
              </div>
              <div className="flex items-center space-x-1">
                <Shield className="h-5 w-5 text-blue-400" />
                <span className="text-sm">Secure Payment</span>
              </div>
              <div className="flex items-center space-x-1">
                <Award className="h-5 w-5 text-yellow-400" />
                <span className="text-sm">30-Day Guarantee</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Floating elements */}
        <div className="absolute top-20 left-10 animate-float">
          <Wifi className="h-8 w-8 text-white/20" />
        </div>
        <div className="absolute top-40 right-20 animate-float" style={{animationDelay: '2s'}}>
          <Zap className="h-6 w-6 text-yellow-400/30" />
        </div>
        <div className="absolute bottom-32 left-20 animate-float" style={{animationDelay: '4s'}}>
          <Globe className="h-10 w-10 text-blue-300/20" />
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-travel-blue to-blue-600 rounded-full mb-4">
                  <stat.icon className="h-8 w-8 text-white" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section with Cards */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose <span className="text-gradient">Travel Data WiFi</span>?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We've revolutionized mobile internet for travelers with cutting-edge technology and unmatched reliability
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card card-hover p-8 text-center group">
                <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r ${feature.color} rounded-full mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Preview Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Premium <span className="text-gradient-orange">Mobile Internet</span> Solutions
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              From powerful hotspots to signal boosters, we have everything you need to stay connected on your journey
            </p>
            
            {/* Product categories preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="card p-6 text-center group cursor-pointer">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Wifi className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Mobile Hotspots</h3>
                <p className="text-gray-600 text-sm">High-speed 5G devices for multiple connections</p>
              </div>
              
              <div className="card p-6 text-center group cursor-pointer">
                <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Signal Boosters</h3>
                <p className="text-gray-600 text-sm">Amplify weak signals in remote areas</p>
              </div>
              
              <div className="card p-6 text-center group cursor-pointer">
                <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Globe className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Plans</h3>
                <p className="text-gray-600 text-sm">Unlimited data with no throttling</p>
              </div>
            </div>
            
            <Link 
              href="/products"
              className="btn-primary text-lg inline-flex items-center space-x-2"
            >
              <span>Browse All Products</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section with Gradient */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-travel-blue via-purple-700 to-travel-blue">
          <div className="absolute inset-0 bg-black/20"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6 text-shadow">
            Ready to Transform Your Travel Experience?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Join thousands of RV travelers, digital nomads, and remote workers who trust Travel Data WiFi for their connectivity needs
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/products" 
              className="btn-secondary text-lg inline-flex items-center space-x-2"
            >
              <span>Shop Now</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link 
              href="/support" 
              className="btn-outline border-white text-white hover:bg-white hover:text-travel-blue text-lg"
            >
              Get Support
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Home;