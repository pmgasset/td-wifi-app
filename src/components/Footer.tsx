// src/components/Footer.tsx
import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Star, 
  Facebook,
  Send,
  CheckCircle,
  Shield,
  HeadphonesIcon,
  Users
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

  const companyLinks = [
    { name: 'About Travel Data', href: '/about' },
    { name: 'RV Internet Blog', href: '/blog' },
    { name: 'Customer Reviews', href: '/reviews' },
    { name: 'Coverage Map', href: '/coverage' },
  ];

  const legalLinks = [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Refund Policy', href: '/refunds' },
    { name: 'Shipping Information', href: '/shipping' },
  ];

  const trustIndicators = [
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
      icon: Users,
      title: "5,000+ Happy Customers",
      description: "Trusted by the RV community"
    }
  ];

  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Trust Indicators Bar */}
      <div className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Subscribe</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="flex items-center space-x-3 text-green-400">
                  <CheckCircle className="h-6 w-6" />
                  <span className="font-semibold">Thank you for subscribing!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Company Info */}
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-logo-teal rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">TD</span>
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">Travel Data WiFi</h4>
                  <p className="text-sm text-gray-300">Reliable Mobile Internet</p>
                </div>
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Keeping RV travelers and remote workers connected with premium mobile internet solutions. 
                Expert support, quality products, and nationwide coverage you can trust.
              </p>
              
              {/* Social Media - Facebook Only */}
              <div>
                <h6 className="text-sm font-semibold mb-3 text-white">Follow Our Journey</h6>
                <a 
                  href="https://facebook.com/traveldatawifi" 
                  className="w-10 h-10 bg-gray-700 hover:bg-logo-teal rounded-full flex items-center justify-center transition-colors duration-200 focus-visible"
                  aria-label="Follow us on Facebook"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              </div>
            </div>

            {/* Company Links */}
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
            </div>

            {/* Contact & Support Info */}
            <div>
              <h5 className="text-lg font-semibold mb-6">Contact & Support</h5>
              <div className="space-y-4">
                <p className="text-gray-300">
                  Need help? Use our support widget on any page or visit our help center.
                </p>
                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <h6 className="font-semibold text-white mb-2">Business Hours</h6>
                  <p className="text-sm text-gray-300">
                    Monday - Friday: 10AM - 10PM EST<br />
                    Saturday: 10AM - 6PM EST<br />
                    Sunday: Closed - Email Always Available
                  </p>
                </div>
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