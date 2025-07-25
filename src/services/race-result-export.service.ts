// src/services/race-result-export.service.ts
/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation> */
// Service for exporting race interaction results to HTML files in a ZIP

import JSZip from "jszip";
import type { Interaction } from "@/types/litechat/interaction";

interface RaceResultData {
  modelName: string;
  runnableCode: string | null;
  fullResponse: string;
  blockType: "runjs" | "runpy" | "text";
  isPromptRace: boolean;
  promptVariantLabel?: string;
  promptContent?: string;
  metadata: {
    responseBytes: number;
    codeBytes: number;
    completionTokens?: number;
    promptTokens?: number;
    timeToFirstToken?: number;
    generationTime?: number;
  };
}

export class RaceResultExportService {
  /**
   * Returns the working LiteChat API script that uses dynamic imports (EXACT COPY FROM get-results.js)
   */
  private static getWorkingLiteChatApiScript(): string {
    return `
        const litechatTarget = document.getElementById('litechat-target');
        async function loadModules(moduleConfigs) {
            const loadedModules = {};
            const loadPromises = {};
            const globalImportMap = {};
            moduleConfigs.forEach(config => {
                if (config.importMap) Object.assign(globalImportMap, config.importMap);
            });
            const existingMap = document.querySelector('script[type="importmap"]');
            if (existingMap) existingMap.remove();
            if (Object.keys(globalImportMap).length > 0) {
                const mapScript = document.createElement('script');
                mapScript.type = 'importmap';
                mapScript.textContent = JSON.stringify({ imports: globalImportMap });
                document.head.appendChild(mapScript);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            const loadSingleModule = async (config) => {
                const key = config.globalKey || config.name;
                if (window[key]) return window[key];
                if (key in loadPromises) return loadPromises[key];
                if (config.dependencies) {
                    await Promise.all(config.dependencies.map(depKey => {
                        const depModule = moduleConfigs.find(m => (m.globalKey || m.name) === depKey);
                        if (depModule) return loadSingleModule(depModule);
                        return Promise.resolve();
                    }));
                }
                loadPromises[key] = (async () => {
                    try {
                        const module = await import(config.url);
                        window[key] = module;
                        loadedModules[key] = module;
                        return module;
                    } catch (error) {
                        console.error(\`Error loading module \${config.name}:\`, error);
                        throw error;
                    }
                })();
                return loadPromises[key];
            };
            await Promise.all(moduleConfigs.map(config => loadSingleModule(config)));
            return loadedModules;
        }
        window.litechat = {
            utils: {
                log: (...args) => console.log(...args),
                toast: (message) => alert(message),
                error: (...args) => console.error(...args),
                warn: (...args) => console.warn(...args),
                loadModules,
                loadModule: async (url, name, key, importMap) => (await loadModules([{url, name, globalKey: key, importMap}]))[key || name],
            },
            target: litechatTarget,
            emit: (eventName, payload) => window.dispatchEvent(new CustomEvent(eventName, { detail: payload })),
        };
    `;
  }

  /**
   * Extracts CSS from style elements in dev mode to preserve custom themes
   */
  private static extractInlineCSS(): string {
    const styleElements = document.querySelectorAll("style");
    let css = "";

    for (const style of styleElements) {
      if (style.textContent) {
        css += style.textContent + "\n";
      }
    }

    return css;
  }

