// ===== src/components/ProductImage.tsx ===== (Enhanced version)
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Package, ImageIcon, AlertCircle, Zap } from 'lucide-react';

interface EnhancedImageData {
  url: string;
  size?: string;
  source: 'storefront' | 'editpage' | 'cdn_construction' | 'inventory' | 'placeholder';
  isWorking?: boolean;
}

interface ProductImageProps {
  product: {
    product_id: string;
    product_name?: string;
    name?: string;
    product_images?: string[]; // Legacy format for compatibility
    enhanced_images?: EnhancedImageData[]; // New enhanced format
    image_count?: number;
    image_sources?: string[];
    has_images?: boolean;
    image_error?: string;
  };
  className?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  showPlaceholder?: boolean;
  showImageSource?: boolean; // Show which API provided the image
  fallbackBehavior?: 'placeholder' | 'hide' | 'error';
  lazy?: boolean;
  onImageLoad?: (success: boolean, source?: string) => void;
}

const ProductImage: React.FC<ProductImageProps> = ({ 
  product, 
  className = '', 
  size = 'medium',
  showPlaceholder = true,
  showImageSource = false,
  fallbackBehavior = 'placeholder',
  lazy = true,
  onImageLoad
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasTriedFallbacks, setHasTriedFallbacks] = useState(false);

  // Size configurations
  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-48 h-48',
    large: 'w-64 h-64',
    xlarge: 'w-96 h-96'
  };

  const iconSizes = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12',
    xlarge: 'h-16 w-16'
  };

  // Get the best available images in priority order
  const getAvailableImages = (): { url: string; source?: string }[] => {
    const images: { url: string; source?: string }[] = [];
    
    // Method 1: Use enhanced images (preferred)
    if (product.enhanced_images && product.enhanced_images.length > 0) {
      // Sort by preference and working status
      const sortedImages = [...product.enhanced_images]
        .filter(img => img.url && img.url.trim().length > 0)
        .sort((a, b) => {
          // Prioritize working images
          if (a.isWorking === true && b.isWorking !== true) return -1;
          if (b.isWorking === true && a.isWorking !== true) return 1;
          
          // Then by source preference
          const sourceOrder = ['storefront', 'editpage', 'cdn_construction', 'inventory'];
          const aIndex = sourceOrder.indexOf(a.source);
          const bIndex = sourceOrder.indexOf(b.source);
          return aIndex - bIndex;
        });

      images.push(...sortedImages.map(img => ({
        url: img.url,
        source: img.source
      })));
    }
    
    // Method 2: Fall back to legacy product_images array
    if (images.length === 0 && product.product_images && product.product_images.length > 0) {
      images.push(...product.product_images.map(url => ({ url, source: 'legacy' })));
    }
    
    return images;
  };

  const availableImages = getAvailableImages();
  const currentImage = availableImages[currentImageIndex];
  const productName = product.product_name || product.name || 'Product';

  // Auto-advance to next image on error
  useEffect(() => {
    if (imageError && currentImageIndex < availableImages.length - 1 && !hasTriedFallbacks) {
      console.log(`Image failed, trying next: ${currentImageIndex + 1}/${availableImages.length}`);
      setCurrentImageIndex(currentImageIndex + 1);
      setImageError(false);
      setIsLoading(true);
    } else if (imageError && currentImageIndex >= availableImages.length - 1) {
      setHasTriedFallbacks(true);
    }
  }, [imageError, currentImageIndex, availableImages.length, hasTriedFallbacks]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setImageError(false);
    onImageLoad?.(true, currentImage?.source);
    console.log(`✅ Image loaded successfully from ${currentImage?.source}: ${currentImage?.url}`);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setImageError(true);
    onImageLoad?.(false, currentImage?.source);
    
    console.warn('❌ Failed to load product image:', {
      productId: product.product_id,
      productName,
      attemptedUrl: currentImage?.url,
      source: currentImage?.source,
      imageIndex: `${currentImageIndex + 1}/${availableImages.length}`,
      hasMoreFallbacks: currentImageIndex < availableImages.length - 1
    });
  };

  // Create an attractive placeholder with product info
  const createPlaceholder = () => {
    const dimensions = size === 'small' ? '64' : size === 'medium' ? '192' : size === 'large' ? '256' : '384';
    const fontSize = size === 'small' ? '10' : size === 'medium' ? '12' : '14';
    const iconSize = size === 'small' ? '16' : size === 'medium' ? '32' : size === 'large' ? '40' : '48';
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="${dimensions}" height="${dimensions}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f8fafc;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#e2e8f0;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${dimensions}" height="${dimensions}" fill="url(#grad)" stroke="#e2e8f0" stroke-width="1"/>
        <rect x="${parseInt(dimensions)/2 - parseInt(iconSize)/2}" y="${parseInt(dimensions)/2 - parseInt(iconSize)/2 - 10}" width="${iconSize}" height="${parseInt(iconSize) * 0.7}" rx="4" fill="#cbd5e1"/>
        <circle cx="${parseInt(dimensions)/2 - parseInt(iconSize)/4}" cy="${parseInt(dimensions)/2 - parseInt(iconSize)/4}" r="${parseInt(iconSize)/8}" fill="#94a3b8"/>
        <polygon points="${parseInt(dimensions)/2 - parseInt(iconSize)/4},${parseInt(dimensions)/2 + parseInt(iconSize)/6} ${parseInt(dimensions)/2 + parseInt(iconSize)/4},${parseInt(dimensions)/2 + parseInt(iconSize)/6} ${parseInt(dimensions)/2},${parseInt(dimensions)/2 - parseInt(iconSize)/6}" fill="#94a3b8"/>
        <text x="50%" y="${parseInt(dimensions) - 20}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#64748b" text-anchor="middle">No Image</text>
        <text x="50%" y="${parseInt(dimensions) - 8}" font-family="Arial, sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">${product.product_id}</text>
      </svg>
    `)}`;
  };

  // Handle different fallback behaviors
  if (!currentImage && fallbackBehavior === 'hide') {
    return null;
  }

  if (!currentImage && fallbackBehavior === 'error') {
    return (
      <div className={`relative ${sizeClasses[size]} ${className} flex items-center justify-center bg-red-50 border border-red-200 rounded`}>
        <div className="text-center">
          <AlertCircle className={`${iconSizes[size]} text-red-500 mx-auto mb-2`} />
          <p className="text-xs text-red-600">Image Error</p>
          {product.image_error && (
            <p className="text-xs text-red-500 mt-1">{product.image_error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${sizeClasses[size]} ${className} group`}>
      {/* Loading state */}
      {isLoading && currentImage && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center rounded">
          <Package className={`${iconSizes[size]} text-gray-400 animate-pulse`} />
        </div>
      )}
      
      {/* Main Image */}
      <Image
        src={currentImage?.url || createPlaceholder()}
        alt={productName}
        fill
        className={`object-cover rounded transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading={lazy ? 'lazy' : 'eager'}
      />
      
      {/* Image source indicator */}
      {showImageSource && currentImage?.source && (
        <div className="absolute top-1 left-1 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
          <Zap className="h-3 w-3 inline mr-1" />
          {currentImage.source}
        </div>
      )}
      
      {/* Multiple images indicator */}
      {availableImages.length > 1 && (
        <div className="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-2 py-0.5 rounded">
          {currentImageIndex + 1}/{availableImages.length}
        </div>
      )}
      
      {/* Error indicator */}
      {imageError && hasTriedFallbacks && (
        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          Failed
        </div>
      )}
      
      {/* No image indicator */}
      {!currentImage && showPlaceholder && (
        <div className="absolute top-2 right-2 bg-gray-500 bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          <ImageIcon className="h-3 w-3 inline mr-1" />
          No Image
        </div>
      )}
      
      {/* Navigation for multiple images */}
      {availableImages.length > 1 && !isLoading && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {availableImages.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentImageIndex(index);
                setImageError(false);
                setIsLoading(true);
                setHasTriedFallbacks(false);
              }}
              className={`w-2 h-2 rounded-full ${
                index === currentImageIndex ? 'bg-white' : 'bg-white bg-opacity-50'
              }`}
            />
          ))}
        </div>
      )}
      
      {/* Development debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 text-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div>
            {currentImage ? `IMG: ${currentImage.source}` : 'PLACEHOLDER'} | 
            Count: {product.image_count || 0} | 
            Sources: {product.image_sources?.join(',') || 'none'}
          </div>
          {product.image_error && (
            <div className="text-red-300 mt-1">Error: {product.image_error}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductImage;