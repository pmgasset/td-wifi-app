// ===== src/pages/products.tsx (COMPLETE FIXED VERSION) =====
import React, { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Layout from '../components/Layout';
import { useCartStore } from '../store/cart';
import { ShoppingCart, Loader2, AlertCircle, Package, Filter, Search, Star, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

// Comprehensive error handling fetcher - NO MOCK DATA
const fetcher = async (url: string) => {
  console.log('Fetching products from:', url);
  
  try {
    const res = await fetch(url);
    
    if (!res.ok) {
      let errorDetails = '';
      try {
        const errorData = await res.json();
        errorDetails = errorData.details || errorData.error || 'Unknown API error';
      } catch {
        errorDetails = await res.text() || 'No error details available';
      }
      
      const error = new Error(`API Error ${res.status}: ${res.statusText}`);
      (error as any).status = res.status;
      (error as any).details = errorDetails;
      (error as any).url = url;
      
      console.error('API request failed:', {
        status: res.status,
        statusText: res.statusText,
        url: url,
        details: errorDetails,
        headers: Object.fromEntries(res.headers.entries())
      });
      
      throw error;
    }
    
    const data = await res.json();
    console.log('Successfully fetched products:', {
      productCount: data.products?.length || 0,
      source: data.source || 'api',
      timestamp: data.meta?.timestamp || new Date().toISOString()
    });
    
    return data;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Product fetch error:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        url: url
      });
      
      // Enhance error with additional context
      const enhancedError = new Error(error.message);
      (enhancedError as any).originalError = error;
      (enhancedError as any).fetchUrl = url;
      (enhancedError as any).timestamp = new Date().toISOString();
      
      if ('status' in error) {
        (enhancedError as any).status = (error as any).status;
        (enhancedError as any).details = (error as any).details;
      }
      
      throw enhancedError;
    }
    
    throw new Error(`Unknown error occurred while fetching products: ${String(error)}`);
  }
};

// Helper function to strip HTML tags and decode HTML entities
const stripHtml = (html: string): string => {
  if (!html) return '';
  
  // Remove HTML tags
  const withoutTags = html.replace(/<[^>]*>/g, ' ');
  
  // Decode common HTML entities
  const decoded = withoutTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '...');
  
  // Clean up extra whitespace
  return decoded.replace(/\s+/g, ' ').trim();
};

// Helper function to check if product is actually available for purchase
const isProductAvailable = (product: any): boolean => {
  return product.status === 'active' && product.show_in_storefront !== false;
};

// Helper function to truncate text
const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  
  const truncated = text.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > maxLength * 0.8) {
    return truncated.substring(0, lastSpaceIndex) + '...';
  }
  
  return truncated + '...';
};

// Helper function to get detailed error information
const getErrorDetails = (error: any) => {
  const details = {
    type: 'Unknown Error',
    message: 'An unexpected error occurred',
    suggestions: [] as string[],
    technicalDetails: null as any
  };
  
  if (!error) return details;
  
  // Network/Connection errors
  if (error.message?.includes('fetch') || error.name === 'TypeError') {
    details.type = 'Network Connection Error';
    details.message = 'Unable to connect to the products API. Please check your internet connection.';
    details.suggestions = [
      'Check your internet connection',
      'Try refreshing the page',
      'Contact support if the issue persists'
    ];
  }
  // API Server errors (5xx)
  else if (error.status >= 500) {
    details.type = 'Server Error';
    details.message = 'The products service is temporarily unavailable. Our team has been notified.';
    details.suggestions = [
      'Please try again in a few minutes',
      'Check our status page for updates',
      'Contact support if the issue continues'
    ];
    details.technicalDetails = {
      status: error.status,
      details: error.details,
      url: error.url || error.fetchUrl
    };
  }
  // Client errors (4xx)
  else if (error.status >= 400 && error.status < 500) {
    details.type = 'Request Error';
    details.message = `Unable to load products: ${error.details || error.message}`;
    details.suggestions = [
      'Try refreshing the page',
      'Clear your browser cache',
      'Contact support if the problem continues'
    ];
    details.technicalDetails = {
      status: error.status,
      details: error.details,
      url: error.url || error.fetchUrl
    };
  }
  // Authentication/Authorization errors
  else if (error.message?.includes('auth') || error.message?.includes('token')) {
    details.type = 'Authentication Error';
    details.message = 'There was an issue accessing the product catalog. This appears to be a configuration problem.';
    details.suggestions = [
      'Please try again later',
      'Contact our support team for assistance'
    ];
  }
  // Timeout errors
  else if (error.message?.includes('timeout')) {
    details.type = 'Request Timeout';
    details.message = 'The request took too long to complete. This might be due to high server load.';
    details.suggestions = [
      'Try again in a moment',
      'Check your internet connection speed',
      'Contact support if timeouts persist'
    ];
  }
  // General API errors
  else {
    details.type = 'API Error';
    details.message = error.message || 'Failed to load product information';
    details.suggestions = [
      'Try refreshing the page',
      'Check your internet connection',
      'Contact support if the issue persists'
    ];
    details.technicalDetails = {
      message: error.message,
      status: error.status,
      details: error.details,
      timestamp: error.timestamp
    };
  }
  
  return details;
};

