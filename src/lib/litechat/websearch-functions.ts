// src/lib/litechat/websearch-functions.ts

/**
 * JavaScript functions for websearch workflow steps
 * These functions are executed within workflow steps to perform web searches and content extraction
 */

export const websearchFunctions = {
  /**
   * Execute web searches for multiple queries
   */
  executeWebSearch: `
async function executeWebSearch(context) {
  const { queries } = context.input;
  const config = context.workflow.templateVariables || {};
  const results = [];
  
  // Import WebSearchService dynamically
  const { WebSearchService } = await import('/src/services/websearch.service.ts');
  
  for (const query of queries) {
    try {
      const searchResults = await WebSearchService.searchWeb(query, {
        maxResults: config.maxResults || 5,
        enableImages: config.enableImageSearch || false,
        region: config.region || 'us-en',
        safeSearch: config.safeSearch || 'moderate',
        timeRange: config.timeRange
      });
      
      results.push({
        query,
        results: searchResults,
        timestamp: new Date().toISOString(),
        success: true
      });
      
      // Rate limiting
      if (config.delayBetweenRequests > 0) {
        await new Promise(resolve => setTimeout(resolve, config.delayBetweenRequests || 1000));
      }
    } catch (error) {
      results.push({
        query,
        error: error.message,
        timestamp: new Date().toISOString(),
        success: false
      });
    }
  }
  
  return { searchResults: results };
}`,

  /**
   * Extract content from selected web pages
   */
  extractWebContent: `
async function extractWebContent(context) {
  const { selectedResults } = context.input;
  const config = context.workflow.templateVariables || {};
  const extractedContent = [];
  
  // Import WebSearchService dynamically
  const { WebSearchService } = await import('/src/services/websearch.service.ts');
  
  for (const result of selectedResults) {
    try {
      const content = await WebSearchService.extractPageContent(result.source);
      
      // Truncate if too long
      const truncatedContent = config.maxContentLength && content.length > config.maxContentLength
        ? content.substring(0, config.maxContentLength) + "..."
        : content;
      
      extractedContent.push({
        ...result,
        content: truncatedContent,
        extractedAt: new Date().toISOString(),
        success: true
      });
      
      // Rate limiting
      if (config.delayBetweenRequests > 0) {
        await new Promise(resolve => setTimeout(resolve, config.delayBetweenRequests || 1000));
      }
    } catch (error) {
      extractedContent.push({
        ...result,
        content: \`Error extracting content: \${error.message}\`,
        extractedAt: new Date().toISOString(),
        success: false,
        error: error.message
      });
    }
  }
  
  return { extractedContent };
}`,

  /**
   * Execute deep search for multiple avenues
   */
  executeDeepSearch: `
async function executeDeepSearch(context) {
  const { avenues } = context.input;
  const config = context.workflow.templateVariables || {};
  const deepResults = [];
  
  // Import WebSearchService dynamically
  const { WebSearchService } = await import('/src/services/websearch.service.ts');
  
  for (const avenue of avenues) {
    const avenueResults = {
      direction: avenue.direction,
      reasoning: avenue.reasoning,
      searches: [],
      success: true
    };
    
    for (const query of avenue.queries) {
      try {
        const searchResults = await WebSearchService.searchWeb(query, {
          maxResults: Math.floor(config.maxResults / 2) || 3,
          enableImages: false,
          region: config.region || 'us-en',
          safeSearch: config.safeSearch || 'moderate',
          timeRange: config.timeRange
        });
        
        avenueResults.searches.push({
          query,
          results: searchResults,
          timestamp: new Date().toISOString(),
          success: true
        });
        
        // Rate limiting
        if (config.delayBetweenRequests > 0) {
          await new Promise(resolve => setTimeout(resolve, config.delayBetweenRequests || 1000));
        }
      } catch (error) {
        avenueResults.searches.push({
          query,
          error: error.message,
          timestamp: new Date().toISOString(),
          success: false
        });
        avenueResults.success = false;
      }
    }
    
    deepResults.push(avenueResults);
  }
  
  return { deepSearchResults: deepResults };
}`,

  /**
   * Process and filter search results
   */
  processSearchResults: `
async function processSearchResults(context) {
  const { searchResults } = context.input;
  const config = context.workflow.templateVariables || {};
  
  // Import WebSearchService dynamically
  const { WebSearchService } = await import('/src/services/websearch.service.ts');
  
  let allResults = [];
  
  // Flatten all search results
  for (const searchResult of searchResults) {
    if (searchResult.success && searchResult.results) {
      allResults.push(...searchResult.results.map(r => ({
        ...r,
        sourceQuery: searchResult.query
      })));
    }
  }
  
  // Remove duplicates
  const deduplicatedResults = WebSearchService.deduplicateResults(allResults);
  
  // Filter by relevance if original query is available
  let filteredResults = deduplicatedResults;
  if (context.workflow.triggerPrompt) {
    filteredResults = WebSearchService.filterResultsByRelevance(
      deduplicatedResults, 
      context.workflow.triggerPrompt,
      0.3 // relevance threshold
    );
  }
  
  // Limit to max results
  const maxResults = config.maxResults || 10;
  const finalResults = filteredResults.slice(0, maxResults);
  
  return {
    processedResults: finalResults,
    totalFound: allResults.length,
    afterDeduplication: deduplicatedResults.length,
    afterFiltering: filteredResults.length,
    finalCount: finalResults.length
  };
}`,

  /**
   * Batch extract content from multiple URLs
   */
  batchExtractContent: `
async function batchExtractContent(context) {
  const { urls } = context.input;
  const config = context.workflow.templateVariables || {};
  
  // Import WebSearchService dynamically
  const { WebSearchService } = await import('/src/services/websearch.service.ts');
  
  const extractedContent = await WebSearchService.batchExtractContent(
    urls,
    config.delayBetweenRequests || 1000
  );
  
  // Process and truncate content if needed
  const processedContent = extractedContent.map(item => {
    if (item.content && config.maxContentLength && item.content.length > config.maxContentLength) {
      return {
        ...item,
        content: item.content.substring(0, config.maxContentLength) + "...",
        truncated: true
      };
    }
    return { ...item, truncated: false };
  });
  
  return { 
    extractedContent: processedContent,
    successCount: processedContent.filter(item => !item.error).length,
    errorCount: processedContent.filter(item => item.error).length
  };
}`,

  /**
   * Assess quality of search results
   */
  assessResultQuality: `
async function assessResultQuality(context) {
  const { results } = context.input;
  const originalQuery = context.workflow.triggerPrompt || '';
  
  // Import WebSearchService dynamically
  const { WebSearchService } = await import('/src/services/websearch.service.ts');
  
  const assessedResults = results.map(result => {
    const qualityMetrics = WebSearchService.assessResultQuality(result, originalQuery);
    return {
      ...result,
      qualityMetrics
    };
  });
  
  // Sort by overall quality score
  const sortedResults = assessedResults.sort((a, b) => 
    (b.qualityMetrics?.overallScore || 0) - (a.qualityMetrics?.overallScore || 0)
  );
  
  return {
    assessedResults: sortedResults,
    averageQuality: sortedResults.reduce((sum, r) => sum + (r.qualityMetrics?.overallScore || 0), 0) / sortedResults.length,
    highQualityCount: sortedResults.filter(r => (r.qualityMetrics?.overallScore || 0) > 0.7).length
  };
}`,

  /**
   * Generate search summary
   */
  generateSearchSummary: `
async function generateSearchSummary(context) {
  const { searchResults, extractedContent } = context.input;
  const config = context.workflow.templateVariables || {};
  
  const summary = {
    totalQueries: searchResults?.length || 0,
    successfulQueries: searchResults?.filter(r => r.success)?.length || 0,
    totalResults: 0,
    extractedPages: extractedContent?.length || 0,
    successfulExtractions: extractedContent?.filter(c => c.success)?.length || 0,
    timestamp: new Date().toISOString(),
    configuration: {
      maxResults: config.maxResults,
      searchDepth: config.searchDepth,
      enableImageSearch: config.enableImageSearch,
      condensationEnabled: config.condensationEnabled,
      region: config.region,
      safeSearch: config.safeSearch
    }
  };
  
  // Count total results
  if (searchResults) {
    summary.totalResults = searchResults.reduce((total, result) => {
      return total + (result.results?.length || 0);
    }, 0);
  }
  
  // Generate performance metrics
  const performance = {
    averageResultsPerQuery: summary.totalResults / Math.max(summary.totalQueries, 1),
    successRate: summary.successfulQueries / Math.max(summary.totalQueries, 1),
    extractionSuccessRate: summary.successfulExtractions / Math.max(summary.extractedPages, 1)
  };
  
  return {
    searchSummary: summary,
    performance
  };
}`
};

// Export individual functions for easier access
export const {
  executeWebSearch,
  extractWebContent,
  executeDeepSearch,
  processSearchResults,
  batchExtractContent,
  assessResultQuality,
  generateSearchSummary
} = websearchFunctions;