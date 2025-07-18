// src/pages/index.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Users, 
  Star, 
  Globe, 
  Shield, 
  Zap, 
  CheckCircle, 
  Signal,
  MapPin,
  Truck,
  HeadphonesIcon,
  AlertCircle,
  Loader2,
  ArrowRight,
  Wifi,
  PlayCircle,
  Phone,
  MessageSquare,
  Clock,
  Award,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import Layout from '../components/Layout';
import { useCartStore } from '../store/cart';

interface Product {
  product_id?: string;
  id?: string;
  name?: string;
  product_name?: string;
  title?: string;
  price?: number;
  product_price?: number;
  sale_price?: number;
  images?: Array<{ src: string; alt?: string }>;
  product_images?: Array<{ src: string; alt?: string }>;
  image_url?: string;
  description?: string;
  product_description?: string;
  short_description?: string;
}

const EnhancedHomepage: React.FC = () => {
  const router = useRouter();
  const { addToCart } = useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visitorCount, setVisitorCount] = useState(863);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  // Simulate visitor count updates
  useEffect(() => {
    const interval = setInterval(() => {
      setVisitorCount(prev => prev + Math.floor(Math.random() * 3) - 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/products');
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error('Products API Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Helper functions
  const getProductPrice = (product: Product): number => {
    return product.sale_price || product.product_price || product.price || 99;
  };

  const getProductName = (product: Product): string => {
    return product.product_name || product.name || product.title || 'Travel Router';
  };

  const getProductImageUrl = (product: Product): string => {
    const images = product.images || product.product_images || [];
    const imageUrl = images[0]?.src || product.image_url;
    return imageUrl || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZmFmYyIvPgogIDx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2Yjc0ODEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZSBBdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPgo=";
  };

  const testimonials = [
    {
      quote: "Finally found reliable internet for our RV adventures. Travel Data WiFi changed everything!",
      author: "Sarah & Mike",
      location: "Full-time RVers",
      rating: 5
    },
    {
      quote: "Work from anywhere confidence. The speed and reliability is incredible for video calls.",
      author: "Jessica Chen", 
      location: "Digital Nomad",
      rating: 5
    },
    {
      quote: "Setup was so easy and support is amazing. Worth every penny for peace of mind.",
      author: "David Rodriguez",
      location: "Remote Worker",
      rating: 5
    }
  ];

  // Rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Layout>
      {/* Live Activity Bar - Improved readability */}
      <div className="bg-logo-signal text-white py-3 text-center shadow-sm">
        <div className="flex items-center justify-center space-x-8 text-sm font-medium">
          <span className="flex items-center">
            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
            {visitorCount} people viewing now
          </span>
          <span className="flex items-center">
            <Star className="h-4 w-4 mr-1 text-yellow-300" />
            4.9/5 rating (2,847 reviews)
          </span>
        </div>
      </div>

      {/* Hero Section - Simplified and more readable */}
      <section className="bg-gradient-to-b from-white to-gray-50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="text-center lg:text-left">
              {/* Trust Badge */}
              <div className="inline-flex items-center space-x-2 bg-logo-signal/10 text-logo-signal rounded-full px-4 py-2 mb-6 border border-logo-signal/20">
                <Award className="h-5 w-5" />
                <span className="text-sm font-semibold">Trusted by 50,000+ Digital Nomads</span>
              </div>
              
              <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Never Lose
                <span className="block text-logo-teal">Signal Again</span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-xl">
                Professional-grade mobile internet for RV travelers and remote workers. 
                <span className="text-logo-ocean font-semibold"> One plan, unlimited everything.</span>
              </p>
              
              {/* Key Features */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { icon: Zap, text: "5G Speed", color: "text-logo-signal" },
                  { icon: Shield, text: "No Throttling", color: "text-logo-forest" },
                  { icon: Globe, text: "50 States", color: "text-logo-teal" },
                  { icon: CheckCircle, text: "No Contracts", color: "text-logo-ocean" }
                ].map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <feature.icon className={`h-5 w-5 ${feature.color}`} />
                    <span className="text-gray-700 font-medium">{feature.text}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button 
                  onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-logo-teal text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-logo-ocean transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center"
                >
                  Shop Routers
                  <ArrowRight className="ml-2 h-5 w-5" />
                </button>
                
                <button 
                  onClick={() => router.push('/free-guide')}
                  className="bg-white text-logo-ocean px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-50 transition-colors border-2 border-logo-ocean hover:border-logo-teal flex items-center justify-center"
                >
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Get Free Guide
                </button>
              </div>
            </div>

            {/* Right Content - Cleaner visual */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                <div className="text-center">
                  <div className="w-20 h-20 bg-logo-teal rounded-full flex items-center justify-center mx-auto mb-6">
                    <Wifi className="h-10 w-10 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    $99/month
                  </h3>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-center space-x-2 text-gray-600">
                      <CheckCircle className="h-5 w-5 text-logo-signal" />
                      <span>Unlimited Data</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2 text-gray-600">
                      <CheckCircle className="h-5 w-5 text-logo-signal" />
                      <span>5G/4G Coverage</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2 text-gray-600">
                      <CheckCircle className="h-5 w-5 text-logo-signal" />
                      <span>All Carriers</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2 text-gray-600">
                      <CheckCircle className="h-5 w-5 text-logo-signal" />
                      <span>24/7 Support</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-6 text-sm text-gray-500 border-t pt-4">
                    <div className="flex items-center">
                      <Globe className="h-4 w-4 mr-1 text-logo-teal" />
                      50 States
                    </div>
                    <div className="flex items-center">
                      <Shield className="h-4 w-4 mr-1 text-logo-forest" />
                      Secure
                    </div>
                    <div className="flex items-center">
                      <Zap className="h-4 w-4 mr-1 text-logo-signal" />
                      Fast Setup
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Digital Nomads Choose Us
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Built specifically for remote workers and RV travelers who need reliable internet everywhere
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                icon: "🏔️",
                title: "Remote Locations",
                description: "Stay connected in the most remote camping spots and wilderness areas"
              },
              {
                icon: "💼",
                title: "Work From Anywhere",
                description: "Rock-solid internet for video calls, uploads, and remote work"
              },
              {
                icon: "🗺️",
                title: "50 State Coverage",
                description: "Seamless connectivity across all United States with carrier switching"
              },
              {
                icon: "⚡",
                title: "5G Lightning Speed",
                description: "Stream 4K, game online, and upload files at lightning speed"
              }
            ].map((feature, index) => (
              <div key={index} className="text-center group hover:bg-gray-50 p-6 rounded-xl transition-colors">
                <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {[
              { number: "50,000+", label: "Happy Customers", icon: Users, color: "text-logo-teal" },
              { number: "99.9%", label: "Uptime", icon: Signal, color: "text-logo-signal" },
              { number: "24/7", label: "Support", icon: HeadphonesIcon, color: "text-logo-forest" },
              { number: "50", label: "States", icon: MapPin, color: "text-logo-ocean" }
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                </div>
                <div className="text-3xl font-bold text-gray-900">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Testimonial Carousel */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <blockquote className="text-xl text-gray-700 italic mb-6">
                  "{testimonials[activeTestimonial].quote}"
                </blockquote>
                <div className="flex items-center justify-center space-x-4">
                  <div className="w-12 h-12 bg-logo-teal rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">
                      {testimonials[activeTestimonial].author.split(' ')[0][0]}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonials[activeTestimonial].author}</div>
                    <div className="text-sm text-gray-500">{testimonials[activeTestimonial].location}</div>
                  </div>
                </div>
              </div>
              
              {/* Testimonial Navigation */}
              <div className="flex justify-center mt-6 space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveTestimonial(index)}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      index === activeTestimonial ? 'bg-logo-teal' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Choose Your Perfect Router
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Every router works with our unlimited data plan. Pick the one that matches your adventure style.
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-logo-teal mx-auto mb-4" />
                <p className="text-gray-600 text-lg">Loading our latest routers...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center bg-red-50 rounded-xl p-8 max-w-2xl border border-red-200">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-red-900 mb-2">Unable to Load Products</h3>
                <p className="text-red-700 mb-4">We're experiencing technical difficulties. Please try again.</p>
                <button 
                  onClick={fetchProducts}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Products Grid */}
          {!loading && !error && products.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {products.slice(0, 3).map((product, index) => {
                const price = getProductPrice(product);
                const isPopular = index === 0;
                const productId = product.product_id || product.id || `product-${index}`;
                
                return (
                  <div key={productId} className="relative">
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                        <div className="bg-logo-signal text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                          🔥 Most Popular
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-logo-teal group">
                      {/* Product Image */}
                      <div className="aspect-w-16 aspect-h-12 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                        <img 
                          src={getProductImageUrl(product)}
                          alt={getProductName(product)}
                          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        
                        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-semibold shadow-sm">
                          <Star className="h-4 w-4 inline mr-1 text-yellow-400" />
                          4.9
                        </div>
                      </div>
                      
                      {/* Product Details */}
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-logo-teal transition-colors">
                          {getProductName(product)}
                        </h3>
                        <p className="text-gray-600 mb-4 line-clamp-2">
                          Professional-grade router with 5G capability and enterprise-level security
                        </p>
                        
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-2xl font-bold text-gray-900">
                            ${price}
                          </div>
                          <div className="text-sm text-gray-500">
                            One-time purchase
                          </div>
                        </div>
                        
                        <button
                          onClick={() => {
                            addToCart({
                              id: productId,
                              name: getProductName(product),
                              price: price,
                              image: getProductImageUrl(product),
                              quantity: 1
                            });
                          }}
                          className="w-full bg-logo-teal text-white py-3 rounded-lg font-semibold hover:bg-logo-ocean transition-colors shadow-sm hover:shadow-md"
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* View All Products Link */}
          <div className="text-center mt-12">
            <button
              onClick={() => router.push('/products')}
              className="bg-gray-100 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors inline-flex items-center"
            >
              View All Products
              <ChevronRight className="ml-2 h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Truck,
                title: "Free Fast Shipping",
                description: "Get your router in 2-3 business days with free shipping on all orders"
              },
              {
                icon: Shield,
                title: "30-Day Money Back", 
                description: "Not satisfied? Return it within 30 days for a full refund, no questions asked"
              },
              {
                icon: HeadphonesIcon,
                title: "Expert Support",
                description: "Get help from real RV internet experts, not offshore call centers"
              }
            ].map((indicator, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <indicator.icon className="h-8 w-8 text-logo-teal" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{indicator.title}</h3>
                <p className="text-gray-600">{indicator.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 bg-logo-ocean text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Never Lose Signal Again?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join 50,000+ travelers who trust Travel Data WiFi for their internet needs
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white text-logo-ocean px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Shop Now
            </button>
            
            <button 
              onClick={() => router.push('/contact')}
              className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-white hover:text-logo-ocean transition-colors"
            >
              Talk to Expert
            </button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default EnhancedHomepage;