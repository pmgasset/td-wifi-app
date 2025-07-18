// src/pages/index.tsx
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Wifi, Zap, Shield, Star, CheckCircle, ArrowRight, Truck, HeadphonesIcon, Loader2, AlertCircle } from 'lucide-react';
import { useCartStore } from '../store/cart';
import toast from 'react-hot-toast';

// Type definitions for product data
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

const StreamlinedHomepage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { addItem } = useCartStore();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/products');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.products && Array.isArray(data.products)) {
        // Filter and sort to get the 3 most popular/featured products
        const activeProducts = data.products.filter((product: Product) => 
          product.status === 'active' && 
          product.show_in_storefront !== false
        );
        
        // Sort by popularity indicators (you can adjust this logic based on your API data)
        const sortedProducts = activeProducts.sort((a: Product, b: Product) => {
          // Prioritize featured products, then by price (assuming higher price = premium)
          const aScore = (a.is_featured ? 1000 : 0) + (parseFloat(String(a.price || 0)) || 0);
          const bScore = (b.is_featured ? 1000 : 0) + (parseFloat(String(b.price || 0)) || 0);
          return bScore - aScore;
        });
        
        // Take the top 3 products
        setProducts(sortedProducts.slice(0, 3));
      } else {
        throw new Error('Invalid product data format');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    try {
      addItem(product, 1);
      toast.success(`${getProductName(product)} added to cart!`);
    } catch (err) {
      toast.error('Failed to add item to cart');
    }
  };

  // Helper functions to extract product data safely
  const getProductName = (product: Product): string => {
    return product.name || product.product_name || 'Unnamed Product';
  };

  const getProductPrice = (product: Product): number | null => {
    const price = parseFloat(String(product.price || product.rate || 0));
    return price > 0 ? price : null;
  };

  const getProductImage = (product: Product): string => {
    // Check various possible image sources from your API
    if (product.images && product.images.length > 0) {
      return product.images[0].url || product.images[0].image_url || '/api/placeholder/400/300';
    }
    if (product.image_url) {
      return product.image_url;
    }
    if (product.documents && product.documents.length > 0) {
      return `/product-images/${product.documents[0].document_id}`;
    }
    return '/api/placeholder/400/300'; // Fallback placeholder
  };

  const getProductDescription = (product: Product): string => {
    return product.description || product.short_description || 'High-quality mobile internet solution';
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                <Wifi className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-blue-600">Travel Data WiFi</span>
                <div className="text-xs text-gray-500 -mt-1">Stay Connected Anywhere</div>
              </div>
            </div>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/support" className="text-gray-700 hover:text-blue-600 font-medium">
                Support
              </Link>
              <Link href="/coverage" className="text-gray-700 hover:text-blue-600 font-medium">
                Coverage
              </Link>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                Call 1-800-WIFI-RV
              </button>
            </nav>

            {/* Mobile menu button */}
            <button className="md:hidden p-2">
              <div className="w-6 h-6 flex flex-col justify-center space-y-1">
                <div className="w-full h-0.5 bg-gray-600"></div>
                <div className="w-full h-0.5 bg-gray-600"></div>
                <div className="w-full h-0.5 bg-gray-600"></div>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center space-x-2 bg-white bg-opacity-20 rounded-full px-4 py-2 mb-8">
            <Star className="h-5 w-5 text-yellow-300" />
            <span className="text-sm font-medium">Trusted by 50,000+ RV Travelers</span>
          </div>
          
          <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
            Stay Connected
            <span className="block text-yellow-300">Anywhere</span>
          </h1>
          
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
            One simple data plan. Premium routers. Unlimited connectivity for your adventures.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <div className="bg-white bg-opacity-10 rounded-lg px-6 py-3 backdrop-blur-sm">
              <div className="text-2xl font-bold">$99/month</div>
              <div className="text-sm text-blue-200">Truly Unlimited Data</div>
            </div>
            <div className="text-blue-200">No contracts • No throttling • All carriers</div>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Choose Your Perfect Router
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              All compatible with our unlimited data plan. Pick the router that fits your lifestyle.
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Loading our latest routers...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center bg-red-50 rounded-lg p-8 max-w-md">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-red-900 mb-2">Unable to load products</h3>
                <p className="text-red-700 mb-4">{error}</p>
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
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {products.map((product, index) => {
                const price = getProductPrice(product);
                const isPopular = index === 0; // First product is most popular
                
                return (
                  <div key={product.product_id || product.id} className="relative">
                    {/* Popular Badge */}
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                        <div className="bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                          Most Popular
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                      {/* Product Image */}
                      <div className="aspect-w-16 aspect-h-12 bg-gray-100">
                        <img 
                          src={getProductImage(product)}
                          alt={getProductName(product)}
                          className="w-full h-48 object-cover"
                          onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/api/placeholder/400/300';
                          }}
                        />
                      </div>
                      
                      {/* Product Details */}
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {getProductName(product)}
                        </h3>
                        
                        <p className="text-gray-600 mb-4 line-clamp-2">
                          {getProductDescription(product)}
                        </p>
                        
                        {/* Price */}
                        {price && (
                          <div className="mb-4">
                            <span className="text-3xl font-bold text-gray-900">${price}</span>
                            <span className="text-gray-500 ml-1">one-time</span>
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="space-y-3">
                          <button 
                            onClick={() => handleAddToCart(product)}
                            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                          >
                            Add to Cart
                          </button>
                          
                          <Link 
                            href={`/products/${product.seo_url || product.url || product.product_id}`}
                            className="w-full border border-blue-600 text-blue-600 py-3 px-6 rounded-lg font-semibold hover:bg-blue-50 transition-colors block text-center"
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

          {/* View All Products Link */}
          {!loading && !error && products.length > 0 && (
            <div className="text-center mt-12">
              <Link 
                href="/products" 
                className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-semibold text-lg"
              >
                <span>View All Products</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Simple Data Plan Section */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            One Plan. Zero Complexity.
          </h2>
          
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Unlike other providers, we keep it simple. One unlimited data plan that works with any of our routers.
          </p>
          
          <div className="bg-white bg-opacity-10 rounded-2xl p-8 backdrop-blur-sm max-w-md mx-auto">
            <div className="text-4xl font-bold mb-2">$99/month</div>
            <div className="text-lg text-blue-200 mb-6">Unlimited High-Speed Data</div>
            
            <ul className="space-y-3 text-left">
              <li className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span>No throttling or data caps</span>
              </li>
              <li className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span>All major carriers included</span>
              </li>
              <li className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span>50-state coverage</span>
              </li>
              <li className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span>No contracts required</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Truck className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Free Shipping</h3>
              <p className="text-gray-600">Fast, secure delivery to your door</p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <HeadphonesIcon className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Expert Support</h3>
              <p className="text-gray-600">24/7 technical assistance</p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">30-Day Guarantee</h3>
              <p className="text-gray-600">Risk-free trial period</p>
            </div>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                <Wifi className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold">Travel Data WiFi</span>
                <div className="text-sm text-gray-400">Stay Connected Anywhere</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-6 text-sm">
              <Link href="/support" className="hover:text-blue-400">Support</Link>
              <Link href="/coverage" className="hover:text-blue-400">Coverage</Link>
              <span className="text-gray-400">1-800-WIFI-RV</span>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2025 Travel Data WiFi. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StreamlinedHomepage;