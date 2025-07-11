// ===== src/pages/debug-images.tsx =====
import React from 'react';
import useSWR from 'swr';
import Layout from '../components/Layout';
import { ZohoProduct } from '../lib/zoho-api';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const DebugImages: React.FC = () => {
  const { data, error, isLoading } = useSWR('/api/products', fetcher);

  if (isLoading) {
    return (
      <Layout title="Debug Images - Travel Data WiFi">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">Loading products...</h1>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Debug Images - Travel Data WiFi">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6 text-red-600">Error loading products</h1>
          <p>{error.message}</p>
        </div>
      </Layout>
    );
  }

  const products = data?.products || [];

  return (
    <Layout title="Debug Images - Travel Data WiFi">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Product Image Debug</h1>
        
        <div className="mb-8 p-4 bg-gray-100 rounded">
          <h2 className="text-xl font-bold mb-4">Raw API Response</h2>
          <pre className="text-sm overflow-auto bg-white p-4 rounded border">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Products Found: {products.length}</h2>
        </div>

        {products.map((product: ZohoProduct, index: number) => (
          <div key={product.product_id || index} className="card p-6 mb-6">
            <h3 className="text-lg font-bold mb-4">Product: {product.product_name || 'Unknown'}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Product Data:</h4>
                <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto">
                  {JSON.stringify(product, null, 2)}
                </pre>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Image Analysis:</h4>
                <div className="space-y-2">
                  <p><strong>Has product_images field:</strong> {product.product_images ? 'Yes' : 'No'}</p>
                  <p><strong>Images array length:</strong> {product.product_images?.length || 0}</p>
                  
                  {product.product_images && product.product_images.length > 0 ? (
                    <div>
                      <p><strong>Image URLs:</strong></p>
                      <ul className="list-disc ml-6">
                        {product.product_images.map((url, i) => (
                          <li key={i} className="break-all">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                      
                      <div className="mt-4">
                        <p><strong>First Image Test:</strong></p>
                        <div className="border p-2 mt-2">
                          <img 
                            src={product.product_images[0]} 
                            alt={product.product_name}
                            className="w-32 h-32 object-cover border"
                            onLoad={() => console.log('Image loaded:', product.product_images[0])}
                            onError={(e) => {
                              console.error('Image failed to load:', product.product_images[0]);
                              const target = e.target as HTMLImageElement;
                              target.style.border = '2px solid red';
                              target.alt = 'FAILED TO LOAD';
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-red-600">No images found for this product</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="mt-8 p-4 bg-yellow-100 rounded">
          <h3 className="font-bold mb-2">Debug Steps:</h3>
          <ol className="list-decimal ml-6 space-y-1">
            <li>Check if products have image URLs in the raw data above</li>
            <li>Click on image URLs to test if they load in a new tab</li>
            <li>Look at the browser console for any error messages</li>
            <li>Check if images show "FAILED TO LOAD" (red border)</li>
          </ol>
        </div>
      </div>
    </Layout>
  );
};

export default DebugImages;