// src/components/Header.tsx
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, Menu, X, Wifi } from 'lucide-react';
import { useCartStore } from '../store/cart';
import Cart from './Cart';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { getTotalItems, openCart } = useCartStore();
  const cartItemCount = getTotalItems();

  const navigation = [
    { name: 'Products', href: '/products' },
    { name: 'Solutions', href: '/solutions' },
    { name: 'Coverage', href: '/coverage' },
    { name: 'Support', href: '/support' },
  ];

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 50;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header className={`bg-white shadow-sm border-b sticky top-0 z-50 transition-all duration-300 ${
        isScrolled ? 'py-2' : 'py-4'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop Layout */}
          <div className="hidden lg:block">
            {/* Top Row - Centered Logo */}
            <div className="flex justify-center items-center mb-4">
              <Link href="/" className="flex items-center space-x-4 group">
                <img 
                  src="/logo.svg" 
                  alt="Travel Data WiFi Logo" 
                  className={`transition-all duration-300 ${
                    isScrolled ? 'w-12 h-12' : 'w-20 h-20'
                  }`}
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    console.log('Header logo failed to load, showing fallback');
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.classList.remove('hidden');
                  }}
                />
                <div className={`bg-gradient-to-r from-travel-blue to-blue-600 rounded-xl flex items-center justify-center hidden transition-all duration-300 ${
                  isScrolled ? 'w-12 h-12' : 'w-20 h-20'
                }`}>
                  <Wifi className={`text-white transition-all duration-300 ${
                    isScrolled ? 'h-6 w-6' : 'h-10 w-10'
                  }`} />
                </div>
                <div className="text-center">
                  <span className={`font-bold text-travel-blue transition-all duration-300 ${
                    isScrolled ? 'text-xl' : 'text-2xl'
                  }`}>
                    Travel Data WiFi
                  </span>
                  <div className={`text-gray-500 transition-all duration-300 ${
                    isScrolled ? 'text-xs -mt-1' : 'text-sm'
                  }`}>
                    Stay Connected Anywhere
                  </div>
                </div>
              </Link>
            </div>

            {/* Bottom Row - Navigation and Actions */}
            <div className="flex justify-between items-center">
              {/* Left spacer for balance */}
              <div className="w-24"></div>

              {/* Center Navigation */}
              <nav className="flex items-center space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="text-gray-700 hover:text-travel-blue font-medium transition-colors duration-200 text-lg"
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>

              {/* Right Actions */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={openCart}
                  className="relative flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                >
                  <ShoppingCart className="h-6 w-6 text-gray-600" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-travel-orange text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile/Tablet Layout */}
          <div className="lg:hidden">
            <div className="flex justify-between items-center">
              {/* Mobile Logo */}
              <Link href="/" className="flex items-center space-x-3">
                <img 
                  src="/logo.svg" 
                  alt="Travel Data WiFi Logo" 
                  className={`transition-all duration-300 ${
                    isScrolled ? 'w-10 h-10' : 'w-14 h-14'
                  }`}
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.classList.remove('hidden');
                  }}
                />
                <div className={`bg-gradient-to-r from-travel-blue to-blue-600 rounded-xl flex items-center justify-center hidden transition-all duration-300 ${
                  isScrolled ? 'w-10 h-10' : 'w-14 h-14'
                }`}>
                  <Wifi className={`text-white transition-all duration-300 ${
                    isScrolled ? 'h-5 w-5' : 'h-7 w-7'
                  }`} />
                </div>
                <div>
                  <span className={`font-bold text-travel-blue transition-all duration-300 ${
                    isScrolled ? 'text-lg' : 'text-xl'
                  }`}>
                    Travel Data WiFi
                  </span>
                  <div className={`text-gray-500 transition-all duration-300 ${
                    isScrolled ? 'text-xs -mt-1' : 'text-sm -mt-1'
                  }`}>
                    Stay Connected Anywhere
                  </div>
                </div>
              </Link>

              {/* Mobile Actions */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={openCart}
                  className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                >
                  <ShoppingCart className="h-5 w-5 text-gray-600" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-travel-orange text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {cartItemCount > 9 ? '9+' : cartItemCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                >
                  {isMenuOpen ? (
                    <X className="h-5 w-5 text-gray-600" />
                  ) : (
                    <Menu className="h-5 w-5 text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Mobile Navigation Menu */}
            {isMenuOpen && (
              <div className="border-t border-gray-200 py-4 mt-4 bg-white">
                <nav className="flex flex-col space-y-4">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="text-gray-700 hover:text-travel-blue font-medium transition-colors duration-200 px-2 py-2 text-lg"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}
                </nav>
              </div>
            )}
          </div>
        </div>
      </header>

      <Cart />
    </>
  );
};

export default Header;