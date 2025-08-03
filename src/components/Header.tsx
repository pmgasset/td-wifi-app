// src/components/Header.tsx
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Menu, X, HelpCircle } from 'lucide-react';
import { useCartStore } from '../store/cart';
import Cart from './Cart';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
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
          {/* Mobile Layout */}
          <div className="lg:hidden">
            {/* Mobile Header Row */}
            <div className="flex justify-between items-center mb-3">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="menu-button flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-logo-teal"
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {isMenuOpen ? (
                  <X className="h-5 w-5 text-gray-600" />
                ) : (
                  <Menu className="h-5 w-5 text-gray-600" />
                )}
              </button>

              {/* Centered Mobile Logo */}
              <Link href="/" className="focus:outline-none focus:ring-2 focus:ring-logo-teal rounded">
                <div className={`transition-all duration-300 ${
                  isScrolled ? 'h-8' : 'h-10'
                }`}>
                  <Image
                    src="/logo.svg"
                    alt="Travel Data WiFi"
                    width={isScrolled ? 32 : 40}
                    height={isScrolled ? 32 : 40}
                    className="h-full w-auto"
                  />
                </div>
              </Link>

              {/* Mobile Cart */}
              <button
                onClick={openCart}
                className="relative flex items-center justify-center w-10 h-10 rounded-full bg-logo-teal hover:bg-logo-ocean transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-logo-teal focus:ring-offset-2"
                aria-label={`Shopping cart with ${cartItemCount} items`}
              >
                <ShoppingCart className="h-5 w-5 text-white" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-logo-signal text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-bounce-gentle">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </button>
            </div>

            {/* Mobile Navigation Menu */}
            <div className={`mobile-menu transition-all duration-300 ease-in-out ${
              isMenuOpen 
                ? 'max-h-screen opacity-100' 
                : 'max-h-0 opacity-0 overflow-hidden'
            }`}>
              <div className="border-t border-gray-200 bg-white/95 backdrop-blur-md rounded-b-lg">
                <div className="px-4 py-6">
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
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:block">
            {/* Centered Logo */}
            <div className="flex justify-center items-center mb-4">
              <Link href="/" className="focus:outline-none focus:ring-2 focus:ring-logo-teal rounded">
                <div className={`transition-all duration-300 hover:scale-105 ${
                  isScrolled ? 'h-12' : 'h-16'
                }`}>
                  <Image
                    src="/logo.svg"
                    alt="Travel Data WiFi"
                    width={isScrolled ? 48 : 64}
                    height={isScrolled ? 48 : 64}
                    className="h-full w-auto"
                  />
                </div>
              </Link>
            </div>

            {/* Navigation Menu Below Logo */}
            <div className="flex justify-center items-center">
              <nav className="flex items-center space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group relative font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-logo-teal rounded-md px-3 py-2 flex items-center space-x-2 ${
                      item.name === 'Support Center'
                        ? 'text-logo-teal hover:text-logo-ocean bg-teal-50 hover:bg-teal-100 rounded-lg'
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

              {/* Desktop Cart - Positioned to the right */}
              <div className="ml-8">
                <button
                  onClick={openCart}
                  className="relative flex items-center justify-center w-10 h-10 rounded-full bg-logo-teal hover:bg-logo-ocean transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-logo-teal focus:ring-offset-2"
                  aria-label={`Shopping cart with ${cartItemCount} items`}
                >
                  <ShoppingCart className="h-5 w-5 text-white" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-logo-signal text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-bounce-gentle">
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <Cart />
    </>
  );
};

export default Header;