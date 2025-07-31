// components/support/ArticleList.jsx
// Component for displaying a list of knowledge base articles

import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Clock, 
  Eye, 
  ThumbsUp, 
  Tag, 
  ChevronRight,
  Filter,
  SortAsc,
  SortDesc
} from 'lucide-react';

const ArticleList = ({ 
  articles = [], 
  selectedCategory = null,
  onArticleSelect, 
  loading = false,
  isSearchResults = false,
  searchQuery = ""
}) => {
  const [sortBy, setSortBy] = useState('modifiedTime'); // modifiedTime, viewCount, helpfulCount, title
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [showFilters, setShowFilters] = useState(false);

  // Sort and filter articles
  const sortedArticles = useMemo(() => {
    let filtered = [...articles];

    // Filter by category if selected
    if (selectedCategory) {
      filtered = filtered.filter(article => article.categoryId === selectedCategory);
    }

    // Sort articles
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // Handle different data types
      if (sortBy === 'title') {
        aValue = aValue?.toLowerCase() || '';
        bValue = bValue?.toLowerCase() || '';
      } else if (sortBy === 'modifiedTime' || sortBy === 'createdTime') {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      } else {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [articles, selectedCategory, sortBy, sortOrder]);

  // Handle sort change
  const handleSortChange = (newSortBy) => {
    if (newSortBy === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  // Truncate text
  const truncateText = (text, maxLength = 150) => {
    if (!text || text.length <= maxLength) return text;
    return text.substr(0, maxLength).trim() + '...';
  };

  // Highlight search terms
  const highlightSearchTerms = (text, query) => {
    if (!query || !text) return text;
    
    const regex = new RegExp(`(${query.split(' ').join('|')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (regex.test(part)) {
        return <mark key={index} className="bg-yellow-200 px-1 rounded">{part}</mark>;
      }
      return part;
    });
  };

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="bg-white rounded-lg p-6 shadow-sm border animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
          <div className="flex items-center space-x-4">
            <div className="h-3 bg-gray-200 rounded w-16"></div>
            <div className="h-3 bg-gray-200 rounded w-12"></div>
            <div className="h-3 bg-gray-200 rounded w-20"></div>
          </div>
        </div>
      ))}
    </div>
  );

  if (loading && sortedArticles.length === 0) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header with sort controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-semibold text-gray-900">
            {isSearchResults ? (
              <>
                Search Results 
                {searchQuery && (
                  <span className="text-gray-500 font-normal">
                    for "{searchQuery}"
                  </span>
                )}
              </>
            ) : selectedCategory ? (
              'Articles in Category'
            ) : (
              'Knowledge Base Articles'
            )}
          </h2>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {sortedArticles.length} article{sortedArticles.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Sort and filter controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="h-4 w-4 mr-2" />
            Sort & Filter
          </button>
        </div>
      </div>

      {/* Sort controls (expanded) */}
      {showFilters && (
        <div className="bg-gray-50 rounded-lg p-4 border">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Sort by:</span>
            
            {[
              { key: 'modifiedTime', label: 'Last Updated' },
              { key: 'viewCount', label: 'Most Viewed' },
              { key: 'helpfulCount', label: 'Most Helpful' },
              { key: 'title', label: 'Title' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSortChange(key)}
                className={`flex items-center px-3 py-1 text-sm rounded transition-colors ${
                  sortBy === key
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {label}
                {sortBy === key && (
                  sortOrder === 'asc' ? 
                    <SortAsc className="h-3 w-3 ml-1" /> : 
                    <SortDesc className="h-3 w-3 ml-1" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Articles list */}
      {sortedArticles.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {isSearchResults ? 'No articles found' : 'No articles available'}
          </h3>
          <p className="text-gray-500">
            {isSearchResults 
              ? `No articles match your search for "${searchQuery}". Try different keywords.`
              : 'There are no articles to display at this time.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedArticles.map((article) => (
            <article
              key={article.id}
              className="bg-white rounded-lg p-6 shadow-sm border hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => onArticleSelect(article.id)}
            >
              {/* Article header */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors pr-4 leading-tight">
                  {isSearchResults ? 
                    highlightSearchTerms(article.title, searchQuery) : 
                    article.title
                  }
                </h3>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
              </div>

              {/* Article summary */}
              {article.summary && (
                <p className="text-gray-600 mb-4 leading-relaxed">
                  {isSearchResults ? 
                    highlightSearchTerms(truncateText(article.summary), searchQuery) :
                    truncateText(article.summary)
                  }
                </p>
              )}

              {/* Article tags */}
              {article.tags && article.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {article.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                  {article.tags.length > 3 && (
                    <span className="text-xs text-gray-500 px-2 py-1">
                      +{article.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}

              {/* Article metadata */}
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{formatDate(article.modifiedTime)}</span>
                  </div>
                  
                  {article.viewCount > 0 && (
                    <div className="flex items-center">
                      <Eye className="h-4 w-4 mr-1" />
                      <span>{article.viewCount.toLocaleString()} views</span>
                    </div>
                  )}
                  
                  {article.helpfulCount > 0 && (
                    <div className="flex items-center">
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      <span>{article.helpfulCount} helpful</span>
                    </div>
                  )}
                </div>

                {/* Article status */}
                {article.status && (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    article.status === 'PUBLISHED' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {article.status}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Loading more indicator */}
      {loading && sortedArticles.length > 0 && (
        <div className="text-center py-4">
          <div className="inline-flex items-center text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Loading more articles...
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleList;