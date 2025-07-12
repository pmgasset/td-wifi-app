// ===== src/pages/products.tsx (Fixed - No More Refreshing) =====
import React, { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Layout from '../components/Layout';
import { useCartStore } from '../store/cart';
import { ShoppingCart, Loader2, AlertCircle, Package, Filter, Search, Star } from 'lucide-react';
import toast from 'react-hot-toast';

// Fixed fetcher with better error handling
const fetcher = async (url: string) => {
  console.log('Fetching:', url);
  
  try {
    const res = await fetch(url);
    
    if (!res.ok) {
      // Don't throw for 500 errors, return fallback data instead
      console.warn(`API responded with ${res.status}, using fallback data`);
      return { 
        products: getMockProducts(),
        source: 'fallback',
        error: `API returned ${res.status}`
      };
    }
    
    const data = await res.json();
    console.log('API data received:', data);
    return data;
  } catch (error) {
    console.warn('Fetch failed, using fallback data:', error);
    // Return fallback data instead of throwing
    return { 
      products: getMockProducts(),
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Network error'
    };
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

// Mock products fallback
function getMockProducts() {
  return [
    {
      product_id: '1',
      product_name: 'GL.iNet GL-X3000 5G Router',
      product_description: 'High-performance 5G router perfect for RV travel with dual-band WiFi and external antenna support.',
      product_price: 249.99,
      product_images: ['/images/gl-x3000.jpg'],
      product_category: '5G Routers',
      status: 'active',
      show_in_storefront: true
    },
    {
      product_id: '2',
      product_name: 'WeBoost Drive Reach Signal Booster',
      product_description: 'Powerful cell phone signal booster for vehicles, increases signal strength up to 32x.',
      product_price: 399.99,
      product_images: ['/images/weboost-reach.jpg'],
      product_category: 'Signal Boosters',
      status: 'active',
      show_in_storefront: true
    },
    {
      product_id: '3',
      product_name: 'Pepwave MAX BR1 Pro 5G',
      product_description: 'Enterprise-grade 5G router with advanced failover and load balancing capabilities.',
      product_price: 1299.99,
      product_images: ['/images/pepwave-br1.jpg'],
      product_category: '5G Routers',
      status: 'active',
      show_in_storefront: true
    },
    {
      product_id: '4',
      product_name: 'Winegard ConnecT WiFi Extender',
      product_description: '4G LTE and WiFi range extender specifically designed for RVs and motorhomes.',
      product_price: 449.99,
      product_images: ['/images/winegard-connect.jpg'],
      product_category: 'WiFi Extenders',
      status: 'active',
      show_in_storefront: true
    },
    {
      product_id: '5',
      product_name: 'SureCall Fusion2Go 3.0 RV',
      product_description: 'Complete RV signal booster kit with external and internal antennas.',
      product_price: 549.99,
      product_images: ['/images/surecall-fusion.jpg'],
      product_category: 'Signal Boosters',
      status: 'active',
      show_in_storefront: true
    },
    {
      product_id: '6',
      product_name: 'Cradlepoint R1900 Series Router',
      product_description: 'High-performance LTE router with enterprise security and cloud management.',
      product_price: 899.99,
      product_images: ['/images/cradlepoint-r1900.jpg'],
      product_category: '4G LTE Routers',
      status: 'active',
      show_in_storefront: true
    }
  ];
}

const ProductsPage: React.FC = () => {
  // Configure SWR to stop aggressive retrying
  const { data, error, isLoading } = useSWR('/api/products', fetcher, {
    // CRITICAL: These settings stop the infinite refreshing
    retry: false,                    // Don't retry failed requests
    revalidateOnFocus: false,       // Don't refetch when window gets focus
    revalidateOnReconnect: false,   // Don't refetch on network reconnect
    refreshInterval: 0,             // Don't auto-refresh
    errorRetryCount: 0,             // No error retries
    shouldRetryOnError: false,      // Never retry on error
    dedupingInterval: 60000,        // Cache for 1 minute
    
    // Optional: Add fallback data
    fallbackData: {
      products: getMockProducts(),
      source: 'fallback'
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

  // Show error state WITHOUT retrying
  if (error && !data) {
    return (
      <Layout title="Products - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <AlertCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Products Temporarily Unavailable</h1>
              <p className="text-gray-600 mb-6">
                We're experiencing technical difficulties loading our product catalog. 
                Please try again later or contact support.
              </p>
              <div className="space-y-3">
                <button 
                  onClick={() => window.location.reload()}
                  className="btn-primary w-full"
                >
                  Refresh Page
                </button>
                <Link href="/" className="block text-travel-blue hover:underline">
                  Return to Home
                </Link>
                <Link href="/support/contact" className="block text-travel-blue hover:underline">
                  Contact Support
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Show loading state
  if (isLoading && !data) {
    return (
      <Layout title="Products - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50">
          <div className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-travel-blue mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Loading Products...</h1>
                <p className="text-xl text-gray-600">Please wait while we fetch our latest products</p>
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
            
            {/* Data source indicator */}
            {data?.source === 'fallback' && (
              <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800">
                <AlertCircle className="h-4 w-4 mr-1" />
                Showing demo products - Live data temporarily unavailable
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
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product: any) => (
              <div key={product.product_id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                <div className="aspect-w-16 aspect-h-12 bg-gray-100 rounded-t-lg overflow-hidden">
                  <img
                    src={getProductImage(product)}
                    alt={product.product_name || product.name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZmFmYyIvPgogIDx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2Yjc0ODEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZSBBdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPgo=";
                    }}
                  />
                </div>
                
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
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {product.product_name || product.name}
                  </h3>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {stripHtml(product.product_description || product.description || 'No description available')}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-travel-blue">
                      ${(product.product_price || product.price || 0).toFixed(2)}
                    </div>
                    
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="bg-travel-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
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