// ===== src/pages/products.tsx ===== (Updated with HTML parsing and inventory fix)
import React, { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Layout from '../components/Layout';
import { useCartStore } from '../store/cart';
import { ShoppingCart, Loader2, AlertCircle, Package, Filter, Search, Star } from 'lucide-react';
import toast from 'react-hot-toast';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
});

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
  // Since you don't track inventory in Zoho, all active products should be purchasable
  // Only check if the product is active and shown in storefront
  return product.status === 'active' && product.show_in_storefront !== false;
};

const ProductsPage: React.FC = () => {
  const { data, error, isLoading } = useSWR('/api/products', fetcher);
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
      return matchesSearch && matchesCategory;
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

  if (error) {
    return (
      <Layout title="Products - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Unable to Load Products</h1>
              <p className="text-gray-600 mb-6">{error.message}</p>
              <button 
                onClick={() => window.location.reload()}
                className="btn-primary"
              >
                Try Again
              </button>
              <Link href="/" className="block mt-4 text-travel-blue hover:underline">
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
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
      <div className="min-h-screen bg-gray-50">
        {/* Header Section */}
        <div className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-12">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Our Products
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Premium mobile internet solutions designed for life on the road
              </p>
            </div>
            
            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                />
              </div>
              
              {/* Category Filter */}
              <div className="flex items-center space-x-4">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent bg-white"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Results Count */}
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Showing <span className="font-semibold">{products.length}</span> of <span className="font-semibold">{data?.products?.length || 0}</span> products
              </p>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="container mx-auto px-4 py-16">
          {products.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-20 w-20 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-gray-900 mb-4">No Products Found</h3>
              <p className="text-gray-600 mb-8">
                {searchTerm || selectedCategory !== 'all' 
                  ? "Try adjusting your search or filter criteria"
                  : "No products are currently available"
                }
              </p>
              {(searchTerm || selectedCategory !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                  }}
                  className="bg-travel-blue text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product: any) => {
                const isAvailable = isProductAvailable(product);
                const cleanDescription = stripHtml(product.product_description || product.description || '');
                
                return (
                  <div key={product.product_id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                    {/* Product Image */}
                    <div className="relative bg-gray-100">
                      <img 
                        src={getProductImage(product)}
                        alt={product.product_name || product.name}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZmFmYyIvPgogIDx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2Yjc0ODEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBVbmF2YWlsYWJsZTwvdGV4dD4KPC9zdmc+Cg==";
                        }}
                      />
                      {/* Remove the out of stock overlay since inventory isn't tracked in Zoho */}
                    </div>
                    
                    {/* Product Info */}
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1 mr-2">
                          {product.product_name || product.name}
                        </h3>
                        {(product.product_category || product.category_name) && (
                          <span className="text-xs bg-travel-blue bg-opacity-10 text-travel-blue px-2 py-1 rounded-full whitespace-nowrap">
                            {product.product_category || product.category_name}
                          </span>
                        )}
                      </div>
                      
                      {/* Rating */}
                      <div className="flex items-center space-x-1 mb-2">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-gray-500 ml-1">(4.8)</span>
                      </div>
                      
                      {/* Clean description without HTML */}
                      {cleanDescription && (
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {cleanDescription.substring(0, 120)}...
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-2xl font-bold text-travel-blue">
                          ${typeof product.product_price === 'number' ? product.product_price.toFixed(2) : (product.min_rate || 0).toFixed(2)}
                        </span>
                        {/* Always show as available since inventory isn't tracked */}
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                          Available
                        </span>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Link 
                          href={`/products/${product.seo_url || product.url || product.product_id}`}
                          className="flex-1 bg-gray-100 text-gray-700 text-center py-2 px-3 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                        >
                          View Details
                        </Link>
                        <button
                          onClick={() => handleAddToCart(product)}
                          disabled={!isAvailable}
                          className="btn-primary text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                          title={!isAvailable ? "Product not available" : "Add to cart"}
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
        </div>
      </div>
    </Layout>
  );
};

export default ProductsPage;