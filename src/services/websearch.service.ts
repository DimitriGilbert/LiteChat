// src/services/websearch.service.ts

import type {
  SearchResult,
  WebSearchOptions,
  ImageSearchOptions,
  BatchSearchOptions,
  BatchSearchResult,
  ContentExtractionResult,
  CachedSearchResult,
  SearchQualityMetrics
} from '../types/litechat/websearch';
import { load } from 'cheerio';

export class WebSearchService {
  private static readonly URL_TO_MARKDOWN_SERVICE = 'https://urltomarkdown.herokuapp.com/';
  private static readonly DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  
  private static cache = new Map<string, CachedSearchResult>();
  private static readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private static readonly MAX_CACHE_SIZE = 100;

  /**
   * Search the web using DuckDuckGo
   */
  static async searchWeb(query: string, options: WebSearchOptions = {}): Promise<SearchResult[]> {
    const cacheKey = this.generateCacheKey(query, options);
    const cached = this.getCachedResult(cacheKey);
    
    if (cached) {
      return cached.results;
    }

    try {
      const results = await this.performDuckDuckGoSearch(query, options);
      this.setCachedResult(cacheKey, { query, results, timestamp: new Date().toISOString(), ttl: this.CACHE_TTL, config: options });
      return results;
    } catch (error) {
      console.error('Web search failed:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for images using DuckDuckGo
   */
  static async searchImages(query: string, options: ImageSearchOptions = {}): Promise<SearchResult[]> {
    const cacheKey = this.generateCacheKey(`img:${query}`, options);
    const cached = this.getCachedResult(cacheKey);
    
    if (cached) {
      return cached.results;
    }

    try {
      const results = await this.performDuckDuckGoImageSearch(query, options);
      this.setCachedResult(cacheKey, { query, results, timestamp: new Date().toISOString(), ttl: this.CACHE_TTL, config: options });
      return results;
    } catch (error) {
      console.error('Image search failed:', error);
      throw new Error(`Image search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform batch searches with rate limiting
   */
  static async batchSearch(queries: string[], options: BatchSearchOptions = {}): Promise<BatchSearchResult[]> {
    const { delayBetweenRequests = 1000, maxConcurrent = 3, ...searchOptions } = options;
    const results: BatchSearchResult[] = [];
    
    // Process queries in batches to respect rate limits
    for (let i = 0; i < queries.length; i += maxConcurrent) {
      const batch = queries.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (query) => {
        try {
          const searchResults = await this.searchWeb(query, searchOptions);
          return {
            query,
            results: searchResults,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          return {
            query,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches (except for the last batch)
      if (i + maxConcurrent < queries.length && delayBetweenRequests > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    }

    return results;
  }

  /**
   * Extract page content as markdown
   */
  static async extractPageContent(url: string): Promise<string> {
    try {
      const response = await fetch(`${this.URL_TO_MARKDOWN_SERVICE}?url=${encodeURIComponent(url)}`, {
        method: 'GET',
        headers: {
          'User-Agent': this.DEFAULT_USER_AGENT,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      return content || `Failed to extract content from ${url}`;
    } catch (error) {
      console.error(`Content extraction failed for ${url}:`, error);
      throw new Error(`Content extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract content from multiple URLs with rate limiting
   */
  static async batchExtractContent(urls: string[], delayBetweenRequests = 1000): Promise<ContentExtractionResult[]> {
    const results: ContentExtractionResult[] = [];

    for (const url of urls) {
      try {
        const content = await this.extractPageContent(url);
        results.push({
          url,
          content,
          extractedAt: new Date().toISOString()
        });
      } catch (error) {
        results.push({
          url,
          content: '',
          error: error instanceof Error ? error.message : 'Unknown error',
          extractedAt: new Date().toISOString()
        });
      }

      // Rate limiting
      if (delayBetweenRequests > 0 && url !== urls[urls.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    }

    return results;
  }

  /**
   * Remove duplicate results based on URL and content similarity
   */
  static deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const deduplicated: SearchResult[] = [];

    for (const result of results) {
      const key = this.generateDeduplicationKey(result);
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }

  /**
   * Filter results by relevance to the original query
   */
  static filterResultsByRelevance(results: SearchResult[], query: string, threshold = 0.3): SearchResult[] {
    return results
      .map(result => ({
        ...result,
        relevanceScore: this.calculateRelevanceScore(result, query)
      }))
      .filter(result => (result.relevanceScore || 0) >= threshold)
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * Assess the quality of search results
   */
  static assessResultQuality(result: SearchResult, query: string): SearchQualityMetrics {
    const relevanceScore = this.calculateRelevanceScore(result, query);
    const credibilityScore = this.calculateCredibilityScore(result);
    const freshnessScore = this.calculateFreshnessScore(result);
    const uniquenessScore = 0.8; // Placeholder - would need comparison with other results

    const overallScore = (relevanceScore * 0.4) + (credibilityScore * 0.3) + (freshnessScore * 0.2) + (uniquenessScore * 0.1);

    return {
      relevanceScore,
      credibilityScore,
      freshnessScore,
      uniquenessScore,
      overallScore
    };
  }

  /**
   * Clear the search cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE
    };
  }

  // Private helper methods

  private static async performDuckDuckGoSearch(query: string, options: WebSearchOptions): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query });
    const corsProxy = 'https://api.cors.lol/?url=';
    const targetUrl = `https://duckduckgo.com/html?${params}`;
    const response = await fetch(`${corsProxy}${encodeURIComponent(targetUrl)}`, {
      headers: {
        "User-Agent": this.DEFAULT_USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`HTML fetch failed: ${response.status}`);
    }

    const html = await response.text();
    return this.parseDuckDuckGoHtmlResults(html, options.maxResults || 10);
  }

  private static async performDuckDuckGoImageSearch(query: string, options: ImageSearchOptions): Promise<SearchResult[]> {
    // First get HTML page to extract vqd token
    const params = new URLSearchParams({ q: query });
    const corsProxy = 'https://api.cors.lol/?url=';
    const targetUrl = `https://duckduckgo.com/html?${params}`;
    const html = await fetch(`${corsProxy}${encodeURIComponent(targetUrl)}`, {
      headers: {
        "User-Agent": this.DEFAULT_USER_AGENT,
      },
    });
    
    if (!html.ok) {
      throw new Error(`HTML fetch failed: ${html.status}`);
    }
    
    const htmlText = await html.text();
    const vqd = this.extractVqd(htmlText);
    
    if (!vqd) {
      throw new Error('Failed to extract vqd token');
    }

    // Now search images using i.js API
    const imageParams = new URLSearchParams({ q: query, vqd, l: 'us-en' });
    const imageUrl = `https://duckduckgo.com/i.js?${imageParams}`;
    const imageResponse = await fetch(`${corsProxy}${encodeURIComponent(imageUrl)}`, {
      headers: {
        "User-Agent": this.DEFAULT_USER_AGENT,
      },
    });

    if (!imageResponse.ok) {
      throw new Error(`Image search failed: ${imageResponse.status}`);
    }

    const json = await imageResponse.json();
    return this.parseDuckDuckGoImageResults(json, options.maxResults || 10);
  }

  private static extractVqd(html: string): string | null {
    const $ = load(html);
    const vqd = $('input[name="vqd"]').attr("value");
    return vqd || null;
  }

  private static parseDuckDuckGoHtmlResults(html: string, maxResults: number): SearchResult[] {
    try {
      const $ = load(html);
      const results: SearchResult[] = [];
      
      $(".result__body").each((index, element) => {
        if (index >= maxResults) return false;
        
        const $el = $(element);
        const title = $el.find(".result__title .result__a").text().trim();

        // Extract and unpack redirect URL
        const rawHref = $el.find(".result__title .result__a").attr("href") || "";
        let source = rawHref;
        try {
          const wrap = new URL(rawHref, "https://duckduckgo.com");
          source = wrap.searchParams.get("uddg") || wrap.href;
        } catch {
          // leave source = rawHref
        }

        const publishedDate = $el.find(".result__extras span").text().trim() || undefined;
        const snippet = $el.find(".result__snippet").text().trim() || undefined;

        let favicon = $el.find(".result__icon__img").attr("src") || undefined;
        if (favicon?.startsWith("//")) favicon = "https:" + favicon;

        if (title && source) {
          results.push({
            title,
            source,
            snippet,
            publishedDate,
            favicon,
            author: undefined,
            image: undefined,
          });
        }
      });
      
      return results;
    } catch (error) {
      console.error('Failed to parse DuckDuckGo HTML results:', error);
      return [];
    }
  }

  private static parseDuckDuckGoImageResults(json: any, maxResults: number): SearchResult[] {
    try {
      const arr: any[] = json.results ?? json;
      const results: SearchResult[] = [];

      for (const item of arr.slice(0, maxResults)) {
        const title = item.title || "";

        // Prefer page URL, else fallback to image origin
        let source = item.url || "";
        if (!source && item.image) {
          try {
            source = new URL(item.image).origin;
          } catch {
            source = "";
          }
        }

        // The direct image URL
        let image = item.image || item.thumbnail;
        if (image?.startsWith("//")) image = "https:" + image;
        else if (image?.startsWith("/") && source) {
          image = new URL(image, source).href;
        }

        const favicon = source
          ? `https://external-content.duckduckgo.com/ip3/${new URL(source).host}.ico`
          : undefined;

        if (title && source) {
          results.push({
            title,
            source,
            publishedDate: undefined,
            author: undefined,
            image,
            favicon,
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('Failed to parse DuckDuckGo image results:', error);
      return [];
    }
  }



  private static generateCacheKey(query: string, options: WebSearchOptions | ImageSearchOptions): string {
    return `${query}:${JSON.stringify(options)}`;
  }

  private static getCachedResult(key: string): CachedSearchResult | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - new Date(cached.timestamp).getTime() < cached.ttl) {
      return cached;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private static setCachedResult(key: string, result: CachedSearchResult): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, result);
  }

  private static generateDeduplicationKey(result: SearchResult): string {
    // Use URL as primary key, fallback to title + source
    return result.source || `${result.title}:${result.source}`;
  }

  private static calculateRelevanceScore(result: SearchResult, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    
    let score = 0;
    let totalTerms = queryTerms.length;
    
    for (const term of queryTerms) {
      if (title.includes(term)) score += 0.6;
      if (snippet.includes(term)) score += 0.4;
    }
    
    return Math.min(score / totalTerms, 1.0);
  }

  private static calculateCredibilityScore(result: SearchResult): number {
    const url = result.source || '';
    let score = 0.5; // Base score
    
    // Domain-based scoring
    if (url.includes('.edu')) score += 0.3;
    else if (url.includes('.gov')) score += 0.4;
    else if (url.includes('.org')) score += 0.2;
    else if (url.includes('wikipedia.org')) score += 0.3;
    
    // HTTPS bonus
    if (url.startsWith('https://')) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private static calculateFreshnessScore(result: SearchResult): number {
    if (!result.publishedDate) return 0.5; // Neutral score for unknown dates
    
    const publishedTime = new Date(result.publishedDate).getTime();
    const now = Date.now();
    const daysSincePublished = (now - publishedTime) / (1000 * 60 * 60 * 24);
    
    // Fresher content gets higher scores
    if (daysSincePublished <= 1) return 1.0;
    if (daysSincePublished <= 7) return 0.9;
    if (daysSincePublished <= 30) return 0.7;
    if (daysSincePublished <= 90) return 0.5;
    if (daysSincePublished <= 365) return 0.3;
    
    return 0.1; // Very old content
  }
}