import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { PersistenceService } from "@/services/persistence.service";
import { emitter } from "@/lib/litechat/event-emitter";
import { mcpEvent } from "@/types/litechat/events/mcp.events";
import type { RegisteredActionHandler } from "@/types/litechat/control";

export interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  headers?: Record<string, string>;
  description?: string;
}

export interface McpBridgeConfig {
  url?: string;        // Full URL: http://192.168.1.100:3001
  host?: string;       // Host only: 192.168.1.100
  port?: number;       // Port only: 3001
}

export interface McpServerStatus {
  serverId: string;
  connected: boolean;
  error?: string;
  lastConnected?: Date;
  toolCount: number;
  tools: string[];
}

export interface McpState {
  servers: McpServerConfig[];
  serverStatuses: Record<string, McpServerStatus>;
  loading: boolean;
  error: string | null;
  // Connection settings
  retryAttempts: number;
  retryDelay: number;
  connectionTimeout: number;
  // Tool response settings
  maxResponseSize: number;
  // Bridge configuration for stdio servers
  bridgeConfig: McpBridgeConfig;
}

export interface McpActions {
  // Server Management
  setServers: (servers: McpServerConfig[]) => void;
  addServer: (server: Omit<McpServerConfig, 'id'>) => void;
  updateServer: (id: string, updates: Partial<McpServerConfig>) => void;
  deleteServer: (id: string) => void;
  
  // Connection Management
  setServerStatus: (status: McpServerStatus) => void;
  clearServerStatus: (serverId: string) => void;
  
  // Connection Settings
  setRetryAttempts: (attempts: number) => void;
  setRetryDelay: (delay: number) => void;
  setConnectionTimeout: (timeout: number) => void;
  
  // Tool Response Settings
  setMaxResponseSize: (size: number) => void;
  
  // Bridge Configuration
  setBridgeConfig: (config: McpBridgeConfig) => void;
  
  // State Management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadMcpState: () => Promise<void>;
  resetMcpState: () => void;
  
  // Event Integration
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
  
  // Proxy Configuration Export
  exportProxyConfig: () => void;
}

// Default constants
const DEFAULT_MCP_RETRY_ATTEMPTS = 3;
const DEFAULT_MCP_RETRY_DELAY = 2000; // 2 seconds
const DEFAULT_MCP_CONNECTION_TIMEOUT = 10000; // 10 seconds
const DEFAULT_MCP_MAX_RESPONSE_SIZE = 128000; // 128KB - much more generous default

const defaultMcpState: McpState = {
  servers: [],
  serverStatuses: {},
  loading: false,
  error: null,
  retryAttempts: DEFAULT_MCP_RETRY_ATTEMPTS,
  retryDelay: DEFAULT_MCP_RETRY_DELAY,
  connectionTimeout: DEFAULT_MCP_CONNECTION_TIMEOUT,
  maxResponseSize: DEFAULT_MCP_MAX_RESPONSE_SIZE,
  bridgeConfig: {},
};

