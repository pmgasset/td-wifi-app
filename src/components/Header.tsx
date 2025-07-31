// src/components/Header.tsx
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, Menu, X, Wifi, Phone, Search, HelpCircle } from 'lucide-react';
import { useCartStore } from '../store/cart';
import Cart from './Cart';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { getTotalItems, openCart } = useCartStore();
  const cartItemCount = getTotalItems();

  const navigation = [
    { name: 'Products', href: '/products', description: 'Browse our router selection' },
    { name: 'Solutions', href: '/solutions', description: 'Find your perfect setup' },
    { name: 'Coverage', href: '/coverage', description: 'Check network availability' },
    { name: 'Support Center', href: '/support', description: 'Get help and guides', icon: HelpCircle },
  ];

  // Handle scroll effect for header transparency
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 20;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isMenuOpen && !target.closest('.mobile-menu') && !target.closest('.menu-button')) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  return (
    <>
      <header 
        className={`bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 sticky top-0 z-50 transition-all duration-300 ${
          isScrolled ? 'py-2' : 'py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop Layout */}
          <div className="hidden lg:block">
            {/* Top Row - Centered Logo */}
            <div className="flex justify-center items-center mb-3">
              <Link href="/" className="group focus-visible">
                <div className={`bg-gradient-to-r from-logo-teal to-logo-ocean rounded-lg p-3 transition-all duration-300 hover:scale-105 ${
                  isScrolled ? 'w-48 h-12 p-2' : 'w-72 h-16 p-3'
                }`}>
                  <div className="flex items-center justify-center space-x-3 h-full">
                    <Wifi className={`text-white transition-all duration-300 ${
                      isScrolled ? 'h-5 w-5' : 'h-8 w-8'
                    }`} />
                    <span className={`font-bold text-white transition-all duration-300 ${
                      isScrolled ? 'text-lg' : 'text-2xl'
                    }`}>
                      Travel Data WiFi
                    </span>
                  </div>
                </div>
              </Link>
            </div>

            {/* Bottom Row - Navigation and Actions */}
            <div className="flex justify-between items-center">
              {/* Left - Contact Info */}
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <a 
                  href="tel:+1-800-555-0123"
                  className="flex items-center space-x-2 hover:text-logo-teal transition-colors focus-visible"
                >
                  <Phone className="h-4 w-4" />
                  <span className="hidden xl:inline">1-800-555-0123</span>
                </a>
                <span className="text-gray-300">|</span>
                <span className="text-logo-signal font-medium">Free Expert Consultation</span>
              </div>

              {/* Center - Navigation */}
              <nav className="flex items-center space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group relative font-medium transition-all duration-200 focus-visible flex items-center space-x-2 ${
                      item.name === 'Support Center'
                        ? 'text-logo-teal hover:text-logo-ocean bg-teal-50 hover:bg-teal-100 px-3 py-2 rounded-lg'
                        : 'text-gray-700 hover:text-logo-teal'
                    }`}
                    title={item.description}
                  >
                    {item.icon && <item.icon className="h-4 w-4" />}
                    <span>{item.name}</span>
                    {item.name !== 'Support Center' && (
                      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-logo-teal transition-all duration-200 group-hover:w-full"></span>
                    )}
                  </Link>
                ))}
              </nav>

              {/* Right - Actions */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200 focus-visible"
                  aria-label="Search products"
                >
                  <Search className="h-5 w-5 text-gray-600" />
                </button>

                <button
                  onClick={openCart}
                  className="relative flex items-center justify-center w-10 h-10 rounded-full bg-logo-teal hover:bg-logo-ocean transition-all duration-200 focus-visible"
                  aria-label={`Shopping cart with ${cartItemCount} items`}
                >
                  <ShoppingCart className="h-5 w-5 text-white" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-logo-signal text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-bounce-gentle">
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="menu-button flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200 focus-visible"
                  aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                >
                  {isMenuOpen ? (
                    <X className="h-5 w-5 text-gray-600" />
                  ) : (
                    <Menu className="h-5 w-5 text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden">
            <div className="flex justify-between items-center">
              {/* Mobile Logo */}
              <Link href="/" className="focus-visible">
                <div className="bg-gradient-to-r from-logo-teal to-logo-ocean rounded-lg p-2">
                  <div className="flex items-center space-x-2">
                    <Wifi className="h-6 w-6 text-white" />
                    <span className="font-bold text-white text-lg">Travel Data</span>
                  </div>
                </div>
              </Link>

              {/* Mobile Actions */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={openCart}
                  className="relative flex items-center justify-center w-10 h-10 rounded-full bg-logo-teal hover:bg-logo-ocean transition-all duration-200 focus-visible"
                  aria-label={`Shopping cart with ${cartItemCount} items`}
                >
                  <ShoppingCart className="h-5 w-5 text-white" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-logo-signal text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-bounce-gentle">
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="menu-button flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200 focus-visible"
                  aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                >
                  {isMenuOpen ? (
                    <X className="h-5 w-5 text-gray-600" />
                  ) : (
                    <Menu className="h-5 w-5 text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div className={`mobile-menu lg:hidden transition-all duration-300 ease-in-out ${
          isMenuOpen 
            ? 'max-h-screen opacity-100' 
            : 'max-h-0 opacity-0 overflow-hidden'
        }`}>
          <div className="border-t border-gray-200 bg-white/95 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 py-6">
              {/* Contact Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Need help choosing?</p>
                    <a 
                      href="tel:+1-800-555-0123"
                      className="text-lg font-semibold text-logo-teal hover:text-logo-ocean transition-colors"
                    >
                      1-800-555-0123
                    </a>
                  </div>
                  <Phone className="h-8 w-8 text-logo-teal" />
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="block group"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <div className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                      item.name === 'Support Center'
                        ? 'bg-teal-50 border border-teal-200 hover:bg-teal-100'
                        : 'hover:bg-gray-50'
                    }`}>
                      <div className="flex items-center space-x-3">
                        {item.icon && <item.icon className="h-5 w-5 text-logo-teal" />}
                        <div>
                          <div className={`text-lg font-semibold transition-colors ${
                            item.name === 'Support Center'
                              ? 'text-logo-teal'
                              : 'text-gray-900 group-hover:text-logo-teal'
                          }`}>
                            {item.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {item.description}
                          </div>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        item.name === 'Support Center'
                          ? 'bg-logo-teal text-white'
                          : 'bg-logo-teal/10 group-hover:bg-logo-teal group-hover:text-white'
                      }`}>
                        <span className="text-xs">→</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </nav>

              {/* Mobile CTA */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Link
                  href="/free-guide"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full bg-gradient-cta text-white text-center py-4 rounded-lg font-semibold hover:shadow-lg transition-shadow"
                >
                  Get Free Setup Guide
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Search Overlay */}
        {isSearchOpen && (
          <div className="absolute top-full left-0 right-0 bg-white shadow-lg border-b border-gray-200 lg:block hidden">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products, guides, or support..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-logo-teal focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
          </div>
        )}
      </header>

      <Cart />
    </>
  );
};

export default Header;