const ProductsPage: React.FC = () => {
  // Configure SWR with proper error handling - NO FALLBACKS
  const { data, error, isLoading } = useSWR('/api/products', fetcher, {
    retry: false,                    // Don't retry failed requests
    revalidateOnFocus: false,       // Don't refetch when window gets focus
    revalidateOnReconnect: false,   // Don't refetch on network reconnect
    refreshInterval: 0,             // Don't auto-refresh
    errorRetryCount: 0,             // No error retries
    shouldRetryOnError: false,      // Never retry on error
    dedupingInterval: 60000,        // Cache for 1 minute
    
    // NO fallback data - let errors surface properly
    onError: (error) => {
      console.error('SWR Error:', error);
    }
  });

  const { addItem } = useCartStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const getProductImage = (product: any) => {
    if (product.product_images && product.product_images.length > 0 && product.product_images[0]) {
      return product.product_images[0];
    }
    return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZmFmYyIvPgogIDx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2Yjc0ODEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZSBBdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPgo=";
  };

  // Helper function to get product slug for navigation
  const getProductSlug = (product: any) => {
    return product.seo_url || product.url || product.product_id;
  };

  const handleAddToCart = (product: any) => {
    addItem(product, 1);
    toast.success(`${product.product_name || product.name} added to cart!`);
  };

  // Filter products based on search and category
  const filteredProducts = React.useMemo(() => {
    if (!data?.products) return [];
    
    return data.products.filter((product: any) => {
      const productName = product.product_name || product.name || '';
      const productDesc = stripHtml(product.product_description || product.description || '');
      const productCategory = product.product_category || product.category_name || '';
      
      const matchesSearch = productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           productDesc.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || 
                             productCategory.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory && isProductAvailable(product);
    });
  }, [data?.products, searchTerm, selectedCategory]);

  // Get unique categories safely
  const categories = React.useMemo(() => {
    if (!data?.products) return [];
    const categorySet = new Set<string>();
    data.products.forEach((p: any) => {
      const category = p.product_category || p.category_name;
      if (category) {
        categorySet.add(category);
      }
    });
    return Array.from(categorySet);
  }, [data?.products]);

  // Show comprehensive error state with actionable information
  if (error) {
    const errorDetails = getErrorDetails(error);
    
    return (
      <Layout title="Products - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-2xl mx-auto px-4">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
              
              <h1 className="text-2xl font-bold text-gray-900 mb-4">{errorDetails.type}</h1>
              <p className="text-gray-600 mb-6 text-lg">{errorDetails.message}</p>
              
              {errorDetails.suggestions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">What you can try:</h3>
                  <ul className="text-left text-gray-600 space-y-2">
                    {errorDetails.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="space-y-3">
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full bg-travel-blue text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
                
                <Link 
                  href="/" 
                  className="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Return to Home
                </Link>
                
                <Link 
                  href="/support/contact" 
                  className="block text-travel-blue hover:underline"
                >
                  Contact Support
                </Link>
              </div>
              
              {/* Technical details for debugging (only in development or for support) */}
              {errorDetails.technicalDetails && process.env.NODE_ENV === 'development' && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Technical Details (Development Only)
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                    {JSON.stringify(errorDetails.technicalDetails, null, 2)}
                  </pre>
                </details>
              )}
              
              {/* Error ID for support */}
              <div className="mt-6 text-xs text-gray-400">
                Error ID: {error?.timestamp || new Date().toISOString()}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <Layout title="Products - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50">
          <div className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-travel-blue mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Loading Products...</h1>
                <p className="text-xl text-gray-600">Fetching the latest products from our catalog</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const products = filteredProducts;

  return (
    <Layout 
      title="Products - Travel Data WiFi"
      description="Browse our selection of mobile hotspots, unlimited data SIMs, and signal boosters for RV travel and remote work."
    >
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Premium Mobile Internet Solutions</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover our curated selection of high-performance internet equipment designed for travelers and remote workers
            </p>
            
            {/* Data source indicator - show any API issues */}
            {data?.source === 'fallback' && (
              <div className="mt-4 inline-flex items-center px-4 py-2 rounded-full text-sm bg-red-100 text-red-800">
                <AlertCircle className="h-4 w-4 mr-2" />
                API Error: Using cached data - Live products may not be current
              </div>
            )}
            
            {data?.error && (
              <div className="mt-4 inline-flex items-center px-4 py-2 rounded-full text-sm bg-orange-100 text-orange-800">
                <AlertCircle className="h-4 w-4 mr-2" />
                Warning: {data.error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-500" />
              <span className="text-gray-700 font-medium">Filter:</span>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600">
              {!data?.products || data.products.length === 0 
                ? "No products are currently available in our catalog." 
                : "Try adjusting your search or filter criteria"
              }
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-4 bg-travel-blue text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product: any) => (
              <div key={product.product_id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                {/* ✅ CLICKABLE PRODUCT IMAGE */}
                <Link href={`/products/${getProductSlug(product)}`}>
                  <div className="aspect-w-16 aspect-h-12 bg-gray-100 rounded-t-lg overflow-hidden cursor-pointer group">
                    <img
                      src={getProductImage(product)}
                      alt={product.product_name || product.name}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZmFmYyIvPgogIDx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2Yjc0ODEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZSBBdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPgo=";
                      }}
                    />
                  </div>
                </Link>
                
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-travel-blue font-medium">
                      {product.product_category || product.category_name || 'General'}
                    </span>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-600 ml-1">4.8</span>
                    </div>
                  </div>
                  
                  {/* ✅ CLICKABLE PRODUCT NAME */}
                  <Link href={`/products/${getProductSlug(product)}`}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-travel-blue transition-colors cursor-pointer">
                      {product.product_name || product.name}
                    </h3>
                  </Link>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {truncateText(stripHtml(product.product_description || product.description || 'No description available'), 120)}
                  </p>
                  
                  {/* ✅ PRICE DISPLAY */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-2xl font-bold text-travel-blue">
                      ${(product.product_price || product.min_rate || product.price || 0).toFixed(2)}
                    </div>
                  </div>
                  
                  {/* ✅ DUAL ACTION BUTTONS - VIEW DETAILS + ADD TO CART */}
                  <div className="flex space-x-2">
                    {/* ✅ VIEW DETAILS BUTTON */}
                    <Link 
                      href={`/products/${getProductSlug(product)}`}
                      className="flex-1 bg-gray-100 text-gray-700 text-center py-2 px-3 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center justify-center space-x-1"
                    >
                      <Eye className="h-4 w-4" />
                      <span>View Details</span>
                    </Link>
                    
                    {/* ADD TO CART BUTTON */}
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="bg-travel-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2 text-sm font-medium"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span>Add to Cart</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProductsPage;