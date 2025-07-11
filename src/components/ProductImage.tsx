// ===== src/components/ProductImage.tsx ===== (Replace your existing file)
import React, { useState } from 'react';
import { Package, ImageIcon } from 'lucide-react';

interface ProductImageProps {
  product: {
    product_id: string;
    product_name?: string;
    name?: string; // Zoho uses 'name'
    product_images?: string[];
    documents?: Array<{
      document_id: string;
      document_name: string;
      file_name?: string;
      is_default_image?: boolean;
      image_url?: string;
    }>;
  };
  className?: string;
  size?: 'small' | 'medium' | 'large';
  showPlaceholder?: boolean;
}

const ProductImage: React.FC<ProductImageProps> = ({ 
  product, 
  className = '', 
  size = 'medium',
  showPlaceholder = true
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Size configurations
  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-48 h-48',
    large: 'w-96 h-96'
  };

  // Get the best available image URL
  const getImageUrl = (): string | null => {
    // Method 1: Check product_images array (from our API transformation)
    if (product.product_images && product.product_images.length > 0) {
      const validImage = product.product_images.find(img => img && img.trim().length > 0);
      if (validImage) return validImage;
    }

    // Method 2: Check documents array directly
    if (product.documents && product.documents.length > 0) {
      // Look for default image first
      const defaultImage = product.documents.find(doc => doc.is_default_image);
      if (defaultImage?.image_url) return defaultImage.image_url;
      
      // Fall back to first document with image_url
      const firstImageDoc = product.documents.find(doc => doc.image_url);
      if (firstImageDoc?.image_url) return firstImageDoc.image_url;
      
      // Construct URL from document_id (this is a guess at Zoho's URL pattern)
      const firstDoc = product.documents[0];
      if (firstDoc?.document_id) {
        return `https://commerce.zoho.com/store/api/v1/documents/${firstDoc.document_id}/image`;
      }
    }

    return null;
  };

  const imageUrl = getImageUrl();
  const productName = product.product_name || product.name || 'Product';

  // Create a more attractive placeholder
  const createPlaceholder = () => {
    const dimensions = size === 'small' ? '64' : size === 'medium' ? '192' : '384';
    const iconSize = size === 'small' ? '20' : size === 'medium' ? '40' : '60';
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="${dimensions}" height="${dimensions}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f8fafc;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#e2e8f0;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${dimensions}" height="${dimensions}" fill="url(#grad)"/>
        <rect x="${parseInt(dimensions)/2 - parseInt(iconSize)/2}" y="${parseInt(dimensions)/2 - parseInt(iconSize)/2 - 10}" width="${iconSize}" height="${parseInt(iconSize) * 0.7}" rx="4" fill="#cbd5e1"/>
        <circle cx="${parseInt(dimensions)/2 - parseInt(iconSize)/4}" cy="${parseInt(dimensions)/2 - parseInt(iconSize)/4}" r="${parseInt(iconSize)/8}" fill="#94a3b8"/>
        <polygon points="${parseInt(dimensions)/2 - parseInt(iconSize)/4},${parseInt(dimensions)/2 + parseInt(iconSize)/6} ${parseInt(dimensions)/2 + parseInt(iconSize)/4},${parseInt(dimensions)/2 + parseInt(iconSize)/6} ${parseInt(dimensions)/2},${parseInt(dimensions)/2 - parseInt(iconSize)/6}" fill="#94a3b8"/>
        <text x="50%" y="${parseInt(dimensions) - 15}" font-family="Arial, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">No Image</text>
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
    console.warn('Failed to load product image:', {
      productId: product.product_id,
      productName,
      attemptedUrl: imageUrl,
      hasDocuments: !!product.documents?.length,
      documentsCount: product.documents?.length || 0,
      hasProductImages: !!product.product_images?.length
    });
  };

  // If no image and we don't want to show placeholder
  if (!imageUrl && !showPlaceholder) {
    return null;
  }

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* Loading state */}
      {isLoading && imageUrl && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <Package className="h-8 w-8 text-gray-400 animate-pulse" />
        </div>
      )}
      
      {/* Image */}
      <img
        src={imageUrl || createPlaceholder()}
        alt={productName}
        className={`w-full h-full object-cover rounded ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      
      {/* No image indicator */}
      {!imageUrl && showPlaceholder && (
        <div className="absolute top-2 right-2 bg-gray-500 bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          <ImageIcon className="h-3 w-3" />
        </div>
      )}
      
      {/* Error indicator */}
      {imageError && imageUrl && (
        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
          Error
        </div>
      )}
      
      {/* Development debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 text-center">
          {imageUrl ? 'IMG' : 'PLACEHOLDER'} | Docs: {product.documents?.length || 0}
        </div>
      )}
    </div>
  );
};

export default ProductImage;