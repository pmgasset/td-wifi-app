// ===== src/pages/products.tsx =====
import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Layout from '../components/Layout';
import { useCartStore } from '../store/cart';
import { ShoppingCart, Loader2, AlertCircle, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { ZohoProduct } from '../lib/zoho-api';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
});

const ProductsPage: React.FC = () => {
  const { data, error, isLoading } = useSWR('/api/products', fetcher);
  const { addItem } = useCartStore();

  const handleAddToCart = (product: ZohoProduct) => {
    addItem(product, 1);
    toast.success(`${product.product_name} added to cart!`);
  };

  // Better image handling with fallback
  const getProductImage = (product: ZohoProduct) => {
    if (product.product_images && product.product_images.length > 0 && product.product_images[0]) {
      return product.product_images[0];
    }
    // Return a data URL for a simple placeholder instead of broken image
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%23374151'%3ENo Image%3C/text%3E%3C/svg%3E";
  };

  if (error) {
    return (
      <Layout title="Products - Travel Data WiFi">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Products</h1>
            <div className="bg-red-50 border border-red-200 rounded-md p-6 mb-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-2">Unable to load products</p>
              <p className="text-sm text-red-500 mb-4">{error.message}</p>
              <button 
                onClick={() => window.location.reload()}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
            <Link href="/" className="text-travel-blue hover:underline">
              Return to Home
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout title="Products - Travel Data WiFi">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Products</h1>
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-travel-blue" />
              <span className="ml-2 text-gray-600">Loading products...</span>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const products = data?.products || [];

  return (
    <Layout 
      title="Products - Travel Data WiFi"
      description="Browse our selection of mobile hotspots, unlimited data SIMs, and signal boosters for RV travel and remote work."
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Products</h1>
          <p className="text-xl text-gray-600">
            Premium mobile internet solutions for life on the road
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {products.length} products available
          </p>
        </div>

        {products.length === 0 ? (
          <div className="text-center">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No products available at this time.</p>
            <Link href="/" className="text-travel-blue hover:underline">
              Return to Home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product: ZohoProduct) => (
              <div key={product.product_id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
                {/* Product Image */}
                <div className="aspect-w-1 aspect-h-1 bg-gray-100">
                  <img 
                    src={getProductImage(product)}
                    alt={product.product_name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      // If image fails to load, show placeholder
                      const target = e.target as HTMLImageElement;
                      target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%23374151'%3ENo Image%3C/text%3E%3C/svg%3E";
                    }}
                  />
                </div>
                
                {/* Product Info */}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1 mr-2">
                      {product.product_name}
                    </h3>
                    {product.product_category && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full whitespace-nowrap">
                        {product.product_category}
                      </span>
                    )}
                  </div>
                  
                  {product.product_description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {product.product_description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl font-bold text-travel-blue">
                      ${typeof product.product_price === 'number' ? product.product_price.toFixed(2) : '0.00'}
                    </span>
                    {product.inventory_count !== undefined && (
                      <span className="text-xs text-gray-500">
                        {product.inventory_count > 0 ? `${product.inventory_count} in stock` : 'Out of stock'}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Link 
                      href={`/products/${product.seo_url || product.product_id}`}
                      className="flex-1 bg-gray-100 text-gray-700 text-center py-2 px-3 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      Details
                    </Link>
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={product.inventory_count === 0}
                      className="flex items-center justify-center space-x-1 bg-travel-blue text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span className="hidden sm:inline">Add</span>
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