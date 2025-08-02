// src/lib/enhanced-token-manager.ts - Centralized token management with advanced rate limiting
// CRITICAL: This replaces all scattered token caching implementations

interface TokenCacheEntry {
  accessToken: string;
  expiryTime: number;
  region: string;
  lastRefresh: number;
  refreshCount: number;
  failureCount: number;
}

interface RateLimitState {
  windowStart: number;
  requestCount: number;
  lastRequest: number;
  backoffUntil: number;
}

interface TokenManagerConfig {
  maxRefreshesPerHour: number;
  maxFailuresBeforeBackoff: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  tokenBufferMinutes: number;
  enableMetrics: boolean;
}

class EnhancedTokenManager {
  private static instance: EnhancedTokenManager;
  private tokenCache = new Map<string, TokenCacheEntry>();
  private rateLimitState = new Map<string, RateLimitState>();
  private refreshPromises = new Map<string, Promise<string>>();
  
  private readonly config: TokenManagerConfig = {
    maxRefreshesPerHour: 10, // Zoho allows ~20-30 per hour, we stay conservative
    maxFailuresBeforeBackoff: 3,
    baseBackoffMs: 5000, // 5 seconds
    maxBackoffMs: 300000, // 5 minutes
    tokenBufferMinutes: 10, // Refresh 10 minutes before expiry
    enableMetrics: process.env.NODE_ENV === 'development'
  };

  private metrics = {
    totalRefreshes: 0,
    successfulRefreshes: 0,
    failedRefreshes: 0,
    cacheHits: 0,
    rateLimitHits: 0,
    lastResetTime: Date.now()
  };

  private constructor() {
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
    
    // Reset metrics daily
    setInterval(() => this.resetMetrics(), 24 * 60 * 60 * 1000);
  }

  public static getInstance(): EnhancedTokenManager {
    if (!EnhancedTokenManager.instance) {
      EnhancedTokenManager.instance = new EnhancedTokenManager();
    }
    return EnhancedTokenManager.instance;
  }

  /**
   * Get access token with comprehensive rate limiting and caching
   */
  async getAccessToken(service: 'inventory' | 'commerce' = 'inventory'): Promise<string> {
    const cacheKey = `zoho_${service}`;
    
    // Check if we need to wait due to rate limiting
    await this.enforceRateLimit(cacheKey);
    
    // Check cache first
    const cachedToken = this.getCachedToken(cacheKey);
    if (cachedToken) {
      this.metrics.cacheHits++;
      if (this.config.enableMetrics) {
        console.log('✓ Using cached Zoho access token', { service, cacheAge: Date.now() - cachedToken.lastRefresh });
      }
      return cachedToken.accessToken;
    }

    // Prevent concurrent refreshes for the same service
    if (this.refreshPromises.has(cacheKey)) {
      console.log('⏳ Waiting for existing token refresh...');
      return await this.refreshPromises.get(cacheKey)!;
    }

    // Start new refresh
    const refreshPromise = this.refreshToken(cacheKey, service);
    this.refreshPromises.set(cacheKey, refreshPromise);

    try {
      const token = await refreshPromise;
      return token;
    } finally {
      this.refreshPromises.delete(cacheKey);
    }
  }

  /**
   * Check cached token validity
   */
  private getCachedToken(cacheKey: string): TokenCacheEntry | null {
    const cached = this.tokenCache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    const bufferTime = this.config.tokenBufferMinutes * 60 * 1000;
    
    // Return token if it's still valid with buffer
    if (now < (cached.expiryTime - bufferTime)) {
      return cached;
    }

    // Token is expired or close to expiry
    return null;
  }

