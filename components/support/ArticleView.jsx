// components/support/ArticleView.jsx
// Component for displaying individual knowledge base articles

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Clock, 
  Eye, 
  ThumbsUp, 
  ThumbsDown, 
  Tag, 
  Share2, 
  Bookmark,
  MessageCircle,
  ExternalLink,
  Download
} from 'lucide-react';
import { knowledgeBaseAPI } from '../../utils/api-client';

const ArticleView = ({ article, onBack, onRelatedArticleSelect }) => {
  const [feedback, setFeedback] = useState(null); // 'helpful' or 'unhelpful'
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    // Check if article is bookmarked
    const bookmarks = JSON.parse(localStorage.getItem('bookmarked_articles') || '[]');
    setIsBookmarked(bookmarks.includes(article.id));

    // Load related articles
    loadRelatedArticles();
  }, [article.id]);

  // Load related articles based on tags and category
  const loadRelatedArticles = async () => {
    try {
      const searchTerms = article.tags?.slice(0, 3).join(' ') || article.title;
      const response = await knowledgeBaseAPI.searchArticles(searchTerms, { limit: 5 });
      
      // Filter out current article and limit to 4 related articles
      const related = response.data?.data?.filter(a => a.id !== article.id).slice(0, 4) || [];
      setRelatedArticles(related);
    } catch (error) {
      console.error('Failed to load related articles:', error);
    }
  };

  // Handle feedback submission
  const handleFeedback = async (type) => {
    setFeedback(type);
    
    if (type === 'unhelpful') {
      setShowFeedbackForm(true);
    } else {
      await submitFeedback(type);
    }
  };

  // Submit feedback to API
  const submitFeedback = async (type, text = '') => {
    try {
      setIsSubmittingFeedback(true);
      
      await knowledgeBaseAPI.submitFeedback(article.id, {
        type,
        comment: text,
        timestamp: new Date().toISOString()
      });

      setShowFeedbackForm(false);
      setFeedbackText('');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Handle feedback form submission
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    await submitFeedback('unhelpful', feedbackText);
  };

  // Toggle bookmark
  const toggleBookmark = () => {
    const bookmarks = JSON.parse(localStorage.getItem('bookmarked_articles') || '[]');
    
    if (isBookmarked) {
      const updated = bookmarks.filter(id => id !== article.id);
      localStorage.setItem('bookmarked_articles', JSON.stringify(updated));
      setIsBookmarked(false);
    } else {
      bookmarks.push(article.id);
      localStorage.setItem('bookmarked_articles', JSON.stringify(bookmarks));
      setIsBookmarked(true);
    }
  };

  // Share article
  const shareArticle = async () => {
    const shareData = {
      title: article.title,
      text: article.summary || 'Check out this helpful article',
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        alert('Article link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing article:', error);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Sanitize and format article content
  const formatContent = (content) => {
    if (!content) return '';
    
    // Basic HTML sanitization (in production, use a proper sanitization library)
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/g, '');
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to articles
        </button>

        <div className="bg-white rounded-lg shadow-sm border p-8">
          {/* Article title and metadata */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
              {article.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                <span>Updated {formatDate(article.modifiedTime)}</span>
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
                  <span>{article.helpfulCount} found this helpful</span>
                </div>
              )}
            </div>

            {/* Article tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {article.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full"
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={toggleBookmark}
                className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                  isBookmarked
                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                <Bookmark className={`h-4 w-4 mr-2 ${isBookmarked ? 'fill-current' : ''}`} />
                {isBookmarked ? 'Bookmarked' : 'Bookmark'}
              </button>
              
              <button
                onClick={shareArticle}
                className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </button>

              {article.attachments && article.attachments.length > 0 && (
                <button className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors">
                  <Download className="h-4 w-4 mr-2" />
                  Downloads ({article.attachments.length})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Article content */}
      <div className="bg-white rounded-lg shadow-sm border p-8 mb-8">
        <div 
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: formatContent(article.content) }}
        />
      </div>

      {/* Feedback section */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Was this article helpful?</h3>
        
        {!feedback ? (
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleFeedback('helpful')}
              className="flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors"
            >
              <ThumbsUp className="h-5 w-5 mr-2" />
              Yes, helpful
            </button>
            
            <button
              onClick={() => handleFeedback('unhelpful')}
              className="flex items-center px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors"
            >
              <ThumbsDown className="h-5 w-5 mr-2" />
              Not helpful
            </button>
          </div>
        ) : (
          <div className="text-green-600">
            <p className="flex items-center">
              <ThumbsUp className="h-5 w-5 mr-2" />
              Thank you for your feedback!
            </p>
          </div>
        )}

        {/* Feedback form for negative feedback */}
        {showFeedbackForm && (
          <form onSubmit={handleFeedbackSubmit} className="mt-4 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How can we improve this article? (optional)
            </label>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="3"
              placeholder="Tell us what was missing or unclear..."
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                type="submit"
                disabled={isSubmittingFeedback}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </button>
              <button
                type="button"
                onClick={() => setShowFeedbackForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Skip
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <MessageCircle className="h-5 w-5 mr-2" />
            Related Articles
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedArticles.map((relatedArticle) => (
              <button
                key={relatedArticle.id}
                onClick={() => onRelatedArticleSelect(relatedArticle.id)}
                className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">
                  {relatedArticle.title}
                </h4>
                {relatedArticle.summary && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {relatedArticle.summary}
                  </p>
                )}
                <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                  <span>{formatDate(relatedArticle.modifiedTime)}</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleView;