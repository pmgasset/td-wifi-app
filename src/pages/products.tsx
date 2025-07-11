// ===== src/pages/products.tsx =====
import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Layout from '../components/Layout';
import { useCartStore } from '../store/cart';
import { ShoppingCart, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ZohoProduct } from '../lib/zoho-api';

const fetcher = (url: string) => fetch(url).then(res => {
  console.log('API Response status:', res.status);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
});

const ProductsPage: React.FC = () => {
  const { data, error, isLoading } = useSWR('/api/products', fetcher);
  const { addItem } = useCartStore();

  // Debug logging
  React.useEffect(() => {
    console.log('Products page data:', data);
    console.log('Products page error:', error);
    console.log('Products page loading:', isLoading);
  }, [data, error, isLoading]);

  const handleAddToCart = (product: ZohoProduct) => {
    addItem(product, 1);
    toast.success(`${product.product_name} added to cart!`);
  };

  if (error) {
    console.error('Products fetch error:', error);
    return (
      <Layout title="Products - Travel Data WiFi">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Products</h1>
            <div className="bg-red-50 border border-red-200 rounded-md p-6 mb-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-2">
                Unable to load products at this time.
              </p>
              <p className="text-sm text-red-500 mb-4">
                Error: {error.message || 'Unknown error occurred'}
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
            <Link 
              href="/"
              className="text-travel-blue hover:underline"
            >
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
  console.log('Parsed products:', products);

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
        </div>

        {/* Debug info for development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-8 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-semibold mb-2">Debug Info:</h3>
            <p>Data: {JSON.stringify(data, null, 2)}</p>
            <p>Products count: {products.length}</p>
          </div>
        )}

        {products.length === 0 ? (
          <div className="text-center">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 mb-8">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-yellow-700 mb-2">No products available</p>
              <p className="text-sm text-yellow-600">
                This could mean:
              </p>
              <ul className="text-sm text-yellow-600 mt-2 space-y-1">
                <li>• Zoho Commerce API is not returning products</li>
                <li>• Environment variables are not properly configured</li>
                <li>• Your Zoho store doesn't have any products yet</li>
              </ul>
            </div>
            <Link 
              href="/"
              className="text-travel-blue hover:underline"
            >
              Return to Home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product: ZohoProduct) => (
              <div key={product.product_id} className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <img 
                  src={product.product_images[0] || '/images/placeholder.jpg'} 
                  alt={product.product_name}
                  className="w-full h-64 object-cover rounded-t-lg"
                />
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-semibold">{product.product_name}</h3>
                    <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {product.product_category}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 mb-4 line-clamp-3">{product.product_description}</p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold text-travel-blue">
                      ${product.product_price}
                    </span>
                    <span className="text-sm text-gray-500">
                      {product.inventory_count > 0 ? `${product.inventory_count} in stock` : 'Out of stock'}
                    </span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Link 
                      href={`/products/${product.seo_url}`}
                      className="flex-1 bg-gray-100 text-gray-700 text-center py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Learn More
                    </Link>
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={product.inventory_count === 0}
                      className="flex items-center space-x-2 bg-travel-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
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