  /**
   * Enforce rate limiting before making requests
   */
  private async enforceRateLimit(cacheKey: string): Promise<void> {
    const now = Date.now();
    let state = this.rateLimitState.get(cacheKey);

    if (!state) {
      state = {
        windowStart: now,
        requestCount: 0,
        lastRequest: 0,
        backoffUntil: 0
      };
      this.rateLimitState.set(cacheKey, state);
    }

    // Check if we're in a backoff period
    if (now < state.backoffUntil) {
      const waitTime = state.backoffUntil - now;
      console.log(`⏳ Rate limit backoff active, waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return;
    }

    // Reset window if needed (1 hour window)
    if (now - state.windowStart > 60 * 60 * 1000) {
      state.windowStart = now;
      state.requestCount = 0;
    }

    // Check if we've exceeded hourly limit
    if (state.requestCount >= this.config.maxRefreshesPerHour) {
      const waitTime = (state.windowStart + 60 * 60 * 1000) - now;
      this.metrics.rateLimitHits++;
      
      console.warn(`🚫 Hourly rate limit reached (${this.config.maxRefreshesPerHour} requests). Waiting ${Math.ceil(waitTime / 60000)} minutes.`);
      
      // Set backoff until window resets
      state.backoffUntil = state.windowStart + 60 * 60 * 1000;
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 60000))); // Wait max 1 minute
      throw new Error('Rate limit exceeded. Please reduce API call frequency.');
    }

    // Update request tracking
    state.requestCount++;
    state.lastRequest = now;
  }

  /**
   * Refresh token with comprehensive error handling
   */
  private async refreshToken(cacheKey: string, service: string): Promise<string> {
    const now = Date.now();
    this.metrics.totalRefreshes++;

    try {
      console.log(`🔄 Refreshing Zoho access token for ${service}...`);

      const requiredVars = ['ZOHO_REFRESH_TOKEN', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET'];
      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
      }

      const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
          client_id: process.env.ZOHO_CLIENT_ID!,
          client_secret: process.env.ZOHO_CLIENT_SECRET!,
          grant_type: 'refresh_token',
        }),
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status} ${responseText}`);
      }

      let tokenData;
      try {
        tokenData = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      if (!tokenData.access_token) {
        throw new Error(`No access token in response: ${JSON.stringify(tokenData)}`);
      }

      // Cache the new token
      const expiresIn = tokenData.expires_in || 3600; // Default 1 hour
      const entry: TokenCacheEntry = {
        accessToken: tokenData.access_token,
        expiryTime: now + (expiresIn * 1000),
        region: 'com',
        lastRefresh: now,
        refreshCount: (this.tokenCache.get(cacheKey)?.refreshCount || 0) + 1,
        failureCount: 0
      };

      this.tokenCache.set(cacheKey, entry);
      this.metrics.successfulRefreshes++;

      if (this.config.enableMetrics) {
        console.log(`✅ Token refreshed successfully for ${service}`, {
          expiresIn: expiresIn,
          refreshCount: entry.refreshCount,
          totalCacheSize: this.tokenCache.size
        });
      }

      return tokenData.access_token;

    } catch (error) {
      this.metrics.failedRefreshes++;
      
      // Handle rate limiting with exponential backoff
      if (error instanceof Error && 
          (error.message.includes('too many requests') || 
           error.message.includes('rate limit') ||
           error.message.includes('429'))) {
        
        const state = this.rateLimitState.get(cacheKey) || {
          windowStart: now,
          requestCount: 0,
          lastRequest: now,
          backoffUntil: 0
        };

        // Exponential backoff for rate limiting
        const backoffTime = Math.min(
          this.config.baseBackoffMs * Math.pow(2, this.metrics.failedRefreshes),
          this.config.maxBackoffMs
        );
        
        state.backoffUntil = now + backoffTime;
        this.rateLimitState.set(cacheKey, state);
        
        console.error(`🚫 Rate limited by Zoho. Backing off for ${Math.ceil(backoffTime / 1000)}s`);
        
        throw new Error(`Rate limited by Zoho API. Please wait ${Math.ceil(backoffTime / 1000)} seconds before retrying.`);
      }

      console.error(`❌ Token refresh failed for ${service}:`, error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear cache for a service (useful for testing or forced refresh)
   */
  clearCache(service?: string): void {
    if (service) {
      const cacheKey = `zoho_${service}`;
      this.tokenCache.delete(cacheKey);
      this.rateLimitState.delete(cacheKey);
      console.log(`🗑️ Cleared cache for ${service}`);
    } else {
      this.tokenCache.clear();
      this.rateLimitState.clear();
      console.log('🗑️ Cleared all token cache');
    }
  }

  /**
   * Get current metrics and status
   */
  getStatus() {
    return {
      metrics: { ...this.metrics },
      cacheSize: this.tokenCache.size,
      activeRateLimits: Array.from(this.rateLimitState.entries()).map(([key, state]) => ({
        service: key,
        requestCount: state.requestCount,
        backoffActive: Date.now() < state.backoffUntil,
        backoffEndsIn: Math.max(0, state.backoffUntil - Date.now())
      })),
      config: this.config
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedTokens = 0;
    let cleanedRateLimit = 0;

    // Clean expired tokens - compatible with older TypeScript targets
    this.tokenCache.forEach((entry, key) => {
      if (now > entry.expiryTime) {
        this.tokenCache.delete(key);
        cleanedTokens++;
      }
    });

    // Clean old rate limit state - compatible with older TypeScript targets
    this.rateLimitState.forEach((state, key) => {
      if (now - state.windowStart > 2 * 60 * 60 * 1000) { // 2 hours old
        this.rateLimitState.delete(key);
        cleanedRateLimit++;
      }
    });

    if ((cleanedTokens > 0 || cleanedRateLimit > 0) && this.config.enableMetrics) {
      console.log(`🧹 Cleanup: removed ${cleanedTokens} expired tokens, ${cleanedRateLimit} old rate limit entries`);
    }
  }

  /**
   * Reset metrics
   */
  private resetMetrics(): void {
    this.metrics = {
      totalRefreshes: 0,
      successfulRefreshes: 0,
      failedRefreshes: 0,
      cacheHits: 0,
      rateLimitHits: 0,
      lastResetTime: Date.now()
    };
    console.log('📊 Metrics reset');
  }
}

// Export singleton instance
export const tokenManager = EnhancedTokenManager.getInstance();

// Export types for other modules
export type { TokenManagerConfig, TokenCacheEntry, RateLimitState };