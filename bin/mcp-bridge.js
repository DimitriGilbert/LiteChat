#!/usr/bin/env node

/**
 * LiteChat MCP Bridge
 * 
 * A local HTTP proxy service that enables browser-based LiteChat to connect
 * to stdio MCP servers by spawning and managing local processes.
 */

import http from 'http';
import { spawn } from 'child_process';
import { URL } from 'url';
import path from 'path';
import fs from 'fs';

// Configuration with defaults
const config = {
  port: parseInt(process.env.MCP_BRIDGE_PORT) || 3001,
  host: process.env.MCP_BRIDGE_HOST || '127.0.0.1',
  verbose: process.env.MCP_BRIDGE_VERBOSE === 'true' || false,
  maxProcesses: parseInt(process.env.MCP_BRIDGE_MAX_PROCESSES) || 10,
  processTimeout: parseInt(process.env.MCP_BRIDGE_PROCESS_TIMEOUT) || 300000, // 5 minutes
  allowedCommands: (process.env.MCP_BRIDGE_ALLOWED_COMMANDS || 'npx,node,python,python3').split(','),
};

// Parse command line arguments
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--port':
    case '-p':
      config.port = parseInt(args[++i]);
      break;
    case '--host':
    case '-h':
      config.host = args[++i];
      break;
    case '--verbose':
    case '-v':
      config.verbose = true;
      break;
    case '--max-processes':
      config.maxProcesses = parseInt(args[++i]);
      break;
    case '--timeout':
      config.processTimeout = parseInt(args[++i]);
      break;
    case '--allowed-commands':
      config.allowedCommands = args[++i].split(',');
      break;
    case '--help':
      console.log(`
LiteChat MCP Bridge - Local stdio MCP server proxy

Usage: node mcp-bridge.js [options]

Options:
  -p, --port <port>           Port to bind to (default: 3001)
  -h, --host <host>           Host to bind to (default: 127.0.0.1)
  -v, --verbose               Enable verbose logging
  --max-processes <num>       Maximum concurrent processes (default: 10)
  --timeout <ms>              Process timeout in milliseconds (default: 300000)
  --allowed-commands <list>   Comma-separated list of allowed commands (default: npx,node,python,python3)
  --help                      Show this help message

Environment Variables:
  MCP_BRIDGE_PORT             Same as --port
  MCP_BRIDGE_HOST             Same as --host  
  MCP_BRIDGE_VERBOSE          Same as --verbose (true/false)
  MCP_BRIDGE_MAX_PROCESSES    Same as --max-processes
  MCP_BRIDGE_PROCESS_TIMEOUT  Same as --timeout
  MCP_BRIDGE_ALLOWED_COMMANDS Same as --allowed-commands

Examples:
  node mcp-bridge.js                              # Start with defaults
  node mcp-bridge.js --port 8080 --verbose       # Custom port with logging
  MCP_BRIDGE_PORT=8080 node mcp-bridge.js        # Using environment variable
      `);
      process.exit(0);
      break;
  }
}

// Global state
const sessions = new Map();
let activeProcesses = 0;

// Utility functions
function log(...args) {
  if (config.verbose) {
    console.log(`[${new Date().toISOString()}]`, ...args);
  }
}

function error(...args) {
  console.error(`[${new Date().toISOString()}] ERROR:`, ...args);
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function isCommandAllowed(command) {
  return config.allowedCommands.includes(command) || config.allowedCommands.includes('*');
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message, details = {}) {
  sendJson(res, statusCode, {
    error: {
      message,
      details,
      timestamp: new Date().toISOString(),
    }
  });
}

// Session management
class McpSession {
  constructor(sessionId, serverId, command, args, cwd) {
    this.sessionId = sessionId;
    this.serverId = serverId;
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.process = null;
    this.messageId = 1;
    this.pendingResponses = new Map();
    this.buffer = '';
    this.lastActivity = Date.now();
    this.timeout = null;
  }

  async start() {
    if (activeProcesses >= config.maxProcesses) {
      throw new Error(`Maximum number of processes (${config.maxProcesses}) reached`);
    }

    if (!isCommandAllowed(this.command)) {
      throw new Error(`Command '${this.command}' is not allowed. Allowed commands: ${config.allowedCommands.join(', ')}`);
    }

    log(`Starting MCP server: ${this.command} ${this.args.join(' ')}`);

    try {
      this.process = spawn(this.command, this.args, {
        cwd: this.cwd || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'production' },
      });

      activeProcesses++;
      
      this.process.on('exit', (code, signal) => {
        activeProcesses = Math.max(0, activeProcesses - 1);
        log(`MCP server process exited: code=${code}, signal=${signal}`);
        this.cleanup();
      });

      this.process.on('error', (err) => {
        error(`MCP server process error:`, err);
        this.cleanup();
      });

      // Handle stdout (MCP responses)
      this.process.stdout.on('data', (data) => {
        this.handleStdoutData(data);
      });

      // Handle stderr (logging)
      this.process.stderr.on('data', (data) => {
        if (config.verbose) {
          console.log(`[MCP:${this.serverId}]`, data.toString().trim());
        }
      });

      // Set up timeout
      this.resetTimeout();

      log(`MCP server started successfully: ${this.sessionId}`);
      
    } catch (err) {
      activeProcesses = Math.max(0, activeProcesses - 1);
      throw new Error(`Failed to spawn process: ${err.message}`);
    }
  }

  handleStdoutData(data) {
    this.buffer += data.toString();
    
    // Process complete JSON lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line.trim());
          this.handleMessage(message);
        } catch (err) {
          error(`Failed to parse MCP response:`, err, 'Line:', line);
        }
      }
    }
  }

  handleMessage(message) {
    this.lastActivity = Date.now();
    this.resetTimeout();
    
    log(`Received MCP message:`, message);
    
    if (message.id && this.pendingResponses.has(message.id)) {
      const { resolve } = this.pendingResponses.get(message.id);
      this.pendingResponses.delete(message.id);
      resolve(message);
    }
  }

  async sendMessage(message) {
    if (!this.process || this.process.killed) {
      throw new Error('MCP process not running');
    }

    // Only assign ID if this is a request without an ID (shouldn't happen with proper clients)
    if (message.method && !message.id) {
      message.id = this.messageId++;
    }

    log(`Sending MCP message:`, message);
    
    return new Promise((resolve, reject) => {
      if (message.id) {
        this.pendingResponses.set(message.id, { resolve, reject });
        
        // Set timeout for response
        setTimeout(() => {
          if (this.pendingResponses.has(message.id)) {
            this.pendingResponses.delete(message.id);
            reject(new Error('MCP request timeout'));
          }
        }, 30000); // 30 second timeout
      }

      try {
        // Forward the message exactly as received, preserving the original ID
        this.process.stdin.write(JSON.stringify(message) + '\n');
        this.lastActivity = Date.now();
        this.resetTimeout();
        
        if (!message.id) {
          // For notifications, resolve immediately
          resolve({ success: true });
        }
      } catch (err) {
        if (message.id) {
          this.pendingResponses.delete(message.id);
        }
        reject(err);
      }
    });
  }

  resetTimeout() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    
    this.timeout = setTimeout(() => {
      log(`Session timeout: ${this.sessionId}`);
      this.cleanup();
    }, config.processTimeout);
  }

  cleanup() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }

    // Reject all pending responses
    for (const [id, { reject }] of this.pendingResponses) {
      reject(new Error('Session closed'));
    }
    this.pendingResponses.clear();

    sessions.delete(this.sessionId);
    log(`Session cleaned up: ${this.sessionId}`);
  }
}

// HTTP request handlers
async function handleHealthCheck(req, res) {
  sendJson(res, 200, {
    status: 'healthy',
    version: '1.0.0',
    config: {
      port: config.port,
      host: config.host,
      maxProcesses: config.maxProcesses,
      activeProcesses,
      activeSessions: sessions.size,
    },
    timestamp: new Date().toISOString(),
  });
}

async function handleStartServer(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { serverId, command, args = [], cwd, headers = {} } = body;

    if (!serverId || !command) {
      return sendError(res, 400, 'Missing required fields: serverId, command');
    }

    const sessionId = generateSessionId();
    const session = new McpSession(sessionId, serverId, command, args, cwd);
    
    sessions.set(sessionId, session);
    
    await session.start();
    
    sendJson(res, 200, { sessionId });
    
  } catch (err) {
    error('Start server error:', err);
    sendError(res, 500, err.message);
  }
}

async function handleMcpMessage(req, res, sessionId) {
  try {
    const session = sessions.get(sessionId);
    if (!session) {
      return sendError(res, 404, 'Session not found');
    }

    const body = await parseJsonBody(req);
    const response = await session.sendMessage(body);
    
    sendJson(res, 200, response);
    
  } catch (err) {
    error('MCP message error:', err);
    sendError(res, 500, err.message);
  }
}

async function handleCloseSession(req, res, sessionId) {
  try {
    const session = sessions.get(sessionId);
    if (!session) {
      return sendError(res, 404, 'Session not found');
    }

    session.cleanup();
    sendJson(res, 200, { success: true });
    
  } catch (err) {
    error('Close session error:', err);
    sendError(res, 500, err.message);
  }
}

// Main HTTP server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method.toUpperCase();

  log(`${method} ${url.pathname}`);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  try {
    // Route requests
    if (method === 'GET' && url.pathname === '/health') {
      await handleHealthCheck(req, res);
    } else if (method === 'POST' && url.pathname === '/mcp/start') {
      await handleStartServer(req, res);
    } else if (method === 'POST' && url.pathname.startsWith('/mcp/')) {
      const pathParts = url.pathname.split('/');
      if (pathParts.length >= 3) {
        const sessionId = pathParts[2];
        const action = pathParts[3];
        
        if (action === 'initialize' || action === 'initialized' || action === 'message') {
          await handleMcpMessage(req, res, sessionId);
        } else if (action === 'close') {
          await handleCloseSession(req, res, sessionId);
        } else {
          sendError(res, 404, 'Unknown action');
        }
      } else {
        sendError(res, 404, 'Invalid path');
      }
    } else {
      sendError(res, 404, 'Not found');
    }
  } catch (err) {
    error('Request handling error:', err);
    sendError(res, 500, 'Internal server error');
  }
});

// Graceful shutdown
function gracefulShutdown() {
  console.log('\nShutting down gracefully...');
  
  // Close all sessions
  for (const session of sessions.values()) {
    session.cleanup();
  }
  
  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('Force exit');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start server
server.listen(config.port, config.host, () => {
  console.log(`🚀 LiteChat MCP Bridge running on http://${config.host}:${config.port}`);
  console.log(`📊 Configuration:`);
  console.log(`   - Max processes: ${config.maxProcesses}`);
  console.log(`   - Process timeout: ${config.processTimeout}ms`);
  console.log(`   - Allowed commands: ${config.allowedCommands.join(', ')}`);
  console.log(`   - Verbose logging: ${config.verbose}`);
  console.log(`💡 Use --help for more options`);
}); 