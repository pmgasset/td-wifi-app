// components/support/SearchBar.jsx
// Search bar component with autocomplete and suggestions - FIXED VERSION

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';

const SearchBar = ({ 
  onSearch, 
  placeholder = "Search...", 
  initialValue = "",
  enableSuggestions = true,  // ← RENAMED from showSuggestions to enableSuggestions
  className = "" 
}) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false); // ← No conflict now
  const [recentSearches, setRecentSearches] = useState([]);
  const [popularSearches] = useState([
    "How to reset password",
    "Account settings", 
    "Billing questions",
    "Technical support",
    "User permissions",
    "API documentation"
  ]);
  
  const searchRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent searches:', e);
      }
    }
  }, []);

  useEffect(() => {
    // Save recent searches to localStorage
    if (recentSearches.length > 0) {
      localStorage.setItem('recent_searches', JSON.stringify(recentSearches));
    }
  }, [recentSearches]);

  // Handle input change and generate suggestions
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (value.trim().length > 2 && enableSuggestions) { // ← Use enableSuggestions
      // Generate suggestions based on popular searches
      const filtered = popularSearches.filter(search =>
        search.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handle search submission
  const handleSearch = (searchQuery = query) => {
    const trimmedQuery = searchQuery.trim();
    
    if (!trimmedQuery) return;

    // Add to recent searches (avoid duplicates)
    setRecentSearches(prev => {
      const filtered = prev.filter(search => search !== trimmedQuery);
      return [trimmedQuery, ...filtered].slice(0, 5); // Keep only last 5
    });

    setShowSuggestions(false);
    onSearch(trimmedQuery);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    handleSearch();
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  // Handle clear search
  const handleClear = () => {
    setQuery('');
    setShowSuggestions(false);
    searchRef.current?.focus();
  };

  // Handle input focus
  const handleFocus = () => {
    if (query.trim().length === 0 && (recentSearches.length > 0 || popularSearches.length > 0)) {
      setShowSuggestions(true);
    }
  };

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target) &&
        !searchRef.current?.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-12 pr-12 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto"
        >
          {/* Current query suggestions */}
          {suggestions.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 px-3 py-2 uppercase tracking-wide">
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center text-gray-700 transition-colors"
                >
                  <Search className="h-4 w-4 mr-3 text-gray-400" />
                  <span className="flex-1">{suggestion}</span>
                </button>
              ))}
            </div>
          )}

          {/* Recent searches */}
          {recentSearches.length > 0 && query.trim().length === 0 && (
            <div className="p-2 border-t border-gray-100">
              <div className="text-xs font-medium text-gray-500 px-3 py-2 uppercase tracking-wide">
                Recent Searches
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(search)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center text-gray-700 transition-colors"
                >
                  <Clock className="h-4 w-4 mr-3 text-gray-400" />
                  <span className="flex-1">{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* Popular searches */}
          {popularSearches.length > 0 && query.trim().length === 0 && (
            <div className="p-2 border-t border-gray-100">
              <div className="text-xs font-medium text-gray-500 px-3 py-2 uppercase tracking-wide">
                Popular Searches
              </div>
              {popularSearches.slice(0, 4).map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(search)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center text-gray-700 transition-colors"
                >
                  <TrendingUp className="h-4 w-4 mr-3 text-gray-400" />
                  <span className="flex-1">{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* No suggestions message */}
          {suggestions.length === 0 && query.trim().length > 2 && (
            <div className="p-4 text-center text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No suggestions found</p>
              <p className="text-xs text-gray-400 mt-1">
                Press Enter to search for &quot;{query}&quot;
              </p>
            </div>
          )}

          {/* Empty state when no recent/popular searches */}
          {recentSearches.length === 0 && query.trim().length === 0 && (
            <div className="p-4 text-center text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Start typing to search</p>
              <p className="text-xs text-gray-400 mt-1">
                Search our knowledge base for answers
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;