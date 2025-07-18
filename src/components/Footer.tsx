// src/components/Footer.tsx
import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Wifi, 
  Star, 
  Phone, 
  Mail, 
  MapPin, 
  ArrowRight,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Send,
  CheckCircle,
  Shield,
  Truck,
  HeadphonesIcon,
  Clock,
  Award
} from 'lucide-react';

const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubscribed(true);
      setIsLoading(false);
      setEmail('');
    }, 1000);
  };

  const productLinks = [
    { name: '5G Mobile Hotspots', href: '/products/5g-hotspots' },
    { name: 'Signal Boosters', href: '/products/signal-boosters' },
    { name: 'External Antennas', href: '/products/antennas' },
    { name: 'Accessories & Cables', href: '/products/accessories' },
  ];

  const supportLinks = [
    { name: 'Setup Guides', href: '/guides' },
    { name: 'Coverage Map', href: '/coverage' },
    { name: 'FAQ & Troubleshooting', href: '/faq' },
    { name: 'Contact Support', href: '/contact' },
  ];

  const companyLinks = [
    { name: 'About Travel Data', href: '/about' },
    { name: 'RV Internet Blog', href: '/blog' },
    { name: 'Customer Reviews', href: '/reviews' },
    { name: 'Press & Media', href: '/press' },
  ];

  const legalLinks = [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Refund Policy', href: '/refunds' },
    { name: 'Shipping Information', href: '/shipping' },
  ];

  const trustIndicators = [
    {
      icon: Truck,
      title: "Free 2-Day Shipping",
      description: "On all orders over $50"
    },
    {
      icon: Shield,
      title: "30-Day Guarantee",
      description: "Money back if not satisfied"
    },
    {
      icon: HeadphonesIcon,
      title: "Expert Support",
      description: "Real RV internet specialists"
    },
    {
      icon: Award,
      title: "50,000+ Happy Customers",
      description: "Trusted by the RV community"
    }
  ];

  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Trust Indicators Bar */}
      <div className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {trustIndicators.map((indicator, index) => (
              <div key={index} className="flex items-center space-x-3 text-center md:text-left">
                <div className="flex-shrink-0 w-12 h-12 bg-logo-teal/20 rounded-full flex items-center justify-center">
                  <indicator.icon className="h-6 w-6 text-logo-teal" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">{indicator.title}</h4>
                  <p className="text-sm text-gray-300">{indicator.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Newsletter Section */}
      <div className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold mb-2">Stay Connected On The Road</h3>
              <p className="text-gray-300">
                Get exclusive RV internet tips, product updates, and special offers delivered to your inbox.
                Join 15,000+ fellow travelers!
              </p>
            </div>
            
            <div className="w-full">
              {!isSubscribed ? (
                <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-logo-teal focus:border-transparent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-logo-teal hover:bg-logo-ocean text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2 min-w-[140px] focus-visible"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Subscribing...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Subscribe</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="flex items-center space-x-3 bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                  <div>
                    <p className="font-semibold text-green-400">Successfully subscribed!</p>
                    <p className="text-sm text-gray-300">Check your email for a welcome message.</p>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-gray-400 mt-3">
                We respect your privacy. Unsubscribe anytime with one click.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-logo-teal rounded-lg flex items-center justify-center">
                <Wifi className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold">Travel Data WiFi</span>
            </div>
            
            <p className="text-gray-300 mb-6 leading-relaxed">
              The most trusted name in RV internet solutions. We've been helping digital nomads and 
              remote workers stay connected since 2018. Professional-grade equipment, unlimited data plans, 
              and expert support - everything you need for reliable internet on the road.
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-logo-teal" />
                <a 
                  href="tel:+1-800-555-0123" 
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  1-800-555-0123
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-logo-teal" />
                <a 
                  href="mailto:support@traveldatawifi.com" 
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  support@traveldatawifi.com
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-logo-teal" />
                <span className="text-gray-300">24/7 Support Available</span>
              </div>
            </div>
          </div>

          {/* Products */}
          <div>
            <h5 className="text-lg font-semibold mb-6">Products</h5>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.name}>
                  <Link 
                    href={link.href}
                    className="text-gray-300 hover:text-white transition-colors duration-200 hover:translate-x-1 transform inline-block"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h5 className="text-lg font-semibold mb-6">Support</h5>
            <ul className="space-y-3">
              {supportLinks.map((link) => (
                <li key={link.name}>
                  <Link 
                    href={link.href}
                    className="text-gray-300 hover:text-white transition-colors duration-200 hover:translate-x-1 transform inline-block"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h5 className="text-lg font-semibold mb-6">Company</h5>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.name}>
                  <Link 
                    href={link.href}
                    className="text-gray-300 hover:text-white transition-colors duration-200 hover:translate-x-1 transform inline-block"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
            
            <div className="mt-6">
              <h6 className="text-sm font-semibold mb-3">Follow Our Journey</h6>
              <div className="flex space-x-3">
                <a 
                  href="https://facebook.com/traveldatawifi" 
                  className="w-8 h-8 bg-gray-700 hover:bg-logo-teal rounded-full flex items-center justify-center transition-colors duration-200 focus-visible"
                  aria-label="Follow us on Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </a>
                <a 
                  href="https://twitter.com/traveldatawifi" 
                  className="w-8 h-8 bg-gray-700 hover:bg-logo-teal rounded-full flex items-center justify-center transition-colors duration-200 focus-visible"
                  aria-label="Follow us on Twitter"
                >
                  <Twitter className="h-4 w-4" />
                </a>
                <a 
                  href="https://instagram.com/traveldatawifi" 
                  className="w-8 h-8 bg-gray-700 hover:bg-logo-teal rounded-full flex items-center justify-center transition-colors duration-200 focus-visible"
                  aria-label="Follow us on Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a 
                  href="https://youtube.com/traveldatawifi" 
                  className="w-8 h-8 bg-gray-700 hover:bg-logo-teal rounded-full flex items-center justify-center transition-colors duration-200 focus-visible"
                  aria-label="Subscribe to our YouTube channel"
                >
                  <Youtube className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <p className="text-gray-400 text-sm">
                &copy; 2025 Travel Data WiFi. All rights reserved.
              </p>
              <div className="flex items-center space-x-2">
                <Star className="h-4 w-4 text-yellow-400" />
                <span className="text-sm text-gray-300">4.9/5 from 2,847 reviews</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {legalLinks.map((link) => (
                <Link 
                  key={link.name}
                  href={link.href}
                  className="text-gray-400 hover:text-white text-sm transition-colors duration-200"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Additional Trust Signals */}
          <div className="mt-6 pt-6 border-t border-gray-800 text-center">
            <p className="text-xs text-gray-400">
              Professional installation available nationwide • FCC ID approved equipment • 
              30-day money-back guarantee • Employee-owned business
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;