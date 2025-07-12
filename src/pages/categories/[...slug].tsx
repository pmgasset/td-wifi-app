// ===== src/pages/categories/[...slug].tsx ===== (Create this new file)
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { useCartStore } from '../../store/cart';
import { ShoppingCart, Loader2, AlertCircle, Package, Search, Star, ArrowLeft, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
});

const CategoryProductsPage: React.FC = () => {
  const router = useRouter();
  const { slug } = router.query;
  const { addItem } = useCartStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  // Extract category info from slug
  const categorySlug = Array.isArray(slug) ? slug[0] : slug; // e.g., "4g-5g-router"
  const categoryId = Array.isArray(slug) ? slug[1] : undefined; // e.g., "2948665000025595042"

  // Fetch all products and categories
  const { data: productsData, error: productsError, isLoading: productsLoading } = useSWR('/api/products', fetcher);
  const { data: categoriesData, error: categoriesError, isLoading: categoriesLoading } = useSWR('/api/categories', fetcher);

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

  // Find the current category
  const currentCategory = React.useMemo(() => {
    if (!categoriesData?.categories) return null;
    
    // Try to find by ID first, then by slug
    return categoriesData.categories.find((cat: any) => 
      cat.category_id === categoryId || 
      cat.url === categorySlug ||
      cat.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') === categorySlug
    );
  }, [categoriesData, categoryId, categorySlug]);

  // Filter products by category
  const categoryProducts = React.useMemo(() => {
    if (!productsData?.products) return [];
    
    return productsData.products.filter((product: any) => {
      // Filter by category using multiple possible matches
      const productCategory = product.product_category || product.category_name || '';
      const productCategoryId = product.category_id;
      
      const matchesCategory = 
        productCategoryId === categoryId ||
        productCategory.toLowerCase().replace(/[^a-z0-9]/g, '-') === categorySlug ||
        productCategory.toLowerCase().includes(categorySlug?.replace('-', ' ') || '') ||
        (currentCategory && productCategory === currentCategory.name);
      
      return matchesCategory;
    });
  }, [productsData, categoryId, categorySlug, currentCategory]);

  // Filter and sort products
  const filteredAndSortedProducts = React.useMemo(() => {
    let filtered = categoryProducts.filter((product: any) => {
      const productName = product.product_name || product.name || '';
      const productDesc = product.product_description || product.description || '';
      
      return productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
             productDesc.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Sort products
    filtered.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'price-low':
          return (a.product_price || a.min_rate || 0) - (b.product_price || b.min_rate || 0);
        case 'price-high':
          return (b.product_price || b.min_rate || 0) - (a.product_price || a.min_rate || 0);
        case 'name':
        default:
          return (a.product_name || a.name || '').localeCompare(b.product_name || b.name || '');
      }
    });

    return filtered;
  }, [categoryProducts, searchTerm, sortBy]);

  if (productsLoading || categoriesLoading) {
    return (
      <Layout title="Loading Category... - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50">
          <div className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-travel-blue mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Loading Category...</h1>
                <p className="text-xl text-gray-600">Please wait while we fetch the products</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (productsError || categoriesError) {
    return (
      <Layout title="Error - Travel Data WiFi">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Unable to Load Category</h1>
              <p className="text-gray-600 mb-6">{productsError?.message || categoriesError?.message}</p>
              <Link href="/products" className="btn-primary">
                View All Products
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const categoryName = currentCategory?.name || 
                      categorySlug?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 
                      'Category';

  return (
    <Layout 
      title={`${categoryName} - Travel Data WiFi`}
      description={`Browse ${categoryName} products - Premium mobile internet solutions for RV travel and remote work.`}
    >
      <div className="min-h-screen bg-gray-50">
        {/* Breadcrumb */}
        <div className="bg-white border-b">
          <div className="container mx-auto px-4 py-4">
            <nav className="flex items-center space-x-2 text-sm text-gray-500">
              <Link href="/" className="hover:text-travel-blue">Home</Link>
              <span>/</span>
              <Link href="/products" className="hover:text-travel-blue">Products</Link>
              <span>/</span>
              <span className="text-gray-900">{categoryName}</span>
            </nav>
          </div>
        </div>

        {/* Header Section */}
        <div className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-12">
            {/* Back Button */}
            <Link 
              href="/products"
              className="inline-flex items-center space-x-2 text-travel-blue hover:text-blue-700 mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to All Products</span>
            </Link>

            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                {categoryName}
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                {currentCategory?.description || `Premium ${categoryName.toLowerCase()} solutions designed for life on the road`}
              </p>
            </div>
            
            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search in this category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent"
                />
              </div>
              
              {/* Sort */}
              <div className="flex items-center space-x-4">
                <label htmlFor="sortBy" className="text-sm font-medium text-gray-700">Sort by:</label>
                <select
                  id="sortBy"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-travel-blue focus:border-transparent bg-white"
                >
                  <option value="name">Name (A-Z)</option>
                  <option value="price-low">Price (Low to High)</option>
                  <option value="price-high">Price (High to Low)</option>
                </select>
              </div>
            </div>
            
            {/* Results Count */}
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Showing <span className="font-semibold">{filteredAndSortedProducts.length}</span> products in {categoryName}
              </p>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="container mx-auto px-4 py-16">
          {filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-20 w-20 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-gray-900 mb-4">No Products Found</h3>
              <p className="text-gray-600 mb-8">
                {categoryProducts.length === 0 
                  ? `No products found in ${categoryName} category`
                  : "Try adjusting your search criteria"
                }
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="bg-travel-blue text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors mr-4"
                >
                  Clear Search
                </button>
              )}
              <Link
                href="/products"
                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors inline-block"
              >
                Browse All Products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedProducts.map((product: any) => (
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
                    {(product.inventory_count === 0 || product.overall_stock === '0') && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Product Info */}
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1 mr-2">
                        {product.product_name || product.name}
                      </h3>
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
                    
                    {(product.product_description || product.description) && (
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                        {product.product_description || product.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-bold text-travel-blue">
                        ${typeof product.product_price === 'number' ? product.product_price.toFixed(2) : (product.min_rate || 0).toFixed(2)}
                      </span>
                      {(product.inventory_count !== undefined && product.inventory_count > 0) || (product.overall_stock && product.overall_stock !== '0') ? (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                          {product.inventory_count || product.overall_stock || 'In stock'}
                        </span>
                      ) : null}
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
                        disabled={(product.inventory_count === 0 || product.overall_stock === '0')}
                        className="btn-primary text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default CategoryProductsPage;