  /**
   * Gets the current CSS content by fetching it from the document
   */
  private static async getCurrentCssContent(): Promise<string> {
    const isDev = import.meta.env.DEV;

    if (isDev) {
      const inlineCSS = this.extractInlineCSS();

      if (inlineCSS.length > 10000) {
        return inlineCSS;
      } else {
        try {
          const response = await fetch("https://cdn.tailwindcss.com");
          if (response.ok) {
            const tailwindCss = await response.text();
            return tailwindCss + "\n\n/* Custom Theme */\n" + inlineCSS;
          }
        } catch (error) {
          console.error(error);
        }
      }
    } else {
      const prodCssLink = document.querySelector(
        'link[rel="stylesheet"][href*="/assets/index-"]'
      ) as HTMLLinkElement;
      if (prodCssLink) {
        try {
          const response = await fetch(prodCssLink.href);
          if (response.ok) {
            return await response.text();
          }
        } catch (error) {
          console.error(error);
        }
      }
    }

    return `
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .container { max-width: 1200px; margin: 0 auto; }
      .bg-card { background: white; }
      .text-card-foreground { color: #333; }
      .border { border: 1px solid #e5e7eb; }
      .rounded-lg { border-radius: 0.5rem; }
      .p-4 { padding: 1rem; }
      .p-6 { padding: 1.5rem; }
      .mb-4 { margin-bottom: 1rem; }
      .text-lg { font-size: 1.125rem; }
      .font-semibold { font-weight: 600; }
      .grid { display: grid; }
      .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
      .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .gap-4 { gap: 1rem; }
      .hidden { display: none !important; }
      .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
      .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
      .bg-gray-200 { background-color: #e5e7eb; }
      .hover\\:bg-gray-300:hover { background-color: #d1d5db; }
      .rounded-md { border-radius: 0.375rem; }
      @media (min-width: 768px) {
        .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (min-width: 1024px) {
        .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
    `;
  }

  /**
   * Extracts the content of the last code block from a response string.
   * @param responseText The full response text from the model.
   * @param blockType The type of block to extract ('runjs', 'runpy')
   * @returns The runnable code or null if not found.
   */
  private static extractLastCodeBlock(
    responseText: string,
    blockType: "runjs" | "runpy"
  ): string | null {
    if (!responseText) return null;

    let regex: RegExp;
    if (blockType === "runjs") {
      regex = /```runjs\n([\s\S]*?)\n```/g;
    } else {
      // For runpy, look for both 'runpy' and 'python' blocks
      regex = /```(?:runpy|python)\n([\s\S]*?)\n```/g;
    }

    const matches = [...responseText.matchAll(regex)];
    if (matches.length > 0) {
      return matches[matches.length - 1][1]; // Return the content of the last match
    }
    return null;
  }

  /**
   * Extracts the model name from a complex model ID string.
   * Based on the splitModelId function logic.
   */
  private static extractModelName(combinedId: string): string | null {
    if (!combinedId || !combinedId.includes(":")) {
      return null;
    }
    const parts = combinedId.split(":");
    if (parts.length < 2) {
      return null;
    }
    // The model identifier is the second part, which might contain a path.
    const modelIdentifier = parts[1];
    const pathParts = modelIdentifier.split("/");
    // The actual name is the last part of the path.
    return pathParts[pathParts.length - 1];
  }

  /**
   * Calculates the byte length of a string.
   */
  private static getByteLength(str: string | null | undefined): number {
    if (str === null || str === undefined) return 0;
    return new TextEncoder().encode(str).length;
  }

