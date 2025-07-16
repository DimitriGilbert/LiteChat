// src/controls/modules/WebSearchToolsModule.ts

import { z } from "zod";
import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import { Tool } from "ai";
import { WebSearchService } from "@/services/websearch.service";

// Schemas for websearch tools
const webSearchSchema = z.object({
  query: z.string().describe("Search query to execute"),
  maxResults: z.number().optional().default(10).describe("Maximum number of results to return"),
});

const webSearchMultipleSchema = z.object({
  queries: z.array(z.string()).describe("Array of search queries to execute"),
  maxResults: z.number().optional().default(10).describe("Maximum number of results per query"),
});

const webExtractContentSchema = z.object({
  urls: z.array(z.string()).describe("Array of URLs to extract content from"),
  maxContentLength: z.number().optional().default(5000).describe("Maximum content length per URL"),
});

const webSearchAvenuesSchema = z.object({
  avenues: z.array(z.object({
    direction: z.string().describe("Research direction or focus area"),
    queries: z.array(z.string()).describe("Search queries for this avenue"),
    reasoning: z.string().describe("Why this avenue is valuable")
  })).describe("Array of research avenues with their queries"),
  maxResults: z.number().optional().default(3).describe("Maximum results per query"),
});

export class WebSearchToolsModule implements ControlModule {
  public readonly id = "websearch-tools";
  private unregisterCallbacks: (() => void)[] = [];

  async initialize(): Promise<void> {
    // Module initialization if needed
  }

  register(modApi: LiteChatModApi): void {
    // Web Search Tool
    const webSearchTool: Tool<any> = {
      description: "Search the web for information using a search query",
      inputSchema: webSearchSchema,
    };

    this.unregisterCallbacks.push(
      modApi.registerTool(
        "webSearch",
        webSearchTool,
        async ({ query, maxResults }: z.infer<typeof webSearchSchema>) => {
          try {
            const results = await WebSearchService.searchWeb(query, { maxResults });
            
            return {
              success: true,
              query,
              results: results.map((result: any) => ({
                title: result.title,
                url: result.source,
                snippet: result.snippet,
                source: result.source || "web"
              }))
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Web search failed: ${error.message}`
            };
          }
        }
      )
    );

    // Multiple Web Search Tool
    const webSearchMultipleTool: Tool<any> = {
      description: "Execute multiple web searches simultaneously",
      inputSchema: webSearchMultipleSchema,
    };

    this.unregisterCallbacks.push(
      modApi.registerTool(
        "webSearchMultiple",
        webSearchMultipleTool,
        async ({ queries, maxResults }: z.infer<typeof webSearchMultipleSchema>) => {
          try {
            const searchPromises = queries.map(query => 
              WebSearchService.searchWeb(query, { maxResults })
            );
            
            const allResults = await Promise.all(searchPromises);
            
            return {
              success: true,
              searches: queries.map((query, index) => ({
                query,
                results: allResults[index].map((result: any) => ({
                  title: result.title,
                  url: result.source,
                  snippet: result.snippet,
                  source: result.source || "web"
                }))
              }))
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Multiple web search failed: ${error.message}`
            };
          }
        }
      )
    );

    // Web Content Extraction Tool
    const webExtractContentTool: Tool<any> = {
      description: "Extract content from web pages given their URLs",
      inputSchema: webExtractContentSchema,
    };

    this.unregisterCallbacks.push(
      modApi.registerTool(
        "webExtractContent",
        webExtractContentTool,
        async ({ urls, maxContentLength }: z.infer<typeof webExtractContentSchema>) => {
          try {
            const extractPromises = urls.map(url => 
              WebSearchService.extractPageContent(url)
            );
            
            const allContent = await Promise.all(extractPromises);
            
            return {
              success: true,
              extractions: urls.map((url, index) => {
                let content = allContent[index] || "";
                // Truncate content if it exceeds maxContentLength
                if (content.length > maxContentLength) {
                  content = content.substring(0, maxContentLength) + "...";
                }
                return {
                  url,
                  content,
                  contentLength: content.length
                };
              })
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Content extraction failed: ${error.message}`
            };
          }
        }
      )
    );

    // Deep Search Avenues Tool
    const webSearchAvenuesTool: Tool<any> = {
      description: "Execute searches for multiple research avenues with multiple queries each",
      inputSchema: webSearchAvenuesSchema,
    };

    this.unregisterCallbacks.push(
      modApi.registerTool(
        "webSearchAvenues",
        webSearchAvenuesTool,
        async ({ avenues, maxResults }: z.infer<typeof webSearchAvenuesSchema>) => {
          try {
            const deepResults = [];
            
            for (const avenue of avenues) {
              const avenueResults = {
                direction: avenue.direction,
                reasoning: avenue.reasoning,
                searches: [] as any[]
              };
              
              for (const query of avenue.queries) {
                try {
                  const searchResults = await WebSearchService.searchWeb(query, { maxResults });
                  avenueResults.searches.push({
                    query,
                    results: searchResults.map((result: any) => ({
                      title: result.title,
                      url: result.source,
                      snippet: result.snippet,
                      source: result.source || "web"
                    })),
                    timestamp: new Date().toISOString()
                  });
                } catch (error: any) {
                  avenueResults.searches.push({
                    query,
                    error: error.message,
                    timestamp: new Date().toISOString()
                  });
                }
              }
              
              deepResults.push(avenueResults);
            }
            
            return {
              success: true,
              deepSearchResults: deepResults
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Deep search failed: ${error.message}`
            };
          }
        }
      )
    );
  }

  destroy(): void {
    // Unregister all tools
    this.unregisterCallbacks.forEach(callback => callback());
    this.unregisterCallbacks = [];
  }
}