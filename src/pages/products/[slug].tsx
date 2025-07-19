// src/pages/products/[slug].tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { useCartStore } from '../../store/cart';
import { ArrowLeft, ShoppingCart, Loader2, AlertCircle, Package, Star, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
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

// Enhanced image handling with carousel support
const getProductImage = (product: any): string => {
  if (product.product_images && product.product_images.length > 0 && product.product_images[0]) {
    const firstImage = product.product_images[0];
    if (typeof firstImage === 'string') {
      return firstImage;
    } else if (typeof firstImage === 'object' && firstImage.src) {
      return firstImage.src;
    }
  }
  return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2Y4ZmFmYyIvPgogIDx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM2Yjc0ODEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBVbmF2YWlsYWJsZTwvdGV4dD4KPC9zdmc+Cg==";
};

// Rate limiting utility for image loading
class ImageLoader {
  private queue: (() => Promise<void>)[] = [];
  private loading = false;
  private readonly DELAY_MS = 100; // Delay between loads

  async addToQueue(loadFn: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await loadFn();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.loading || this.queue.length === 0) return;
    
    this.loading = true;
    while (this.queue.length > 0) {
      const loadFn = this.queue.shift();
      if (loadFn) {
        try {
          await loadFn();
          if (this.queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, this.DELAY_MS));
          }
        } catch (error) {
          console.warn('Image loading failed:', error);
        }
      }
    }
    this.loading = false;
  }
}

// Types
interface ImageItem {
  src: string;
  alt?: string;
}

interface CarouselProps {
  images: (string | { src: string })[];
  productName: string;
  className?: string;
}