  /**
   * Formats bytes into a human-readable string (KB, MB, etc.).
   */
  private static formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0 || bytes === null || bytes === undefined) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  /**
   * Formats milliseconds into a human-readable string (ms, s).
   */
  private static formatTime(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  /**
   * Processes race interactions and extracts relevant data
   */
  private static processRaceInteractions(
    interactions: Interaction[]
  ): RaceResultData[] {
    const results: RaceResultData[] = [];

    for (const interaction of interactions) {
      const fullResponse = interaction.response || "";

      // Try to extract runjs code first
      let runnableCode = this.extractLastCodeBlock(fullResponse, "runjs");
      let blockType: "runjs" | "runpy" | "text" = "runjs";

      // If no runjs, try runpy
      if (!runnableCode) {
        runnableCode = this.extractLastCodeBlock(fullResponse, "runpy");
        blockType = "runpy";
      }

      // If no executable code, treat as text-only
      if (!runnableCode) {
        blockType = "text";
      }

      // Extract model name from metadata
      const modelId = interaction.metadata?.modelId;
      if (!modelId) {
        console.warn(
          `Skipping interaction ${interaction.id}: No modelId found`
        );
        continue;
      }

      const modelName = this.extractModelName(modelId);
      if (!modelName) {
        console.warn(
          `Skipping interaction ${interaction.id}: Could not extract model name from "${modelId}"`
        );
        continue;
      }

      // Build metadata
      const metadata = interaction.metadata || {};
      
      // Check if this is a prompt race by looking for promptVariantLabel
      const isPromptRace = !!metadata.promptVariantLabel;
      const promptVariantLabel = metadata.promptVariantLabel as string;
      const promptContent = interaction.prompt?.content || "";
      
      results.push({
        modelName,
        runnableCode,
        fullResponse,
        blockType,
        isPromptRace,
        promptVariantLabel,
        promptContent,
        metadata: {
          responseBytes: this.getByteLength(fullResponse),
          codeBytes: this.getByteLength(runnableCode),
          completionTokens: metadata.completionTokens || metadata.outputTokens,
          promptTokens: metadata.promptTokens || metadata.inputTokens,
          timeToFirstToken: metadata.timeToFirstToken,
          generationTime: metadata.generationTime,
        },
      });
    }

    return results;
  }

  /**
   * Generates an individual model's HTML page
   */
  private static generateModelHtmlPage(
    data: RaceResultData,
    _promptText: string = "Race interaction results"
  ): string {
    const sanitizedResponse = data.fullResponse
      ? data.fullResponse.replace(/</g, "&lt;").replace(/>/g, "&gt;")
      : "No response content.";

    // Determine the display name and title based on race type
    const displayName = data.isPromptRace 
      ? (data.promptVariantLabel || "Unknown Variant")
      : data.modelName;
    
    const pageTitle = data.isPromptRace 
      ? `${data.promptVariantLabel} - LiteChat Prompt Race Result`
      : `${data.modelName} - LiteChat Race Result`;

    // Sanitize prompt content for display
    const sanitizedPromptContent = data.promptContent
      ? data.promptContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")
      : "";

    // LiteChat API implementation for the exported files (EXACT COPY FROM WORKING get-results.js)
    const litechatApiScript = this.getWorkingLiteChatApiScript();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <link rel="stylesheet" href="styles.css">
    <style>
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .tab-button { 
            transition: all 0.2s ease-in-out; 
            border-bottom: 2px solid transparent; 
        }
        .tab-button.active { 
            border-bottom-color: hsl(var(--primary)); 
            color: hsl(var(--primary)); 
            background-color: hsl(var(--muted)); 
        }
    </style>
</head>
<body class="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
    <div class="max-w-7xl mx-auto container bg-card rounded-2xl shadow-lg overflow-hidden border border-border">
        <div class="header bg-card border-b border-border p-6 sm:p-8 text-center">
            <div class="flex justify-between items-center mb-4">
                <h1 class="text-3xl sm:text-4xl font-bold text-card-foreground">🚀 ${displayName}</h1>
                <button id="theme-toggle" class="p-2 rounded-md border border-border bg-muted hover:bg-muted/80">
                    <span class="dark:hidden">🌙</span>
                    <span class="hidden dark:inline">☀️</span>
                </button>
            </div>
            <p class="text-muted-foreground">LiteChat ${data.isPromptRace ? 'Prompt' : 'Model'} Race Result (${data.blockType.toUpperCase()})</p>
        </div>
        
        ${data.isPromptRace && sanitizedPromptContent ? `
        <div class="prompt-section bg-muted/30 border-b border-border p-6">
            <h2 class="text-xl font-semibold mb-3 text-card-foreground">Prompt Variant</h2>
            <div class="bg-card border border-border rounded-lg p-4">
                <pre class="whitespace-pre-wrap text-sm text-card-foreground font-mono">${sanitizedPromptContent}</pre>
            </div>
        </div>
        ` : ''}
        
        <div class="p-4 sm:p-6">
            <div class="border-b border-border mb-4">
                <nav class="-mb-px flex space-x-4" aria-label="Tabs">
                    ${
                      data.runnableCode
                        ? `
                        <button class="tab-button active hover:text-primary/80 whitespace-nowrap py-3 px-4 font-medium text-sm rounded-t-md" data-tab="preview">Live Preview</button>
                        <button class="tab-button hover:text-primary/80 whitespace-nowrap py-3 px-4 font-medium text-sm rounded-t-md" data-tab="raw">Raw Response</button>
                    `
                        : `
                        <button class="tab-button active hover:text-primary/80 whitespace-nowrap py-3 px-4 font-medium text-sm rounded-t-md" data-tab="raw">Response Content</button>
                    `
                    }
                </nav>
            </div>

            ${
              data.runnableCode
                ? `
                <div id="preview" class="tab-content active">
                    <div id="litechat-target" class="w-full min-h-[600px] bg-muted/50 rounded-lg p-4 border border-border"></div>
                </div>
            `
                : ""
            }

            <div id="raw" class="tab-content${
              !data.runnableCode ? " active" : ""
            }">
                <div class="w-full min-h-[600px] bg-gray-900 text-white rounded-lg p-4 overflow-x-auto font-mono">
                    <pre class="whitespace-pre-wrap text-sm"><code>${sanitizedResponse}</code></pre>
                </div>
            </div>
        </div>

        <div class="footer bg-muted/50 p-4 border-t border-border text-center text-sm text-muted-foreground">
            Generated by <strong>LiteChat</strong> • <a href="./index.html" class="text-primary hover:underline">Back to Main Page</a>
        </div>
    </div>

    <script type="module">
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        const html = document.documentElement;
        
        themeToggle?.addEventListener('click', () => {
            html.classList.toggle('dark');
            localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
        });
        
        // Load saved theme
        if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            html.classList.add('dark');
        }

        // Tab switching logic
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                const tabId = button.dataset.tab;
                tabContents.forEach(content => content.id === tabId ? content.classList.add('active') : content.classList.remove('active'));
            });
        });
        
        ${
          data.runnableCode
            ? `
        // --- LITECHAT MOCK API ---
        ${litechatApiScript}

        // --- EXECUTE CODE ---
        try {
            ${
              data.blockType === "runjs"
                ? data.runnableCode
                : `
                // Python code execution placeholder - would need pyodide or similar
                const codeDiv = document.createElement('div');
                codeDiv.className = 'p-4 bg-blue-100 border border-blue-200 rounded-md';
                codeDiv.innerHTML = '<h3 class="font-bold text-blue-800 mb-2">Python Code:</h3>' +
                                   '<pre class="bg-blue-50 p-2 rounded text-sm overflow-x-auto"><code>${data.runnableCode
                                     ?.replace(/'/g, "\\'")
                                     .replace(/\n/g, "\\n")}</code></pre>' +
                                   '<p class="text-blue-600 text-sm mt-2">Python execution not available in exported HTML. Code is displayed above.</p>';
                document.getElementById('litechat-target').appendChild(codeDiv);
            `
            }
        } catch (error) {
            console.error('Execution error:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'p-4 text-red-600 bg-red-100 border border-red-200 rounded-md';
            errorDiv.textContent = 'Execution Error: ' + error.message;
            document.getElementById('litechat-target').appendChild(errorDiv);
        }
        `
            : ""
        }
    </script>
