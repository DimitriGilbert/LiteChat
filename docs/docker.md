# Docker Documentation

LiteChat provides comprehensive Docker support with minimal container sizes, MCP bridge integration, and language-specific image builds.

## Quick Start

### Single Container

```bash
# Build the application
npm run build

# Build and run Docker container
docker build -t litechat .
docker run -d -p 8080:3000 litechat

# Access at http://localhost:8080
```

### Docker Compose (Recommended)

```bash
# Start all services (LiteChat + MCP Bridge)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Services

### LiteChat Service

The main application runs on a minimal BusyBox httpd server (~80KB base image).

**Features:**
- SPA routing support
- Gzip compression (when `.gz` files provided)
- Minimal resource usage
- Fast startup time

**Default Port:** 3000 (configurable via `LITECHAT_PORT`)

### MCP Bridge Service

Provides MCP (Model Context Protocol) server integration for AI tools.

**Features:**
- Dynamic server creation
- Multiple transport methods (HTTP, SSE, Stdio)
- Health monitoring
- Configurable ports and logging

**Default Port:** 3001 (configurable via `MCP_BRIDGE_PORT`)

## Configuration

### Environment Variables

Create a `.env` file for easy configuration:

```bash
# LiteChat configuration
LITECHAT_PORT=8080

# MCP Bridge configuration  
MCP_BRIDGE_PORT=3001
MCP_BRIDGE_INTERNAL_PORT=3001
MCP_BRIDGE_VERBOSE=false
```

### Available Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LITECHAT_PORT` | 8080 | External port for LiteChat |
| `MCP_BRIDGE_PORT` | 3001 | External port for MCP bridge |
| `MCP_BRIDGE_INTERNAL_PORT` | 3001 | Internal container port for MCP bridge |
| `MCP_BRIDGE_VERBOSE` | false | Enable verbose logging for MCP bridge |

## Language-Specific Images

For multi-language applications, the builder script creates optimized images for each language.

### Automated Build

```bash
# Create images for all detected languages
bin/builder --release v1.0.0 --docker-repo myuser/litechat

# Images created:
# - myuser/litechat:v1.0.0 (default language)
# - myuser/litechat:latest (points to default)
# - myuser/litechat:v1.0.0-fr (French)
# - myuser/litechat:v1.0.0-de (German)
# - myuser/litechat:v1.0.0-es (Spanish)
# etc.
```

### Manual Language Build

```bash
# Example: Build French version manually
cat > dockerfile.fr << EOF
FROM lipanski/docker-static-website:latest
COPY dist/fr/ .
COPY docker/httpd.conf .
EOF

docker build -f dockerfile.fr -t myuser/litechat:v1.0.0-fr .
rm dockerfile.fr
```

### Benefits

- **Smaller Size**: Only contains files for one language
- **Faster Startup**: Reduced file system overhead  
- **Clean URLs**: No language prefixes needed
- **Regional Deployment**: Deploy specific languages to regional CDNs

## Advanced Usage

### Custom Docker Compose

```yaml
version: '3.8'

services:
  # Use specific language image
  litechat-fr:
    image: myuser/litechat:v1.0.0-fr
    ports:
      - "8080:3000"
    restart: unless-stopped

  # MCP bridge with custom settings
  mcp-bridge:
    image: node:20-alpine
    working_dir: /app
    command: ["node", "bin/mcp-bridge.js", "--host", "0.0.0.0", "--verbose"]
    ports:
      - "3001:3001"
    environment:
      - MCP_BRIDGE_PORT=3001
      - MCP_BRIDGE_HOST=0.0.0.0
      - MCP_BRIDGE_VERBOSE=true
    volumes:
      - ./bin/mcp-bridge.js:/app/bin/mcp-bridge.js:ro
    restart: unless-stopped

  # Optional: Reverse proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - litechat-fr
      - mcp-bridge
```

### Health Checks

```bash
# Check LiteChat health
curl http://localhost:8080

# Check MCP Bridge health
curl http://localhost:3001/health

# Docker Compose health status
docker-compose ps
```

### Development with Volumes

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  litechat-dev:
    build: .
    ports:
      - "8080:3000"
    volumes:
      # Mount development build
      - ./build:/home/static
      # Mount custom config
      - ./docker/httpd.conf:/home/static/httpd.conf
    restart: unless-stopped
```

## Troubleshooting

### Common Issues

**Container won't start:**
```bash
# Check logs
docker-compose logs litechat
docker-compose logs mcp-bridge

# Check container status
docker-compose ps
```

**Port conflicts:**
```bash
# Change ports in .env file
echo "LITECHAT_PORT=8081" >> .env
echo "MCP_BRIDGE_PORT=3002" >> .env

# Restart services
docker-compose down && docker-compose up -d
```

**MCP Bridge connection issues:**
```bash
# Enable verbose logging
echo "MCP_BRIDGE_VERBOSE=true" >> .env
docker-compose restart mcp-bridge

# Check bridge health
curl http://localhost:3001/health
```

### Performance Optimization

**Build optimization:**
```bash
# Use multi-stage build for smaller images
# Add to dockerfile:
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM lipanski/docker-static-website:latest
COPY --from=builder /app/dist/ .
COPY docker/httpd.conf .
```

**Resource limits:**
```yaml
# Add to docker-compose.yml
services:
  litechat:
    # ... other config
    deploy:
      resources:
        limits:
          memory: 64M
          cpus: '0.25'
        reservations:
          memory: 32M
          cpus: '0.1'
```

## Security

### Production Configuration

```bash
# Use specific image tags (not latest)
image: myuser/litechat:v1.0.0

# Enable read-only filesystem
read_only: true

# Drop capabilities
cap_drop:
  - ALL

# Run as non-root user
user: "1000:1000"
```

### Network Security

```yaml
# Create isolated network
networks:
  litechat-network:
    driver: bridge

services:
  litechat:
    networks:
      - litechat-network
  
  mcp-bridge:
    networks:
      - litechat-network
```

### Environment Security

```bash
# Use Docker secrets for sensitive data
echo "secret_api_key" | docker secret create api_key -

# Reference in compose file
secrets:
  - api_key
```

This Docker setup provides a complete, production-ready deployment solution for LiteChat with comprehensive MCP integration and multi-language support. 
