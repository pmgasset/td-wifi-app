// ===== src/pages/index.tsx =====
import React from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import { Wifi, Zap, Shield, MapPin, Star, CheckCircle } from 'lucide-react';

const Home: React.FC = () => {
  const heroSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Travel Data WiFi",
    "description": "Premium mobile internet solutions for RV travelers and remote workers",
    "url": "https://traveldatawifi.com",
    "logo": "https://traveldatawifi.com/images/logo.png"
  };

  const features = [
    {
      icon: Zap,
      title: "Lightning Fast 5G",
      description: "Experience blazing speeds up to 8Gbps for seamless streaming, video calls, and remote work"
    },
    {
      icon: Shield,
      title: "Enterprise Security", 
      description: "Military-grade encryption and VPN protection keeps your data safe on public networks"
    },
    {
      icon: MapPin,
      title: "Nationwide Coverage",
      description: "Stay connected across all 50 states with our multi-carrier network technology"
    },
    {
      icon: Wifi,
      title: "Truly Unlimited",
      description: "No throttling, no data caps, no surprises - just unlimited high-speed internet"
    }
  ];

  return (
    <Layout schema={heroSchema}>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-travel-blue to-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-white bg-opacity-10 rounded-full px-4 py-2 mb-8">
              <Star className="h-5 w-5 text-yellow-400 fill-current" />
              <span className="text-white text-sm font-medium">Trusted by 50,000+ RV Travelers</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Stay Connected{' '}
              <span className="text-yellow-400">Anywhere</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-blue-100 mb-10 max-w-3xl mx-auto">
              Premium mobile internet solutions designed for RV travelers, digital nomads, and remote workers who demand reliable connectivity on the road
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link 
                href="/products" 
                className="bg-travel-orange hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
              >
                Shop Products
              </Link>
              <Link 
                href="/guides" 
                className="border-2 border-white text-white hover:bg-white hover:text-travel-blue px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
              >
                Setup Guides
              </Link>
            </div>
            
            <div className="flex items-center justify-center space-x-8 text-white text-opacity-80">
              <div className="flex items-center space-x-1">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-sm">Free Shipping</span>
              </div>
              <div className="flex items-center space-x-1">
                <Shield className="h-5 w-5 text-blue-400" />
                <span className="text-sm">Secure Payment</span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="h-5 w-5 text-yellow-400" />
                <span className="text-sm">30-Day Guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-travel-blue to-blue-600 rounded-full mb-4">
                <Wifi className="h-8 w-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">50,000+</div>
              <div className="text-gray-600">Happy Customers</div>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full mb-4">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">99.9%</div>
              <div className="text-gray-600">Uptime Guarantee</div>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-travel-orange to-orange-600 rounded-full mb-4">
                <Star className="h-8 w-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">24/7</div>
              <div className="text-gray-600">Expert Support</div>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full mb-4">
                <MapPin className="h-8 w-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">50 States</div>
              <div className="text-gray-600">Coverage Area</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose Travel Data WiFi?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We've revolutionized mobile internet for travelers with cutting-edge technology and unmatched reliability
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg p-8 text-center hover:shadow-xl transition-shadow duration-300">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-travel-orange to-orange-600 rounded-full mb-6">
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
              Premium Mobile Internet Solutions
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              From powerful hotspots to signal boosters, we have everything you need to stay connected on your journey
            </p>
            
            <Link 
              href="/products"
              className="bg-travel-blue hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
            >
              Browse All Products
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-travel-blue text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Transform Your Travel Experience?</h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Join thousands of RV travelers, digital nomads, and remote workers who trust Travel Data WiFi for their connectivity needs
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/products" 
              className="bg-travel-orange hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
            >
              Shop Now
            </Link>
            <Link 
              href="/support" 
              className="border-2 border-white text-white hover:bg-white hover:text-travel-blue px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
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