// src/pages/products.tsx - Updated to allow flexible image sizing

import React, { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Layout from '../components/Layout';
import { useCartStore } from '../store/cart';
import { ShoppingCart, Loader2, AlertCircle, Package, Search, Star } from 'lucide-react';
import toast from 'react-hot-toast';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
});

// Get product image URL (remove size restrictions for high quality)
const getProductImage = (product: any): string => {
  if (product.product_images && product.product_images.length > 0 && product.product_images[0]) {
    // Remove size restrictions from Zoho CDN URLs to get full-size images
    let imageUrl = product.product_images[0];
    if (imageUrl.includes('/400x400')) {
      imageUrl = imageUrl.replace('/400x400', '');
    }
    if (imageUrl.includes('/300x300')) {
      imageUrl = imageUrl.replace('/300x300', '');
    }
    return imageUrl;
  }
  
  // Return placeholder SVG for missing images
  return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2Y4ZmFmYyIvPgogIDx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM2Yjc0ODEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZSBBdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPgo=";
};

const getProductSlug = (product: any): string => {
  return product.seo_url || product.url || product.product_id;
};

const ProductsPage: React.FC = () => {
  const { data, error, isLoading } = useSWR('/api/products', fetcher);
  const { addItem } = useCartStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const handleAddToCart = (product: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    addItem({
      id: product.product_id,
      name: product.product_name || product.name,
      price: product.product_price || product.min_rate || 0,
      quantity: 1,
      image: getProductImage(product)
    });
    
    toast.success(`${product.product_name || product.name} added to cart!`);
  };

  // Filter and sort products
  const processedProducts = React.useMemo(() => {
    if (!data?.products) return [];
    
    let filtered = data.products.filter((product: any) => {
      const name = (product.product_name || product.name || '').toLowerCase();
      const description = (product.product_description || product.description || '').toLowerCase();
      const category = (product.product_category || product.category_name || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      
      return name.includes(search) || description.includes(search) || category.includes(search);
    });

    // Sort products
    filtered.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'price-low':
          return (a.product_price || 0) - (b.product_price || 0);
        case 'price-high':
          return (b.product_price || 0) - (a.product_price || 0);
        case 'name':
        default:
          return (a.product_name || a.name || '').localeCompare(b.product_name || b.name || '');
      }
    });

    return filtered;
  }, [data?.products, searchTerm, sortBy]);

  if (error) {
    return (
      <Layout title="Products - Travel Data WiFi" description="Browse our router and data plan products">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to load products</h3>
            <p className="text-gray-600 mb-4">
              {error?.message || 'There was an error loading our product catalog.'}
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-travel-blue text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title="Products - Travel Data WiFi" 
      description="Browse our selection of high-performance routers and flexible data plans for travelers"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Products</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover our range of premium routers and data solutions designed for travelers, 
            remote workers, and anyone who needs reliable internet connectivity on the go.
          </p>
        </div>

        {/* Search and Filter Controls */}
        <div className="mb-8 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-travel-blue focus:border-transparent"
            >
              <option value="name">Sort by Name</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
            
            {data?.products && (
              <span className="text-sm text-gray-600">
                {processedProducts.length} of {data.products.length} products
              </span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="h-12 w-12 text-travel-blue mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Loading products...</p>
          </div>
        ) : !processedProducts || processedProducts.length === 0 ? (
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
            {processedProducts.map((product: any) => (
              <div key={product.product_id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                {/* ✅ FIXED: Product image container with proper aspect ratio */}
                <Link href={`/products/${getProductSlug(product)}`}>
                  <div className="h-48 bg-gray-50 rounded-t-lg overflow-hidden cursor-pointer group flex items-center justify-center p-4">
                    <img
                      src={getProductImage(product)}
                      alt={product.product_name || product.name}
                      className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'auto',
                        height: 'auto'
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNmOGZhZmM7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I2UyZThmMDtzdG9wLW9wYWNpdHk6MSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWQpIi8+CiAgPHJlY3QgeD0iMTcwIiB5PSIxMjAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI0MCIgcng9IjQiIGZpbGw9IiNjYmQ1ZTEiLz4KICA8Y2lyY2xlIGN4PSIxODUiIGN5PSIxMzUiIHI9IjgiIGZpbGw9IiM5NGEzYjgiLz4KICA8cG9seWdvbiBwb2ludHM9IjE4NSwxNTUgMjE1LDE1NSAyMDAsMTM1IiBmaWxsPSIjOTRhM2I4Ii8+CiAgPHRleHQgeD0iMjAwIiB5PSIxOTAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+SW1hZ2UgVW5hdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPgo=";
                      }}
                    />
                    
                    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-semibold shadow-sm">
                      <Star className="h-4 w-4 inline mr-1 text-yellow-400" />
                      4.9
                    </div>
                  </div>
                </Link>

                {/* Product Details */}
                <div className="p-6">
                  {(product.product_category || product.category_name) && (
                    <span className="inline-block bg-travel-blue/10 text-travel-blue px-2 py-1 rounded text-xs font-medium mb-2">
                      {product.product_category || product.category_name}
                    </span>
                  )}
                  
                  <Link href={`/products/${getProductSlug(product)}`}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-travel-blue transition-colors cursor-pointer">
                      {product.product_name || product.name}
                    </h3>
                  </Link>
                  
                  {(product.product_description || product.description) && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {(product.product_description || product.description).replace(/<[^>]*>/g, '').substring(0, 100)}...
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-travel-blue">
                      ${typeof product.product_price === 'number' ? 
                        product.product_price.toFixed(2) : 
                        parseFloat(product.product_price || product.min_rate || 0).toFixed(2)
                      }
                    </span>
                    
                    <button
                      onClick={(e) => handleAddToCart(product, e)}
                      className="flex items-center space-x-2 bg-travel-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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

        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && data && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg text-sm">
            <h4 className="font-semibold mb-2">Debug Info:</h4>
            <p>Total products: {data.products?.length || 0}</p>
            <p>Filtered products: {processedProducts.length}</p>
            <p>Products with images: {data.products?.filter((p: any) => p.product_images?.length > 0).length || 0}</p>
            {data.meta && (
              <pre className="mt-2 text-xs overflow-auto">
                {JSON.stringify(data.meta, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProductsPage;