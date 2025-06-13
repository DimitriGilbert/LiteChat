import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
} from "@/types/litechat/modding";
import { useMcpStore, type McpServerConfig } from "@/store/mcp.store";
import { mcpEvent } from "@/types/litechat/events/mcp.events";
import { experimental_createMCPClient } from "ai";
import { Tool } from "ai";
import { emitter } from "@/lib/litechat/event-emitter";
import { toast } from "sonner";
import { z } from "zod";

interface McpClient {
  id: string;
  name: string;
  client: any; // MCP client instance
  tools: Record<string, Tool>;
  sessionId?: string; // For Streamable HTTP session management
  transport: 'streamable-http' | 'sse' | 'stdio'; // Track which transport is being used
}

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  timeout: number;
}

export class McpToolsModule implements ControlModule {
  readonly id = "core-mcp-tools";
  private unregisterCallbacks: (() => void)[] = [];
  private mcpToolUnregisterCallbacks: (() => void)[] = []; // Track MCP tool registrations for cleanup
  public mcpClients: Map<string, McpClient> = new Map(); // Make public for access
  private modApi?: LiteChatModApi;
  private connectionAttempts: Map<string, number> = new Map();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApi = modApi;
    console.log(`[${this.id}] Initializing MCP Tools Module...`);
    
    // Store global reference for AI service access
    (globalThis as any).mcpToolsModuleInstance = this;
    
