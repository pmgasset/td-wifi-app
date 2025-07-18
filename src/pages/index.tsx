// src/pages/index.tsx
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import { useCartStore } from '../store/cart';
import { 
  Wifi, Zap, Shield, Star, CheckCircle, ArrowRight, Truck, HeadphonesIcon, 
  Loader2, AlertCircle, X, Mail, MapPin, Users, Award, Signal, Globe
} from 'lucide-react';
import toast from 'react-hot-toast';

// Type definitions
interface ProductImage {
  url?: string;
  image_url?: string;
  document_id?: string;
}

interface ProductDocument {
  document_id: string;
}

interface Product {
  product_id?: string;
  id?: string;
  name?: string;
  product_name?: string;
  price?: string | number;
  rate?: string | number;
  status?: string;
  show_in_storefront?: boolean;
  is_featured?: boolean;
  description?: string;
  short_description?: string;
  seo_url?: string;
  url?: string;
  images?: ProductImage[];
  image_url?: string;
  documents?: ProductDocument[];
}

const EnhancedHomepage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmailCapture, setShowEmailCapture] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState<boolean>(false);
  const [visitorCount, setVisitorCount] = useState<number>(847);
  const { addItem } = useCartStore();

  useEffect(() => {
    fetchProducts();
    
    // Simple visitor counter
    const interval = setInterval(() => {
      setVisitorCount(prev => prev + Math.floor(Math.random() * 3));
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      console.log('Fetching products from API...');
      
      const response = await fetch('/api/products');
      console.log('API Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('API Response data:', data);
      
      if (data.products && Array.isArray(data.products)) {
        const activeProducts = data.products.filter((product: Product) => 
          product.status === 'active' && 
          product.show_in_storefront !== false
        );
        
        console.log('Active products found:', activeProducts.length);
        
        const sortedProducts = activeProducts.sort((a: Product, b: Product) => {
          const aScore = (a.is_featured ? 1000 : 0) + (parseFloat(String(a.price || 0)) || 0);
          const bScore = (b.is_featured ? 1000 : 0) + (parseFloat(String(b.price || 0)) || 0);
          return bScore - aScore;
        });
        
        setProducts(sortedProducts.slice(0, 3));
        console.log('Products set:', sortedProducts.slice(0, 3));
      } else {
        console.error('Invalid data structure:', data);
        throw new Error('Invalid product data format from API');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    try {
      addItem(product, 1);
      toast.success(`${getProductName(product)} added to cart!`);
    } catch (err) {
      console.error('Error adding to cart:', err);
      toast.error('Failed to add item to cart');
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingEmail(true);
    
    try {
      // Replace with your actual email capture endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Thanks! Check your email for the free guide.');
      setShowEmailCapture(false);
      setEmail('');
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  // Helper functions
  const getProductName = (product: Product): string => {
    return product.name || product.product_name || 'Router';
  };

  const getProductPrice = (product: Product): number | null => {
    const price = parseFloat(String(product.price || product.rate || 0));
    return price > 0 ? price : null;
  };

  const getProductImage = (product: Product): string => {
    if (product.images && product.images.length > 0) {
      return product.images[0].url || product.images[0].image_url || '/api/placeholder/400/300';
    }
    if (product.image_url) {
      return product.image_url;
    }
    if (product.documents && product.documents.length > 0) {
      return `/product-images/${product.documents[0].document_id}`;
    }
    return '/api/placeholder/400/300';
  };

  const getProductDescription = (product: Product): string => {
    return product.description || product.short_description || 'High-performance mobile internet router';
  };

  return (
    <Layout>
      {/* Live Activity Bar */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 text-center">
        <div className="flex items-center justify-center space-x-6 text-sm">
          <span className="flex items-center">
            <Users className="h-4 w-4 mr-1" />
            {visitorCount} people viewing now
          </span>
          <span className="flex items-center">
            <Star className="h-4 w-4 mr-1" />
            4.9/5 rating (2,847 reviews)
          </span>
        </div>
      </div>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 text-white py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              {/* Trust Badge */}
              <div className="inline-flex items-center space-x-2 bg-white/20 rounded-full px-4 py-2 mb-6">
                <Star className="h-5 w-5 text-yellow-400" />
                <span className="text-sm font-medium">Trusted by 50,000+ Digital Nomads</span>
              </div>
              
              <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
                Never Lose
                <span className="block text-yellow-400">Signal Again</span>
              </h1>
              
              <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                Professional-grade mobile internet for RV travelers and remote workers. 
                <span className="text-yellow-400 font-semibold"> One plan, unlimited everything.</span>
              </p>

              {/* Quick Benefits */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-green-400" />
                  <span>5G Speed</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Globe className="h-5 w-5 text-blue-400" />
                  <span>50 States</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-purple-400" />
                  <span>No Throttling</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-orange-400" />
                  <span>No Contracts</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-4 rounded-lg font-bold text-lg shadow-lg hover:from-orange-600 hover:to-red-600 transition-all duration-300 transform hover:scale-105"
                >
                  Shop Routers →
                </button>
                
                <button 
                  onClick={() => setShowEmailCapture(true)}
                  className="border-2 border-white text-white hover:bg-white hover:text-blue-600 px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300"
                >
                  Get Free Guide
                </button>
              </div>
            </div>

            {/* Pricing Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">$99</div>
                <div className="text-xl text-gray-300 mb-6">per month</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Unlimited Data</span>
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>5G/4G Coverage</span>
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>All Carriers</span>
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>24/7 Support</span>
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-4">
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
                <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">Loading our latest routers...</p>
                <p className="text-gray-500 text-sm mt-2">Fetching from API...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center bg-red-50 rounded-xl p-8 max-w-md border border-red-200">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-red-900 mb-2">Unable to load products</h3>
                <p className="text-red-700 mb-4 text-sm">{error}</p>
                <button 
                  onClick={fetchProducts}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Products Grid */}
          {!loading && !error && products.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {products.map((product, index) => {
                const price = getProductPrice(product);
                const isPopular = index === 0;
                const productId = product.product_id || product.id || `product-${index}`;
                
                return (
                  <div key={productId} className="relative">
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                          🔥 Most Popular
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 border border-gray-100">
                      {/* Product Image */}
                      <div className="aspect-w-16 aspect-h-12 bg-gray-100">
                        <img 
                          src={getProductImage(product)}
                          alt={getProductName(product)}
                          className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                          onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/api/placeholder/400/300';
                          }}
                        />
                        
                        <div className="absolute top-4 right-4 bg-white/90 rounded-full px-3 py-1 text-sm font-semibold">
                          <Star className="h-4 w-4 inline mr-1 text-yellow-400" />
                          4.9
                        </div>
                      </div>
                      
                      {/* Product Details */}
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {getProductName(product)}
                        </h3>
                        
                        <p className="text-gray-600 mb-4 line-clamp-2">
                          {getProductDescription(product)}
                        </p>
                        
                        {/* Features */}
                        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                          <div className="flex items-center text-gray-600">
                            <Signal className="h-4 w-4 mr-1 text-green-500" />
                            5G Ready
                          </div>
                          <div className="flex items-center text-gray-600">
                            <Wifi className="h-4 w-4 mr-1 text-blue-500" />
                            Multi-Device
                          </div>
                        </div>
                        
                        {/* Price */}
                        {price && (
                          <div className="mb-4">
                            <span className="text-3xl font-bold text-gray-900">${price}</span>
                            <span className="text-gray-500 ml-1">one-time</span>
                            <div className="text-sm text-green-600 font-medium mt-1">
                              ✓ Free shipping • 30-day guarantee
                            </div>
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="space-y-3">
                          <button 
                            onClick={() => handleAddToCart(product)}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-md hover:shadow-lg"
                          >
                            Add to Cart
                          </button>
                          
                          <Link 
                            href={`/products/${product.seo_url || product.url || product.product_id}`}
                            className="w-full border-2 border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:border-blue-600 hover:text-blue-600 transition-colors block text-center"
                          >
                            Learn More
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* No Products State */}
          {!loading && !error && products.length === 0 && (
            <div className="text-center py-16">
              <div className="bg-gray-100 rounded-xl p-8 max-w-md mx-auto">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Products Found</h3>
                <p className="text-gray-600 mb-4">Unable to load products from the API.</p>
                <button 
                  onClick={fetchProducts}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Data Plan Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-5xl font-bold mb-6">
            One Plan. Zero Complexity.
          </h2>
          
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            While others confuse you with multiple tiers and hidden fees, we keep it simple. 
            <span className="text-yellow-400 font-semibold"> One unlimited plan that just works.</span>
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { icon: Zap, text: "Truly unlimited data", color: "text-yellow-400" },
              { icon: Globe, text: "All major carriers", color: "text-green-400" },
              { icon: Shield, text: "50-state coverage", color: "text-purple-400" },
              { icon: CheckCircle, text: "No contracts", color: "text-blue-400" }
            ].map((feature, index) => (
              <div key={index} className="flex flex-col items-center p-4">
                <feature.icon className={`h-8 w-8 ${feature.color} mb-2`} />
                <span className="text-center">{feature.text}</span>
              </div>
            ))}
          </div>

          <button 
            onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-yellow-400 text-gray-900 px-8 py-4 rounded-lg font-bold text-lg hover:bg-yellow-500 transition-colors shadow-lg"
          >
            Get Started Today
          </button>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Trusted by Digital Nomads Everywhere
            </h2>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {[
              { number: "50,000+", label: "Happy Customers", icon: Users },
              { number: "99.9%", label: "Uptime", icon: Signal },
              { number: "24/7", label: "Support", icon: HeadphonesIcon },
              { number: "50", label: "States", icon: MapPin }
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: "Finally found reliable internet for our RV adventures. Travel Data WiFi changed everything!",
                author: "Sarah & Mike",
                location: "Full-time RVers"
              },
              {
                quote: "Work from anywhere confidence. The speed and reliability is incredible for video calls.",
                author: "Jessica Chen", 
                location: "Digital Nomad"
              },
              {
                quote: "Setup was so easy and support is amazing. Worth every penny for peace of mind.",
                author: "David Rodriguez",
                location: "Remote Worker"
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-6">
                <div className="flex mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-4 italic">"{testimonial.quote}"</p>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.author}</div>
                  <div className="text-sm text-gray-500">{testimonial.location}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Truck,
                title: "Free Fast Shipping",
                description: "Get your router in 2-3 business days with free shipping"
              },
              {
                icon: Shield,
                title: "30-Day Guarantee", 
                description: "Not satisfied? Get your money back, no questions asked"
              },
              {
                icon: Award,
                title: "Expert Setup Support",
                description: "Free white-glove setup and configuration assistance"
              }
            ].map((feature, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Email Capture Modal */}
      {showEmailCapture && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setShowEmailCapture(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Get Your Free RV WiFi Guide</h3>
              <p className="text-gray-600">
                Learn the secrets to staying connected anywhere with our comprehensive setup guide.
              </p>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              <button
                type="submit"
                disabled={isSubmittingEmail}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmittingEmail ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Sending...
                  </span>
                ) : (
                  'Get Free Guide'
                )}
              </button>
              
              <p className="text-xs text-gray-500 text-center">
                We respect your privacy. Unsubscribe at any time.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* CSS for line-clamp */}
      <style jsx>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </Layout>
  );
};

export default EnhancedHomepage;