// Enhanced Image Carousel Component with all images support
const ProductImageCarousel: React.FC<CarouselProps> = ({ images, productName, className = '' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [isZoomed, setIsZoomed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageLoaderRef = useRef(new ImageLoader());

  // Normalize images to consistent format
  const normalizedImages: ImageItem[] = useMemo(() => {
    if (!images || images.length === 0) return [];
    
    return images.map((img, index) => ({
      src: typeof img === 'string' ? img : img.src,
      alt: `${productName} - Image ${index + 1}`
    })).filter(img => img.src && img.src.trim() !== '');
  }, [images, productName]);

  // Preload images with rate limiting
  useEffect(() => {
    if (normalizedImages.length === 0) return;

    const preloadImage = (src: string, index: number): Promise<void> => {
      return imageLoaderRef.current.addToQueue(() => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            setLoadedImages(prev => new Set(prev).add(index));
            resolve();
          };
          img.onerror = () => {
            setFailedImages(prev => new Set(prev).add(index));
            reject(new Error(`Failed to load image: ${src}`));
          };
          img.src = src;
        });
      });
    };

    // Load current image first, then others
    const loadOrder = [currentIndex, ...normalizedImages.map((_, i) => i).filter(i => i !== currentIndex)];
    
    loadOrder.forEach(index => {
      if (!loadedImages.has(index) && !failedImages.has(index)) {
        preloadImage(normalizedImages[index].src, index).catch(() => {
          // Error handling is done in preloadImage
        });
      }
    });
  }, [currentIndex, normalizedImages, loadedImages, failedImages]);

  // Navigation functions
  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, normalizedImages.length - 1)));
  }, [normalizedImages.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => prev === 0 ? normalizedImages.length - 1 : prev - 1);
  }, [normalizedImages.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => prev === normalizedImages.length - 1 ? 0 : prev + 1);
  }, [normalizedImages.length]);

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) goToNext();
    if (isRightSwipe) goToPrevious();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case 'Escape':
          if (isZoomed) {
            e.preventDefault();
            setIsZoomed(false);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext, isZoomed]);

  // Fallback SVG for failed images
  const FallbackSVG = () => (
    <svg 
      className="w-full h-full text-gray-300" 
      fill="currentColor" 
      viewBox="0 0 24 24"
      role="img"
      aria-label="Image failed to load"
    >
      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
    </svg>
  );

  // Handle empty or no images case
  if (normalizedImages.length === 0) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center h-96 ${className}`}>
        <FallbackSVG />
      </div>
    );
  }

  // Single image display (no carousel needed)
  if (normalizedImages.length === 1) {
    const image = normalizedImages[0];
    const isLoaded = loadedImages.has(0);
    const hasFailed = failedImages.has(0);

    return (
      <div className={`relative group ${className}`}>
        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
          {!isLoaded && !hasFailed && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-travel-blue"></div>
            </div>
          )}
          {hasFailed ? (
            <FallbackSVG />
          ) : (
            <img
              src={image.src}
              alt={image.alt}
              className={`w-full h-full object-cover transition-all duration-300 cursor-pointer ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              } ${isZoomed ? 'scale-150' : 'hover:scale-105'}`}
              onClick={() => setIsZoomed(!isZoomed)}
            />
          )}
          {isLoaded && !hasFailed && (
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={isZoomed ? "Zoom out" : "Zoom in"}
            >
              <ZoomIn size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Multi-image carousel display
  const currentImage = normalizedImages[currentIndex];
  const isCurrentLoaded = loadedImages.has(currentIndex);
  const hasCurrentFailed = failedImages.has(currentIndex);

  return (
    <div 
      ref={containerRef}
      className={`relative group ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-label="Product image carousel"
      tabIndex={0}
    >
      {/* Main image display */}
      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4 relative">
        {!isCurrentLoaded && !hasCurrentFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-travel-blue"></div>
          </div>
        )}
        
        {hasCurrentFailed ? (
          <FallbackSVG />
        ) : (
          <img
            src={currentImage.src}
            alt={currentImage.alt}
            className={`w-full h-full object-cover transition-all duration-300 cursor-pointer ${
              isCurrentLoaded ? 'opacity-100' : 'opacity-0'
            } ${isZoomed ? 'scale-150' : 'hover:scale-105'}`}
            onClick={() => setIsZoomed(!isZoomed)}
          />
        )}

        {/* Navigation arrows */}
        {normalizedImages.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-75"
              aria-label="Previous image"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-75"
              aria-label="Next image"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Zoom button */}
        {isCurrentLoaded && !hasCurrentFailed && (
          <button
            onClick={() => setIsZoomed(!isZoomed)}
            className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={isZoomed ? "Zoom out" : "Zoom in"}
          >
            <ZoomIn size={16} />
          </button>
        )}

        {/* Image counter */}
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
          {currentIndex + 1} / {normalizedImages.length}
        </div>
      </div>

      {/* Thumbnails */}
      {normalizedImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {normalizedImages.map((image, index) => {
            const isThumbnailLoaded = loadedImages.has(index);
            const hasThumbnailFailed = failedImages.has(index);
            const isActive = index === currentIndex;

            return (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  isActive 
                    ? 'border-travel-blue ring-2 ring-blue-200' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                aria-label={`View image ${index + 1}`}
              >
                <div className="w-full h-full bg-gray-100 relative">
                  {!isThumbnailLoaded && !hasThumbnailFailed && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  {hasThumbnailFailed ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                      </svg>
                    </div>
                  ) : (
                    <img
                      src={image.src}
                      alt={`Thumbnail ${index + 1}`}
                      className={`w-full h-full object-cover transition-opacity ${
                        isThumbnailLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Touch indicators for mobile */}
      {normalizedImages.length > 1 && (
        <div className="flex justify-center gap-1 mt-2 md:hidden">
          {normalizedImages.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-travel-blue' : 'bg-gray-300'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
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

  const handleAddToCart = () => {
    if (!product) return;
    
    const price = typeof product.product_price === 'number' 
      ? product.product_price 
      : parseFloat(product.product_price || product.min_rate || 0);

    addItem({
      product_id: product.product_id,
      product_name: product.product_name || product.name,
      product_price: price,
      product_images: product.product_images || [],
      quantity: 1
    }, 1);
    
    toast.success('Added to cart!');
  };

  if (isLoading) {
    return (
      <Layout title="Loading Product...">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-travel-blue mx-auto mb-4" />
            <p className="text-gray-600">Loading product details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Error Loading Product">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Product</h1>
            <p className="text-gray-600 mb-4">We couldn't load the product details. Please try again.</p>
            <button 
              onClick={() => router.reload()}
              className="bg-travel-blue text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout title="Product Not Found">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h1>
            <p className="text-gray-600 mb-4">The product you're looking for doesn't exist or may have been removed.</p>
            <Link 
              href="/products"
              className="bg-travel-blue text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-block"
            >
              Browse All Products
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const parsedDescription = parseProductDescription(product.product_description || product.description || '');
  const isAvailable = isProductAvailable(product);
  const price = typeof product.product_price === 'number' 
    ? product.product_price 
    : parseFloat(product.product_price || product.min_rate || 0);

  // Schema markup for SEO
  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.product_name || product.name,
    "description": parsedDescription.text || `Buy ${product.product_name || product.name} from Travel Data WiFi`,
    "image": product.product_images && product.product_images.length > 0 
      ? product.product_images.map(img => typeof img === 'string' ? img : img.src).filter(Boolean)
      : [getProductImage(product)],
    "offers": {
      "@type": "Offer",
      "price": price.toString(),
      "priceCurrency": "USD",
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
          {/* Enhanced Product Images with Carousel */}
          <div className="space-y-4">
            <ProductImageCarousel 
              images={product.product_images || []}
              productName={product.product_name || product.name}
              className="w-full"
            />
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
                  ${price.toFixed(2)}
                </span>
                <div className="flex items-center">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <span className="ml-2 text-sm text-gray-600">(4.9/5 - Based on customer reviews)</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 mb-6">
                <div className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${isAvailable ? 'text-green-700' : 'text-red-700'}`}>
                  {isAvailable ? 'In Stock - Ready to Ship' : 'Out of Stock'}
                </span>
              </div>
            </div>

            {/* Product Description */}
            {parsedDescription.text && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Product Overview</h3>
                <p className="text-gray-600 leading-relaxed">{parsedDescription.text}</p>
              </div>
            )}

            {/* Key Features */}
            {parsedDescription.features.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Key Features</h3>
                <ul className="space-y-2">
                  {parsedDescription.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-travel-blue rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Add to Cart */}
            <div className="space-y-4">
              <button
                onClick={handleAddToCart}
                disabled={!isAvailable}
                className={`w-full flex items-center justify-center space-x-2 px-8 py-4 rounded-lg text-lg font-semibold transition-colors ${
                  isAvailable 
                    ? 'bg-travel-blue text-white hover:bg-blue-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <ShoppingCart className="h-5 w-5" />
                <span>{isAvailable ? 'Add to Cart' : 'Out of Stock'}</span>
              </button>
              
              <p className="text-center text-sm text-gray-600">
                Free shipping on orders over $100 • 30-day return policy
              </p>
            </div>

            {/* Product Details */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Details</h3>
              <div className="space-y-2 text-sm">
                {product.sku && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">SKU:</span>
                    <span className="text-gray-900">{product.sku}</span>
                  </div>
                )}
                {product.product_category && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Category:</span>
                    <span className="text-gray-900">{product.product_category}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Availability:</span>
                  <span className={isAvailable ? 'text-green-600' : 'text-red-600'}>
                    {isAvailable ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 bg-gray-50 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Why Choose Travel Data WiFi?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-travel-blue rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Fast Shipping</h3>
              <p className="text-gray-600">
                Ships in 3 business days or less with tracking information provided.
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Quality Guarantee</h3>
              <p className="text-gray-600">
                30-day money-back guarantee and 1-year warranty on all products.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProductPage;