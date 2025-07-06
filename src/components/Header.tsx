// ===== src/components/Header.tsx =====
import React, { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Menu, X, Wifi } from 'lucide-react';
import { useCartStore } from '../store/cart';
import Cart from './Cart';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { getTotalItems, openCart } = useCartStore();
  const cartItemCount = getTotalItems();

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Wifi className="h-8 w-8 text-travel-blue" />
            <span className="text-xl font-bold text-travel-blue">Travel Data WiFi</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/products" className="text-gray-600 hover:text-travel-blue transition-colors">
              Products
            </Link>
            <Link href="/guides" className="text-gray-600 hover:text-travel-blue transition-colors">
              Guides
            </Link>
            <Link href="/coverage" className="text-gray-600 hover:text-travel-blue transition-colors">
              Coverage
            </Link>
            <Link href="/support" className="text-gray-600 hover:text-travel-blue transition-colors">
              Support
            </Link>
          </nav>

          {/* Cart & Mobile Menu */}
          <div className="flex items-center space-x-4">
            <button
              onClick={openCart}
              className="relative p-2 text-gray-600 hover:text-travel-blue transition-colors"
            >
              <ShoppingCart className="h-6 w-6" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-travel-orange text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-600"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col space-y-4">
              <Link 
                href="/products" 
                className="text-gray-600 hover:text-travel-blue transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Products
              </Link>
              <Link 
                href="/guides" 
                className="text-gray-600 hover:text-travel-blue transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Guides
              </Link>
              <Link 
                href="/coverage" 
                className="text-gray-600 hover:text-travel-blue transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Coverage
              </Link>
              <Link 
                href="/support" 
                className="text-gray-600 hover:text-travel-blue transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Support
              </Link>
            </nav>
          </div>
        )}
      </div>
      
      <Cart />
    </header>
  );
};

export default Header;
