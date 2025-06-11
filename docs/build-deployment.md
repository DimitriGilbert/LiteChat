# Build & Deployment

LiteChat is designed as a static web application with comprehensive build-time configuration options, multiple deployment strategies, and development-friendly setup. This guide covers development setup, build processes, configuration, and deployment options.

## Development Setup

### Prerequisites

- **Node.js** v18+ (v20+ recommended)
- **npm** or **pnpm** package manager
- Modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### Local Development

```bash
# Clone repository
git clone https://github.com/user/litechat.git
cd litechat

# Install dependencies
npm install
# or
pnpm install

# Start development server
npm run dev
# or
pnpm dev
```

The development server typically starts on `http://localhost:5173`.

### Development Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "type-check": "tsc --noEmit"
  }
}
```

### Development Features

- **Hot Module Replacement (HMR)**: Instant updates during development
- **TypeScript Support**: Full type checking and IntelliSense
- **ESLint Integration**: Code quality and style enforcement
- **Source Maps**: Debugging support with original source files

## Build-Time Configuration

### Overview

LiteChat supports loading configuration and system prompts at build time using environment variables. This enables:

- **Custom System Prompts**: Load default prompts from files
- **Pre-configured Settings**: Ship with predefined configurations
- **Team Distributions**: Standardized setups for teams
- **Demo Configurations**: Customized demo environments

### Environment Variables

#### System Prompt Configuration

```bash
# Load system prompt from file
VITE_SYSTEM_PROMPT_FILE=system-prompt.txt npm run build

# The file content becomes the default global system prompt
```

#### User Configuration

```bash
# Load complete user configuration from JSON file
VITE_USER_CONFIG_FILE=config.json npm run build

# Supports full application state including:
# - Settings (theme, parameters, etc.)
# - Provider configurations
# - Projects and rules
# - Tags and preferences
```

### Configuration File Format

#### System Prompt File
```text
You are a helpful AI assistant specialized in software development.

You provide clear, working code examples and explain best practices. 
When helping with LiteChat development, you understand the modular 
architecture and event-driven design patterns used in the codebase.

Focus on TypeScript, React, and modern web development practices.
```

#### User Configuration JSON
```json
{
  "version": 1,
  "exportedAt": "2024-01-01T00:00:00.000Z",
  "settings": {
    "theme": "dark",
    "temperature": 0.7,
    "enableStreamingMarkdown": true,
    "customFontFamily": "JetBrains Mono, monospace",
    "chatMaxWidth": "max-w-7xl"
  },
  "providerConfigs": [
    {
      "id": "team-openai",
      "type": "openai",
      "label": "Team OpenAI",
      "enabled": true,
      "enabledModels": ["gpt-4", "gpt-3.5-turbo"]
    }
  ],
  "projects": [
    {
      "id": "default-project",
      "name": "Development Workspace",
      "description": "Default project for development",
      "settings": {
        "defaultModelId": "gpt-4",
        "temperature": 0.7
      }
    }
  ],
  "rules": [
    {
      "id": "coding-standards",
      "name": "Coding Standards",
      "content": "Follow TypeScript best practices and include comprehensive JSDoc comments.",
      "type": "system"
    }
  ],
  "tags": [
    {
      "id": "development",
      "name": "Development",
      "color": "#10b981"
    }
  ]
}
```

### Build-Time Processing

The build system processes configuration files during compilation:

```typescript
// vite.config.ts configuration
export default defineConfig({
  define: {
    // Inject build-time configuration
    __BUILD_TIME_SYSTEM_PROMPT__: JSON.stringify(
      loadSystemPrompt(process.env.VITE_SYSTEM_PROMPT_FILE)
    ),
    __BUILD_TIME_USER_CONFIG__: JSON.stringify(
      loadUserConfig(process.env.VITE_USER_CONFIG_FILE)
    )
  }
});
```

### Configuration Examples

#### Development Setup
```bash
# Create development configuration
echo "You are a development assistant for LiteChat." > dev-prompt.txt

cat > dev-config.json << EOF
{
  "version": 1,
  "settings": {
    "theme": "dark",
    "enableAdvancedSettings": true,
    "temperature": 0.7
  },
  "rules": [
    {
      "id": "dev-focus",
      "name": "Development Focus",
      "content": "Focus on clean, maintainable code following React and TypeScript best practices.",
      "type": "system"
    }
  ]
}
EOF

