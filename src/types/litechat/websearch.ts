// src/types/litechat/websearch.ts

export interface SearchResult {
  title: string;
  source: string;
  publishedDate?: string;
  author?: string;
  image?: string;
  favicon?: string;
  content?: string; // Extracted markdown content
  relevanceScore?: number;
  snippet?: string; // Short excerpt from search results
}

export interface WebSearchOptions {
  maxResults?: number;
  enableImages?: boolean;
  region?: string;
  safeSearch?: 'strict' | 'moderate' | 'off';
  timeRange?: 'day' | 'week' | 'month' | 'year';
}

export interface ImageSearchOptions extends WebSearchOptions {
  size?: 'small' | 'medium' | 'large';
  color?: 'color' | 'monochrome' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'brown' | 'black' | 'gray' | 'teal' | 'white';
  type?: 'photo' | 'clipart' | 'gif' | 'transparent' | 'line';
  layout?: 'square' | 'wide' | 'tall';
  license?: 'any' | 'public' | 'share' | 'sharecommercially' | 'modify';
}

export interface BatchSearchOptions extends WebSearchOptions {
  delayBetweenRequests?: number;
  maxConcurrent?: number;
}

export interface BatchSearchResult {
  query: string;
  results?: SearchResult[];
  error?: string;
  timestamp: string;
}

export interface WebSearchConfig {
  maxResults: number;
  searchDepth: number;
  enableImageSearch: boolean;
  condensationEnabled: boolean;
  condensationModelId?: string;
  selectionModelId?: string;
  queryGenerationModelId?: string;
  delayBetweenRequests: number;
  maxContentLength: number;
  persistAcrossSubmissions?: boolean;
  region?: string;
  safeSearch?: 'strict' | 'moderate' | 'off';
  timeRange?: 'day' | 'week' | 'month' | 'year';
}

export interface SearchStep {
  id: string;
  query: string;
  results: SearchResult[];
  selectedResults: SearchResult[];
  condensedContent?: string;
  timestamp: string;
  status: 'pending' | 'searching' | 'selecting' | 'extracting' | 'condensing' | 'completed' | 'failed';
  error?: string;
}

export interface DeepSearchConfig {
  enabled: boolean;
  maxDepth: number;
  avenuesPerDepth: number;
  avenueSelectorModelId?: string;
}

export interface SearchAvenue {
  direction: string;
  queries: string[];
  reasoning: string;
  priority?: number;
}

export interface SearchOperation {
  id: string;
  conversationId: string;
  originalQuery: string;
  config: WebSearchConfig;
  deepSearchConfig?: DeepSearchConfig;
  steps: SearchStep[];
  currentStep?: string;
  status: 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  totalResults: number;
  selectedWorkflow: string;
  error?: string;
}

export interface ContentExtractionResult {
  url: string;
  content: string;
  title?: string;
  author?: string;
  publishedDate?: string;
  extractedAt: string;
  error?: string;
}

export interface SearchQualityMetrics {
  relevanceScore: number;
  credibilityScore: number;
  freshnessScore: number;
  uniquenessScore: number;
  overallScore: number;
}

export interface CachedSearchResult {
  query: string;
  results: SearchResult[];
  timestamp: string;
  ttl: number;
  config: WebSearchOptions;
}

export interface WebSearchState {
  activeSearches: Map<string, SearchOperation>;
  searchHistory: SearchOperation[];
  cachedResults: Map<string, CachedSearchResult>;
  defaultConfig: WebSearchConfig;
  availableWorkflows: string[];
}

export interface WebSearchActions {
  startSearch: (query: string, config: WebSearchConfig) => Promise<string>;
  cancelSearch: (searchId: string) => void;
  updateSearchStep: (searchId: string, stepId: string, update: Partial<SearchStep>) => void;
  completeSearch: (searchId: string, results: SearchResult[]) => void;
  failSearch: (searchId: string, error: string) => void;
  updateConfig: (config: Partial<WebSearchConfig>) => void;
  clearHistory: () => void;
  clearCache: () => void;
}