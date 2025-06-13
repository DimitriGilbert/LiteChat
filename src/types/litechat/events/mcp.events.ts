import type { McpState, McpServerConfig, McpBridgeConfig } from "@/store/mcp.store";

export const mcpEvent = {
  // State Change Events
  serversChanged: "mcp.servers.changed",
  serverAdded: "mcp.server.added",
  serverUpdated: "mcp.server.updated",
  serverDeleted: "mcp.server.deleted",
  serverConnectionChanged: "mcp.server.connection.changed",
  toolsChanged: "mcp.tools.changed",

  // Connection Settings Events
  retryAttemptsChanged: "mcp.retry.attempts.changed",
  retryDelayChanged: "mcp.retry.delay.changed",
  connectionTimeoutChanged: "mcp.connection.timeout.changed",
  maxResponseSizeChanged: "mcp.max.response.size.changed",
  bridgeConfigChanged: "mcp.bridge.config.changed",

  // Tool Lifecycle Events for Modding API
  beforeToolCall: "mcp.tool.before.call",
  afterToolCall: "mcp.tool.after.call",
  toolCallFailed: "mcp.tool.call.failed",
  beforeToolExecution: "mcp.tool.before.execution",
  toolDiscovered: "mcp.tool.discovered",
  toolRegistered: "mcp.tool.registered",
  toolUnregistered: "mcp.tool.unregistered",

  // Action Request Events
  setServersRequest: "mcp.set.servers.request",
  addServerRequest: "mcp.add.server.request",
  updateServerRequest: "mcp.update.server.request",
  deleteServerRequest: "mcp.delete.server.request",
  connectServerRequest: "mcp.connect.server.request",
  disconnectServerRequest: "mcp.disconnect.server.request",
  refreshToolsRequest: "mcp.refresh.tools.request",
  loadMcpStateRequest: "mcp.load.state.request",
  resetMcpStateRequest: "mcp.reset.state.request",

  // Connection Settings Request Events
  setRetryAttemptsRequest: "mcp.set.retry.attempts.request",
  setRetryDelayRequest: "mcp.set.retry.delay.request",
  setConnectionTimeoutRequest: "mcp.set.connection.timeout.request",
  setMaxResponseSizeRequest: "mcp.set.max.response.size.request",
} as const;

export interface McpEventPayloads {
  // State Change Events
  [mcpEvent.serversChanged]: { servers: McpState["servers"] };
  [mcpEvent.serverAdded]: { server: McpServerConfig };
  [mcpEvent.serverUpdated]: { server: McpServerConfig };
  [mcpEvent.serverDeleted]: { serverId: string };
  [mcpEvent.serverConnectionChanged]: { 
    serverId: string; 
    connected: boolean; 
    error?: string;
  };
  [mcpEvent.toolsChanged]: { 
    serverId: string; 
    tools: string[]; 
  };

  // Connection Settings Events
  [mcpEvent.retryAttemptsChanged]: { attempts: number };
  [mcpEvent.retryDelayChanged]: { delay: number };
  [mcpEvent.connectionTimeoutChanged]: { timeout: number };
  [mcpEvent.maxResponseSizeChanged]: { size: number };
  [mcpEvent.bridgeConfigChanged]: { config: McpBridgeConfig };

  // Tool Lifecycle Events for Modding API
  [mcpEvent.beforeToolCall]: {
    toolName: string;
    serverId: string;
    serverName: string;
    parameters: any;
    conversationId: string;
    interactionId: string;
  };
  [mcpEvent.afterToolCall]: {
    toolName: string;
    serverId: string;
    serverName: string;
    parameters: any;
    result: any;
    conversationId: string;
    interactionId: string;
    duration: number;
  };
  [mcpEvent.toolCallFailed]: {
    toolName: string;
    serverId: string;
    serverName: string;
    parameters: any;
    error: string;
    conversationId: string;
    interactionId: string;
  };
  [mcpEvent.beforeToolExecution]: {
    toolName: string;
    serverId: string;
    serverName: string;
    parameters: any;
    conversationId: string;
    interactionId: string;
    // Modding API can modify parameters by emitting modified parameters in response
  };
  [mcpEvent.toolDiscovered]: {
    toolName: string;
    serverId: string;
    serverName: string;
    toolDefinition: any;
  };
  [mcpEvent.toolRegistered]: {
    toolName: string;
    serverId: string;
    serverName: string;
    prefixedToolName: string;
  };
  [mcpEvent.toolUnregistered]: {
    toolName: string;
    serverId: string;
    prefixedToolName: string;
  };

  // Action Request Events
  [mcpEvent.setServersRequest]: { servers: McpState["servers"] };
  [mcpEvent.addServerRequest]: { server: Omit<McpServerConfig, 'id'> };
  [mcpEvent.updateServerRequest]: { 
    id: string; 
    updates: Partial<McpServerConfig> 
  };
  [mcpEvent.deleteServerRequest]: { id: string };
  [mcpEvent.connectServerRequest]: { serverId: string };
  [mcpEvent.disconnectServerRequest]: { serverId: string };
  [mcpEvent.refreshToolsRequest]: { serverId?: string }; // undefined = all servers
  [mcpEvent.loadMcpStateRequest]: undefined;
  [mcpEvent.resetMcpStateRequest]: undefined;

  // Connection Settings Request Events
  [mcpEvent.setRetryAttemptsRequest]: { attempts: number };
  [mcpEvent.setRetryDelayRequest]: { delay: number };
  [mcpEvent.setConnectionTimeoutRequest]: { timeout: number };
  [mcpEvent.setMaxResponseSizeRequest]: { size: number };
} 