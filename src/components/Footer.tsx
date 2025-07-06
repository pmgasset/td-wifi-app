// ===== src/components/Footer.tsx =====
import React from 'react';
import Link from 'next/link';
import { Wifi, Mail, Phone } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Wifi className="h-8 w-8 text-travel-orange" />
              <span className="text-xl font-bold">Travel Data WiFi</span>
            </div>
            <p className="text-gray-300 mb-4">
              Reliable mobile internet solutions for RV travelers, remote workers, and digital nomads. 
              Stay connected anywhere with our premium devices and unlimited data plans.
            </p>
            <div className="flex space-x-4">
              <a href="mailto:support@traveldatawifi.com" className="flex items-center text-gray-300 hover:text-white">
                <Mail className="h-4 w-4 mr-2" />
                support@traveldatawifi.com
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link href="/products" className="text-gray-300 hover:text-white">Products</Link></li>
              <li><Link href="/guides" className="text-gray-300 hover:text-white">Setup Guides</Link></li>
              <li><Link href="/coverage" className="text-gray-300 hover:text-white">Coverage Maps</Link></li>
              <li><Link href="/support" className="text-gray-300 hover:text-white">Support</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li><Link href="/support/installation" className="text-gray-300 hover:text-white">Installation Help</Link></li>
              <li><Link href="/support/troubleshooting" className="text-gray-300 hover:text-white">Troubleshooting</Link></li>
              <li><Link href="/support/warranty" className="text-gray-300 hover:text-white">Warranty</Link></li>
              <li><Link href="/support/contact" className="text-gray-300 hover:text-white">Contact Us</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; 2024 Travel Data WiFi. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
