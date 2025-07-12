// ===== src/lib/html-utils.ts ===== (Create this new file)

/**
 * Utility functions for processing HTML content from Zoho Commerce
 */

/**
 * Strips HTML tags and decodes HTML entities from a string
 */
export const stripHtml = (html: string): string => {
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
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&deg;/g, '°')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™');
  
  // Clean up extra whitespace
  return decoded.replace(/\s+/g, ' ').trim();
};

/**
 * Parses HTML content and extracts structured information
 */
export const parseProductDescription = (html: string): { 
  text: string; 
  features: string[];
  specifications: { [key: string]: string };
} => {
  if (!html) return { text: '', features: [], specifications: {} };
  
  const features: string[] = [];
  const specifications: { [key: string]: string } = {};
  
  // Extract list items as features
  const listItemRegex = /<li[^>]*>(.*?)<\/li>/gi;
  let match;
  while ((match = listItemRegex.exec(html)) !== null) {
    const featureText = stripHtml(match[1]);
    if (featureText && featureText.trim().length > 0) {
      features.push(featureText.trim());
    }
  }
  
  // Extract specifications from tables or definition lists
  const tableRowRegex = /<tr[^>]*>.*?<td[^>]*>(.*?)<\/td>.*?<td[^>]*>(.*?)<\/td>.*?<\/tr>/gi;
  while ((match = tableRowRegex.exec(html)) !== null) {
    const key = stripHtml(match[1]).trim();
    const value = stripHtml(match[2]).trim();
    if (key && value) {
      specifications[key] = value;
    }
  }
  
  // Extract from definition lists
  const dtRegex = /<dt[^>]*>(.*?)<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/gi;
  while ((match = dtRegex.exec(html)) !== null) {
    const key = stripHtml(match[1]).trim();
    const value = stripHtml(match[2]).trim();
    if (key && value) {
      specifications[key] = value;
    }
  }
  
  // Get the main text content
  const mainText = stripHtml(html);
  
  return { text: mainText, features, specifications };
};

/**
 * Truncates text to a specified length while preserving word boundaries
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  
  const truncated = text.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > maxLength * 0.8) {
    return truncated.substring(0, lastSpaceIndex) + '...';
  }
  
  return truncated + '...';
};

/**
 * Checks if a product is available for purchase
 * Since inventory isn't tracked in Zoho, this checks product status
 */
export const isProductAvailable = (product: any): boolean => {
  return product.status === 'active' && product.show_in_storefront !== false;
};

/**
 * Formats price with currency symbol
 */
export const formatPrice = (price: number | string): string => {
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numericPrice)) return '$0.00';
  return `$${numericPrice.toFixed(2)}`;
};

/**
 * Extracts the primary image URL from a product
 */
export const getProductImageUrl = (product: any): string => {
  // Check for product_images array first
  if (product.product_images && product.product_images.length > 0 && product.product_images[0]) {
    return product.product_images[0];
  }
  
  // Check for documents with images
  if (product.documents && product.documents.length > 0) {
    const imageDoc = product.documents.find((doc: any) => doc.is_default_image || doc.image_url);
    if (imageDoc?.image_url) {
      return imageDoc.image_url;
    }
  }
  
  // Return placeholder SVG
  return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZmFmYyIvPgogIDx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2Yjc0ODEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZSBBdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPgo=";
};

/**
 * Generates a clean product URL slug from the product name
 */
export const generateProductSlug = (productName: string): string => {
  return productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Extracts clean product name from Zoho product data
 */
export const getProductName = (product: any): string => {
  return product.product_name || product.name || 'Unnamed Product';
};

/**
 * Extracts clean product description from Zoho product data
 */
export const getProductDescription = (product: any): string => {
  const rawDescription = product.product_description || product.description || '';
  return stripHtml(rawDescription);
};

/**
 * Gets the product price in a consistent format
 */
export const getProductPrice = (product: any): number => {
  return product.product_price || product.min_rate || 0;
};

/**
 * Gets the product category name
 */
export const getProductCategory = (product: any): string => {
  return product.product_category || product.category_name || '';
};