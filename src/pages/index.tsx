// src/pages/index.tsx
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Wifi, Zap, Shield, Star, CheckCircle, ArrowRight, Truck, HeadphonesIcon, 
  Loader2, AlertCircle, Play, X, Mail, MapPin, Users, Timer, Award,
  Signal, Smartphone, Laptop, Globe
} from 'lucide-react';
import { useCartStore } from '../store/cart';
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
  const [visitorCount, setVisitorCount] = useState<number>(0);
  const [recentPurchases, setRecentPurchases] = useState<string[]>([]);
  const heroRef = useRef<HTMLDivElement>(null);
  const { addItem } = useCartStore();

  useEffect(() => {
    fetchProducts();
    startVisitorCounter();
    startRecentPurchasesFeed();
    
    // Show email capture after 30 seconds
    const emailTimer = setTimeout(() => {
      setShowEmailCapture(true);
    }, 30000);

    return () => clearTimeout(emailTimer);
  }, []);

  // Animated visitor counter
  const startVisitorCounter = () => {
    const baseCount = 847;
    setVisitorCount(baseCount);
    
    setInterval(() => {
      setVisitorCount(prev => prev + Math.floor(Math.random() * 3));
    }, 8000);
  };

  // Recent purchases feed
  const startRecentPurchasesFeed = () => {
    const purchases = [
      "Sarah from Austin just ordered MiFi X PRO 5G",
      "Mike from Denver purchased RoadLink Router Pro", 
      "Jessica from Phoenix bought Signal Booster Kit",
      "David from Seattle ordered MiFi X PRO 5G",
      "Linda from Tampa purchased RoadLink Router Pro"
    ];
    
    let index = 0;
    setInterval(() => {
      setRecentPurchases([purchases[index % purchases.length]]);
      index++;
    }, 6000);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/products');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.products && Array.isArray(data.products)) {
        const activeProducts = data.products.filter((product: Product) => 
          product.status === 'active' && 
          product.show_in_storefront !== false
        );
        
        const sortedProducts = activeProducts.sort((a: Product, b: Product) => {
          const aScore = (a.is_featured ? 1000 : 0) + (parseFloat(String(a.price || 0)) || 0);
          const bScore = (b.is_featured ? 1000 : 0) + (parseFloat(String(b.price || 0)) || 0);
          return bScore - aScore;
        });
        
        setProducts(sortedProducts.slice(0, 3));
      } else {
        throw new Error('Invalid product data format');
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
      toast.success(`${getProductName(product)} added to cart!`, {
        style: {
          background: '#10B981',
          color: 'white',
        },
      });
    } catch (err) {
      console.error('Error adding to cart:', err);
      toast.error('Failed to add item to cart');
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingEmail(true);
    
    try {
      // Simulate API call - replace with your actual endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Welcome! Check your email for your free guide.', {
        duration: 4000,
        style: {
          background: '#10B981',
          color: 'white',
        },
      });
      
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
    return product.name || product.product_name || 'Unnamed Product';
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
    return product.description || product.short_description || 'High-quality mobile internet solution';
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Floating Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-20 right-10 w-32 h-32 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-40 left-10 w-24 h-24 bg-gradient-to-r from-orange-400/20 to-pink-400/20 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-gradient-to-r from-green-400/20 to-blue-400/20 rounded-full blur-xl animate-pulse delay-2000"></div>
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                <Wifi className="h-7 w-7 text-white animate-pulse" />
              </div>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Travel Data WiFi
                </span>
                <div className="text-xs text-gray-500 -mt-1">Stay Connected Anywhere</div>
              </div>
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/support" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                Support
              </Link>
              <Link href="/coverage" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                Coverage
              </Link>
              <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                📞 1-800-WIFI-RV
              </button>
            </nav>

            <button className="md:hidden p-2">
              <div className="w-6 h-6 flex flex-col justify-center space-y-1">
                <div className="w-full h-0.5 bg-gray-600 transition-all"></div>
                <div className="w-full h-0.5 bg-gray-600 transition-all"></div>
                <div className="w-full h-0.5 bg-gray-600 transition-all"></div>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Live Activity Bar */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white py-2 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          <span className="mx-8 flex items-center">
            <Users className="h-4 w-4 mr-2" />
            {visitorCount} people viewing now
          </span>
          <span className="mx-8 flex items-center">
            <Star className="h-4 w-4 mr-2" />
            4.9/5 rating from 2,847 reviews
          </span>
          {recentPurchases.map((purchase, index) => (
            <span key={index} className="mx-8 flex items-center">
              <Signal className="h-4 w-4 mr-2" />
              {purchase}
            </span>
          ))}
        </div>
      </div>

      {/* Hero Section */}
      <section 
        ref={heroRef}
        className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 text-white py-20 lg:py-32 overflow-hidden"
      >
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(68,68,68,.2)_50%,transparent_75%,transparent_100%)] bg-[length:60px_60px] animate-pulse"></div>
        </div>
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              {/* Social Proof Badge */}
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 mb-8 animate-bounce">
                <Star className="h-5 w-5 text-yellow-400" />
                <span className="text-sm font-medium">Trusted by 50,000+ Digital Nomads</span>
                <div className="flex -space-x-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="w-6 h-6 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full border-2 border-white"></div>
                  ))}
                </div>
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
                <span className="block">Never Lose</span>
                <span className="block bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent animate-pulse">
                  Signal Again
                </span>
              </h1>
              
              <p className="text-xl text-gray-300 mb-8 max-w-lg leading-relaxed">
                Professional-grade mobile internet for RV travelers and remote workers. 
                <span className="text-yellow-400 font-semibold"> One plan, unlimited everything.</span>
              </p>

              {/* Value Props */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm">5G Speed</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <Globe className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm">50 States</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm">No Throttling</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm">No Contracts</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                  className="group bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-2xl hover:from-orange-600 hover:to-red-600 transition-all duration-300 transform hover:scale-105 hover:shadow-orange-500/25"
                >
                  <span className="flex items-center justify-center">
                    Shop Routers
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
                
                <button 
                  onClick={() => setShowEmailCapture(true)}
                  className="border-2 border-white text-white hover:bg-white hover:text-gray-900 px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 backdrop-blur-sm"
                >
                  Get Free Guide
                </button>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative">
              <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
                <div className="text-center">
                  <div className="text-6xl font-bold mb-2">$99</div>
                  <div className="text-xl text-gray-300 mb-6">per month</div>
                  <div className="space-y-3 text-left">
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
                
                {/* Floating Icons */}
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-gradient-to-r from-green-400 to-blue-400 rounded-full flex items-center justify-center animate-bounce">
                  <Wifi className="h-6 w-6 text-white" />
                </div>
                <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center animate-bounce delay-1000">
                  <Signal className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section id="products" className="py-20 lg:py-32 bg-gradient-to-br from-gray-50 to-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
              Choose Your
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Perfect Router
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Every router works with our unlimited data plan. Pick the one that matches your adventure style.
            </p>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="relative">
                  <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-6" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full animate-ping opacity-75"></div>
                </div>
                <p className="text-gray-600 text-lg">Loading our latest routers...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center bg-red-50 rounded-2xl p-8 max-w-md border border-red-200">
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-red-900 mb-4">Oops! Something went wrong</h3>
                <p className="text-red-700 mb-6">{error}</p>
                <button 
                  onClick={fetchProducts}
                  className="bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {!loading && !error && products.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {products.map((product, index) => {
                const price = getProductPrice(product);
                const isPopular = index === 0;
                const productId = product.product_id || product.id || `product-${index}`;
                
                return (
                  <div key={productId} className="relative group">
                    {isPopular && (
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-20">
                        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
                          🔥 Most Popular
                        </div>
                      </div>
                    )}
                    
                    <div className="relative bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 transform group-hover:scale-105 border border-gray-100">
                      {/* Product Image */}
                      <div className="relative aspect-w-16 aspect-h-12 bg-gradient-to-br from-gray-100 to-gray-50">
                        <img 
                          src={getProductImage(product)}
                          alt={getProductName(product)}
                          className="w-full h-56 object-cover group-hover:scale-110 transition-transform duration-500"
                          onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/api/placeholder/400/300';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                        
                        {/* Floating Badge */}
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-semibold text-gray-900">
                          <Star className="h-4 w-4 inline mr-1 text-yellow-400" />
                          4.9
                        </div>
                      </div>
                      
                      {/* Product Details */}
                      <div className="p-8">
                        <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                          {getProductName(product)}
                        </h3>
                        
                        <p className="text-gray-600 mb-6 line-clamp-2">
                          {getProductDescription(product)}
                        </p>
                        
                        {/* Features */}
                        <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
                          <div className="flex items-center text-gray-600">
                            <Signal className="h-4 w-4 mr-2 text-green-500" />
                            5G Ready
                          </div>
                          <div className="flex items-center text-gray-600">
                            <Wifi className="h-4 w-4 mr-2 text-blue-500" />
                            32 Devices
                          </div>
                          <div className="flex items-center text-gray-600">
                            <Smartphone className="h-4 w-4 mr-2 text-purple-500" />
                            Long Battery
                          </div>
                          <div className="flex items-center text-gray-600">
                            <Shield className="h-4 w-4 mr-2 text-orange-500" />
                            Secure VPN
                          </div>
                        </div>
                        
                        {/* Price */}
                        {price && (
                          <div className="mb-6">
                            <span className="text-4xl font-bold text-gray-900">${price}</span>
                            <span className="text-gray-500 ml-2">one-time</span>
                            <div className="text-sm text-green-600 font-semibold mt-1">
                              ✓ Free shipping • 30-day guarantee
                            </div>
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="space-y-3">
                          <button 
                            onClick={() => handleAddToCart(product)}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 group"
                          >
                            <span className="flex items-center justify-center">
                              Add to Cart
                              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                          </button>
                          
                          <Link 
                            href={`/products/${product.seo_url || product.url || product.product_id}`}
                            className="w-full border-2 border-gray-300 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:border-blue-600 hover:text-blue-600 transition-all duration-300 block text-center"
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
            <div className="text-center py-20">
              <div className="bg-gray-50 rounded-2xl p-12 max-w-md mx-auto border border-gray-200">
                <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-gray-900 mb-4">No Products Available</h3>
                <p className="text-gray-600 mb-6">We're currently updating our product catalog.</p>
                <button 
                  onClick={fetchProducts}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Refresh
                </button>
              </div>
            </div>
          )}

          {/* View All Products Link */}
          {!loading && !error && products.length > 0 && (
            <div className="text-center mt-16">
              <Link 
                href="/products" 
                className="inline-flex items-center space-x-3 text-blue-600 hover:text-purple-600 font-bold text-xl group"
              >
                <span>View All Products</span>
                <ArrowRight className="h-6 w-6 group-hover:translate-x-2 transition-transform" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Interactive Data Plan Section */}
      <section className="py-20 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 text-white relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white/5 rounded-full animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-24 h-24 bg-white/5 rounded-full animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/3 w-16 h-16 bg-white/5 rounded-full animate-pulse delay-2000"></div>
        </div>
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl lg:text-6xl font-bold mb-6">
                One Plan.
                <span className="block text-yellow-400">Zero Complexity.</span>
              </h2>
              
              <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                While others confuse you with multiple tiers and hidden fees, we keep it simple. 
                <span className="text-yellow-400 font-semibold"> One unlimited plan that just works.</span>
              </p>
              
              {/* Interactive Features */}
              <div className="space-y-4 mb-8">
                {[
                  { icon: Zap, text: "Truly unlimited data - no throttling ever", color: "from-yellow-400 to-orange-400" },
                  { icon: Globe, text: "All major carriers included automatically", color: "from-green-400 to-blue-400" },
                  { icon: Shield, text: "50-state coverage with 5G speeds", color: "from-purple-400 to-pink-400" },
                  { icon: CheckCircle, text: "No contracts - cancel anytime", color: "from-blue-400 to-purple-400" }
                ].map((feature, index) => (
                  <div 
                    key={index}
                    className="flex items-center space-x-4 group cursor-pointer p-3 rounded-lg hover:bg-white/10 transition-all duration-300"
                  >
                    <div className={`w-12 h-12 bg-gradient-to-r ${feature.color} rounded-full flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-lg group-hover:text-yellow-400 transition-colors">{feature.text}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl hover:from-yellow-500 hover:to-orange-500 transition-all duration-300 transform hover:scale-105"
              >
                Start Your Journey
              </button>
            </div>

            {/* Interactive Pricing Card */}
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
                <div className="text-center mb-8">
                  <div className="text-7xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                    $99
                  </div>
                  <div className="text-xl text-gray-300">per month</div>
                  <div className="text-sm text-yellow-400 font-semibold mt-2">⚡ Most Popular Plan</div>
                </div>
                
                <div className="space-y-4 mb-8">
                  {[
                    "Unlimited High-Speed Data",
                    "5G/4G LTE Coverage", 
                    "All Major Carriers",
                    "24/7 Expert Support",
                    "30-Day Money Back",
                    "Free Router Setup"
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                      <span>{feature}</span>
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                  ))}
                </div>

                <div className="bg-gradient-to-r from-green-400 to-blue-400 p-4 rounded-xl">
                  <div className="text-center">
                    <div className="text-sm font-semibold mb-1">🎉 Limited Time Offer</div>
                    <div className="text-lg font-bold">First Month 50% Off</div>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-6 -right-6 w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center animate-bounce shadow-lg">
                <Timer className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Trusted by Digital Nomads Everywhere
            </h2>
            <p className="text-xl text-gray-600">Join thousands who've made the switch to reliable internet</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {[
              { number: "50,000+", label: "Happy Customers", icon: Users, color: "from-blue-500 to-purple-500" },
              { number: "99.9%", label: "Uptime", icon: Signal, color: "from-green-500 to-blue-500" },
              { number: "24/7", label: "Support", icon: HeadphonesIcon, color: "from-orange-500 to-red-500" },
              { number: "50", label: "States Covered", icon: MapPin, color: "from-purple-500 to-pink-500" }
            ].map((stat, index) => (
              <div key={index} className="text-center group cursor-pointer">
                <div className={`w-20 h-20 bg-gradient-to-r ${stat.color} rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                  <stat.icon className="h-10 w-10 text-white" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">{stat.number}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Testimonial Carousel */}
          <div className="bg-gradient-to-r from-gray-50 to-white rounded-3xl p-8 lg:p-12 border border-gray-100">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {[
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
              ].map((testimonial, index) => (
                <div key={index} className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
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
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Truck,
                title: "Free Fast Shipping",
                description: "Get your router in 2-3 business days with free shipping",
                color: "from-green-500 to-emerald-500"
              },
              {
                icon: Shield,
                title: "30-Day Guarantee",
                description: "Not satisfied? Get your money back, no questions asked",
                color: "from-blue-500 to-purple-500"
              },
              {
                icon: Award,
                title: "Expert Setup Support",
                description: "Free white-glove setup and configuration assistance",
                color: "from-orange-500 to-red-500"
              }
            ].map((feature, index) => (
              <div key={index} className="text-center group cursor-pointer">
                <div className={`w-20 h-20 bg-gradient-to-r ${feature.color} rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                  <feature.icon className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Email Capture Modal */}
      {showEmailCapture && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-200 relative">
            <button 
              onClick={() => setShowEmailCapture(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
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
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50"
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

      {/* Enhanced Footer */}
      <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Brand Section */}
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <Wifi className="h-7 w-7 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold">Travel Data WiFi</span>
                  <div className="text-sm text-gray-400">Stay Connected Anywhere</div>
                </div>
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Your trusted partner for reliable mobile internet solutions. We've been helping RV travelers, 
                remote workers, and digital nomads stay connected for over a decade.
              </p>
              <div className="flex space-x-4">
                <div className="flex -space-x-2">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                  <span className="text-sm text-gray-300 ml-3">4.9/5 from 2,847 reviews</span>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="lg:pl-12">
              <h4 className="text-lg font-semibold mb-6">Quick Links</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'Products', href: '/products' },
                  { name: 'Coverage', href: '/coverage' },
                  { name: 'Support', href: '/support' },
                  { name: 'Setup Guides', href: '/guides' },
                  { name: 'Reviews', href: '/reviews' },
                  { name: 'Contact', href: '/contact' }
                ].map((link) => (
                  <Link 
                    key={link.name}
                    href={link.href}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Contact & Support */}
            <div>
              <h4 className="text-lg font-semibold mb-6">Get in Touch</h4>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <HeadphonesIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold">1-800-WIFI-RV</div>
                    <div className="text-sm text-gray-400">Available 24/7</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold">support@traveldatawifi.com</div>
                    <div className="text-sm text-gray-400">Quick response guaranteed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              &copy; 2025 Travel Data WiFi. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 mt-4 md:mt-0 text-sm text-gray-400">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <span>Made with ❤️ for travelers</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button 
          onClick={() => setShowEmailCapture(true)}
          className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-full shadow-2xl hover:from-orange-600 hover:to-red-600 transition-all duration-300 transform hover:scale-110 animate-pulse"
        >
          <Mail className="h-6 w-6" />
        </button>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default EnhancedHomepage;