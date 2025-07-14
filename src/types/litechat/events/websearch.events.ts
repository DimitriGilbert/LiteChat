// src/types/litechat/events/websearch.events.ts

import type { SearchOperation, SearchStep, WebSearchConfig, DeepSearchConfig, SearchResult } from '../websearch';

export const webSearchEvent = {
  // Request events
  searchRequest: "websearch.search.request",
  deepSearchRequest: "websearch.deep.search.request",
  cancelSearchRequest: "websearch.cancel.request",
  
  // Status events
  searchStarted: "websearch.search.started",
  searchCompleted: "websearch.search.completed",
  searchFailed: "websearch.search.failed",
  searchCancelled: "websearch.search.cancelled",
  
  // Progress events
  stepStarted: "websearch.step.started",
  stepCompleted: "websearch.step.completed",
  stepFailed: "websearch.step.failed",
  queryExecuted: "websearch.query.executed",
  resultsSelected: "websearch.results.selected",
  contentExtracted: "websearch.content.extracted",
  contentCondensed: "websearch.content.condensed",
  
  // Configuration events
  configUpdated: "websearch.config.updated",
  workflowSelected: "websearch.workflow.selected",
  
  // Cache events
  cacheHit: "websearch.cache.hit",
  cacheMiss: "websearch.cache.miss",
  cacheCleared: "websearch.cache.cleared",
} as const;

export interface WebSearchEventPayloads {
  [webSearchEvent.searchRequest]: {
    query: string;
    config: WebSearchConfig;
    deepSearchConfig?: DeepSearchConfig;
    conversationId: string;
    workflowId?: string;
  };
  
  [webSearchEvent.deepSearchRequest]: {
    query: string;
    config: WebSearchConfig;
    deepSearchConfig: DeepSearchConfig;
    conversationId: string;
    workflowId?: string;
  };
  
  [webSearchEvent.cancelSearchRequest]: {
    searchId: string;
  };
  
  [webSearchEvent.searchStarted]: {
    searchId: string;
    operation: SearchOperation;
  };
  
  [webSearchEvent.searchCompleted]: {
    searchId: string;
    operation: SearchOperation;
    results: SearchResult[];
    totalTime: number;
  };
  
  [webSearchEvent.searchFailed]: {
    searchId: string;
    operation: SearchOperation;
    error: string;
    step?: string;
  };
  
  [webSearchEvent.searchCancelled]: {
    searchId: string;
    operation: SearchOperation;
  };
  
  [webSearchEvent.stepStarted]: {
    searchId: string;
    step: SearchStep;
    operation: SearchOperation;
  };
  
  [webSearchEvent.stepCompleted]: {
    searchId: string;
    step: SearchStep;
    operation: SearchOperation;
    results?: SearchResult[];
  };
  
  [webSearchEvent.stepFailed]: {
    searchId: string;
    step: SearchStep;
    operation: SearchOperation;
    error: string;
  };
  
  [webSearchEvent.queryExecuted]: {
    searchId: string;
    stepId: string;
    query: string;
    results: SearchResult[];
    duration: number;
  };
  
  [webSearchEvent.resultsSelected]: {
    searchId: string;
    stepId: string;
    originalResults: SearchResult[];
    selectedResults: SearchResult[];
    selectionReasoning?: string;
  };
  
  [webSearchEvent.contentExtracted]: {
    searchId: string;
    stepId: string;
    url: string;
    content: string;
    success: boolean;
    error?: string;
  };
  
  [webSearchEvent.contentCondensed]: {
    searchId: string;
    stepId: string;
    originalContent: string;
    condensedContent: string;
    compressionRatio: number;
  };
  
  [webSearchEvent.configUpdated]: {
    oldConfig: WebSearchConfig;
    newConfig: WebSearchConfig;
    changedFields: string[];
  };
  
  [webSearchEvent.workflowSelected]: {
    workflowId: string;
    workflowName: string;
  };
  
  [webSearchEvent.cacheHit]: {
    query: string;
    cacheKey: string;
    resultCount: number;
  };
  
  [webSearchEvent.cacheMiss]: {
    query: string;
    cacheKey: string;
  };
  
  [webSearchEvent.cacheCleared]: {
    clearedCount: number;
    reason: 'manual' | 'ttl' | 'size_limit';
  };
}

// Type helper for event emission
export type WebSearchEventName = keyof WebSearchEventPayloads;
export type WebSearchEventPayload<T extends WebSearchEventName> = WebSearchEventPayloads[T];