    // Load initial MCP state
    emitter.emit(mcpEvent.loadMcpStateRequest, undefined);
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize MCP clients for enabled servers
    await this.initializeMcpClients();
  }

  register(_modApi: LiteChatModApi): void {
    // Tools are registered dynamically when MCP clients connect
    console.log(`[${this.id}] MCP Tools Module registered`);
  }

  destroy(): void {
    console.log(`[${this.id}] Destroying MCP Tools Module...`);
    
    // Clear all retry timeouts
    this.retryTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.retryTimeouts.clear();
    this.connectionAttempts.clear();
    
    // Disconnect all MCP clients
    this.mcpClients.forEach((client) => {
      try {
        if (client.client && typeof client.client.disconnect === 'function') {
          client.client.disconnect();
        }
      } catch (error) {
        console.error(`[${this.id}] Error disconnecting MCP client ${client.id}:`, error);
      }
    });
    this.mcpClients.clear();
    
    // Unregister all callbacks
    this.unregisterCallbacks.forEach(callback => callback());
    this.unregisterCallbacks = [];
    
    // Unregister MCP tool callbacks
    this.mcpToolUnregisterCallbacks.forEach(callback => callback());
    this.mcpToolUnregisterCallbacks = [];
  }

  private setupEventListeners(): void {
    // Listen for MCP server changes
    const handleServersChanged = (_payload: any) => {
      console.log(`[${this.id}] MCP servers configuration changed, reinitializing clients...`);
      this.initializeMcpClients().catch(error => {
        console.error(`[${this.id}] Error reinitializing MCP clients:`, error);
      });
    };
    
    emitter.on(mcpEvent.serversChanged, handleServersChanged);
    
    this.unregisterCallbacks.push(() => {
      emitter.off(mcpEvent.serversChanged, handleServersChanged);
    });
  }

  private getRetryConfig(): RetryConfig {
    const mcpState = useMcpStore.getState();
    return {
      maxAttempts: mcpState.retryAttempts,
      baseDelay: mcpState.retryDelay,
      timeout: mcpState.connectionTimeout,
    };
  }

  private async initializeMcpClients(): Promise<void> {
    try {
      // Get current MCP servers from store
      const mcpState = useMcpStore.getState();
      const enabledServers = mcpState.servers.filter(server => server.enabled);
      
      console.log(`[${this.id}] Initializing ${enabledServers.length} enabled MCP servers...`);
      
      // Clear existing retry attempts and timeouts
      this.connectionAttempts.clear();
      this.retryTimeouts.forEach((timeout) => {
        clearTimeout(timeout);
      });
      this.retryTimeouts.clear();
      
      // Disconnect existing clients and unregister their tools
      this.mcpClients.forEach((client) => {
        try {
          if (client.client && typeof client.client.disconnect === 'function') {
            client.client.disconnect();
          }
        } catch (error) {
          console.error(`[${this.id}] Error disconnecting existing MCP client ${client.id}:`, error);
        }
      });
      this.mcpClients.clear();
      
      // Unregister existing MCP tools before reconnecting
      this.mcpToolUnregisterCallbacks.forEach(callback => callback());
      this.mcpToolUnregisterCallbacks = [];
      
      // Connect to enabled servers
      for (const server of enabledServers) {
        this.connectToMcpServerWithRetry(server);
      }
      
    } catch (error) {
      console.error(`[${this.id}] Error initializing MCP clients:`, error);
      toast.error("Failed to initialize MCP clients", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }

  private async connectToMcpServerWithRetry(server: McpServerConfig): Promise<void> {
    const retryConfig = this.getRetryConfig();
    const currentAttempt = this.connectionAttempts.get(server.id) || 0;
    
    console.log(`[${this.id}] Connecting to MCP server: ${server.name} (attempt ${currentAttempt + 1}/${retryConfig.maxAttempts + 1})`);
    
    try {
      await this.connectToMcpServer(server);
      
      // Reset connection attempts on success
      this.connectionAttempts.delete(server.id);
      
      // Clear any pending retry timeout
      const existingTimeout = this.retryTimeouts.get(server.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.retryTimeouts.delete(server.id);
      }
      
      toast.success(`Connected to MCP server: ${server.name}`, {
        description: `Successfully connected and loaded tools`,
      });
      
    } catch (error) {
      console.error(`[${this.id}] Failed to connect to MCP server ${server.name} (attempt ${currentAttempt + 1}):`, error);
      
      // Update server status to indicate connection failure
      const mcpState = useMcpStore.getState();
      mcpState.setServerStatus({
        serverId: server.id,
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        lastConnected: undefined,
        toolCount: 0,
        tools: [],
      });
      
      // Check if we should retry
      if (currentAttempt < retryConfig.maxAttempts) {
        this.connectionAttempts.set(server.id, currentAttempt + 1);
        
        const nextAttempt = currentAttempt + 1;
        const delay = retryConfig.baseDelay * Math.pow(1.5, currentAttempt); // Exponential backoff
        
        console.log(`[${this.id}] Scheduling retry for ${server.name} in ${delay}ms (attempt ${nextAttempt + 1}/${retryConfig.maxAttempts + 1})`);
        
        const timeout = setTimeout(() => {
          this.retryTimeouts.delete(server.id);
          this.connectToMcpServerWithRetry(server);
        }, delay);
        
        this.retryTimeouts.set(server.id, timeout);
        
        toast.warning(`MCP server connection failed: ${server.name}`, {
          description: `Retrying in ${Math.round(delay / 1000)}s (attempt ${nextAttempt + 1}/${retryConfig.maxAttempts + 1})`,
        });
        
      } else {
        // All retry attempts exhausted
        this.connectionAttempts.delete(server.id);
        
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        toast.error(`Failed to connect to MCP server: ${server.name}`, {
          description: `All ${retryConfig.maxAttempts + 1} connection attempts failed. ${errorMessage}`,
          duration: 10000, // Show error longer
        });
        
        console.error(`[${this.id}] All retry attempts exhausted for MCP server ${server.name}`);
      }
    }
  }

  private async connectToMcpServer(server: McpServerConfig): Promise<void> {
    console.log(`[${this.id}] Attempting connection to MCP server: ${server.name} (${server.url})`);
    
    const retryConfig = this.getRetryConfig();
    
    try {
      let mcpClient: any;
      let transportType: 'streamable-http' | 'sse' | 'stdio' = 'streamable-http';
      
      // Determine transport type based on URL scheme
      if (server.url.startsWith('stdio://')) {
        // Try stdio transport via multi-server bridge 
        // No timeout for stdio as it needs time to spawn the npx process
        console.log(`[${this.id}] Using stdio transport for ${server.name} (no timeout - allows time for process startup)`);
        mcpClient = await this.connectWithStdioTransport(server);
        transportType = 'stdio';
      } else {
        // Create a timeout promise for HTTP-based transports only
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Connection timeout after ${retryConfig.timeout}ms`));
          }, retryConfig.timeout);
        });
        
        // Try HTTP-based transports with timeout
        try {
          // First try the new Streamable HTTP transport
          mcpClient = await Promise.race([
            this.connectWithStreamableHttp(server),
            timeoutPromise,
          ]);
          transportType = 'streamable-http';
        } catch (streamableError) {
          console.log(`[${this.id}] Streamable HTTP failed for ${server.name}, falling back to SSE transport:`, streamableError);
          
          // Fallback to deprecated SSE transport for backwards compatibility
          mcpClient = await Promise.race([
            this.connectWithSseTransport(server),
            timeoutPromise,
          ]);
          transportType = 'sse';
        }
      }
      
      console.log(`[${this.id}] About to handle successful connection for ${server.name} with transport ${transportType}`);
      console.log(`[${this.id}] MCP client object for ${server.name}:`, mcpClient);
      
      await this.handleSuccessfulConnection(server, mcpClient, transportType);
      
      console.log(`[${this.id}] Successfully handled connection for ${server.name}`);
      
    } catch (error) {
      // Enhance error messages for common issues
      let enhancedError = error;
      
      if (error instanceof Error) {
        if (error.message.includes('Bridge service not healthy') || error.message.includes('stdio bridge connection failed')) {
          enhancedError = new Error(`Stdio MCP server requires LiteChat MCP Bridge. Please install and start the bridge service: npm install -g litechat-mcp-bridge && litechat-mcp-bridge`);
        } else if (error.message.includes('fetch')) {
          enhancedError = new Error(`Network error: Unable to reach MCP server at ${server.url}. Please check if the server is running and accessible.`);
        } else if (error.message.includes('timeout')) {
          enhancedError = new Error(`Connection timeout: MCP server at ${server.url} did not respond within ${retryConfig.timeout}ms.`);
        } else if (error.message.includes('401') || error.message.includes('403')) {
          enhancedError = new Error(`Authentication error: Invalid credentials for MCP server at ${server.url}.`);
        } else if (error.message.includes('404')) {
          enhancedError = new Error(`Server not found: MCP server endpoint ${server.url} does not exist.`);
        } else if (error.message.includes('500')) {
          enhancedError = new Error(`Server error: MCP server at ${server.url} returned an internal server error.`);
        }
      }
      
      console.error(`[${this.id}] Failed to connect to MCP server ${server.name}:`, enhancedError);
      throw enhancedError;
    }
  }

  /**
   * Attempt connection using the new Streamable HTTP transport (MCP 2025-03-26)
   */
  private async connectWithStreamableHttp(server: McpServerConfig): Promise<any> {
    console.log(`[${this.id}] Trying Streamable HTTP transport for ${server.name}`);
    
    // For Streamable HTTP, we need to implement a custom transport that follows the new spec
    // Since the Vercel AI SDK doesn't yet support Streamable HTTP natively, 
    // we'll use a custom transport that implements the new protocol
    const transport = this.createStreamableHttpTransport(server);
    
    return experimental_createMCPClient({
      transport,
    });
  }

  /**
   * Detect if stdio bridge is available on configured locations
   */
  private async getBridgeUrl(): Promise<string> {
    // Get bridge configuration from MCP settings
    const mcpState = useMcpStore.getState();
    const bridgeConfig = mcpState.bridgeConfig || {};
    
    // If user has configured a specific bridge URL, use that
    if (bridgeConfig.url) {
      return bridgeConfig.url;
    }
    
    // If user has configured host/port, use that combination
    if (bridgeConfig.host || bridgeConfig.port) {
      const host = bridgeConfig.host || 'localhost';
      const port = bridgeConfig.port || 3001;
      
      // For host/port config, default to HTTP (user can specify full URL with protocol if they want HTTPS)
      return `http://${host}:${port}`;
    }
    
    // Default fallback: localhost:3001
    return 'http://localhost:3001';
  }

  /**
   * Connect directly to bridge and get tools - NO AI SDK BULLSHIT!
   */
  private async connectWithStdioTransport(server: McpServerConfig): Promise<any> {
    console.log(`[${this.id}] Connecting directly to bridge for ${server.name}`);
    
    // Check if this is a stdio server configuration
    if (!server.url.startsWith('stdio://')) {
      throw new Error('Not a stdio server configuration');
    }
    
    // Parse stdio URL to get command and args: stdio://command?args=arg1,arg2,arg3
    const stdioUrl = new URL(server.url);
    const command = stdioUrl.hostname || stdioUrl.pathname.replace('//', '');
    const argsParam = stdioUrl.searchParams.get('args') || '';
    
    // Validate command is provided
    if (!command) {
      throw new Error('stdio:// URL must specify a command (e.g., stdio://npx?args=-y,@modelcontextprotocol/server-filesystem,.)');
    }
    
    // Get the configured bridge URL
    const bridgeUrl = await this.getBridgeUrl();
    
    // Create a unique server name based on command and args for the bridge
    const serverName = `${command}-${Date.now()}`;
      
    try {
      // Build the dynamic server endpoint with command and args as query parameters
      const params = new URLSearchParams();
      params.set('command', command);
      if (argsParam) {
        params.set('args', argsParam);
      }
      
      const serverEndpoint = `${bridgeUrl}/servers/${serverName}/mcp?${params.toString()}`;
      
      console.log(`[${this.id}] Starting bridge server: ${serverEndpoint}`);
      
      // Get the tools list by making a POST request with tools/list method
      // The bridge will create the server automatically on the first request
      const toolsResponse = await fetch(serverEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...server.headers || {},
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        })
      });
      
      if (!toolsResponse.ok) {
        throw new Error(`Failed to get tools: ${toolsResponse.status} ${toolsResponse.statusText}`);
      }
      
      const toolsResult = await toolsResponse.json();
      console.log(`[${this.id}] Raw tools response:`, toolsResult);
      
      if (toolsResult.error) {
        throw new Error(`Tools request failed: ${toolsResult.error.message}`);
      }
      
      // Create a counter for unique IDs to prevent collisions in rapid tool calls
      let requestIdCounter = 0;
      
      // Return a simple client that can call tools
      return {
        tools: toolsResult.result?.tools || [],
        serverEndpoint,
        callTool: async (request: { name: string; arguments: any }) => {
          // Generate unique ID using timestamp + counter to prevent collisions
          const uniqueId = `${Date.now()}_${++requestIdCounter}`;
          
          const response = await fetch(serverEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...server.headers || {},
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: uniqueId,
              method: 'tools/call',
              params: {
                name: request.name,
                arguments: request.arguments
              }
            })
          });
          
          if (!response.ok) {
            throw new Error(`Tool call failed: ${response.status} ${response.statusText}`);
          }
          
          const result = await response.json();
          if (result.error) {
            throw new Error(`Tool execution failed: ${result.error.message}`);
          }
          
          return result.result;
        }
      };
      
    } catch (error) {
      throw new Error(`Bridge connection failed: ${error instanceof Error ? error.message : error}. Ensure bridge is running with: npm run mcp-proxy. Command: ${command}, Args: ${argsParam || 'none'}`);
    }
  }

  /**
   * Fallback to the deprecated SSE transport for backwards compatibility
   */
  private async connectWithSseTransport(server: McpServerConfig): Promise<any> {
    console.log(`[${this.id}] Using SSE transport (deprecated) for ${server.name}`);
    
    return experimental_createMCPClient({
      transport: {
        type: "sse",
        url: server.url,
        headers: server.headers || {},
      },
    });
  }

  /**
   * Create a custom transport that implements the new Streamable HTTP protocol
   */
  private createStreamableHttpTransport(server: McpServerConfig): any {
    let sessionId: string | null = null;
    let isConnected = false;
    
    return {
      async start(): Promise<void> {
        console.log(`[${this.id}] Starting Streamable HTTP transport for ${server.name}`);
        
        // Send InitializeRequest to establish session
        const initResponse = await fetch(server.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Origin': window.location.origin, // Required for security
            ...server.headers,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `init_${Date.now()}`,
            method: 'initialize',
            params: {
              protocolVersion: '2025-03-26',
              capabilities: {
                tools: {},
              },
              clientInfo: {
                name: 'LiteChat',
                version: '1.0.0',
              },
            },
          }),
        });
        
        if (!initResponse.ok) {
          throw new Error(`HTTP ${initResponse.status}: ${initResponse.statusText}`);
        }
        
        // Extract session ID from response headers if provided
        sessionId = initResponse.headers.get('Mcp-Session-Id');
        
        const initResult = await initResponse.json();
        
        if (initResult.error) {
          throw new Error(`MCP Initialize Error: ${initResult.error.message}`);
        }
        
        // Send InitializedNotification
        const initializedResponse = await fetch(server.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': window.location.origin,
            ...(sessionId && { 'Mcp-Session-Id': sessionId }),
            ...server.headers,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'initialized',
            params: {},
          }),
        });
        
        if (!initializedResponse.ok) {
          throw new Error(`Failed to send initialized notification: ${initializedResponse.status}`);
        }
        
        isConnected = true;
        console.log(`[${this.id}] Successfully initialized Streamable HTTP connection for ${server.name}`, 
                   sessionId ? `with session ID: ${sessionId}` : 'without session management');
      },
      
      async send(message: any): Promise<void> {
        if (!isConnected) {
          throw new Error('Transport not connected');
        }
        
        const response = await fetch(server.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Origin': window.location.origin,
            ...(sessionId && { 'Mcp-Session-Id': sessionId }),
            ...server.headers,
          },
          body: JSON.stringify(message),
        });
        
        if (!response.ok) {
          // Handle session expiration (404 with session ID)
          if (response.status === 404 && sessionId) {
            sessionId = null;
            isConnected = false;
            throw new Error('Session expired, reinitializing connection');
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Handle different response types based on Content-Type
        const contentType = response.headers.get('Content-Type') || '';
        
        if (contentType.includes('text/event-stream')) {
          // Handle SSE stream response
          const reader = response.body?.getReader();
          if (reader) {
            // Process SSE events
            // This would need full SSE parsing implementation
            console.log(`[${this.id}] Received SSE stream response`);
          }
        } else if (contentType.includes('application/json')) {
          // Handle single JSON response
          const result = await response.json();
          this.onmessage?.(result);
        }
      },
      
      async close(): Promise<void> {
        if (sessionId) {
          // Explicitly terminate session if supported
          try {
            await fetch(server.url, {
              method: 'DELETE',
              headers: {
                'Origin': window.location.origin,
                'Mcp-Session-Id': sessionId,
                ...server.headers,
              },
            });
          } catch (error) {
            console.log(`[${this.id}] Session termination not supported or failed:`, error);
          }
        }
        isConnected = false;
        sessionId = null;
        this.onclose?.();
      },
      
      // Callbacks that will be set by the MCP client
      onclose: undefined as (() => void) | undefined,
      onerror: undefined as ((error: Error) => void) | undefined,
      onmessage: undefined as ((message: any) => void) | undefined,
    };
  }

  /**
   * Handle successful connection regardless of transport type
   */
  private async handleSuccessfulConnection(
    server: McpServerConfig, 
    mcpClient: any, 
    transportType: 'streamable-http' | 'sse' | 'stdio'
  ): Promise<void> {
    console.log(`[${this.id}] Getting tools from MCP server ${server.name}...`);
    
    // Get available tools from our simple bridge client
    let tools;
    try {
      console.log(`[${this.id}] Getting tools from bridge client for ${server.name}...`);
      console.log(`[${this.id}] Bridge Client object:`, mcpClient);
      
      // Our simple client already has the tools from the bridge
      if (mcpClient.tools && Array.isArray(mcpClient.tools)) {
        // Convert array of tools to object format expected by the rest of the code
        tools = {};
        mcpClient.tools.forEach((tool: any) => {
          tools[tool.name] = {
            description: tool.description,
            parameters: tool.inputSchema, // MCP uses inputSchema, AI SDK expects parameters
          };
        });
        
        console.log(`[${this.id}] Converted ${mcpClient.tools.length} tools from bridge format`);
        console.log(`[${this.id}] Tools:`, Object.keys(tools));
      } else {
        console.error(`[${this.id}] Bridge client missing tools array:`, mcpClient);
        throw new Error('Bridge client missing tools array');
      }
      
      console.log(`[${this.id}] Successfully retrieved tools from ${server.name}:`, Object.keys(tools));
    } catch (error) {
      console.error(`[${this.id}] Failed to retrieve tools from ${server.name}:`, error);
      console.error(`[${this.id}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace available');
      throw error;
    }
    
    console.log(`[${this.id}] Connected to MCP server ${server.name} via ${transportType}, found ${Object.keys(tools).length} tools`);
    
    // Store the client with transport info
    const clientInfo: McpClient = {
      id: server.id,
      name: server.name,
      client: mcpClient,
      tools: tools,
      transport: transportType,
    };
    
    this.mcpClients.set(server.id, clientInfo);
    
    // Register MCP tools for individual control (but mark them as MCP tools)
    console.log(`[${this.id}] MCP server ${server.name} provides ${Object.keys(tools).length} tools: ${Object.keys(tools).join(', ')}`);
    
    // Store tools for later registration when user enables them
    console.log(`[${this.id}] Storing ${Object.keys(tools).length} discovered tools for ${server.name}`);
    console.log(`[${this.id}] Available tools:`, Object.keys(tools));
    
    // Update the existing clientInfo with the tools
    clientInfo.tools = tools;
    
    // Register MCP tools with LiteChat control registry so they show up in UI tool selector
    if (this.modApi) {
      Object.entries(tools).forEach(([toolName, tool]) => {
        const prefixedToolName = `mcp_${server.name}_${toolName}`;
        
        console.log(`[${this.id}] Registering MCP tool with LiteChat: ${prefixedToolName}`);
        
        // Tool definition for LiteChat registry
        const mcpTool = tool as any; // MCP tool from bridge
        
        // Convert JSON schema to Zod schema
        let parametersSchema: z.ZodSchema<any>;
        if (mcpTool.parameters && typeof mcpTool.parameters === 'object') {
          // The MCP tool has a JSON schema - we need to create a Zod schema that accepts any object
          // The actual validation will be done by the MCP server
          console.log(`[${this.id}] Converting JSON schema to Zod for tool ${toolName}:`, mcpTool.parameters);
          parametersSchema = z.record(z.any()).describe(`Parameters for MCP tool ${toolName}`);
        } else {
          // No parameters or invalid parameters
          parametersSchema = z.object({});
        }
        
        const toolDefinition: Tool<any> = {
          description: mcpTool.description || `MCP tool ${toolName} from ${server.name}`,
          parameters: parametersSchema,
        };
        
        // Tool implementation that calls the MCP bridge
        const toolImplementation = async (args: any) => {
          try {
            console.log(`[McpToolsModule] Executing MCP tool ${toolName} from server ${server.name} with args:`, args);
            
            const result = await clientInfo.client.callTool({
              name: toolName,
              arguments: args
            });
            
            console.log(`[McpToolsModule] MCP bridge returned for ${toolName}:`, JSON.stringify(result, null, 2));
            
            // Extract the actual content from MCP result format
            if (result && result.content) {
              if (Array.isArray(result.content)) {
                // Handle array of content items
                const textContent = result.content
                  .map((item: any) => {
                    if (item.type === 'text') {
                      return item.text;
                    } else if (item.type === 'image') {
                      return `[Image: ${item.mimeType || 'unknown format'}]`;
                    }
                    return JSON.stringify(item);
                  })
                  .join('\n');
                return textContent;
              } else if (typeof result.content === 'string') {
                return result.content;
              } else {
                return JSON.stringify(result.content);
              }
            } else {
              // Fallback to stringifying the whole result
              return JSON.stringify(result);
            }
          } catch (error) {
            console.error(`[McpToolsModule] Error executing MCP tool ${toolName}:`, error);
            throw error;
          }
        };
        
        // Register with LiteChat control registry (shows in UI tool selector)
        const unregisterTool = this.modApi!.registerTool(
          prefixedToolName,
          toolDefinition,
          toolImplementation
        );
        
        this.mcpToolUnregisterCallbacks.push(unregisterTool);
        
        // Emit discovery event
        emitter.emit(mcpEvent.toolDiscovered, {
          toolName,
          serverId: server.id,
          serverName: server.name,
          toolDefinition: mcpTool,
        });
        
        console.log(`[${this.id}] MCP tool registered with LiteChat: ${prefixedToolName}`);
      });
    }
    
    // Update server status to indicate successful connection
    console.log(`[${this.id}] Updating server status for ${server.name} with ${Object.keys(tools).length} tools`);
    const mcpState = useMcpStore.getState();
    mcpState.setServerStatus({
      serverId: server.id,
      connected: true,
      error: undefined,
      lastConnected: new Date(),
      toolCount: Object.keys(tools).length,
      tools: Object.keys(tools),
    });
    console.log(`[${this.id}] Server status updated for ${server.name}`);
    
    // DON'T emit serversChanged - that would trigger infinite reconnection loop!
    // The UI will be updated by the server status changes through the MCP store
    
    // Show success toast with transport info
    const transportNames = {
      'streamable-http': 'Streamable HTTP (latest)',
      'sse': 'SSE (legacy)', 
      'stdio': 'Stdio (local bridge)'
    };
    
    toast.success(`Connected to MCP server: ${server.name}`, {
      description: `Using ${transportNames[transportType]} transport with ${Object.keys(tools).length} tools`,
    });
  }

  // Public method to manually retry connection for a specific server
  public retryServerConnection(serverId: string): void {
    const mcpState = useMcpStore.getState();
    const server = mcpState.servers.find(s => s.id === serverId);
    
    if (!server) {
      console.error(`[${this.id}] Server with ID ${serverId} not found`);
      return;
    }
    
    if (!server.enabled) {
      console.log(`[${this.id}] Server ${server.name} is disabled, skipping retry`);
      return;
    }
    
    // Clear existing retry attempts and timeouts for this server
    this.connectionAttempts.delete(serverId);
    const existingTimeout = this.retryTimeouts.get(serverId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.retryTimeouts.delete(serverId);
    }
    
    // Disconnect existing client if any
    const existingClient = this.mcpClients.get(serverId);
    if (existingClient) {
      try {
        if (existingClient.client && typeof existingClient.client.disconnect === 'function') {
          existingClient.client.disconnect();
        }
      } catch (error) {
        console.error(`[${this.id}] Error disconnecting existing client for ${server.name}:`, error);
      }
      this.mcpClients.delete(serverId);
    }
    
    // Start fresh connection attempt
    this.connectToMcpServerWithRetry(server);
  }

  // Get connection status for all servers
  public getConnectionStatus(): Record<string, { connected: boolean; error?: string; toolCount: number }> {
    const status: Record<string, { connected: boolean; error?: string; toolCount: number }> = {};
    
    const mcpState = useMcpStore.getState();
    mcpState.servers.forEach(server => {
      const serverStatus = mcpState.serverStatuses[server.id];
      status[server.id] = {
        connected: serverStatus?.connected || false,
        error: serverStatus?.error,
        toolCount: serverStatus?.toolCount || 0,
      };
    });
    
    return status;
  }

  /**
   * Register a specific MCP tool with the AI SDK when user enables it
   */
  public registerMcpToolWithAI(serverId: string, toolName: string): () => void {
    const clientInfo = this.mcpClients.get(serverId);
    if (!clientInfo) {
      console.error(`[${this.id}] No MCP client found for server ${serverId}`);
      return () => {};
    }
    
    const tool = clientInfo.tools[toolName];
    if (!tool) {
      console.error(`[${this.id}] Tool ${toolName} not found in server ${clientInfo.name}`);
      return () => {};
    }
    
    if (!this.modApi) {
      console.error(`[${this.id}] ModApi not available for tool registration`);
      return () => {};
    }
    
    const prefixedToolName = `mcp_${clientInfo.name}_${toolName}`;
    
    console.log(`[${this.id}] Registering MCP tool with AI SDK: ${prefixedToolName}`);
    
    try {
      // Tool definition (without execute function)
      const toolDefinition: Tool<any> = {
        description: tool.description || `MCP tool ${toolName} from ${clientInfo.name}`,
        parameters: tool.parameters || z.object({}),
      };
      
      // Tool implementation (separate from definition)
      const toolImplementation = async (args: any) => {
        try {
          console.log(`[McpToolsModule] Executing MCP tool ${toolName} from server ${clientInfo.name} with args:`, args);
          
          // Use our bridge client to call the tool
          const result = await clientInfo.client.callTool({
            name: toolName,
            arguments: args
          });
          
          console.log(`[McpToolsModule] Bridge tool result for ${toolName}:`, result);
          
          // Handle MCP tool response format
          let content = "";
          if (result && result.content) {
            if (Array.isArray(result.content)) {
              content = result.content
                .map((item: any) => {
                  if (item.type === 'text') {
                    return item.text;
                  } else if (item.type === 'image') {
                    return `[Image: ${item.mimeType || 'unknown format'}]`;
                  }
                  return JSON.stringify(item);
                })
                .join('\n');
            } else if (typeof result.content === 'string') {
              content = result.content;
            } else {
              content = JSON.stringify(result.content);
            }
          } else {
            content = JSON.stringify(result);
          }
          
          // Truncate very large responses to prevent API errors
          const { maxResponseSize } = useMcpStore.getState();
          if (content.length > maxResponseSize) {
            console.warn(`[McpToolsModule] MCP tool ${toolName} response too large (${content.length} chars), truncating to ${maxResponseSize} chars`);
            content = content.substring(0, maxResponseSize) + '\n\n[... response truncated due to size ...]';
          }
          
          console.log(`[McpToolsModule] Returning content for ${toolName}:`, content.substring(0, 200) + '...');
          return content;
        } catch (error) {
          console.error(`[McpToolsModule] Error executing MCP tool ${toolName}:`, error);
          throw error;
        }
      };
      
      // Register the MCP tool with proper 3-parameter format
      const unregisterTool = this.modApi.registerTool(
        prefixedToolName,
        toolDefinition,
        toolImplementation
      );
      
      console.log(`[${this.id}] MCP tool registered with AI SDK: ${prefixedToolName}`);
      
      // Track for cleanup
      this.mcpToolUnregisterCallbacks.push(unregisterTool);
      
      // Emit tool registered event
      emitter.emit(mcpEvent.toolRegistered, {
        toolName,
        serverId: clientInfo.id,
        serverName: clientInfo.name,
        prefixedToolName,
      });
      
      return unregisterTool;
      
    } catch (error) {
      console.error(`[${this.id}] Error registering MCP tool ${toolName} with AI SDK:`, error);
      return () => {};
         }
   }

  /**
   * Unregister a specific MCP tool from the AI SDK when user disables it
   */
  public unregisterMcpToolFromAI(serverId: string, toolName: string): void {
    const clientInfo = this.mcpClients.get(serverId);
    if (!clientInfo) {
      console.error(`[${this.id}] No MCP client found for server ${serverId}`);
      return;
    }
    
    const prefixedToolName = `mcp_${clientInfo.name}_${toolName}`;
    console.log(`[${this.id}] Unregistering MCP tool from AI SDK: ${prefixedToolName}`);
    
         // Find and call the unregister callback for this specific tool
     // Note: This is a limitation - we don't track individual tool unregister callbacks
     // For now, emit an event to signal the tool should be disabled
     emitter.emit(mcpEvent.toolUnregistered, {
       toolName,
       serverId: clientInfo.id,
       prefixedToolName,
     });
  }

} 