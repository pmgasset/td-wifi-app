import { Redis } from '@upstash/redis';
import { zohoInventoryAPI } from './zoho-api-inventory';
import { zohoAPI } from './zoho-api.ts';

const TTL_SECONDS = 60 * 60 * 24; // 24 hours

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function filterProductsByDisplayInApp(products) {
  return products.filter((product) => {
    const displayField = product.custom_fields?.find(
      (field) =>
        field.label?.toLowerCase() === 'display_in_app' ||
        field.field_name?.toLowerCase() === 'display_in_app'
    );
    return displayField?.value === true || displayField?.value === 'true';
  });
}

function mergeInventoryWithCommerceImages(inventoryProducts, commerceProducts) {
  const commerceBySku = new Map();
  for (const cp of commerceProducts) {
    if (cp.sku) {
      commerceBySku.set(cp.sku, cp);
    }
  }

  return inventoryProducts.map((ip) => {
    const match = ip.sku ? commerceBySku.get(ip.sku) : null;
    const images = match?.images || match?.product_images || [];
    return {
      ...ip,
      commerce_images: images,
      commerce_product_id: match?.product_id,
      has_commerce_match: Boolean(match),
      commerce_match_type: match ? 'sku_match' : undefined,
      image_source: images.length > 0 ? 'storefront_api_fixed' : 'no_source',
    };
  });
}

function parseStock(stockValue) {
  if (stockValue === null || stockValue === undefined || stockValue === '') {
    return 0;
  }
  const parsed = typeof stockValue === 'string' ? parseFloat(stockValue) : Number(stockValue);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function transformProducts(products) {
  return products.map((product) => {
    const productImages = Array.isArray(product.commerce_images)
      ? product.commerce_images
      : [];
    return {
      product_id: product.item_id,
      product_name: product.name,
      product_price: product.rate || 0,
      product_description: product.description || '',
      product_images: productImages,
      inventory_count: parseStock(product.stock_on_hand || product.available_stock),
      product_category: product.category_name || product.group_name || '',
      category_id: product.category_id || product.group_id,
      status: product.status,
      seo_url: product.sku || product.item_id,
      cf_display_in_app: product.cf_display_in_app_unformatted || product.cf_display_in_app,
      sku: product.sku,
      item_type: product.item_type,
      product_type: product.product_type,
      show_in_storefront: product.show_in_storefront,
      rate: product.rate,
      purchase_rate: product.purchase_rate,
      stock_on_hand: product.stock_on_hand,
      available_stock: product.available_stock,
      reorder_level: product.reorder_level,
      created_time: product.created_time,
      last_modified_time: product.last_modified_time,
      has_commerce_images: productImages.length > 0,
      has_commerce_match: product.has_commerce_match,
      commerce_product_id: product.commerce_product_id,
      commerce_match_type: product.commerce_match_type,
      image_source: product.image_source || 'storefront_api_fixed',
    };
  });
}

async function fetchProducts() {
  const inventoryProducts = await zohoInventoryAPI.getInventoryProducts();
  const filtered = filterProductsByDisplayInApp(inventoryProducts);

  let commerceProducts = [];
  try {
    commerceProducts = await zohoAPI.getProducts();
  } catch (err) {
    console.error('Failed to fetch commerce products', err);
  }

  const merged = mergeInventoryWithCommerceImages(filtered, commerceProducts);
  const transformed = transformProducts(merged);
  return transformed.filter(
    (product) => product.status === 'active' || product.status === 'Active' || !product.status
  );
}

class RedisProductService {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async getAllProducts() {
    try {
      const cached = await this.redis.get('products:all');
      if (cached) {
        return cached;
      }
    } catch (err) {
      console.error('Redis error during getAllProducts', err);
    }

    try {
      await this.syncProducts();
      const synced = await this.redis.get('products:all');
      if (synced) {
        return synced;
      }
    } catch (err) {
      console.error('Emergency sync failed', err);
    }

    try {
      return await fetchProducts();
    } catch (err) {
      console.error('Direct fetch failed', err);
      return [];
    }
  }

  async getProductById(itemId) {
    try {
      const cached = await this.redis.get(`product:${itemId}`);
      if (cached) return cached;
    } catch (err) {
      console.error('Redis error getProductById', err);
    }

    const all = await this.getAllProducts();
    return all.find((p) => p.product_id === itemId);
  }

  async getProductBySku(sku) {
    try {
      const cached = await this.redis.get(`product:sku:${sku}`);
      if (cached) return cached;
    } catch (err) {
      console.error('Redis error getProductBySku', err);
    }

    const all = await this.getAllProducts();
    return all.find((p) => p.sku === sku);
  }

  async syncProducts() {
    const products = await fetchProducts();
    const lastSync = new Date().toISOString();
    await this.redis.set('products:all', products, { ex: TTL_SECONDS });
    await this.redis.set('products:last_sync', lastSync);

    for (const p of products) {
      await this.redis.set(`product:${p.product_id}`, p, { ex: TTL_SECONDS });
      if (p.sku) {
        await this.redis.set(`product:sku:${p.sku}`, p, { ex: TTL_SECONDS });
      }
    }

    await this.redis.set('sync:status', { status: 'ok', timestamp: lastSync });
    return { count: products.length, lastSync };
  }

  async getCacheStats() {
    const [products, lastSync] = await Promise.all([
      this.redis.get('products:all'),
      this.redis.get('products:last_sync'),
    ]);
    const count = Array.isArray(products) ? products.length : 0;
    const cacheAgeMs = lastSync ? Date.now() - Date.parse(lastSync) : null;
    return { productCount: count, lastSync, cacheAgeMs };
  }
}

export const productService = new RedisProductService(redis);

