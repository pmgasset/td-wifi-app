// ===== src/pages/index.tsx =====
import React from 'react';
import { GetStaticProps } from 'next';
import Link from 'next/link';
import Layout from '../components/Layout';
import { Wifi, Zap, Shield, MapPin } from 'lucide-react';
import { zohoAPI, ZohoProduct } from '../lib/zoho-api';

interface HomeProps {
  featuredProducts: ZohoProduct[];
}

const Home: React.FC<HomeProps> = ({ featuredProducts }) => {
  const heroSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Travel Data WiFi",
    "description": "Premium mobile internet solutions for RV travelers and remote workers",
    "url": "https://traveldatawifi.com",
    "logo": "https://traveldatawifi.com/images/logo.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-555-TRAVEL",
      "contactType": "customer service"
    }
  };

  return (
    <Layout schema={heroSchema}>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-travel-blue to-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Stay Connected <span className="text-travel-orange">Anywhere</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              Premium mobile internet solutions for RV travelers and remote workers
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/products" 
                className="bg-travel-orange hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Shop Products
              </Link>
              <Link 
                href="/guides" 
                className="border-2 border-white text-white hover:bg-white hover:text-travel-blue px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Setup Guides
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Travel Data WiFi?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <Zap className="h-12 w-12 text-travel-orange mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
              <p className="text-gray-600">5G speeds up to 8Gbps for seamless streaming and work</p>
            </div>
            
            <div className="text-center">
              <Shield className="h-12 w-12 text-travel-orange mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Secure Connection</h3>
              <p className="text-gray-600">Private encrypted network keeps your data safe</p>
            </div>
            
            <div className="text-center">
              <MapPin className="h-12 w-12 text-travel-orange mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nationwide Coverage</h3>
              <p className="text-gray-600">Stay connected across all 50 states</p>
            </div>
            
            <div className="text-center">
              <Wifi className="h-12 w-12 text-travel-orange mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Unlimited Data</h3>
              <p className="text-gray-600">No throttling, no data caps, no surprises</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Featured Products</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredProducts.map((product) => (
              <div key={product.product_id} className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <img 
                  src={product.product_images[0] || '/images/placeholder.jpg'} 
                  alt={product.product_name}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2">{product.product_name}</h3>
                  <p className="text-gray-600 mb-4">{product.product_description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-travel-blue">${product.product_price}</span>
                    <Link 
                      href={`/products/${product.seo_url}`}
                      className="bg-travel-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Learn More
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-travel-blue text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Stay Connected?</h2>
          <p className="text-xl mb-8">Join thousands of RV travelers who trust Travel Data WiFi</p>
          <Link 
            href="/products" 
            className="bg-travel-orange hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
          >
            Shop Now
          </Link>
        </div>
      </section>
    </Layout>
  );
};

export const getStaticProps: GetStaticProps = async () => {
  try {
    const allProducts = await zohoAPI.getProducts();
    const featuredProducts = allProducts.slice(0, 3); // Show first 3 products
    
    return {
      props: {
        featuredProducts,
      },
      revalidate: 3600, // Revalidate every hour
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    return {
      props: {
        featuredProducts: [],
      },
      revalidate: 3600,
    };
  }
};

export default Home;
