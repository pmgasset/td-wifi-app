// ===== src/components/Footer.tsx =====
import React from 'react';
import Link from 'next/link';
import { Wifi, Mail, Phone, MapPin, Facebook, Twitter, Instagram, Youtube, ArrowRight, Star } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const productLinks = [
    { name: 'Mobile Hotspots', href: '/products?category=hotspots' },
    { name: 'Signal Boosters', href: '/products?category=boosters' },
    { name: 'Data Plans', href: '/products?category=plans' },
    { name: 'Accessories', href: '/products?category=accessories' },
  ];

  const supportLinks = [
    { name: 'Installation Guides', href: '/support/installation' },
    { name: 'Troubleshooting', href: '/support/troubleshooting' },
    { name: 'Coverage Maps', href: '/coverage' },
    { name: 'Contact Support', href: '/support/contact' },
    { name: 'Warranty Info', href: '/support/warranty' },
  ];

  const companyLinks = [
    { name: 'About Us', href: '/about' },
    { name: 'Our Story', href: '/story' },
    { name: 'Careers', href: '/careers' },
    { name: 'Press Kit', href: '/press' },
    { name: 'Partners', href: '/partners' },
  ];

  const legalLinks = [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Return Policy', href: '/returns' },
    { name: 'Shipping Info', href: '/shipping' },
  ];

  return (
    <React.Fragment>
      <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gray-800"></div>
        </div>

        <div className="relative">
          <div className="border-b border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Stay Connected on the Road</h3>
                  <p className="text-gray-300">
                    Get the latest updates on new products, exclusive deals, and travel tips for RV life.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      type="email"
                      placeholder="Enter your email address"
                      className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg focus:ring-2 focus:ring-travel-orange focus:border-transparent text-white placeholder-gray-400"
                    />
                  </div>
                  <button className="bg-gradient-to-r from-travel-orange to-orange-500 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap inline-flex items-center space-x-2">
                    <span>Subscribe</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-travel-blue to-blue-600 rounded-xl flex items-center justify-center">
                    <Wifi className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <span className="text-xl font-bold">Travel Data WiFi</span>
                    <div className="text-sm text-gray-400">Stay Connected Anywhere</div>
                  </div>
                </div>
                
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Your trusted partner for reliable mobile internet solutions. We've been helping RV travelers, 
                  remote workers, and digital nomads stay connected for over a decade.
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 text-gray-300">
                    <Phone className="h-5 w-5 text-travel-orange" />
                    <span>1-800-WIFI-RV (1-800-943-4781)</span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-300">
                    <Mail className="h-5 w-5 text-travel-orange" />
                    <span>support@traveldatawifi.com</span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-300">
                    <MapPin className="h-5 w-5 text-travel-orange" />
                    <span>Austin, Texas, USA</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-700">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-300 ml-2">4.8/5 Rating</span>
                    </div>
                    <div className="text-sm text-gray-300">50,000+ Customers</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-6">Products</h4>
                <ul className="space-y-3">
                  {productLinks.map((link) => (
                    <li key={link.name}>
                      <Link 
                        href={link.href}
                        className="text-gray-300 hover:text-travel-orange transition-colors duration-200 flex items-center group"
                      >
                        <span>{link.name}</span>
                        <ArrowRight className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all duration-200" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-6">Support</h4>
                <ul className="space-y-3">
                  {supportLinks.map((link) => (
                    <li key={link.name}>
                      <Link 
                        href={link.href}
                        className="text-gray-300 hover:text-travel-orange transition-colors duration-200 flex items-center group"
                      >
                        <span>{link.name}</span>
                        <ArrowRight className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all duration-200" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-6">Company</h4>
                <ul className="space-y-3 mb-6">
                  {companyLinks.map((link) => (
                    <li key={link.name}>
                      <Link 
                        href={link.href}
                        className="text-gray-300 hover:text-travel-orange transition-colors duration-200 flex items-center group"
                      >
                        <span>{link.name}</span>
                        <ArrowRight className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all duration-200" />
                      </Link>
                    </li>
                  ))}
                </ul>

                <div>
                  <h5 className="text-sm font-semibold mb-3 text-gray-400">Follow Us</h5>
                  <div className="flex space-x-3">
                    <a href="#" aria-label="Facebook" className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-travel-orange transition-all duration-200 transform hover:scale-110">
                      <Facebook className="h-5 w-5" />
                    </a>
                    <a href="#" aria-label="Twitter" className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-travel-orange transition-all duration-200 transform hover:scale-110">
                      <Twitter className="h-5 w-5" />
                    </a>
                    <a href="#" aria-label="Instagram" className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-travel-orange transition-all duration-200 transform hover:scale-110">
                      <Instagram className="h-5 w-5" />
                    </a>
                    <a href="#" aria-label="YouTube" className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-travel-orange transition-all duration-200 transform hover:scale-110">
                      <Youtube className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                <div className="text-center md:text-left">
                  <p className="text-gray-400 text-sm">
                    © {currentYear} Travel Data WiFi. All rights reserved.
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Empowering travelers with reliable connectivity since 2010
                  </p>
                </div>
                
                <div className="flex flex-wrap justify-center md:justify-end items-center text-sm">
                  <Link href="/privacy" className="text-gray-400 hover:text-travel-orange transition-colors duration-200 mx-2">
                    Privacy Policy
                  </Link>
                  <span className="text-gray-600">•</span>
                  <Link href="/terms" className="text-gray-400 hover:text-travel-orange transition-colors duration-200 mx-2">
                    Terms of Service
                  </Link>
                  <span className="text-gray-600">•</span>
                  <Link href="/returns" className="text-gray-400 hover:text-travel-orange transition-colors duration-200 mx-2">
                    Return Policy
                  </Link>
                  <span className="text-gray-600">•</span>
                  <Link href="/shipping" className="text-gray-400 hover:text-travel-orange transition-colors duration-200 mx-2">
                    Shipping Info
                  </Link>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                <div className="flex items-center space-x-4">
                  <div className="text-xs text-gray-500">Secured by</div>
                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center">
                      <span className="text-white font-bold">S</span>
                    </div>
                    <span>SSL Encryption</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                      <span className="text-white font-bold">P</span>
                    </div>
                    <span>PCI Compliant</span>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500">
                  Made with ❤️ for the RV community
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </React.Fragment>
  );
};

export default Footer;