# Build with configuration
VITE_SYSTEM_PROMPT_FILE=dev-prompt.txt VITE_USER_CONFIG_FILE=dev-config.json npm run build
```

#### Team Distribution
```bash
# Team configuration with standardized settings
cat > team-config.json << EOF
{
  "version": 1,
  "settings": {
    "theme": "system",
    "autoTitleEnabled": true,
    "customFontFamily": "Inter, sans-serif"
  },
  "providerConfigs": [
    {
      "id": "team-openai",
      "type": "openai", 
      "label": "Team OpenAI",
      "enabled": true,
      "enabledModels": ["gpt-4", "gpt-3.5-turbo"]
    }
  ],
  "projects": [
    {
      "id": "team-workspace",
      "name": "Team Workspace",
      "description": "Shared team workspace with standard configurations"
    }
  ]
}
EOF

VITE_USER_CONFIG_FILE=team-config.json npm run build
```

#### Demo Environment
```bash
# Demo configuration with sample content
cat > demo-config.json << EOF
{
  "version": 1,
  "settings": {
    "theme": "TijuLight",
    "chatMaxWidth": "max-w-4xl"
  },
  "rules": [
    {
      "id": "demo-assistant",
      "name": "Demo Assistant", 
      "content": "You are demonstrating LiteChat's capabilities. Showcase features like file attachments, VFS, Git sync, and project organization.",
      "type": "system"
    }
  ],
  "tags": [
    {
      "id": "demo",
      "name": "Demo Mode",
      "color": "#8b5cf6"
    }
  ]
}
EOF

VITE_USER_CONFIG_FILE=demo-config.json npm run build
```

## Build Process

### Production Build

```bash
# Standard production build
npm run build

