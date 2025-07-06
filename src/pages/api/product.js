// ===== pages/api/products.js =====
import { zohoAPI } from '../../lib/zoho-api';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const products = await zohoAPI.getProducts();
    res.status(200).json({ products });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

// ===== pages/api/products/[id].js =====
import { zohoAPI } from '../../../lib/zoho-api';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const product = await zohoAPI.getProduct(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(200).json({ product });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
}

// ===== Updated pages/index.tsx =====
import React from 'react';
import { GetStaticProps } from 'next';
import Link from 'next/link';
import Layout from '../components/Layout';
import { Wifi, Zap, Shield, MapPin } from 'lucide-react';

interface HomeProps {
  featuredProducts: any[];
}

const Home: React.FC<HomeProps> = ({ featuredProducts }) => {
  // ... existing component code ...
};

export const getStaticProps: GetStaticProps = async () => {
  try {
    // For static export, we can't call API routes at build time
    // So we'll use mock data and load real data client-side
    const featuredProducts = [
      {
        product_id: 'tdw-hotspot-pro',
        product_name: 'Travel Data Hotspot Pro',
        product_description: 'High-performance 5G mobile hotspot perfect for RV travel and remote work.',
        product_price: 299.99,
        product_images: ['/images/hotspot-pro-1.jpg'],
        inventory_count: 50,
        product_category: 'Mobile Hotspots',
        seo_url: 'travel-data-hotspot-pro'
      },
      // ... other mock products
    ];
    
    return {
      props: {
        featuredProducts: featuredProducts.slice(0, 3),
      },
      revalidate: 3600,
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return {
      props: {
        featuredProducts: [],
      },
      revalidate: 3600,
    };
  }
};

export default Home;

// ===== Alternative: Client-side data fetching =====
import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const ProductsPage = () => {
  const { data, error, isLoading } = useSWR('/api/products', fetcher);

  if (error) return <div>Failed to load products</div>;
  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Products</h1>
      {data?.products?.map(product => (
        <div key={product.product_id}>
          <h3>{product.product_name}</h3>
          <p>${product.product_price}</p>
        </div>
      ))}
    </div>
  );
};

// ===== Updated next.config.js for hybrid approach =====
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove output: 'export' to enable API routes
  // output: 'export',  // <-- Comment this out
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET,
    ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN,
    ZOHO_STORE_ID: process.env.ZOHO_STORE_ID,
  },
  async generateBuildId() {
    return 'build-' + Date.now()
  }
}

module.exports = nextConfig