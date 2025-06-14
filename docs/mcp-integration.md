# MCP (Model Context Protocol) Integration

LiteChat supports HTTP-based MCP (Model Context Protocol) servers, allowing you to extend the AI assistant with additional tools and capabilities from external services.

## What is MCP?

MCP (Model Context Protocol) is an open standard that enables secure connections between AI applications and external data sources and tools. Think of it as "USB-C for AI apps" - it provides a standardized way for AI models to access external functionality.

### Key Benefits

- **Standardized Protocol**: Works with any MCP-compliant server
- **Secure Access**: Controlled access to external tools and data
- **Extensible**: Add custom tools without modifying LiteChat core
- **Real-time**: Tools are available during AI conversations
- **Industry Adoption**: Supported by major companies (Cloudflare, Stripe, OpenAI, etc.)

## Supported MCP Servers

LiteChat supports **multiple MCP server types** with comprehensive transport protocols:

### 1. Streamable HTTP Transport (MCP 2025-03-26) - Primary
- **Latest MCP specification** with single endpoint design
- **Session management** with `Mcp-Session-Id` headers
- **Enhanced security** with Origin header validation
- **Improved resumability** with event IDs and connection recovery
- **Better error handling** and backwards compatibility

### 2. Stdio Transport - Local Servers
- **Local MCP servers** via LiteChat MCP Bridge service
- **File system access** and local tool integration
- **Process management** through secure bridge proxy
- **High performance** local communication
- **Rich local tool ecosystem** access

### 3. SSE Transport (Legacy) - Backwards Compatibility
- **Automatic fallback** for servers not supporting Streamable HTTP
- **Backwards compatibility** with older MCP implementations
- **Graceful degradation** with user notification of transport type

This allows connection to:
- **Latest MCP servers** using Streamable HTTP protocol
- **Local MCP servers** using stdio transport via bridge
- **Legacy MCP servers** using deprecated SSE transport  
- **Public MCP API endpoints**
- **Self-hosted MCP servers**
- **Cloud-based MCP services**
- **Custom MCP implementations**

## Configuration

### Adding MCP Servers

1. Go to **Settings → Assistant → MCP**
2. Click **"Add MCP Server"**
3. Configure the server based on type:

#### HTTP/HTTPS Servers
- **Name**: Display name for the server
- **URL**: HTTP/HTTPS endpoint (e.g., `https://api.example.com/mcp`)
- **Description**: Optional description
- **Headers**: JSON object for authentication (optional)
- **Enabled**: Toggle to enable/disable the server

#### Stdio (Local/Remote) Servers
- **Name**: Display name for the server
- **URL**: Stdio command URL (e.g., `stdio://npx?args=-y,@modelcontextprotocol/server-filesystem,/path/to/directory`)
- **Description**: Optional description
- **Headers**: Not applicable for stdio servers
- **Enabled**: Toggle to enable/disable the server

> **Bridge Location**: Configure bridge location in MCP settings to use remote bridges on VMs, containers, or other hosts.