# Build output in dist/ directory
# - index.html (main entry point)
# - assets/ (CSS, JS, fonts, images)
# - manifest.json (PWA manifest)
# - icons/ (PWA icons)
```

### Build Optimization

#### Code Splitting
```typescript
// Automatic code splitting by routes/modules
const VfsModal = lazy(() => import('./components/VfsModal'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
```

#### Tree Shaking
```typescript
// Import only used functions
import { streamText } from 'ai';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
```

#### Bundle Analysis
```bash
# Analyze bundle size
npx vite-bundle-analyzer dist

# Or use bundle analyzer
npm install -g webpack-bundle-analyzer
npx webpack-bundle-analyzer dist/assets/*.js
```

### Build Configuration

#### Vite Configuration
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'ai-sdk': ['ai'],
          'ui-components': ['@radix-ui/react-dialog', '@radix-ui/react-select'],
          'markdown': ['marked', 'prismjs'],
          'vfs': ['@zenfs/core', '@zenfs/dom']
        }
      }
    }
  },
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __VERSION__: JSON.stringify(process.env.npm_package_version)
  }
});
```

#### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## Deployment Strategies

### Static File Hosting

#### GitHub Pages
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          VITE_SYSTEM_PROMPT_FILE: production-prompt.txt
          VITE_USER_CONFIG_FILE: production-config.json
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

#### Netlify
```toml
# netlify.toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "20"
  VITE_SYSTEM_PROMPT_FILE = "netlify-prompt.txt"
  VITE_USER_CONFIG_FILE = "netlify-config.json"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

#### Vercel
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": "vite",
  "env": {
    "VITE_SYSTEM_PROMPT_FILE": "vercel-prompt.txt",
    "VITE_USER_CONFIG_FILE": "vercel-config.json"
  }
}
```

### Docker Deployment

#### Dockerfile
```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy build output
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Nginx Configuration
```nginx
# docker/nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

#### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  litechat:
    build: .
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Optional: Reverse proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/proxy.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - litechat
    restart: unless-stopped
```

### Self-Hosted Options

#### Simple HTTP Server

##### Python
```bash
# Python 3.x
cd dist
python3 -m http.server 8080

# Python 2.x  
python -m SimpleHTTPServer 8080
```

##### Node.js
```bash
cd dist
npx http-server -p 8080 -c-1
```

##### Go
```bash
cd dist
go run -m http.FileServer http.Dir(".") :8080
```

#### Advanced Setup with SSL

```bash
# Using Caddy server
# Caddyfile
litechat.example.com {
    root * /path/to/litechat/dist
    file_server
    
    # Handle client-side routing
    try_files {path} {path}/ /index.html
    
    # Security headers
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

## CORS Configuration

### Local Development with AI Providers

#### Ollama
```bash
# Start Ollama with CORS enabled
OLLAMA_ORIGIN='*' ollama serve

# Or specific origins
OLLAMA_ORIGIN='http://localhost:5173,http://localhost:8080' ollama serve
```

#### LMStudio
```json
{
  "cors": {
    "enabled": true,
    "origins": ["http://localhost:5173", "http://localhost:8080"]
  }
}
```

#### Custom OpenAI-Compatible APIs
Check your specific API server documentation for CORS configuration.

### Browser Security Considerations

- **HTTPS Requirement**: Many browsers require HTTPS for advanced features
- **Mixed Content**: Cannot call HTTP APIs from HTTPS pages
- **Local Development**: Use HTTP for both app and local AI providers
- **Production**: Use HTTPS with HTTPS-enabled AI providers

## Performance Optimization

### Build Optimizations

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react';
            if (id.includes('ai')) return 'ai-sdk';
            if (id.includes('zenfs')) return 'vfs';
            return 'vendor';
          }
          
          // Feature chunks
          if (id.includes('components/settings')) return 'settings';
          if (id.includes('components/vfs')) return 'vfs-ui';
          if (id.includes('controls/modules')) return 'controls';
        }
      }
    }
  }
});
```

### Runtime Optimizations

#### Service Worker (PWA)
```typescript
// sw.js
const CACHE_NAME = 'litechat-v1';
const urlsToCache = [
  '/',
  '/assets/index.css',
  '/assets/index.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

#### Web Workers
```typescript
// Heavy computation in web workers
const worker = new Worker('/workers/markdown-parser.js');
worker.postMessage({ content: markdownContent });
worker.onmessage = (e) => {
  const parsedContent = e.data;
  // Use parsed content
};
```

## Monitoring & Analytics

### Build Monitoring
```bash
# Bundle size monitoring
npm install -g bundlesize

# .bundlesize.config.json
{
  "files": [
    {
      "path": "./dist/assets/index.*.js",
      "maxSize": "500kb"
    },
    {
      "path": "./dist/assets/index.*.css", 
      "maxSize": "50kb"
    }
  ]
}
```

### Runtime Monitoring
```typescript
// Performance monitoring
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}ms`);
  });
});

observer.observe({ entryTypes: ['navigation', 'resource'] });
```

## Security Considerations

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self' https://api.openai.com https://api.anthropic.com;
  worker-src 'self' blob:;
">
```

### Environment Variables Security
```bash
# Never commit sensitive environment variables
# Use .env.local for local development secrets
echo ".env.local" >> .gitignore

# Production secrets via deployment platform
# GitHub Actions: secrets.OPENAI_API_KEY
# Netlify: site settings environment variables  
# Vercel: project settings environment variables
```

### Build Artifacts
```bash
# Clean builds to avoid sensitive data leakage
npm run clean && npm run build

# Verify no secrets in build output
grep -r "sk-" dist/ || echo "No API keys found"
grep -r "password" dist/ || echo "No passwords found"
```

## Troubleshooting

### Common Build Issues

#### Memory Issues
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

#### Module Resolution
```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

#### Environment Variable Issues
```bash
# Debug environment variables
npm run build -- --debug

# Verify variables are loaded
echo $VITE_SYSTEM_PROMPT_FILE
echo $VITE_USER_CONFIG_FILE
```

### Deployment Issues

#### 404 on Refresh
- Configure server for client-side routing
- Set up catch-all route to serve index.html

#### CORS Errors
- Verify AI provider CORS settings
- Check HTTPS/HTTP mixing
- Validate origin configurations

#### Bundle Size Warnings
- Analyze bundle with webpack-bundle-analyzer
- Optimize imports and dependencies
- Implement code splitting

This comprehensive deployment guide should help you get LiteChat running in any environment while maintaining security and performance best practices. 