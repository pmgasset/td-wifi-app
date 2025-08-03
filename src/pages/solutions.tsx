// src/pages/solutions.tsx
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Layout from '../components/Layout';
import { useCartStore } from '../store/cart';
import { 
  Wifi, Zap, Shield, Star, CheckCircle, ArrowRight, Truck, HeadphonesIcon, 
  Globe, MapPin, Users, Award, Signal, Router, Smartphone, Home, Car,
  Mountain, Coffee, Video, Download, Upload, Timer, DollarSign, X
} from 'lucide-react';
import toast from 'react-hot-toast';

// Type definitions matching your existing structure
interface Product {
  product_id?: string;
  id?: string;
  name?: string;
  product_name?: string;
  price?: string | number;
  rate?: string | number;
  product_price?: string | number;
  min_rate?: string | number;
  status?: string;
  show_in_storefront?: boolean;
  is_featured?: boolean;
  description?: string;
  product_description?: string;
  short_description?: string;
  seo_url?: string;
  url?: string;
  images?: any[];
  product_images?: string[];
  image_url?: string;
  documents?: any[];
  product_category?: string;
  category_name?: string;
}

const SolutionsPage = () => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSolution, setSelectedSolution] = useState<string>('rv-travel');
  const { addItem } = useCartStore();

  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  const fetchFeaturedProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        // Get featured products or top products
        const products = data.products || [];
        const featured = products
          .filter((p: Product) => p.is_featured || p.show_in_storefront)
          .slice(0, 4);
        setFeaturedProducts(featured);
      }
    } catch (error) {
      console.error('Error fetching featured products:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProductName = (product: Product) => {
    return product.product_name || product.name || 'Product';
  };

  const getProductPrice = (product: Product) => {
    const price = product.product_price || product.price || product.min_rate || product.rate;
    return typeof price === 'string' ? parseFloat(price) : (price || 0);
  };

  const getProductImage = (product: Product) => {
    if (product.image_url) return product.image_url;
    if (product.images && product.images.length > 0) return product.images[0].url || product.images[0].image_url;
    if (product.product_images && product.product_images.length > 0) return product.product_images[0];
    return null;
  };

  const handleAddToCart = (product: Product) => {
    addItem(product, 1);
    toast.success(`${getProductName(product)} added to cart!`);
  };

  // Define connectivity problems and solutions
  const connectivityProblems = [
    {
      id: 'rv-travel',
      title: 'RV & Camping Travel',
      icon: Car,
      problem: 'Spotty campground WiFi and dead zones in remote locations',
      solution: 'Our high-gain routers and unlimited T-Mobile data keep you connected anywhere',
      stats: { coverage: '99%', speed: '100+ Mbps', reliability: '99.9%' }
    },
    {
      id: 'remote-work',
      title: 'Remote Work & Business',
      icon: Coffee,
      problem: 'Unreliable internet disrupting video calls and file uploads',
      solution: 'Professional-grade connectivity with guaranteed speeds for business use',
      stats: { uptime: '99.9%', latency: '<50ms', support: '24/7' }
    },
    {
      id: 'digital-nomad',
      title: 'Digital Nomad Life',
      icon: Mountain,
      problem: 'Inconsistent connections while traveling between locations',
      solution: 'Seamless handoffs between towers with unlimited data nationwide',
      stats: { states: '50', carriers: '3', setup: '5 min' }
    },
    {
      id: 'backup-internet',
      title: 'Home Internet Backup',
      icon: Home,
      problem: 'Internet outages leaving you disconnected when you need it most',
      solution: 'Automatic failover backup internet that kicks in instantly',
      stats: { failover: '<30s', capacity: 'Unlimited', installation: 'DIY' }
    }
  ];

  const selectedProblem = connectivityProblems.find(p => p.id === selectedSolution) || connectivityProblems[0];

  const keyBenefits = [
    {
      icon: Zap,
      title: 'Truly Unlimited Data',
      description: 'No throttling, no caps, no surprises. Use as much data as you need.',
      highlight: 'No data limits'
    },
    {
      icon: Signal,
      title: 'Premium T-Mobile Network',
      description: 'Access to T-Mobile\'s nationwide 5G and 4G LTE network with priority data.',
      highlight: '5G speeds'
    },
    {
      icon: Shield,
      title: 'Enterprise-Grade Security',
      description: 'WPA3 encryption and VPN-ready connections for secure remote work.',
      highlight: 'Bank-level security'
    },
    {
      icon: HeadphonesIcon,
      title: '24/7 Expert Support',
      description: 'Real people who understand connectivity, available whenever you need help.',
      highlight: 'Human support'
    }
  ];

  return (
    <Layout 
      title="Internet Solutions for Travel & Remote Work - Travel Data WiFi"
      description="Discover how Travel Data WiFi solves connectivity problems for RV travelers, remote workers, and digital nomads with unlimited data and reliable routers."
      canonical="https://traveldatawifi.com/solutions"
    >
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-logo-ocean via-logo-teal to-logo-signal py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6">
              Your Connectivity Problems,
              <span className="block text-yellow-400">Solved.</span>
            </h1>
            
            <p className="text-xl lg:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Stop settling for slow, unreliable internet. Our routers + unlimited data plans 
              deliver enterprise-grade connectivity wherever life takes you.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/products"
                className="bg-gradient-to-r from-logo-signal to-logo-forest text-white px-8 py-4 rounded-lg font-bold text-lg shadow-lg hover:from-logo-forest hover:to-logo-signal transition-all duration-300 transform hover:scale-105"
              >
                Shop Solutions →
              </Link>
              
              <Link
                href="/coverage"
                className="border-2 border-white text-white hover:bg-white hover:text-logo-ocean px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300"
              >
                Check Coverage
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Matrix */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-4">
                What&apos;s Your Connectivity Challenge?
              </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Select your situation to see how Travel Data WiFi provides the perfect solution.
            </p>
          </div>

          {/* Solution Selector */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {connectivityProblems.map((problem) => (
              <button
                key={problem.id}
                onClick={() => setSelectedSolution(problem.id)}
                className={`p-6 rounded-xl border-2 transition-all duration-300 text-center ${
                  selectedSolution === problem.id
                    ? 'border-logo-teal bg-logo-teal text-white'
                    : 'border-gray-200 hover:border-logo-teal hover:bg-gray-50'
                }`}
              >
                <problem.icon className={`h-8 w-8 mx-auto mb-3 ${
                  selectedSolution === problem.id ? 'text-white' : 'text-logo-teal'
                }`} />
                <h3 className="font-semibold text-sm lg:text-base">{problem.title}</h3>
              </button>
            ))}
          </div>

          {/* Selected Solution Details */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-8 lg:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center mb-4">
                  <selectedProblem.icon className="h-12 w-12 text-logo-teal mr-4" />
                  <h3 className="text-2xl font-bold text-gray-900">{selectedProblem.title}</h3>
                </div>
                
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-red-600 mb-2">The Problem:</h4>
                  <p className="text-gray-700 mb-4">{selectedProblem.problem}</p>
                  
                  <h4 className="text-lg font-semibold text-green-600 mb-2">Our Solution:</h4>
                  <p className="text-gray-700">{selectedProblem.solution}</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(selectedProblem.stats).map(([key, value]) => (
                    <div key={key} className="text-center p-3 bg-white rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-logo-teal">{value}</div>
                      <div className="text-xs text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">What You Get:</h4>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span>High-performance router optimized for {selectedProblem.title.toLowerCase()}</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span>Unlimited data on T-Mobile&apos;s premium network</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span>Professional setup and configuration support</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span>24/7 technical support from connectivity experts</span>
                  </li>
                </ul>

                <Link 
                  href="/products"
                  className="mt-6 w-full bg-logo-teal text-white py-3 px-6 rounded-lg font-semibold hover:bg-logo-ocean transition-colors duration-300 inline-block text-center"
                >
                  Find Your Perfect Router →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-4">
              Why Travel Data WiFi Works
            </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                We&apos;ve solved the core problems that make mobile internet frustrating.
              </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {keyBenefits.map((benefit, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className="w-16 h-16 bg-gradient-to-r from-logo-teal to-logo-ocean rounded-full flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="h-8 w-8 text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">{benefit.title}</h3>
                
                <div className="text-center mb-4">
                  <span className="bg-logo-signal text-white px-3 py-1 rounded-full text-sm font-semibold">
                    {benefit.highlight}
                  </span>
                </div>
                
                <p className="text-gray-600 text-center">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Simple Pricing */}
      <section className="py-16 lg:py-24 bg-gradient-to-r from-logo-ocean to-logo-teal">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-3xl lg:text-5xl font-bold mb-6">
            One Plan. Zero Complexity.
          </h2>
          
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            While others confuse you with multiple tiers and hidden fees, we keep it simple. 
            <span className="text-yellow-400 font-semibold"> One unlimited plan that just works.</span>
          </p>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-md mx-auto mb-8">
            <div className="text-6xl font-bold mb-4">$99</div>
            <div className="text-xl text-gray-300 mb-6">per month</div>
            
            <div className="space-y-3 text-left">
              {[
                'Unlimited Data',
                '5G/4G Coverage',
                'All Major Carriers', 
                '24/7 Support',
                'No Contracts'
              ].map((feature, index) => (
                <div key={index} className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/products"
              className="bg-yellow-400 text-gray-900 px-8 py-4 rounded-lg font-bold text-lg hover:bg-yellow-500 transition-colors shadow-lg"
            >
              Shop Routers →
            </Link>
            
            <Link
              href="/coverage"
              className="border-2 border-white text-white hover:bg-white hover:text-logo-ocean px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300"
            >
              Check Coverage
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="py-16 lg:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-4">
                Popular Solutions
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                These router + data plan combinations solve 90% of connectivity problems.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {featuredProducts.map((product, index) => {
                const productImage = getProductImage(product);
                const productPrice = getProductPrice(product);
                
                return (
                  <div key={product.product_id || index} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                    <div className="aspect-w-16 aspect-h-12 bg-gray-100 h-48 relative">
                        {productImage ? (
                          <Image
                            src={productImage}
                            alt={getProductName(product)}
                            fill
                            className="object-cover"
                          />
                        ) : (
                        <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          <Router className="h-16 w-16 text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {getProductName(product)}
                      </h3>
                      
                      <div className="text-2xl font-bold text-logo-teal mb-4">
                        ${productPrice.toFixed(2)}
                      </div>
                      
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="w-full bg-logo-teal text-white py-3 px-4 rounded-lg font-semibold hover:bg-logo-ocean transition-colors duration-300"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-12">
              <Link 
                href="/products"
                className="inline-flex items-center text-logo-teal hover:text-logo-ocean font-semibold text-lg"
              >
                View All Products <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Social Proof */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Trusted by Digital Nomads Everywhere
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {[
              { number: "50,000+", label: "Happy Customers", icon: Users },
              { number: "99.9%", label: "Uptime", icon: Signal },
              { number: "24/7", label: "Support", icon: HeadphonesIcon },
              { number: "50", label: "States", icon: MapPin }
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-logo-teal rounded-full flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="h-8 w-8 text-white" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: "Finally found reliable internet for our RV adventures. Travel Data WiFi changed everything!",
                author: "Sarah & Mike",
                title: "Full-time RVers"
              },
              {
                quote: "Working remotely from anywhere is actually possible now. The connection is consistently fast.",
                author: "James Chen",
                title: "Digital Marketing Consultant"
              },
              {
                quote: "Best investment we made for our mobile office setup. Support team is incredibly helpful.",
                author: "Lisa Rodriguez",
                title: "Travel Blogger"
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                  <p className="text-gray-700 mb-4 italic">&quot;{testimonial.quote}&quot;</p>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.author}</div>
                  <div className="text-sm text-gray-600">{testimonial.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-logo-ocean">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            Ready to Solve Your Connectivity Problems?
          </h2>
          
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join thousands of travelers who&apos;ve discovered reliable internet anywhere.
            </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/products"
              className="bg-yellow-400 text-gray-900 px-8 py-4 rounded-lg font-bold text-lg hover:bg-yellow-500 transition-colors shadow-lg"
            >
              Shop Solutions Now →
            </Link>
            
            <Link
              href="/support"
              className="border-2 border-white text-white hover:bg-white hover:text-logo-ocean px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300"
            >
              Talk to an Expert
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default SolutionsPage;