> **Backup & Restore**: MCP server configurations are included in [Full Configuration Backups](./persistence.md#full-application-configuration-backup) and can be managed individually via [Data Management Settings](./persistence.md#individual-category-exportimport).

#### Stdio URL Format
For stdio servers, use the format: `stdio://command?args=arg1,arg2&cwd=/working/directory`

Examples:
- `stdio://npx?args=-y,@modelcontextprotocol/server-filesystem,/Users/username/Documents`
- `stdio://python?args=/path/to/my-mcp-server.py&cwd=/home/user`
- `stdio://node?args=server.js,--port,3000`

### Connection Settings

Configure retry behavior and timeouts in the MCP settings:

- **Retry Attempts** (0-10): Number of automatic retry attempts
- **Retry Delay** (500-30000ms): Initial delay between retries (uses exponential backoff)
- **Connection Timeout** (1000-60000ms): Maximum time to wait for initial connection

### Transport Priority

LiteChat automatically determines transport type based on the server URL and attempts connections in the following priority:

#### For HTTP/HTTPS URLs:
1. **Streamable HTTP Transport (2025-03-26)** - Latest MCP specification
   - Single endpoint with POST/GET support
   - Session management and enhanced security
   - Better error handling and resumability

2. **SSE Transport (Legacy)** - Backwards compatibility fallback
   - Deprecated transport method
   - Automatic fallback when Streamable HTTP fails
   - User notification about transport type used

#### For Stdio URLs (`stdio://`):
1. **Stdio Transport via Bridge** - Local server support
   - Requires LiteChat MCP Bridge service running on localhost:3001
   - Spawns and manages local MCP server processes
   - Provides access to local filesystem and system tools

This ensures compatibility with modern, legacy, and local MCP servers while prioritizing the latest protocol features.

## LiteChat MCP Bridge Setup

To use stdio MCP servers, you need to install and run the LiteChat MCP Bridge service:

### Installation
```bash
# run from LiteChat project
node bin/mcp-bridge.js
```

### Running the Bridge
```bash
# Start with default settings (port 3001)
node bin/mcp-bridge.js

# Custom port and verbose logging
node bin/mcp-bridge.js --port 8080 --verbose

# With environment variables
MCP_BRIDGE_PORT=8080 MCP_BRIDGE_VERBOSE=true node bin/mcp-bridge.js

# Show all options
node bin/mcp-bridge.js --help
```

### What the Bridge Does
- **Process Management**: Safely spawns and manages local MCP server processes
- **Security Isolation**: Runs MCP servers in isolated processes with controlled access
- **Protocol Translation**: Converts HTTP requests to stdio MCP communication
- **Session Management**: Handles multiple concurrent MCP server instances
- **Port Auto-Detection**: LiteChat automatically detects the bridge on common ports
- **Error Handling**: Provides robust error handling and logging

### Configuration Options

#### Bridge Service Configuration
- **Port**: Configurable via `--port` or `MCP_BRIDGE_PORT` (default: 3001)
- **Host**: Configurable via `--host` or `MCP_BRIDGE_HOST` (default: 127.0.0.1)
- **Max Processes**: Limit concurrent MCP servers via `--max-processes` (default: 10)
- **Process Timeout**: Auto-cleanup idle processes via `--timeout` (default: 300000ms)
- **Allowed Commands**: Security allowlist via `--allowed-commands` (default: npx,node,python,python3)

#### LiteChat Bridge Configuration
Configure where LiteChat looks for the bridge service:

**Option 1: Full URL** (highest priority)
```json
{
  "url": "https://my-bridge.example.com:3001"
}
```

```json
{
  "url": "http://192.168.1.100:3001"
}
```

**Option 2: Host + Port**
```json
{
  "host": "192.168.1.100",
  "port": 3001
}
```

**Option 3: Auto-Detection** (fallback)
- LiteChat scans localhost ports: 3001, 8080, 3000, 8000
- Uses HTTP by default (specify full URL for HTTPS)

#### Remote Bridge Examples
```bash
# Run bridge on VM/container with custom host binding
node bin/mcp-bridge.js --host 0.0.0.0 --port 3001

# Run bridge on specific interface
node bin/mcp-bridge.js --host 192.168.1.100 --port 8080

# Run bridge in Docker container
docker run -p 3001:3001 my-mcp-bridge node bin/mcp-bridge.js --host 0.0.0.0
```

### Requirements
- **Node.js 18+**: Required for running the bridge service
- **Network Access**: Bridge runs on configurable host/port
- **Process Permissions**: Ability to spawn child processes for MCP servers
- **Firewall**: Ensure ports are accessible if running bridge remotely

> **Security Note**: Configure bridge host binding carefully. Use `127.0.0.1` for localhost-only, or `0.0.0.0` for remote access. Always validate commands against the allowlist.

> **Remote Access**: When running the bridge on a remote host, ensure proper network security and consider using VPN or firewall rules to restrict access.

> **Note**: Connection settings are now properly managed in the dedicated MCP store, separate from general application settings, ensuring clean architectural separation.

### Authentication

For servers requiring authentication, add headers in JSON format:

```json
{
  "Authorization": "Bearer your-api-token",
  "X-API-Key": "your-api-key",
  "X-Custom-Header": "custom-value"
}
```

> **Security Note**: When using Streamable HTTP transport, the `Origin` header is automatically set to `window.location.origin` for security validation and should not be manually configured. This follows the MCP 2025-03-26 specification security requirements.

## Error Handling & Reliability

### Graceful Connection Handling

LiteChat implements robust connection handling:

- **Automatic Retries**: Failed connections are retried with exponential backoff
- **Timeout Protection**: Connections that hang are terminated after the configured timeout
- **Status Monitoring**: Real-time connection status for each server
- **Error Classification**: Enhanced error messages for common issues

### Toast Notifications

Users receive informative notifications about:

- **Successful Connections**: Confirmation when servers connect successfully
- **Retry Progress**: Updates during retry attempts with countdown
- **Final Failures**: Clear error messages when all retry attempts are exhausted
- **Enhanced Errors**: Specific guidance for common connection issues

### Common Error Messages

- **Network Error**: Server unreachable (check if server is running)
- **Connection Timeout**: Server not responding (increase timeout or check server health)
- **Authentication Error**: Invalid credentials (check headers configuration)
- **Server Not Found**: Invalid URL or endpoint doesn't exist
- **Server Error**: Internal server error (check server logs)

## Tool Integration

### How MCP Tools Work

1. **Discovery**: LiteChat connects to enabled MCP servers and discovers available tools
2. **Registration**: Tools are registered with prefixed names (`mcp_{server_id}_{tool_name}`)
3. **Availability**: Tools become available in the AI assistant's tool selector
4. **Execution**: During conversations, the AI can call MCP tools as needed
5. **Results**: Tool results are integrated into the conversation context

### Tool Naming Convention

MCP tools are prefixed to avoid conflicts:
- Original tool: `search_database`
- LiteChat tool: `mcp_myserver_search_database`

### Tool Capabilities

MCP tools can provide various capabilities:
- **Data Access**: Query databases, APIs, files
- **Actions**: Perform operations, send notifications, create resources
- **Integrations**: Connect to third-party services
- **Custom Logic**: Execute domain-specific business logic

## Usage in Conversations

### Automatic Tool Selection

The AI assistant automatically selects appropriate MCP tools based on:
- Conversation context
- User requests
- Available tool capabilities
- Tool descriptions and parameters

### Manual Tool Control

Users can control tool usage through:
- **Tool Selector**: Enable/disable specific tool categories
- **Server Management**: Enable/disable entire MCP servers
- **Context Awareness**: Tools respect conversation and project context

## Best Practices

### Server Configuration

1. **Use Descriptive Names**: Choose clear, meaningful names for servers
2. **Set Appropriate Timeouts**: Balance responsiveness with reliability
3. **Configure Reasonable Retries**: Avoid overwhelming servers with retries
4. **Secure Authentication**: Use proper authentication headers for sensitive services

### Connection Management

1. **Monitor Status**: Check server connection status regularly
2. **Test Connectivity**: Verify servers are reachable before enabling
3. **Update Regularly**: Keep server URLs and credentials up to date
4. **Plan for Downtime**: Expect occasional connection failures

### Performance Optimization

1. **Selective Enabling**: Only enable servers you actively use
2. **Reasonable Timeouts**: Don't set timeouts too high for responsive UI
3. **Monitor Usage**: Track which tools are actually being used
4. **Regular Cleanup**: Remove unused or non-functional servers

## Troubleshooting

### Connection Issues

**Problem**: Server won't connect
**Solutions**:
- Verify the server is running and accessible
- Check URL format (must be valid HTTP/HTTPS URL)
- Test connection from browser or curl
- Review authentication headers

**Problem**: Frequent disconnections
**Solutions**:
- Increase connection timeout
- Check server stability
- Monitor network connectivity
- Review server logs for errors

### Authentication Issues

**Problem**: 401/403 errors
**Solutions**:
- Verify authentication headers format (valid JSON)
- Check API key/token validity
- Confirm required headers are included
- Test authentication with server documentation

### Performance Issues

**Problem**: Slow tool responses
**Solutions**:
- Increase connection timeout if needed
- Check MCP server performance
- Monitor network latency
- Consider server location/hosting

## Modding API Integration

### Enhanced Event System for Mods

The MCP system provides comprehensive events for the modding API, enabling powerful customizations and extensions:

#### Tool Lifecycle Events

Mods can intercept and enhance tool behavior:

```typescript
// Modify tool parameters before execution
modApi.on('mcp.tool.before.execution', (payload) => {
  if (payload.toolName === 'search_files') {
    // Add additional search filters
    payload.parameters.filters = {
      ...payload.parameters.filters,
      excludeHidden: true
    };
  }
});

// Monitor tool performance
modApi.on('mcp.tool.after.call', (payload) => {
  console.log(`Tool ${payload.toolName} executed in ${payload.duration}ms`);
  
  if (payload.duration > 5000) {
    modApi.toast('warning', `Slow tool execution: ${payload.toolName}`);
  }
});

// Handle tool failures gracefully
modApi.on('mcp.tool.call.failed', (payload) => {
  if (payload.toolName === 'critical_operation') {
    modApi.toast('error', `Critical operation failed: ${payload.error}`);
    // Trigger backup procedure or fallback logic
  }
});
```

#### Tool Discovery Events

React to new tools becoming available:

```typescript
// Auto-configure tools when discovered
modApi.on('mcp.tool.discovered', (payload) => {
  console.log(`New tool discovered: ${payload.toolName} from ${payload.serverName}`);
  
  // Auto-configure specific tools
  if (payload.toolName === 'code_formatter') {
    modApi.emit('mcp.configure.tool', {
      toolName: payload.toolName,
      config: { indentSize: 2, semicolons: false }
    });
  }
});

// Track tool registration
modApi.on('mcp.tool.registered', (payload) => {
  console.log(`Tool registered: ${payload.prefixedToolName}`);
});
```

#### Connection Events

Monitor and react to server connection changes:

```typescript
// React to connection settings changes
modApi.on('mcp.retry.attempts.changed', (payload) => {
  console.log(`MCP retry attempts updated: ${payload.attempts}`);
});

modApi.on('mcp.server.connection.changed', (payload) => {
  if (!payload.connected && payload.error) {
    // Custom error handling for specific servers
    if (payload.serverId === 'critical-server') {
      modApi.toast('error', 'Critical MCP server disconnected!');
    }
  }
});
```

### Available MCP Events

The complete list of MCP events available to mods:

**Tool Lifecycle:**
- `mcp.tool.before.execution` - Before tool execution (allows parameter modification)
- `mcp.tool.before.call` - Before tool call
- `mcp.tool.after.call` - After successful tool call (includes performance data)
- `mcp.tool.call.failed` - When tool execution fails

**Tool Discovery:**
- `mcp.tool.discovered` - When tools are discovered from MCP servers
- `mcp.tool.registered` - When tool is registered with modding API
- `mcp.tool.unregistered` - When tool is removed

**Server Management:**
- `mcp.servers.changed` - Server list updated
- `mcp.server.added` - New server added
- `mcp.server.updated` - Server configuration changed
- `mcp.server.deleted` - Server removed
- `mcp.server.connection.changed` - Connection status changed
- `mcp.tools.changed` - Available tools changed

**Connection Settings:**
- `mcp.retry.attempts.changed` - Retry attempts setting changed
- `mcp.retry.delay.changed` - Retry delay setting changed
- `mcp.connection.timeout.changed` - Connection timeout changed

## Advanced Configuration

### Custom Headers

For complex authentication or custom requirements:

```json
{
  "Authorization": "Bearer token",
  "X-API-Key": "key",
  "X-User-Agent": "LiteChat/1.0",
  "X-Custom-Context": "value"
}
```

### Development Setup

For development with local MCP servers:

1. **Local Server**: Run MCP server on localhost
2. **CORS Configuration**: Ensure server allows CORS from LiteChat
3. **Development URL**: Use `http://localhost:port/mcp` format
4. **Testing**: Use browser developer tools to debug connections

### Production Deployment

For production MCP server deployments:

1. **HTTPS Required**: Use secure HTTPS endpoints
2. **Authentication**: Implement proper API key/token authentication
3. **Rate Limiting**: Configure appropriate rate limits
4. **Monitoring**: Set up server health monitoring
5. **Backup**: Plan for server redundancy and failover

## Integration Examples

### Database Query Server

```json
{
  "name": "Database Tools",
  "url": "https://api.mycompany.com/mcp/database",
  "description": "Query company database",
  "headers": {
    "Authorization": "Bearer db-access-token",
    "X-Database": "production"
  }
}
```

### File Management Server

```json
{
  "name": "File System",
  "url": "https://fs.mycompany.com/mcp",
  "description": "File operations and management",
  "headers": {
    "X-API-Key": "fs-api-key",
    "X-Workspace": "project-alpha"
  }
}
```

### External API Integration

```json
{
  "name": "External Services",
  "url": "https://integrations.example.com/mcp",
  "description": "Third-party service integration",
  "headers": {
    "Authorization": "Bearer integration-token",
    "X-Client-ID": "litechat-client"
  }
}
```

## Security Considerations

### Authentication Best Practices

1. **Use Strong Tokens**: Generate cryptographically secure API tokens
2. **Rotate Regularly**: Implement token rotation policies
3. **Scope Appropriately**: Limit token permissions to required operations
4. **Monitor Usage**: Track API usage and detect anomalies

### Network Security

1. **HTTPS Only**: Always use HTTPS for production servers
2. **Firewall Rules**: Restrict server access to authorized clients
3. **VPN Access**: Consider VPN for sensitive internal services
4. **Certificate Validation**: Ensure proper SSL certificate validation

### Data Protection

1. **Minimize Exposure**: Only expose necessary data through MCP tools
2. **Input Validation**: Validate all tool parameters on server side
3. **Output Sanitization**: Sanitize tool results before returning
4. **Audit Logging**: Log all tool executions for security audit

## Future Enhancements

### Planned Features

- **WebSocket Transport**: Real-time bidirectional communication
- **Server Discovery**: Automatic discovery of MCP servers
- **Tool Categories**: Organization of tools by category/domain

### Contributing

The MCP integration is designed to be extensible. Contributions welcome for:

- Additional transport protocols
- Enhanced error handling
- Performance optimizations
- Security improvements
- Documentation updates

## Resources

### Official MCP Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP GitHub Repository](https://github.com/modelcontextprotocol)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

### LiteChat Resources

- [Settings Configuration Guide](settings.md)
- [Tool System Documentation](tools.md)
- [API Reference](api.md)
- [Development Guide](development.md)

---

For additional support or questions about MCP integration, please refer to the LiteChat documentation or open an issue on the project repository. 