export const useMcpStore = create(
  immer<McpState & McpActions>((set, get) => ({
    ...defaultMcpState,

    // Server Management Actions
    setServers: (servers: McpServerConfig[]) => {
      set((state) => {
        state.servers = servers;
        state.error = null;
      });
      
      // Persist to storage
      PersistenceService.saveSetting("mcpServers", servers).catch((error: any) => {
        console.error("Failed to persist MCP servers:", error);
      });
      
      // Emit change event
      emitter.emit(mcpEvent.serversChanged, { servers });
    },

    addServer: (serverData: Omit<McpServerConfig, 'id'>) => {
      const server: McpServerConfig = {
        ...serverData,
        id: `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
      
      set((state) => {
        state.servers.push(server);
        state.error = null;
      });
      
      const updatedServers = get().servers;
      
      // Persist to storage
      PersistenceService.saveSetting("mcpServers", updatedServers).catch((error: any) => {
        console.error("Failed to persist MCP servers:", error);
      });
      
      // Emit events
      emitter.emit(mcpEvent.serverAdded, { server });
      emitter.emit(mcpEvent.serversChanged, { servers: updatedServers });
    },

    updateServer: (id: string, updates: Partial<McpServerConfig>) => {
      let updatedServer: McpServerConfig | null = null;
      
      set((state) => {
        const serverIndex = state.servers.findIndex(s => s.id === id);
        if (serverIndex !== -1) {
          state.servers[serverIndex] = { ...state.servers[serverIndex], ...updates };
          updatedServer = state.servers[serverIndex];
          state.error = null;
        }
      });
      
      if (updatedServer) {
        const updatedServers = get().servers;
        
        // Persist to storage
        PersistenceService.saveSetting("mcpServers", updatedServers).catch((error: any) => {
          console.error("Failed to persist MCP servers:", error);
        });
        
        // Emit events
        emitter.emit(mcpEvent.serverUpdated, { server: updatedServer });
        emitter.emit(mcpEvent.serversChanged, { servers: updatedServers });
      }
    },

    deleteServer: (id: string) => {
      set((state) => {
        state.servers = state.servers.filter(s => s.id !== id);
        delete state.serverStatuses[id];
        state.error = null;
      });
      
      const updatedServers = get().servers;
      
      // Persist to storage
      PersistenceService.saveSetting("mcpServers", updatedServers).catch((error: any) => {
        console.error("Failed to persist MCP servers:", error);
      });
      
      // Emit events
      emitter.emit(mcpEvent.serverDeleted, { serverId: id });
      emitter.emit(mcpEvent.serversChanged, { servers: updatedServers });
    },

    // Connection Management Actions
    setServerStatus: (status: McpServerStatus) => {
      set((state) => {
        state.serverStatuses[status.serverId] = status;
      });
      
      // Emit events
      emitter.emit(mcpEvent.serverConnectionChanged, {
        serverId: status.serverId,
        connected: status.connected,
        error: status.error,
      });
      
      if (status.tools.length > 0) {
        emitter.emit(mcpEvent.toolsChanged, {
          serverId: status.serverId,
          tools: status.tools,
        });
      }
    },

    clearServerStatus: (serverId: string) => {
      set((state) => {
        delete state.serverStatuses[serverId];
      });
      
      emitter.emit(mcpEvent.serverConnectionChanged, {
        serverId,
        connected: false,
      });
    },

    // Connection Settings Actions
    setRetryAttempts: (attempts: number) => {
      const clampedAttempts = Math.max(0, Math.min(10, attempts));
      set((state) => {
        state.retryAttempts = clampedAttempts;
      });
      
      PersistenceService.saveSetting("mcpRetryAttempts", clampedAttempts).catch((error: any) => {
        console.error("Failed to persist MCP retry attempts:", error);
      });
      
      emitter.emit(mcpEvent.retryAttemptsChanged, { attempts: clampedAttempts });
    },

    setRetryDelay: (delay: number) => {
      const clampedDelay = Math.max(500, Math.min(30000, delay));
      set((state) => {
        state.retryDelay = clampedDelay;
      });
      
      PersistenceService.saveSetting("mcpRetryDelay", clampedDelay).catch((error: any) => {
        console.error("Failed to persist MCP retry delay:", error);
      });
      
      emitter.emit(mcpEvent.retryDelayChanged, { delay: clampedDelay });
    },

    setConnectionTimeout: (timeout: number) => {
      const clampedTimeout = Math.max(1000, Math.min(60000, timeout));
      set((state) => {
        state.connectionTimeout = clampedTimeout;
      });
      
      PersistenceService.saveSetting("mcpConnectionTimeout", clampedTimeout).catch((error: any) => {
        console.error("Failed to persist MCP connection timeout:", error);
      });
      
      emitter.emit(mcpEvent.connectionTimeoutChanged, { timeout: clampedTimeout });
    },

    setMaxResponseSize: (size: number) => {
      const clampedSize = Math.max(1000, Math.min(10000000, size)); // 1KB to 10MB range
      set((state) => {
        state.maxResponseSize = clampedSize;
      });
      
      PersistenceService.saveSetting("mcpMaxResponseSize", clampedSize).catch((error: any) => {
        console.error("Failed to persist MCP max response size:", error);
      });
      
      emitter.emit(mcpEvent.maxResponseSizeChanged, { size: clampedSize });
    },

    // Bridge Configuration Actions
    setBridgeConfig: (config: McpBridgeConfig) => {
      set((state) => {
        state.bridgeConfig = { ...config };
      });
      
      PersistenceService.saveSetting("mcpBridgeConfig", config).catch((error: any) => {
        console.error("Failed to persist MCP bridge config:", error);
      });
      
      emitter.emit(mcpEvent.bridgeConfigChanged, { config });
    },

    // State Management Actions
    setLoading: (loading: boolean) => {
      set((state) => {
        state.loading = loading;
      });
    },

    setError: (error: string | null) => {
      set((state) => {
        state.error = error;
      });
    },

    loadMcpState: async () => {
      try {
        set((state) => {
          state.loading = true;
          state.error = null;
        });

        // Load all MCP settings from persistence
        const [
          servers,
          retryAttempts,
          retryDelay,
          connectionTimeout,
          maxResponseSize,
          bridgeConfig,
        ] = await Promise.all([
          PersistenceService.loadSetting<McpServerConfig[]>("mcpServers", []),
          PersistenceService.loadSetting<number>("mcpRetryAttempts", DEFAULT_MCP_RETRY_ATTEMPTS),
          PersistenceService.loadSetting<number>("mcpRetryDelay", DEFAULT_MCP_RETRY_DELAY),
          PersistenceService.loadSetting<number>("mcpConnectionTimeout", DEFAULT_MCP_CONNECTION_TIMEOUT),
          PersistenceService.loadSetting<number>("mcpMaxResponseSize", DEFAULT_MCP_MAX_RESPONSE_SIZE),
          PersistenceService.loadSetting<McpBridgeConfig>("mcpBridgeConfig", {}),
        ]);
        
        set((state) => {
          state.servers = servers || [];
          state.retryAttempts = retryAttempts;
          state.retryDelay = retryDelay;
          state.connectionTimeout = connectionTimeout;
          state.maxResponseSize = maxResponseSize;
          state.bridgeConfig = bridgeConfig || {};
          state.loading = false;
        });

        // Emit change events
        emitter.emit(mcpEvent.serversChanged, { servers: servers || [] });
        emitter.emit(mcpEvent.retryAttemptsChanged, { attempts: retryAttempts });
        emitter.emit(mcpEvent.retryDelayChanged, { delay: retryDelay });
        emitter.emit(mcpEvent.connectionTimeoutChanged, { timeout: connectionTimeout });
        emitter.emit(mcpEvent.maxResponseSizeChanged, { size: maxResponseSize });
        emitter.emit(mcpEvent.bridgeConfigChanged, { config: bridgeConfig || {} });
        
      } catch (error: any) {
        console.error("Failed to load MCP state:", error);
        set((state) => {
          state.error = error.message || "Failed to load MCP state";
          state.loading = false;
        });
      }
    },

    resetMcpState: () => {
      set((state) => {
        state.servers = [];
        state.serverStatuses = {};
        state.retryAttempts = DEFAULT_MCP_RETRY_ATTEMPTS;
        state.retryDelay = DEFAULT_MCP_RETRY_DELAY;
        state.connectionTimeout = DEFAULT_MCP_CONNECTION_TIMEOUT;
        state.maxResponseSize = DEFAULT_MCP_MAX_RESPONSE_SIZE;
        state.bridgeConfig = {};
        state.loading = false;
        state.error = null;
      });
      
      // Clear persistence
      Promise.all([
        PersistenceService.saveSetting("mcpServers", []),
        PersistenceService.saveSetting("mcpRetryAttempts", DEFAULT_MCP_RETRY_ATTEMPTS),
        PersistenceService.saveSetting("mcpRetryDelay", DEFAULT_MCP_RETRY_DELAY),
        PersistenceService.saveSetting("mcpConnectionTimeout", DEFAULT_MCP_CONNECTION_TIMEOUT),
        PersistenceService.saveSetting("mcpMaxResponseSize", DEFAULT_MCP_MAX_RESPONSE_SIZE),
      ]).catch((error: any) => {
        console.error("Failed to clear MCP settings from storage:", error);
      });
      
      // Emit change events
      emitter.emit(mcpEvent.serversChanged, { servers: [] });
      emitter.emit(mcpEvent.retryAttemptsChanged, { attempts: DEFAULT_MCP_RETRY_ATTEMPTS });
      emitter.emit(mcpEvent.retryDelayChanged, { delay: DEFAULT_MCP_RETRY_DELAY });
      emitter.emit(mcpEvent.connectionTimeoutChanged, { timeout: DEFAULT_MCP_CONNECTION_TIMEOUT });
      emitter.emit(mcpEvent.maxResponseSizeChanged, { size: DEFAULT_MCP_MAX_RESPONSE_SIZE });
    },

    // Event Integration
    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const actions = get();
      return [
        {
          eventName: mcpEvent.setServersRequest,
          handler: (payload: { servers: McpServerConfig[] }) => 
            actions.setServers(payload.servers),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.addServerRequest,
          handler: (payload: { server: Omit<McpServerConfig, 'id'> }) => 
            actions.addServer(payload.server),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.updateServerRequest,
          handler: (payload: { id: string; updates: Partial<McpServerConfig> }) => 
            actions.updateServer(payload.id, payload.updates),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.deleteServerRequest,
          handler: (payload: { id: string }) => 
            actions.deleteServer(payload.id),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.setRetryAttemptsRequest,
          handler: (payload: { attempts: number }) => 
            actions.setRetryAttempts(payload.attempts),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.setRetryDelayRequest,
          handler: (payload: { delay: number }) => 
            actions.setRetryDelay(payload.delay),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.setConnectionTimeoutRequest,
          handler: (payload: { timeout: number }) => 
            actions.setConnectionTimeout(payload.timeout),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.setMaxResponseSizeRequest,
          handler: (payload: { size: number }) => 
            actions.setMaxResponseSize(payload.size),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.loadMcpStateRequest,
          handler: () => actions.loadMcpState(),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.resetMcpStateRequest,
          handler: () => actions.resetMcpState(),
          storeId: "mcpStore",
        },
      ];
    },

    // Proxy Configuration Export
    exportProxyConfig: () => {
      const servers = get().servers.map(server => ({
        id: server.id,
        name: server.name,
        url: server.url,
        enabled: server.enabled,
      }));
    },
  }))
); 