/**
 * Simple Redis product service utilities.
 * Provides helpers to cache image metadata and expose image URLs
 * for inventory products.
 */

const PRODUCT_IMAGE = 'PRODUCT_IMAGE';

/**
 * Cache product image metadata in Redis.
 * If the product doesn't have a top-level image_id but includes an images array,
 * fall back to the first image's id when building the cache key.
 */
export async function cacheProductImages(redis, product) {
  if (!redis || !product) return;

  const imageId =
    product.image_id ||
    (Array.isArray(product.images) && product.images.length > 0
      ? product.images[0].image_id
      : null);

  if (!imageId) return;

  const key = `${PRODUCT_IMAGE}:${product.item_id}`;
  const value = JSON.stringify({ image_id: imageId });
  try {
    await redis.set(key, value);
  } catch (err) {
    // Swallow redis errors to avoid breaking product flows
    console.warn('Failed to cache product image', err);
  }
}

/**
 * Transform raw inventory items into products consumable by the frontend.
 * Adds product_images with a route to fetch images when any image metadata exists.
 */
export function transformInventoryProducts(items = []) {
  return items.map(item => {
    const product = { ...item, product_images: item.product_images || [] };

    if (
      item.image_id ||
      (Array.isArray(item.images) && item.images.length > 0)
    ) {
      product.product_images.push(`/api/images/${item.item_id}`);
    }

    return product;
  });
}

export default {
  cacheProductImages,
  transformInventoryProducts,
};
