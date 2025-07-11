// ===== src/pages/products/[slug].tsx =====
import React from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { useCartStore } from '../../store/cart';
import { ArrowLeft, ShoppingCart, Loader2, AlertCircle, Package, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { ZohoProduct } from '../../lib/zoho-api';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
});

const ProductPage: React.FC = () => {
  const router = useRouter();
  const { slug } = router.query;
  const { addItem } = useCartStore();
  
  // Fetch all products and find the one with matching slug
  const { data, error, isLoading } = useSWR('/api/products', fetcher);
  
  // Find the specific product
  const product = React.useMemo(() => {
    if (!data?.products || !slug) return null;
    return data.products.find((p: ZohoProduct) => 
      p.seo_url === slug || p.product_id === slug
    );
  }, [data, slug]);

  const handleAddToCart = (quantity: number = 1) => {
    if (!product) return;
    addItem(product, quantity);
    toast.success(`${product.product_name} added to cart!`);
  };

  const getProductImage = (product: ZohoProduct) => {
    if (product.product_images && product.product_images.length > 0 && product.product_images[0]) {
      return product.product_images[0];
    }
    return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2Y4ZmFmYyIvPgogIDx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM2Yjc0ODEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZSBBdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPgo=";
  };

  if (isLoading) {
    return (
      <Layout title="Loading... - Travel Data WiFi">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-travel-blue mx-auto mb-4" />
            <p className="text-gray-600">Loading product details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Error - Travel Data WiFi">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Product</h1>
            <p className="text-red-600 mb-4">{error.message}</p>
            <Link 
              href="/products"
              className="text-travel-blue hover:underline"
            >
              Back to Products
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout title="Product Not Found - Travel Data WiFi">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
            <p className="text-gray-600 mb-6">
              The product you're looking for doesn't exist or may have been removed.
            </p>
            <Link 
              href="/products"
              className="bg-travel-blue text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse All Products
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.product_name,
    "description": product.product_description,
    "image": getProductImage(product),
    "offers": {
      "@type": "Offer",
      "url": `https://traveldatawifi.com/products/${product.seo_url || product.product_id}`,
      "priceCurrency": "USD",
      "price": product.product_price,
      "availability": product.inventory_count > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  };

  return (
    <Layout 
      title={`${product.product_name} - Travel Data WiFi`}
      description={product.product_description || `Buy ${product.product_name} from Travel Data WiFi`}
      schema={productSchema}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-travel-blue">Home</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-travel-blue">Products</Link>
          <span>/</span>
          <span className="text-gray-900">{product.product_name}</span>
        </nav>

        {/* Back Button */}
        <Link 
          href="/products"
          className="inline-flex items-center space-x-2 text-travel-blue hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Products</span>
        </Link>

        {/* Product Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Image */}
          <div className="space-y-4">
            <div className="aspect-w-1 aspect-h-1 bg-gray-100 rounded-lg overflow-hidden">
              <img 
                src={getProductImage(product)}
                alt={product.product_name}
                className="w-full h-96 object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2Y4ZmFmYyIvPgogIDx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM2Yjc0ODEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBVbmF2YWlsYWJsZTwvdGV4dD4KPC9zdmc+Cg==";
                }}
              />
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              {product.product_category && (
                <span className="inline-block bg-travel-blue/10 text-travel-blue px-3 py-1 rounded-full text-sm font-medium mb-3">
                  {product.product_category}
                </span>
              )}
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {product.product_name}
              </h1>
              
              <div className="flex items-center space-x-4 mb-4">
                <span className="text-3xl font-bold text-travel-blue">
                  ${typeof product.product_price === 'number' ? product.product_price.toFixed(2) : '0.00'}
                </span>
                {product.inventory_count !== undefined && (
                  <span className={`text-sm font-medium ${
                    product.inventory_count > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {product.inventory_count > 0 ? `${product.inventory_count} in stock` : 'Out of stock'}
                  </span>
                )}
              </div>

              {/* Rating placeholder */}
              <div className="flex items-center space-x-1 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
                <span className="text-sm text-gray-600 ml-2">(4.8/5 based on customer reviews)</span>
              </div>
            </div>

            {/* Description */}
            {product.product_description && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <p className="text-gray-600 leading-relaxed">
                  {product.product_description}
                </p>
              </div>
            )}

            {/* Add to Cart */}
            <div className="border-t pt-6">
              <div className="flex space-x-4">
                <button
                  onClick={() => handleAddToCart(1)}
                  disabled={product.inventory_count === 0}
                  className="flex-1 bg-travel-blue text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span>{product.inventory_count === 0 ? 'Out of Stock' : 'Add to Cart'}</span>
                </button>
                <button
                  disabled={product.inventory_count === 0}
                  className="px-6 py-3 border border-travel-blue text-travel-blue rounded-lg font-semibold hover:bg-travel-blue hover:text-white transition-colors disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  Buy Now
                </button>
              </div>
            </div>

            {/* Features */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Features</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Free shipping on orders over $50</li>
                <li>• 30-day money-back guarantee</li>
                <li>• 24/7 technical support</li>
                <li>• Professional installation guide included</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProductPage;