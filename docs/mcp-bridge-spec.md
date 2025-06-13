# LiteChat MCP Bridge Specification

## Overview

The LiteChat MCP Bridge is a lightweight local service that enables browser-based LiteChat to connect to stdio MCP servers. Since browsers cannot directly spawn processes or access local file systems, the bridge acts as a secure proxy between LiteChat and local MCP server processes.

## Architecture

```
┌─────────────┐    HTTP/JSON     ┌─────────────┐    stdio     ┌─────────────┐
│   LiteChat  │ ←──────────────→ │ MCP Bridge  │ ←──────────→ │ MCP Server  │
│  (Browser)  │                  │ (localhost) │              │  (Process)  │
└─────────────┘                  └─────────────┘              └─────────────┘
```

## API Endpoints

### Health Check
```http
GET /health
```
**Response**: `200 OK` with service status

### Start MCP Server
```http
POST /mcp/start
Content-Type: application/json

{
  "serverId": "unique-server-id",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
  "cwd": "/working/directory",
  "headers": {}
}
```
**Response**: `200 OK` with `{ "sessionId": "session-uuid" }`

### Initialize MCP Connection
```http
POST /mcp/{sessionId}/initialize
Content-Type: application/json

{
  "protocolVersion": "2025-03-26",
  "capabilities": { "tools": {} },
  "clientInfo": { "name": "LiteChat", "version": "1.0.0" }
}
```
**Response**: MCP initialize response

### Send Initialized Notification
```http
POST /mcp/{sessionId}/initialized
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "initialized", 
  "params": {}
}
```
**Response**: `200 OK`

### Send MCP Message
```http
POST /mcp/{sessionId}/message
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```
**Response**: MCP response from stdio server

### Close Session
```http
POST /mcp/{sessionId}/close
```
**Response**: `200 OK`

## Security Considerations

### Network Security
- **Localhost Only**: Bridge binds only to 127.0.0.1, not 0.0.0.0
- **CORS Headers**: Appropriate CORS headers for browser communication
- **Request Validation**: All requests validated before processing

### Process Security
- **Sandboxing**: MCP servers run in isolated child processes
- **Resource Limits**: CPU and memory limits on spawned processes
- **Path Validation**: Working directory and file path validation
- **Command Restrictions**: Optional allowlist of permitted commands

### Session Management
- **Session Isolation**: Each MCP server gets unique session ID
- **Timeout Handling**: Sessions expire after inactivity
- **Clean Shutdown**: Proper cleanup of child processes

## Configuration

### Default Configuration
```json
{
  "port": 3001,
  "host": "127.0.0.1",
  "cors": {
    "origin": ["http://localhost:3000", "http://localhost:5173"],
    "methods": ["GET", "POST"]
  },
  "security": {
    "allowedCommands": ["npx", "node", "python", "python3"],
    "maxProcesses": 10,
    "processTimeout": 300000,
    "maxMemory": "512MB"
  }
}
```

### Environment Variables
- `BRIDGE_PORT`: Service port (default: 3001)
- `BRIDGE_HOST`: Bind address (default: 127.0.0.1)
- `BRIDGE_VERBOSE`: Enable verbose logging
- `BRIDGE_ALLOWED_COMMANDS`: Comma-separated list of allowed commands

## Error Handling

### HTTP Status Codes
- `200 OK`: Success
- `400 Bad Request`: Invalid request format
- `404 Not Found`: Session not found
- `429 Too Many Requests`: Rate limited
- `500 Internal Server Error`: Server error

### Error Response Format
```json
{
  "error": {
    "code": "PROCESS_SPAWN_FAILED",
    "message": "Failed to spawn MCP server process",
    "details": {
      "command": "npx",
      "args": ["-y", "nonexistent-server"],
      "exitCode": 1
    }
  }
}
```

## Implementation Guidelines

### Process Management
```javascript
// Spawn MCP server process
const process = spawn(command, args, {
  cwd: workingDirectory,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production' }
});

// Handle process lifecycle
process.on('exit', (code) => {
  console.log(`MCP server exited with code ${code}`);
  cleanupSession(sessionId);
});
```

### Message Routing
```javascript
// Route HTTP messages to stdio
app.post('/mcp/:sessionId/message', async (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Send to stdio
  session.process.stdin.write(JSON.stringify(req.body) + '\n');
  
  // Wait for response
  const response = await session.waitForResponse(req.body.id);
  res.json(response);
});
```

### Session Cleanup
```javascript
// Cleanup on session end
function cleanupSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.process.kill('SIGTERM');
    session.cleanup();
    sessions.delete(sessionId);
  }
}
```

## Installation & Usage

### NPM Package Structure
```
litechat-mcp-bridge/
├── package.json
├── bin/
│   └── litechat-mcp-bridge
├── src/
│   ├── index.js
│   ├── server.js
│   ├── session.js
│   └── config.js
└── README.md
```

### CLI Interface
```bash
# Basic usage
litechat-mcp-bridge

# With options
litechat-mcp-bridge --port 3001 --verbose

# Show help
litechat-mcp-bridge --help
```

## Testing

### Health Check Test
```bash
curl http://localhost:3001/health
```

### MCP Server Test
```bash
# Start filesystem server
curl -X POST http://localhost:3001/mcp/start \
  -H "Content-Type: application/json" \
  -d '{"serverId":"test","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","."]}'
```

## Compatibility

### Supported Platforms
- **Windows**: Windows 10+ with Node.js 18+
- **macOS**: macOS 10.15+ with Node.js 18+
- **Linux**: Ubuntu 18.04+ / equivalent with Node.js 18+

### MCP Compatibility
- **Protocol Version**: 2025-03-26 (latest)
- **Fallback Support**: 2024-11-05 (previous)
- **Transport**: stdio only (HTTP/SSE handled directly by LiteChat)

## License

MIT License - See LICENSE file for details. 