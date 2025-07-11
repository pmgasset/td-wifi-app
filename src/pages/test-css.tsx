// ===== src/pages/test-css.tsx =====
import React from 'react';
import Layout from '../components/Layout';

const TestCSS: React.FC = () => {
  return (
    <Layout title="CSS Test - Travel Data WiFi">
      <div className="py-8 px-4">
        <div className="container mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-travel-blue mb-4 text-center">CSS Test Page</h1>
            <p className="text-lg text-gray-600 mb-6 text-center">Testing if our styles are working correctly.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="card p-6">
              <h3 className="text-xl font-bold text-travel-blue mb-3">Test Card 1</h3>
              <p className="text-gray-600 mb-4">This should be a white card with shadow and hover effects.</p>
              <a href="#" className="btn-primary">Primary Button</a>
            </div>
            
            <div className="card p-6">
              <h3 className="text-xl font-bold text-travel-orange mb-3">Test Card 2</h3>
              <p className="text-gray-600 mb-4">This card should also have styling applied.</p>
              <a href="#" className="btn-secondary">Secondary Button</a>
            </div>
          </div>

          <div className="bg-travel-blue text-white p-6 rounded-lg mb-6">
            <h2 className="text-2xl font-bold mb-2">Blue Background Test</h2>
            <p>If this has a blue background, our custom colors are working.</p>
          </div>

          <div className="bg-travel-orange text-white p-6 rounded-lg mb-6">
            <h2 className="text-2xl font-bold mb-2">Orange Background Test</h2>
            <p>If this has an orange background, our custom colors are working.</p>
          </div>

          <div className="bg-gradient-to-r from-travel-blue to-blue-600 text-white p-6 rounded-lg">
            <h2 className="text-2xl font-bold mb-2">Gradient Test</h2>
            <p>If this has a gradient background, our gradients are working.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TestCSS;