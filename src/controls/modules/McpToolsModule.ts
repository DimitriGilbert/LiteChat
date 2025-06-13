import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  type ReadonlyChatContextSnapshot,
} from "@/types/litechat/modding";
import { useMcpStore, type McpServerConfig } from "@/store/mcp.store";
import { useSettingsStore } from "@/store/settings.store";
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
}

interface RetryConfig {
  attempts: number;
  delay: number;
  timeout: number;
}

export class McpToolsModule implements ControlModule {
  readonly id = "core-mcp-tools";
  private unregisterCallbacks: (() => void)[] = [];
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
      attempts: mcpState.retryAttempts,
      delay: mcpState.retryDelay,
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
      
      // Disconnect existing clients
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
    
    console.log(`[${this.id}] Connecting to MCP server: ${server.name} (attempt ${currentAttempt + 1}/${retryConfig.attempts + 1})`);
    
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
      if (currentAttempt < retryConfig.attempts) {
        this.connectionAttempts.set(server.id, currentAttempt + 1);
        
        const nextAttempt = currentAttempt + 1;
        const delay = retryConfig.delay * Math.pow(1.5, currentAttempt); // Exponential backoff
        
        console.log(`[${this.id}] Scheduling retry for ${server.name} in ${delay}ms (attempt ${nextAttempt + 1}/${retryConfig.attempts + 1})`);
        
        const timeout = setTimeout(() => {
          this.retryTimeouts.delete(server.id);
          this.connectToMcpServerWithRetry(server);
        }, delay);
        
        this.retryTimeouts.set(server.id, timeout);
        
        toast.warning(`MCP server connection failed: ${server.name}`, {
          description: `Retrying in ${Math.round(delay / 1000)}s (attempt ${nextAttempt + 1}/${retryConfig.attempts + 1})`,
        });
        
      } else {
        // All retry attempts exhausted
        this.connectionAttempts.delete(server.id);
        
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        toast.error(`Failed to connect to MCP server: ${server.name}`, {
          description: `All ${retryConfig.attempts + 1} connection attempts failed. ${errorMessage}`,
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
      // Race the connection against the timeout
      const mcpClient = await Promise.race([
        experimental_createMCPClient({
          transport: {
            type: "sse",
            url: server.url,
            headers: server.headers || {},
          },
        }),
        timeoutPromise,
      ]);
      
      // Get available tools from the MCP server
      const tools = await mcpClient.tools();
      
      console.log(`[${this.id}] Connected to MCP server ${server.name}, found ${Object.keys(tools).length} tools`);
      
      // Store the client
      const clientInfo: McpClient = {
        id: server.id,
        name: server.name,
        client: mcpClient,
        tools: tools,
      };
      
      this.mcpClients.set(server.id, clientInfo);
      
      // Register tools with the modding API
      if (this.modApi) {
        Object.entries(tools).forEach(([toolName, tool]) => {
          const prefixedToolName = `mcp_${server.id}_${toolName}`;
          
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
              tool,
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
            
            this.unregisterCallbacks.push(unregisterTool);
            
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
      
    } catch (error) {
      // Enhance error messages for common issues
      let enhancedError = error;
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
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