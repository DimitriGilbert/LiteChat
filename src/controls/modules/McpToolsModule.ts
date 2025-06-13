import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  type ReadonlyChatContextSnapshot,
} from "@/types/litechat/modding";
import { useMcpStore, type McpServerConfig } from "@/store/mcp.store";
import { mcpEvent } from "@/types/litechat/events/mcp.events";
import { experimental_createMCPClient } from "ai";
import { Tool } from "ai";
import { emitter } from "@/lib/litechat/event-emitter";
import { toast } from "sonner";

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
  private mcpToolUnregisterCallbacks: (() => void)[] = []; // Separate tracking for MCP tool registrations
  private mcpClients: Map<string, McpClient> = new Map();
  private modApi?: LiteChatModApi;
  private connectionAttempts: Map<string, number> = new Map();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApi = modApi;
    console.log(`[${this.id}] Initializing MCP Tools Module...`);
    
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
    
    // Also unregister MCP tool callbacks
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
      
      // Unregister only MCP tool registrations to clear any old registrations
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
    
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Connection timeout after ${retryConfig.timeout}ms`));
      }, retryConfig.timeout);
    });
    
    try {
      let mcpClient: any;
      let transportType: 'streamable-http' | 'sse' | 'stdio' = 'streamable-http';
      
      // Determine transport type based on URL scheme
      if (server.url.startsWith('stdio://')) {
        // Try stdio transport via bridge
        mcpClient = await Promise.race([
          this.connectWithStdioTransport(server),
          timeoutPromise,
        ]);
        transportType = 'stdio';
      } else {
        // Try HTTP-based transports
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
      
      await this.handleSuccessfulConnection(server, mcpClient, transportType);
      
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
   * Attempt connection using stdio transport via local bridge service
   */
  private async connectWithStdioTransport(server: McpServerConfig): Promise<any> {
    console.log(`[${this.id}] Trying stdio transport via bridge for ${server.name}`);
    
    // Check if this is a stdio server configuration
    if (!server.url.startsWith('stdio://')) {
      throw new Error('Not a stdio server configuration');
    }
    
    // Parse stdio URL: stdio://command?args=arg1,arg2&cwd=/path
    const stdioUrl = new URL(server.url);
    const command = stdioUrl.hostname || stdioUrl.pathname.replace('//', '');
    const args = stdioUrl.searchParams.get('args')?.split(',') || [];
    const cwd = stdioUrl.searchParams.get('cwd') || undefined;
    
    // Get the configured bridge URL
    const bridgeUrl = await this.getBridgeUrl();
      
    try {
      // Start stdio MCP server via bridge
      const startResponse = await fetch(`${bridgeUrl}/mcp/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverId: server.id,
          command,
          args,
          cwd,
          headers: server.headers,
        }),
      });
      
      if (!startResponse.ok) {
        const error = await startResponse.text();
        throw new Error(`Failed to start stdio server: ${error}`);
      }
      
      const { sessionId } = await startResponse.json();
      
      // Create MCP client that communicates with bridge
      const transport = this.createStdioBridgeTransport(server, bridgeUrl, sessionId);
      
      return experimental_createMCPClient({
        transport,
      });
      
    } catch (error) {
      throw new Error(`Stdio bridge connection failed: ${error instanceof Error ? error.message : error}. Ensure LiteChat MCP Bridge is running`);
    }
  }

  /**
   * Create transport for stdio MCP servers via local bridge
   */
  private createStdioBridgeTransport(server: McpServerConfig, bridgeUrl: string, sessionId: string): any {
    let isConnected = false;
    let currentRequestId: any = null;
    
    return {
      async start(): Promise<void> {
        console.log(`[${this.id}] Starting stdio bridge transport for ${server.name}`);
        
        // The stdio server process is already started by the bridge
        // We just need to mark the transport as connected so the MCP client can use it
        isConnected = true;
        console.log(`[${this.id}] Successfully initialized stdio bridge connection for ${server.name} (session: ${sessionId})`);
      },
      
      async send(message: any): Promise<void> {
        if (!isConnected) {
          throw new Error('Transport not connected');
        }
        
        console.log(`[${this.id}] Sending MCP message to bridge:`, JSON.stringify(message, null, 2));
        
        // Store the current request ID so we can fix response ID mismatches
        currentRequestId = message.id;
        
        // Fix AI SDK method name incompatibility with MCP servers
        if (message.method === 'notifications/initialized') {
          message.method = 'initialized';
          console.log(`[${this.id}] Corrected method name: notifications/initialized -> initialized`);
        }
        
        try {
          // Send message and wait for response
          const response = await fetch(`${bridgeUrl}/mcp/${sessionId}/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`Bridge message failed: ${response.status} ${response.statusText} - ${errorText}`);
            this.onerror?.(error);
            throw error;
          }
          
          const result = await response.json();
          
          console.log(`[${this.id}] Received MCP response from bridge:`, JSON.stringify(result, null, 2));
          
          // Fix ID mismatch issues:
          // 1. If we have a valid response but wrong ID, correct it
          // 2. If we get an error response to a notification (no ID sent), ignore it
          if (result && (result.result || result.error)) {
            if (currentRequestId !== undefined && result.id !== currentRequestId) {
              // Response ID mismatch - correct it
              console.log(`[${this.id}] Correcting response ID from ${result.id} to ${currentRequestId}`);
              result.id = currentRequestId;
            } else if (currentRequestId === undefined && result.id !== undefined) {
              // Server sent response with ID to a notification (which has no ID) - ignore it
              console.log(`[${this.id}] Ignoring error response to notification:`, result);
              return; // Don't call onmessage for this invalid response
            }
          }
          
          // Only call onmessage for actual responses (not for notifications)
          if (result && (result.result || result.error || result.id)) {
            this.onmessage?.(result);
          }
        } catch (error) {
          this.onerror?.(error);
          throw error;
        }
      },
      
      async close(): Promise<void> {
        try {
          await fetch(`${bridgeUrl}/mcp/${sessionId}/close`, {
            method: 'POST',
          });
        } catch (error) {
          console.log(`[${this.id}] Bridge session cleanup failed:`, error);
        }
        isConnected = false;
        this.onclose?.();
      },
      
      // Callbacks that will be set by the MCP client
      onclose: undefined as (() => void) | undefined,
      onerror: undefined as ((error: Error) => void) | undefined,
      onmessage: undefined as ((message: any) => void) | undefined,
    };
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
            id: Date.now(),
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
    
    // Get available tools from the MCP server
    const tools = await mcpClient.tools();
    
    console.log(`[${this.id}] Successfully retrieved tools from ${server.name}:`, Object.keys(tools));
    
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
    
    // Register tools with the modding API
    if (this.modApi) {
      Object.entries(tools).forEach(([toolName, tool]) => {
        const prefixedToolName = `mcp_${server.name}_${toolName}`;
        
        console.log(`[${this.id}] Registering tool: ${prefixedToolName} (server: ${server.name}, original: ${toolName})`);
        
        try {
          // Emit tool discovery event for modding API
          emitter.emit(mcpEvent.toolDiscovered, {
            toolName,
            serverId: server.id,
            serverName: server.name,
            toolDefinition: tool,
          });
          
          const unregisterTool = this.modApi!.registerTool(
            prefixedToolName,
            tool as any, // Type assertion for MCP tool compatibility
            async (params: any, context: ReadonlyChatContextSnapshot) => {
              const startTime = Date.now();
              
              try {
                // Emit before tool call event for modding API
                emitter.emit(mcpEvent.beforeToolCall, {
                  toolName,
                  serverId: server.id,
                  serverName: server.name,
                  parameters: params,
                  conversationId: context.selectedConversationId || 'unknown',
                  interactionId: 'unknown', // TODO: Get from context when available
                });
                
                // Emit before tool execution event (allows parameter modification)
                emitter.emit(mcpEvent.beforeToolExecution, {
                  toolName,
                  serverId: server.id,
                  serverName: server.name,
                  parameters: params,
                  conversationId: context.selectedConversationId || 'unknown',
                  interactionId: 'unknown',
                });
                
                // Execute the tool via the MCP client
                // Note: The actual tool execution is handled by the AI SDK
                // when the tool is called during generateText/streamText
                const result = {
                  success: true,
                  toolName: toolName,
                  serverName: server.name,
                  transport: transportType,
                  note: "Tool execution handled by AI SDK MCP client",
                };
                
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                // Emit after tool call event for modding API
                emitter.emit(mcpEvent.afterToolCall, {
                  toolName,
                  serverId: server.id,
                  serverName: server.name,
                  parameters: params,
                  result,
                  conversationId: context.selectedConversationId || 'unknown',
                  interactionId: 'unknown',
                  duration,
                });
                
                return result;
              } catch (error) {
                console.error(`[${this.id}] Error executing MCP tool ${toolName}:`, error);
                
                // Emit tool call failed event for modding API
                emitter.emit(mcpEvent.toolCallFailed, {
                  toolName,
                  serverId: server.id,
                  serverName: server.name,
                  parameters: params,
                  error: error instanceof Error ? error.message : String(error),
                  conversationId: context.selectedConversationId || 'unknown',
                  interactionId: 'unknown',
                });
                
                throw error;
              }
            }
          );
          
          this.mcpToolUnregisterCallbacks.push(unregisterTool);
          
          // Emit tool registered event for modding API
          emitter.emit(mcpEvent.toolRegistered, {
            toolName,
            serverId: server.id,
            serverName: server.name,
            prefixedToolName,
          });
          
        } catch (error) {
          console.error(`[${this.id}] Error registering MCP tool ${toolName}:`, error);
        }
      });
    }
    
    // Update server status to indicate successful connection
    const mcpState = useMcpStore.getState();
    mcpState.setServerStatus({
      serverId: server.id,
      connected: true,
      error: undefined,
      lastConnected: new Date(),
      toolCount: Object.keys(tools).length,
      tools: Object.keys(tools),
    });
    
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
} 