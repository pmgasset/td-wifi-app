// components/support/CategoryFilter.jsx
// Sidebar component for filtering articles by category

import React, { useState } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  ChevronDown, 
  ChevronRight,
  Filter,
  X
} from 'lucide-react';

const CategoryFilter = ({ 
  categories = [], 
  selectedCategory = null, 
  onCategorySelect,
  className = ""
}) => {
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [showMobileFilter, setShowMobileFilter] = useState(false);

  // Toggle category expansion
  const toggleCategory = (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Handle category selection
  const handleCategorySelect = (categoryId) => {
    onCategorySelect(categoryId === selectedCategory ? null : categoryId);
    setShowMobileFilter(false); // Close mobile filter after selection
  };

  // Calculate total articles across all categories
  const totalArticles = categories.reduce((sum, category) => sum + (category.articleCount || 0), 0);

  // Filter component content
  const FilterContent = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Filter className="h-5 w-5 mr-2" />
          Categories
        </h3>
        {showMobileFilter && (
          <button
            onClick={() => setShowMobileFilter(false)}
            className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* All Articles option */}
      <button
        onClick={() => handleCategorySelect(null)}
        className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
          selectedCategory === null
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : 'text-gray-700 hover:bg-gray-50 border border-gray-200'
        }`}
      >
        <div className="flex items-center">
          <FolderOpen className="h-5 w-5 mr-3" />
          <span className="font-medium">All Articles</span>
        </div>
        <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
          {totalArticles}
        </span>
      </button>

      {/* Categories list */}
      {categories.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Folder className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No categories available</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => handleCategorySelect(category.id)}
                className={`w-full flex items-center justify-between p-3 transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center flex-1">
                  <Folder className={`h-5 w-5 mr-3 ${
                    selectedCategory === category.id ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <div className="text-left flex-1">
                    <div className="font-medium">{category.name}</div>
                    {category.description && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {category.description}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    selectedCategory === category.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {category.articleCount || 0}
                  </span>
                  
                  {category.sections && category.sections.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategory(category.id);
                      }}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      {expandedCategories.has(category.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </button>

              {/* Category sections (if expanded) */}
              {expandedCategories.has(category.id) && category.sections && (
                <div className="bg-gray-50 border-t border-gray-200">
                  {category.sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => handleCategorySelect(section.id)}
                      className="w-full flex items-center justify-between p-3 pl-8 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{section.name}</span>
                      </div>
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                        {section.articleCount || 0}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Category statistics */}
      {categories.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Total Categories:</span>
              <span className="font-medium">{categories.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Articles:</span>
              <span className="font-medium">{totalArticles}</span>
            </div>
            {selectedCategory && (
              <div className="flex justify-between text-blue-600">
                <span>Filtered Articles:</span>
                <span className="font-medium">
                  {categories.find(c => c.id === selectedCategory)?.articleCount || 0}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className={`hidden lg:block ${className}`}>
        <div className="sticky top-4">
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <FilterContent />
          </div>
        </div>
      </div>

      {/* Mobile filter button */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setShowMobileFilter(true)}
          className="flex items-center justify-center w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Filter className="h-5 w-5 mr-2" />
          <span>Filter by Category</span>
          {selectedCategory && (
            <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
              1 selected
            </span>
          )}
        </button>
      </div>

      {/* Mobile filter overlay */}
      {showMobileFilter && (
        <div className="lg:hidden fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowMobileFilter(false)}
            />
            
            {/* Modal panel */}
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
              <FilterContent />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CategoryFilter;