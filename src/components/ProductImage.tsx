// ===== src/components/ProductImage.tsx =====
import React, { useState } from 'react';
import { Package } from 'lucide-react';

interface ProductImageProps {
  product: {
    product_id: string;
    product_name: string;
    product_images?: string[];
    // Add other possible image field names from Zoho
    images?: string[];
    image?: string;
    thumbnail?: string;
    photo?: string;
  };
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

const ProductImage: React.FC<ProductImageProps> = ({ 
  product, 
  className = '', 
  size = 'medium' 
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Try multiple possible image sources from Zoho
  const getImageUrl = (): string | null => {
    // Try different possible field names that Zoho might use
    const possibleImageSources = [
      product.product_images?.[0],
      product.images?.[0],
      product.image,
      product.thumbnail,
      product.photo,
    ];

    for (const source of possibleImageSources) {
      if (source && typeof source === 'string' && source.trim().length > 0) {
        // Basic URL validation
        try {
          new URL(source);
          return source;
        } catch {
          // If not a valid URL, maybe it's a relative path - try to make it absolute
          if (source.startsWith('/') || source.startsWith('./')) {
            // Could be a relative path from Zoho's CDN
            return `https://commerce.zoho.com${source.startsWith('/') ? '' : '/'}${source}`;
          }
        }
      }
    }
    return null;
  };

  const imageUrl = getImageUrl();
  
  // Size configurations
  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-48 h-48',
    large: 'w-96 h-96'
  };

  // Fallback SVG placeholder
  const createPlaceholder = () => {
    const dimensions = size === 'small' ? '64' : size === 'medium' ? '192' : '384';
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="${dimensions}" height="${dimensions}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${dimensions}" height="${dimensions}" fill="#f8fafc"/>
        <circle cx="${parseInt(dimensions)/2}" cy="${parseInt(dimensions)/2 - 20}" r="20" fill="#e2e8f0"/>
        <rect x="${parseInt(dimensions)/2 - 15}" y="${parseInt(dimensions)/2 - 10}" width="30" height="20" rx="2" fill="#e2e8f0"/>
        <text x="50%" y="${parseInt(dimensions) - 20}" font-family="Arial, sans-serif" font-size="12" fill="#6b7480" text-anchor="middle">No Image</text>
      </svg>
    `)}`;
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setImageError(true);
    console.error('Failed to load product image:', {
      productId: product.product_id,
      productName: product.product_name,
      attemptedUrl: imageUrl,
      availableFields: Object.keys(product).filter(key => 
        key.toLowerCase().includes('image') || 
        key.toLowerCase().includes('photo') || 
        key.toLowerCase().includes('picture')
      )
    });
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <Package className="h-8 w-8 text-gray-400 animate-pulse" />
        </div>
      )}
      
      {/* Image or placeholder */}
      <img
        src={imageUrl || createPlaceholder()}
        alt={product.product_name || 'Product image'}
        className={`w-full h-full object-cover rounded ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      
      {/* Error indicator */}
      {imageError && imageUrl && (
        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
          Failed
        </div>
      )}
      
      {/* Debug info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1">
          URL: {imageUrl ? 'Found' : 'None'}
        </div>
      )}
    </div>
  );
};

export default ProductImage;