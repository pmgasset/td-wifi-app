// components/support/SupportDashboard.jsx
// Main support dashboard component

import React, { useState, useEffect } from 'react';
import { Search, HelpCircle, BookOpen, MessageCircle, Users, TrendingUp } from 'lucide-react';
import ArticleList from './ArticleList';
import ArticleView from './ArticleView';
import SearchBar from './SearchBar';
import CategoryFilter from './CategoryFilter';
import ContactForm from './ContactForm';
import { useKnowledgeBase } from '../../hooks/useKnowledgeBase';

const SupportDashboard = () => {
  const [currentView, setCurrentView] = useState('home'); // home, article, search, contact
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);

  const {
    articles,
    categories,
    stats,
    loading,
    error,
    searchArticles,
    getArticle,
    refreshData
  } = useKnowledgeBase();

  useEffect(() => {
    // Load initial data
    refreshData();
  }, [refreshData]);

  // Handle search
  const handleSearch = async (query) => {
    if (!query.trim()) return;
    
    setSearchQuery(query);
    setCurrentView('search');
    await searchArticles(query);
  };

  // Handle article selection
  const handleArticleSelect = async (articleId) => {
    const article = await getArticle(articleId);
    if (article) {
      setSelectedArticle(article);
      setCurrentView('article');
    }
  };

  // Handle category filter
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setCurrentView('home');
  };

  // Navigation handlers
  const goHome = () => {
    setCurrentView('home');
    setSelectedArticle(null);
    setSearchQuery('');
  };

  const goBack = () => {
    if (currentView === 'article') {
      setCurrentView(searchQuery ? 'search' : 'home');
      setSelectedArticle(null);
    } else if (currentView === 'search') {
      setCurrentView('home');
      setSearchQuery('');
    } else if (currentView === 'contact') {
      setCurrentView('home');
    }
  };

  // Render loading state
  if (loading && !articles.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading support center...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !articles.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <HelpCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Support Center</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={refreshData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                onClick={goHome}
                className="flex items-center text-gray-900 hover:text-blue-600 transition-colors"
              >
                <HelpCircle className="h-8 w-8 mr-2" />
                <span className="text-xl font-semibold">Support Center</span>
              </button>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Navigation breadcrumbs */}
              {currentView !== 'home' && (
                <button
                  onClick={goBack}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  ← Back
                </button>
              )}
              
              {/* Contact support button */}
              <button
                onClick={() => setCurrentView('contact')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'home' && (
          <div>
            {/* Hero Section with Search */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                How can we help you?
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Search our knowledge base or browse categories below
              </p>
              
              <div className="max-w-2xl mx-auto">
                <SearchBar
                  onSearch={handleSearch}
                  placeholder="Search for articles, guides, and FAQs..."
                />
              </div>
            </div>

            {/* Stats Section */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-center">
                    <BookOpen className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Total Articles</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats.totalArticles}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-green-600 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Categories</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats.totalCategories}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-purple-600 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Last Updated</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(stats.lastUpdated).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Categories and Articles */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Category Filter Sidebar */}
              <div className="lg:col-span-1">
                <CategoryFilter
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onCategorySelect={handleCategorySelect}
                />
              </div>

              {/* Articles List */}
              <div className="lg:col-span-3">
                <ArticleList
                  articles={articles}
                  selectedCategory={selectedCategory}
                  onArticleSelect={handleArticleSelect}
                  loading={loading}
                />
              </div>
            </div>
          </div>
        )}

        {currentView === 'search' && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Search Results
              </h1>
              <div className="max-w-2xl">
                <SearchBar
                  onSearch={handleSearch}
                  initialValue={searchQuery}
                  placeholder="Search for articles, guides, and FAQs..."
                />
              </div>
            </div>

            <ArticleList
              articles={articles}
              onArticleSelect={handleArticleSelect}
              loading={loading}
              isSearchResults={true}
              searchQuery={searchQuery}
            />
          </div>
        )}

        {currentView === 'article' && selectedArticle && (
          <ArticleView
            article={selectedArticle}
            onBack={goBack}
            onRelatedArticleSelect={handleArticleSelect}
          />
        )}

        {currentView === 'contact' && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Contact Support
              </h1>
              <p className="text-gray-600">
                Can't find what you're looking for? Our support team is here to help.
              </p>
            </div>

            <ContactForm onSuccess={() => setCurrentView('home')} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2025 Support Center. Powered by Zoho Desk.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SupportDashboard;