// src/lib/litechat/websearch-prompt-templates.ts

import type { PromptTemplate } from '@/types/litechat/prompt-template';

export const websearchPromptTemplates: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: "Web Search Query Generator",
    description: "Generates targeted search queries for web search based on user input",
    type: "prompt",
    isPublic: true,
    isShortcut: false,
    tags: ["websearch", "query-generation", "search"],
    variables: [
      {
        name: "userQuery",
        description: "The original user query to generate search queries for",
        type: "string",
        required: true,
        instructions: "The user's original question or request"
      },
      {
        name: "maxQueries",
        description: "Maximum number of search queries to generate",
        type: "number",
        required: true,
        default: 3,
        instructions: "Number between 1 and 10"
      }
    ],
    prompt: `Given the following user query, generate {{maxQueries}} specific, targeted search queries that will help gather comprehensive information to answer the user's question.

User Query: {{userQuery}}

Requirements:
- Each query should target a different aspect or angle of the topic
- Use specific, searchable terms that are likely to return relevant results
- Avoid overly broad or vague queries
- Consider different perspectives, sources, and contexts
- Focus on factual, informative content
- Use keywords that search engines can effectively match

Generate queries that will help provide a complete and accurate answer to the user's question.

Output the queries as a JSON array of strings.`,
    structuredOutput: {
      schema: { queries: "array" },
      jsonSchema: {
        type: "object",
        properties: {
          queries: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 10
          }
        },
        required: ["queries"]
      }
    }
  },
  
  {
    name: "Web Search Result Selector",
    description: "Selects the most relevant search results based on the original query",
    type: "prompt",
    isPublic: true,
    isShortcut: false,
    tags: ["websearch", "result-selection", "filtering"],
    variables: [
      {
        name: "originalQuery",
        description: "The original user query",
        type: "string",
        required: true,
        instructions: "The user's original question or request"
      },
      {
        name: "results",
        description: "Search results from web search",
        type: "string",
        required: true,
        instructions: "JSON string containing search results with titles, sources, and snippets"
      },
      {
        name: "maxResults",
        description: "Maximum number of results to select",
        type: "number",
        required: true,
        default: 5,
        instructions: "Number between 1 and 20"
      }
    ],
    prompt: `Given the following search results and the original user query, select the {{maxResults}} most relevant and useful results.

Original Query: {{originalQuery}}

Search Results:
{{results}}

Selection Criteria:
1. **Relevance**: How well does the result address the original query?
2. **Credibility**: Is the source trustworthy and authoritative?
3. **Recency**: Is the information current and up-to-date (when applicable)?
4. **Uniqueness**: Does it provide unique information not covered by other results?
5. **Completeness**: Does it provide comprehensive information on the topic?

For each selected result, provide:
- The query it came from
- The index/position in the original results
- The title and source
- Brief reasoning for why this result was selected

Focus on results that will collectively provide the most comprehensive answer to the user's question.`,
    structuredOutput: {
      schema: { selectedResults: "array" },
      jsonSchema: {
        type: "object",
        properties: {
          selectedResults: {
            type: "array",
            items: {
              type: "object",
              properties: {
                query: { type: "string" },
                index: { type: "number" },
                title: { type: "string" },
                source: { type: "string" },
                reasoning: { type: "string" }
              },
              required: ["query", "index", "title", "source", "reasoning"]
            },
            minItems: 1,
            maxItems: 20
          }
        },
        required: ["selectedResults"]
      }
    }
  },
  
  {
    name: "Web Search Content Condenser",
    description: "Condenses extracted web content into a comprehensive summary",
    type: "prompt",
    isPublic: true,
    isShortcut: false,
    tags: ["websearch", "content-condensation", "summarization"],
    variables: [
      {
        name: "originalQuery",
        description: "The original user query",
        type: "string",
        required: true,
        instructions: "The user's original question or request"
      },
      {
        name: "content",
        description: "Extracted web content from selected results",
        type: "string",
        required: true,
        instructions: "JSON string containing extracted content from web pages"
      },
      {
        name: "enableCondensation",
        description: "Whether to condense the content or return it as-is",
        type: "boolean",
        required: false,
        default: true,
        instructions: "Set to false to skip condensation"
      }
    ],
    prompt: `{{#if enableCondensation}}
Given the following extracted web content and the original user query, create a comprehensive but concise summary that directly addresses the user's question.

Original Query: {{originalQuery}}

Extracted Content:
{{content}}

Requirements:
- Focus on information directly relevant to the query
- Maintain factual accuracy and cite sources when making specific claims
- Organize information logically with clear structure
- Remove redundant or irrelevant details while preserving important context
- Synthesize information from multiple sources when they complement each other
- Note any contradictions or conflicting information between sources
- Preserve important nuances and caveats
- Use clear, accessible language

Provide a well-structured response that synthesizes the information to answer the user's question comprehensively.
{{else}}
Based on the extracted content, here is the information gathered from web search:

{{content}}

This content has been extracted from web sources to help answer your query: {{originalQuery}}
{{/if}}`,
    structuredOutput: undefined
  },
  
  {
    name: "Deep Search Avenue Identifier",
    description: "Identifies specific research avenues for deeper investigation",
    type: "prompt",
    isPublic: true,
    isShortcut: false,
    tags: ["websearch", "deep-search", "research-planning"],
    variables: [
      {
        name: "originalQuery",
        description: "The original user query",
        type: "string",
        required: true,
        instructions: "The user's original question or request"
      },
      {
        name: "initialResults",
        description: "Summary of initial search results",
        type: "string",
        required: true,
        instructions: "JSON string containing initial search results and extracted content"
      },
      {
        name: "maxAvenues",
        description: "Maximum number of research avenues to identify",
        type: "number",
        required: true,
        default: 3,
        instructions: "Number between 1 and 5"
      }
    ],
    prompt: `Based on the initial search results and the original query, identify {{maxAvenues}} specific research avenues that would provide deeper, more comprehensive information.

Original Query: {{originalQuery}}

Initial Search Results Summary:
{{initialResults}}

Analysis Instructions:
1. **Identify Gaps**: What important aspects of the query weren't fully covered?
2. **Find Specializations**: What specific sub-topics or specialized areas need deeper investigation?
3. **Consider Perspectives**: What different viewpoints or approaches should be explored?
4. **Look for Context**: What background information or related topics would enhance understanding?

For each research avenue, provide:
1. **Direction**: A clear, specific research direction or focus area
2. **Queries**: 2-3 targeted search queries for that direction
3. **Reasoning**: Brief explanation of why this avenue is valuable and what it will add

Focus on areas that will significantly enhance the comprehensiveness and depth of the final answer.`,
    structuredOutput: {
      schema: { avenues: "array" },
      jsonSchema: {
        type: "object",
        properties: {
          avenues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                direction: { type: "string" },
                queries: { 
                  type: "array", 
                  items: { type: "string" },
                  minItems: 1,
                  maxItems: 5
                },
                reasoning: { type: "string" }
              },
              required: ["direction", "queries", "reasoning"]
            },
            minItems: 1,
            maxItems: 5
          }
        },
        required: ["avenues"]
      }
    }
  },
  
  {
    name: "Deep Search Result Synthesizer",
    description: "Synthesizes results from initial and deep search phases",
    type: "prompt",
    isPublic: true,
    isShortcut: false,
    tags: ["websearch", "deep-search", "synthesis"],
    variables: [
      {
        name: "originalQuery",
        description: "The original user query",
        type: "string",
        required: true,
        instructions: "The user's original question or request"
      },
      {
        name: "initialContent",
        description: "Content from initial search phase",
        type: "string",
        required: true,
        instructions: "JSON string containing initial search results and content"
      },
      {
        name: "deepResults",
        description: "Results from deep search avenues",
        type: "string",
        required: true,
        instructions: "JSON string containing deep search results organized by avenue"
      },
      {
        name: "enableCondensation",
        description: "Whether to condense the final output",
        type: "boolean",
        required: false,
        default: true,
        instructions: "Set to false to provide detailed output"
      }
    ],
    prompt: `Synthesize the comprehensive research results from both initial and deep search phases to provide a thorough answer to the user's query.

Original Query: {{originalQuery}}

Initial Search Content:
{{initialContent}}

Deep Search Results by Avenue:
{{deepResults}}

Synthesis Instructions:
1. **Integrate Information**: Combine insights from both initial and deep search phases
2. **Resolve Conflicts**: Address any contradictions or conflicting information
3. **Highlight Key Findings**: Emphasize the most important discoveries from the deep search
4. **Maintain Structure**: Organize the response logically and coherently
5. **Cite Sources**: Reference specific sources when making claims
6. **Provide Context**: Explain how the deep search enhanced understanding

{{#if enableCondensation}}
Create a comprehensive but well-organized response that fully addresses the user's query using all available information.
{{else}}
Provide a detailed, thorough response that includes all relevant information from both search phases, organized by topic or avenue.
{{/if}}

Focus on delivering the most complete and accurate answer possible based on the comprehensive research conducted.`,
    structuredOutput: undefined
  }
];

export const WEBSEARCH_TEMPLATE_IDS = {
  QUERY_GENERATOR: 'websearch-query-generator',
  RESULT_SELECTOR: 'websearch-result-selector', 
  CONTENT_CONDENSER: 'websearch-content-condenser',
  AVENUE_IDENTIFIER: 'websearch-avenue-identifier',
  DEEP_SYNTHESIZER: 'websearch-deep-synthesizer'
} as const;