</body>
</html>`;
  }

  /**
   * Generates the results grid/card view HTML
   */
  private static generateResultsList(results: RaceResultData[]): string {
    return results
      .map(
        (data) => {
          const displayName = data.isPromptRace 
            ? (data.promptVariantLabel || "Unknown Variant")
            : data.modelName;
          const fileName = data.isPromptRace 
            ? (data.promptVariantLabel || "unknown").replace(/[^a-zA-Z0-9\-_]/g, '_')
            : data.modelName;
          
          return `
        <li class="bg-card rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-border">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-card-foreground">${displayName}</h3>
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                      data.blockType === "runjs"
                        ? "bg-green-100 text-green-700"
                        : data.blockType === "runpy"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }">
                        ${data.blockType.toUpperCase()}
                    </span>
                    <a href="./${fileName}.html" target="_blank" rel="noopener noreferrer" 
                       class="inline-flex items-center px-3 py-2 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary/90">
                        View Result
                    </a>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                    <span class="font-medium">Response Size:</span><br>
                    <span class="text-card-foreground">${this.formatBytes(
                      data.metadata.responseBytes
                    )}</span>
                </div>
                <div>
                    <span class="font-medium">Code Size:</span><br>
                    <span class="text-card-foreground">${this.formatBytes(
                      data.metadata.codeBytes
                    )}</span>
                </div>
                <div>
                    <span class="font-medium">Tokens (Out/In):</span><br>
                    <span class="text-card-foreground">${
                      data.metadata.completionTokens ?? "N/A"
                    } / ${data.metadata.promptTokens ?? "N/A"}</span>
                </div>
                <div>
                    <span class="font-medium">TTFT:</span><br>
                    <span class="text-card-foreground">${this.formatTime(
                      data.metadata.timeToFirstToken
                    )}</span>
                </div>
                <div class="col-span-2">
                    <span class="font-medium">Total Time:</span><br>
                    <span class="text-card-foreground">${this.formatTime(
                      data.metadata.generationTime
                    )}</span>
                </div>
            </div>
        </li>
    `;
        }
      )
      .join("\n");
  }

  /**
   * Generates the results table HTML
   */
  private static generateResultsTable(results: RaceResultData[]): string {
    return results
      .map(
        (data) => {
          const displayName = data.isPromptRace 
            ? (data.promptVariantLabel || "Unknown Variant")
            : data.modelName;
          const fileName = data.isPromptRace 
            ? (data.promptVariantLabel || "unknown").replace(/[^a-zA-Z0-9\-_]/g, '_')
            : data.modelName;
          
          return `
        <tr class="hover:bg-muted/50">
            <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                    <a href="./${fileName}.html" target="_blank" rel="noopener noreferrer" 
                       class="text-primary hover:underline font-medium">${displayName}</a>
                    <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                      data.blockType === "runjs"
                        ? "bg-green-100 text-green-700"
                        : data.blockType === "runpy"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }">
                        ${data.blockType.toUpperCase()}
                    </span>
                </div>
            </td>
            <td class="px-4 py-3" data-sort="${
              data.metadata.responseBytes || 0
            }">${this.formatBytes(data.metadata.responseBytes)}</td>
            <td class="px-4 py-3" data-sort="${
              data.metadata.codeBytes || 0
            }">${this.formatBytes(data.metadata.codeBytes)}</td>
            <td class="px-4 py-3" data-sort="${
              data.metadata.completionTokens || 0
            }">${data.metadata.completionTokens ?? "N/A"}</td>
            <td class="px-4 py-3" data-sort="${
              data.metadata.promptTokens || 0
            }">${data.metadata.promptTokens ?? "N/A"}</td>
            <td class="px-4 py-3" data-sort="${
              data.metadata.timeToFirstToken || 0
            }">${this.formatTime(data.metadata.timeToFirstToken)}</td>
            <td class="px-4 py-3" data-sort="${
              data.metadata.generationTime || 0
            }">${this.formatTime(data.metadata.generationTime)}</td>
        </tr>
    `;
        }
      )
      .join("\n");
  }

  /**
   * Generates the main index.html page
   */
  private static generateIndexHtml(
    results: RaceResultData[],
    promptText: string = "Race interaction results"
  ): string {
    const resultsListHtml = this.generateResultsList(results);
    const resultsTableHtml = this.generateResultsTable(results);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LiteChat Race Results</title>
    <link rel="stylesheet" href="styles.css">
    <link href="https://cdn.jsdelivr.net/npm/simple-datatables@latest/dist/style.css" rel="stylesheet" type="text/css">
    <script src="https://cdn.jsdelivr.net/npm/simple-datatables@latest" type="text/javascript"></script>
    <style>
        /* DataTable theming */
        .dataTable-table {
            background: hsl(var(--card)) !important;
            border: 1px solid hsl(var(--border)) !important;
            border-radius: 0.5rem !important;
            overflow: hidden !important;
        }
        .dataTable-table thead th {
            background: hsl(var(--muted)) !important;
            color: hsl(var(--card-foreground)) !important;
            border-bottom: 1px solid hsl(var(--border)) !important;
            padding: 12px 16px !important;
        }
        .dataTable-table tbody td {
            color: hsl(var(--card-foreground)) !important;
            border-bottom: 1px solid hsl(var(--border)) !important;
            padding: 12px 16px !important;
        }
        .dataTable-table tbody tr:hover {
            background: hsl(var(--muted) / 0.5) !important;
        }
        .dataTable-search input,
        .dataTable-selector select {
            background: hsl(var(--card)) !important;
            border: 2px solid hsl(var(--primary)) !important;
            color: hsl(var(--card-foreground)) !important;
            border-radius: 0.5rem !important;
            padding: 0.75rem 1.25rem !important;
        }
        .dataTable-pagination a {
            background: hsl(var(--card)) !important;
            border: 2px solid hsl(var(--primary)) !important;
            color: hsl(var(--primary)) !important;
            border-radius: 0.5rem !important;
            padding: 0.75rem 1.25rem !important;
        }
        .dataTable-pagination a:hover {
            background: hsl(var(--primary)) !important;
            color: hsl(var(--primary-foreground)) !important;
        }
    </style>
</head>
<body class="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
    <div class="max-w-7xl mx-auto container bg-card rounded-2xl shadow-lg overflow-hidden border border-border">
        <div class="header bg-card border-b border-border p-6 sm:p-8 text-center">
            <div class="flex justify-between items-center mb-4">
                <h1 class="text-3xl sm:text-4xl font-bold text-card-foreground">🚀 LiteChat Race Results</h1>
                <button id="theme-toggle" class="p-2 rounded-md border border-border bg-muted hover:bg-muted/80">
                    <span class="dark:hidden">🌙</span>
                    <span class="hidden dark:inline">☀️</span>
                </button>
            </div>
            <p class="text-muted-foreground">Comparing code generation capabilities of various models.</p>
        </div>
        <div class="content p-6 sm:p-8">
            <div class="prompt-container mb-8">
                <h2 class="text-2xl font-bold mb-4 text-card-foreground">Prompt</h2>
                <div class="markdown-content bg-muted/50 p-4 rounded-lg border border-border">
                    <div class="text-card-foreground prose prose-sm max-w-none" id="prompt-content">${promptText}</div>
                </div>
            </div>
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-card-foreground">Results</h2>
                <button id="view-toggle" class="px-3 py-1 text-sm font-medium bg-muted hover:bg-muted/80 rounded-md border border-border">View as Table</button>
            </div>
            <ul id="results-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${resultsListHtml}</ul>
            <div id="results-table-container" class="hidden">
                <table id="results-table" class="w-full">
                    <thead>
                        <tr>
                            <th class="text-left">Model</th>
                            <th class="text-left">Response Size</th>
                            <th class="text-left">Code Size</th>
                            <th class="text-left">Completion Tokens</th>
                            <th class="text-left">Prompt Tokens</th>
                            <th class="text-left">TTFT</th>
                            <th class="text-left">Total Time</th>
                        </tr>
                    </thead>
                    <tbody>${resultsTableHtml}</tbody>
                </table>
            </div>
        </div>
        <div class="footer bg-muted/50 p-4 border-t border-border text-center text-sm text-muted-foreground">
            Generated by <strong>LiteChat</strong> • Visit <a href="https://litechat.dev" class="text-primary hover:underline">litechat.dev</a>
        </div>
    </div>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Theme toggle
            const themeToggle = document.getElementById('theme-toggle');
            const html = document.documentElement;
            
            themeToggle?.addEventListener('click', () => {
                html.classList.toggle('dark');
                localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
            });
            
            // Load saved theme
            if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                html.classList.add('dark');
            }

            // Format prompt as markdown
            const promptContent = document.getElementById('prompt-content');
            if (promptContent) {
                let content = promptContent.innerHTML;
                content = content.replace(/\\n/g, '<br>');
                content = content.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
                content = content.replace(/\\*(.*?)\\*/g, '<em>$1</em>');
                content = content.replace(/\`(.*?)\`/g, '<code class="bg-muted px-1 rounded">\\$1</code>');
                promptContent.innerHTML = content;
            }

            let dataTable = null;
            const btn = document.getElementById('view-toggle');
            const grid = document.getElementById('results-grid');
            const tableContainer = document.getElementById('results-table-container');
            const table = document.getElementById('results-table');
            
            function initDataTable() {
                try {
                    if (dataTable) {
                        dataTable.destroy();
                        dataTable = null;
                    }
                    
                    if (!table || !simpleDatatables?.DataTable) {
                        return;
                    }
                    
                    dataTable = new simpleDatatables.DataTable(table, {
                        searchable: true,
                        sortable: true,
                        perPage: 25,
                        perPageSelect: [10, 25, 50, 100],
                        fixedHeight: false,
                        labels: {
                            placeholder: "Search models...",
                            perPage: "Show {select} models per page",
                            noRows: "No models found",
                            info: "Showing {start} to {end} of {rows} models"
                        }
                    });
                } catch (error) {
                    // Silent fallback
                }
            }
            
            if (btn) {
                btn.addEventListener('click', () => {
                    const isCurrentlyGrid = !grid.classList.contains('hidden');
                    
                    if (isCurrentlyGrid) {
                        grid.classList.add('hidden');
                        tableContainer.classList.remove('hidden');
                        btn.textContent = 'View as Grid';
                        setTimeout(initDataTable, 100);
                    } else {
                        tableContainer.classList.add('hidden');
                        grid.classList.remove('hidden');
                        btn.textContent = 'View as Table';
                        if (dataTable) {
                            dataTable.destroy();
                            dataTable = null;
                        }
                    }
                });
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Main export function - processes race interactions and generates a ZIP file
   */
  public static async exportRaceResults(
    interactions: Interaction[],
    promptText?: string
  ): Promise<Blob> {
    // Process interactions to extract race result data
    const results = this.processRaceInteractions(interactions);

    if (results.length === 0) {
      throw new Error("No valid race results found to export");
    }

    // Get CSS content
    const cssContent = await this.getCurrentCssContent();

    // Create ZIP file
    const zip = new JSZip();

    // Add CSS file to the bundle
    zip.file("styles.css", cssContent);

    // Generate individual model HTML files
    for (const result of results) {
      const modelHtml = this.generateModelHtmlPage(result, promptText);
      // Use appropriate filename based on race type
      const fileName = result.isPromptRace 
        ? (result.promptVariantLabel || "unknown").replace(/[^a-zA-Z0-9\-_]/g, '_')
        : result.modelName;
      zip.file(`${fileName}.html`, modelHtml);
    }

    // Generate main index.html
    const indexHtml = this.generateIndexHtml(results, promptText);
    zip.file("index.html", indexHtml);

    // Generate ZIP blob
    return await zip.generateAsync({ type: "blob" });
  }
}
