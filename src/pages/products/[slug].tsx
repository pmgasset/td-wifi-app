// ===== src/pages/products/[slug].tsx ===== (Updated with HTML parsing and inventory fix)
import React from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { useCartStore } from '../../store/cart';
import { ArrowLeft, ShoppingCart, Loader2, AlertCircle, Package, Star } from 'lucide-react';
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

// Helper function to parse HTML content and create formatted sections
const parseProductDescription = (html: string): { text: string; features: string[] } => {
  if (!html) return { text: '', features: [] };
  
  const features: string[] = [];
  
  // Extract list items as features
  const listItemRegex = /<li[^>]*>(.*?)<\/li>/gi;
  let match;
  while ((match = listItemRegex.exec(html)) !== null) {
    const featureText = stripHtml(match[1]);
    if (featureText && featureText.trim().length > 0) {
      features.push(featureText.trim());
    }
  }
  
  // Get the main text content
  const mainText = stripHtml(html);
  
  return { text: mainText, features };
};

// Helper function to check if product is available for purchase
const isProductAvailable = (product: any): boolean => {
  // Since inventory isn't tracked in Zoho, all active products should be purchasable
  return product.status === 'active' && product.show_in_storefront !== false;
};

const ProductPage: React.FC = () => {
  const router = useRouter();
  const { slug } = router.query;
  const { addItem } = useCartStore();
  
  // Fetch all products and find the one with matching slug
  const { data, error, isLoading } = useSWR('/api/products', fetcher);
  
  // Find the specific product
  const product = React.useMemo(() => {
    if (!data?.products || !slug) return null;
    return data.products.find((p: any) => 
      (p.seo_url === slug || p.url === slug || p.product_id === slug)
    );
  }, [data, slug]);

  const handleAddToCart = (quantity: number = 1) => {
    if (!product) return;
    addItem(product, quantity);
    toast.success(`${product.product_name || product.name} added to cart!`);
  };

  const getProductImage = (product: any) => {
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

  const isAvailable = isProductAvailable(product);
  const parsedDescription = parseProductDescription(product.product_description || product.description || '');

  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.product_name || product.name,
    "description": parsedDescription.text,
    "image": getProductImage(product),
    "offers": {
      "@type": "Offer",
      "url": `https://traveldatawifi.com/products/${product.seo_url || product.url || product.product_id}`,
      "priceCurrency": "USD",
      "price": product.product_price || product.min_rate || 0,
      "availability": isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  };

  return (
    <Layout 
      title={`${product.product_name || product.name} - Travel Data WiFi`}
      description={parsedDescription.text || `Buy ${product.product_name || product.name} from Travel Data WiFi`}
      schema={productSchema}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-travel-blue">Home</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-travel-blue">Products</Link>
          <span>/</span>
          <span className="text-gray-900">{product.product_name || product.name}</span>
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
                alt={product.product_name || product.name}
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
              {(product.product_category || product.category_name) && (
                <span className="inline-block bg-travel-blue/10 text-travel-blue px-3 py-1 rounded-full text-sm font-medium mb-3">
                  {product.product_category || product.category_name}
                </span>
              )}
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {product.product_name || product.name}
              </h1>
              
              <div className="flex items-center space-x-4 mb-4">
                <span className="text-3xl font-bold text-travel-blue">
                  ${typeof product.product_price === 'number' ? product.product_price.toFixed(2) : (product.min_rate || 0).toFixed(2)}
                </span>
                {/* Always show as available since inventory isn't tracked */}
                <span className="text-sm font-medium text-green-600">
                  Available
                </span>
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
            {parsedDescription.text && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <p className="text-gray-600 leading-relaxed">
                  {parsedDescription.text}
                </p>
              </div>
            )}

            {/* Features from parsed HTML */}
            {parsedDescription.features.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">What's Included</h3>
                <ul className="space-y-2 text-gray-600">
                  {parsedDescription.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-travel-blue mr-2">•</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Add to Cart */}
            <div className="border-t pt-6">
              <div className="flex space-x-4">
                <button
                  onClick={() => handleAddToCart(1)}
                  disabled={!isAvailable}
                  className="flex-1 bg-travel-blue text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span>{!isAvailable ? 'Not Available' : 'Add to Cart'}</span>
                </button>
                <button
                  disabled={!isAvailable}
                  className="px-6 py-3 border border-travel-blue text-travel-blue rounded-lg font-semibold hover:bg-travel-blue hover:text-white transition-colors disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  Buy Now
                </button>
              </div>
            </div>

            {/* Additional Features */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Why Choose Travel Data WiFi</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Free shipping on orders over $50
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  30-day money-back guarantee
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  24/7 technical support
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Professional installation guide included
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Concierge Connect device setup and configuration
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Additional Product Information */}
        <div className="mt-16 border-t pt-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-travel-blue rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Easy Setup</h3>
              <p className="text-gray-600">
                Concierge Connect service includes device setup, SIM card installation, and full configuration.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-travel-orange rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Expert Support</h3>
              <p className="text-gray-600">
                24/7 technical support from our team of connectivity experts.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-travel-green rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Fast Shipping</h3>
              <p className="text-gray-600">
                Ships in 3 business days or less with tracking information provided.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProductPage;