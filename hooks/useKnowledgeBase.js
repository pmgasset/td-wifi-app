// hooks/useKnowledgeBase.js
// Custom hook for managing knowledge base data and API calls

import { useState, useCallback, useRef } from 'react';
import { apiClient } from '../utils/api-client';

export const useKnowledgeBase = () => {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  
  // Cache to avoid unnecessary API calls
  const cache = useRef({
    articles: new Map(),
    categories: null,
    stats: null,
    searches: new Map()
  });

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Generic error handler
  const handleError = useCallback((err, defaultMessage = 'An error occurred') => {
    console.error('Knowledge base error:', err);
    const errorMessage = err.response?.data?.message || err.message || defaultMessage;
    setError(errorMessage);
    setLoading(false);
  }, []);

  // Get all articles with optional filtering
  const getArticles = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      clearError();

      const cacheKey = JSON.stringify(params);
      const cached = cache.current.articles.get(cacheKey);
      
      // Return cached data if fresh (within 5 minutes)
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        setArticles(cached.data);
        setLoading(false);
        return cached.data;
      }

      const response = await apiClient.get('/knowledge-base/articles', { params });
      const articlesData = response.data?.data || [];
      
      // Cache the result
      cache.current.articles.set(cacheKey, {
        data: articlesData,
        timestamp: Date.now()
      });
      
      setArticles(articlesData);
      setLastFetch(new Date());
      return articlesData;
    } catch (err) {
      handleError(err, 'Failed to load articles');
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearError, handleError]);

  // Get single article by ID
  const getArticle = useCallback(async (articleId) => {
    try {
      setLoading(true);
      clearError();

      // Check cache first
      const cached = cache.current.articles.get(`single:${articleId}`);
      if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
        setLoading(false);
        return cached.data;
      }

      const response = await apiClient.get(`/knowledge-base/articles/${articleId}`);
      const articleData = response.data;
      
      // Cache the result
      cache.current.articles.set(`single:${articleId}`, {
        data: articleData,
        timestamp: Date.now()
      });
      
      return articleData;
    } catch (err) {
      handleError(err, 'Failed to load article');
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearError, handleError]);

  // Search articles
  const searchArticles = useCallback(async (query, params = {}) => {
    try {
      setLoading(true);
      clearError();

      const searchParams = { q: query, ...params };
      const cacheKey = JSON.stringify(searchParams);
      const cached = cache.current.searches.get(cacheKey);
      
      // Return cached search results if fresh (within 2 minutes)
      if (cached && Date.now() - cached.timestamp < 2 * 60 * 1000) {
        setArticles(cached.data);
        setLoading(false);
        return cached.data;
      }

      const response = await apiClient.get('/knowledge-base/search', { 
        params: searchParams 
      });
      const searchResults = response.data?.data || [];
      
      // Cache the search results
      cache.current.searches.set(cacheKey, {
        data: searchResults,
        timestamp: Date.now()
      });
      
      setArticles(searchResults);
      return searchResults;
    } catch (err) {
      handleError(err, 'Failed to search articles');
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearError, handleError]);

  // Get all categories
  const getCategories = useCallback(async () => {
    try {
      setLoading(true);
      clearError();

      // Return cached categories if fresh (within 15 minutes)
      if (cache.current.categories && Date.now() - cache.current.categories.timestamp < 15 * 60 * 1000) {
        setCategories(cache.current.categories.data);
        setLoading(false);
        return cache.current.categories.data;
      }

      const response = await apiClient.get('/knowledge-base/categories');
      const categoriesData = response.data?.data || [];
      
      // Cache the result
      cache.current.categories = {
        data: categoriesData,
        timestamp: Date.now()
      };
      
      setCategories(categoriesData);
      return categoriesData;
    } catch (err) {
      handleError(err, 'Failed to load categories');
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearError, handleError]);

  // Get help center statistics
  const getStats = useCallback(async () => {
    try {
      clearError();

      // Return cached stats if fresh (within 30 minutes)
      if (cache.current.stats && Date.now() - cache.current.stats.timestamp < 30 * 60 * 1000) {
        setStats(cache.current.stats.data);
        return cache.current.stats.data;
      }

      const response = await apiClient.get('/knowledge-base/stats');
      const statsData = response.data;
      
      // Cache the result
      cache.current.stats = {
        data: statsData,
        timestamp: Date.now()
      };
      
      setStats(statsData);
      return statsData;
    } catch (err) {
      handleError(err, 'Failed to load statistics');
      return null;
    }
  }, [clearError, handleError]);

  // Get articles by category
  const getArticlesByCategory = useCallback(async (categoryId, params = {}) => {
    return await getArticles({ category: categoryId, ...params });
  }, [getArticles]);

  // Get articles by section
  const getArticlesBySection = useCallback(async (sectionId, params = {}) => {
    return await getArticles({ section: sectionId, ...params });
  }, [getArticles]);

  // Refresh all data (force reload)
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      clearError();
      
      // Clear all caches
      cache.current = {
        articles: new Map(),
        categories: null,
        stats: null,
        searches: new Map()
      };

      // Fetch all data in parallel
      const [articlesData, categoriesData, statsData] = await Promise.allSettled([
        getArticles(),
        getCategories(),
        getStats()
      ]);

      // Handle any errors from parallel requests
      const errors = [];
      if (articlesData.status === 'rejected') errors.push('Failed to load articles');
      if (categoriesData.status === 'rejected') errors.push('Failed to load categories');
      if (statsData.status === 'rejected') errors.push('Failed to load statistics');

      if (errors.length > 0) {
        setError(errors.join(', '));
      }

      setLastFetch(new Date());
    } catch (err) {
      handleError(err, 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, [getArticles, getCategories, getStats, clearError, handleError]);

  // Trigger manual sync with Zoho Desk
  const syncWithZoho = useCallback(async () => {
    try {
      setLoading(true);
      clearError();

      const response = await apiClient.post('/knowledge-base/sync');
      
      if (response.data.success) {
        // Clear cache and refresh data after successful sync
        await refreshData();
        return response.data;
      } else {
        throw new Error(response.data.message || 'Sync failed');
      }
    } catch (err) {
      handleError(err, 'Failed to sync with Zoho Desk');
      return null;
    } finally {
      setLoading(false);
    }
  }, [refreshData, clearError, handleError]);

  // Get cached data info
  const getCacheInfo = useCallback(() => {
    return {
      articlesCache: cache.current.articles.size,
      searchCache: cache.current.searches.size,
      categoriesCache: cache.current.categories ? 1 : 0,
      statsCache: cache.current.stats ? 1 : 0,
      lastFetch
    };
  }, [lastFetch]);

  // Clear all caches
  const clearCache = useCallback(() => {
    cache.current = {
      articles: new Map(),
      categories: null,
      stats: null,
      searches: new Map()
    };
  }, []);

  // Check if data is stale
  const isDataStale = useCallback((maxAge = 10 * 60 * 1000) => { // 10 minutes default
    return !lastFetch || Date.now() - lastFetch.getTime() > maxAge;
  }, [lastFetch]);

  // Auto-refresh stale data
  const autoRefreshIfStale = useCallback(async (maxAge = 10 * 60 * 1000) => {
    if (isDataStale(maxAge) && !loading) {
      await refreshData();
    }
  }, [isDataStale, loading, refreshData]);

  return {
    // Data state
    articles,
    categories,
    stats,
    loading,
    error,
    lastFetch,

    // Data fetching functions
    getArticles,
    getArticle,
    searchArticles,
    getCategories,
    getStats,
    getArticlesByCategory,
    getArticlesBySection,

    // Data management functions
    refreshData,
    syncWithZoho,
    clearError,
    clearCache,
    getCacheInfo,
    isDataStale,
    autoRefreshIfStale,

    // Computed properties
    hasData: articles.length > 0 || categories.length > 0,
    isEmpty: !loading && articles.length === 0 && categories.length === 0,
    isInitialized: lastFetch !== null
  };
};