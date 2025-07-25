# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## LiteChat Development Commands

### Development

```bash
npm run build              # Build for production with TypeScript compilation
npm run build:en           # Build English version specifically
npm run build:fr           # Build French version specifically
npm run build:all          # Build all language versions
```

### Deployment & Services

```bash
npm run deploy             # Deploy to GitHub Pages (gh-pages -d dist)
npm run to2web             # Build, release, and deploy to web
npm run mcp-proxy          # Start MCP bridge service (node bin/mcp-bridge.js)
npm run serve              # Build and serve with http-server on LITECHAT_PORT (default: 5173)
npm run update             # Git pull, npm install, and serve (respects LITECHAT_ORIGIN and LITECHAT_BRANCH)
```

**⚠️ CRITICAL: NEVER run `npm run serve` or start any servers - user has their own dev environment running!**
**⚠️ CRITICAL: NO DYNAMIC IMPORTS UNLESS EXPRESSLY TOLD SO ! NEVER !**

### Docker

```bash
# Manual build
npm run build && docker build -t litechat .
docker run -d -p 8080:3000 litechat

# Docker Compose (includes MCP bridge)
docker-compose up -d
```

## Architecture Overview

LiteChat is a 100% client-side AI chat application built with a modular, event-driven architecture designed for extensibility and privacy.

### Core Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **State Management**: Zustand with Immer middleware and domain-specific stores
- **Data Storage**: Dexie.js (IndexedDB) with ZenFS for virtual file system
- **AI Integration**: Vercel AI SDK supporting multiple providers (OpenAI, Claude, Gemini, OpenRouter, local models)
- **Version Control**: isomorphic-git for browser-based Git operations
- **Internationalization**: i18next with React integration

### Modular Control System

LiteChat uses a sophisticated control module architecture with three scopes:

1. **PromptControls**: Input area extensions and prompt manipulation
2. **ChatControls**: Sidebar panels, headers, and general UI controls
3. **CanvasControls**: Action buttons and interactions within chat canvas

**Control Module Lifecycle**:

- `initialize()`: Setup phase
- `register(modApi)`: Registration with mod API
- `destroy()`: Cleanup and resource deallocation

**Key Directories**:

- `src/controls/modules/`: Control module implementations
- `src/controls/components/`: UI components for controls
- `src/store/control.store.ts`: Central control registry

### Event-Driven Architecture

All inter-system communication uses a centralized event emitter with strongly-typed events:

- **Event Types**: Organized in `src/types/litechat/events/` by domain
- **Event Coordinator**: `EventActionCoordinatorService` automatically binds store actions to events
- **Store Integration**: Stores emit events on state changes and expose `getRegisteredActionHandlers()`

### State Management Pattern

Domain-specific Zustand stores with consistent patterns:

- **Immer middleware**: Immutable state updates
- **Event integration**: Automatic event emission on changes
- **Action handlers**: Exposed for event coordinator registration
- **Type safety**: Full TypeScript coverage

**Key Stores**:

- `conversation.store.ts`: Chat data and state
- `settings.store.ts`: Application configuration
- `provider.store.ts`: AI provider management
- `vfs.store.ts`: Virtual file system state

### Block Renderer System

Extensible content rendering with priority-based selection:

- **Language-specific renderers**: Handle code blocks, diagrams, etc.
- **Universal fallback**: Default renderer with enhanced features
- **Context-aware**: Rich context including streaming state, file paths
- **Registration**: `src/services/block-renderer.service.ts`

**Example Renderers**:

- `JsRunnableBlockRenderer`: JavaScript execution with safe/unsafe/iframe modes
- `MermaidBlockRenderer`: Real-time diagram rendering
- `PythonRunnableBlockRenderer`: Python code execution

### Virtual File System (VFS)

Browser-based filesystem using ZenFS + IndexedDB:

- **Full CRUD operations**: Create, read, update, delete files/directories
- **Git integration**: Clone, commit, push, pull repositories
- **Project organization**: Hierarchical project structure
- **Sync capabilities**: Git-based conversation synchronization

### Modding API

Safe, controlled extension interface:

- **Resource management**: Automatic cleanup on mod unload
- **Sandboxed API**: `createModApi()` provides controlled access
- **Event system access**: Mods can emit/listen to typed events
- **Tool registration**: Dynamic AI tool addition

### Build System Features

- **Build-time configuration**: Custom system prompts via `VITE_SYSTEM_PROMPT_FILE`
- **Multi-language builds**: Automatic language detection and building
- **Node.js polyfills**: Browser compatibility for Node.js APIs
- **PWA support**: Service worker and offline capabilities

### Security & Privacy

- **100% client-side**: No server dependencies for core functionality
- **Local storage**: All data in browser IndexedDB
- **Code execution**: Multiple isolation levels (QuickJS VM, iframe sandbox, direct eval)
- **CORS handling**: Direct browser requests to AI providers

### Key Development Patterns

1. **Control Registration**:

   ```typescript
   export class ExampleControlModule implements ControlModule {
     register(modApi: LiteChatModApi): void {
       this.unregisterCallback = modApi.registerPromptControl({
         id: "example-control",
         component: ExampleComponent,
       });
     }
   }
   ```

2. **Event Handling**:

   ```typescript
   // Store exposes action handlers
   getRegisteredActionHandlers(): ActionHandler[] {
     return [
       { type: 'EXAMPLE_EVENT', handler: this.handleExample }
     ];
   }
   ```

3. **Block Renderer**:
   ```typescript
   const renderer: BlockRenderer = {
     id: "example-renderer",
     supportedLanguages: ["example"],
     priority: 10,
     renderer: (context) => <ExampleComponent {...context} />,
   };
   ```

### File Organization

- `src/components/LiteChat/`: Core UI components
- `src/controls/`: Control modules and components
- `src/services/`: Business logic services
- `src/store/`: State management
- `src/types/litechat/`: TypeScript definitions
- `src/lib/litechat/`: Utility functions
- `src/locales/`: Internationalization files
- `docs/`: Comprehensive documentation

### Development Tips

- **Type Safety**: Leverage TypeScript throughout - all events, stores, and APIs are fully typed
- **Event-First**: Use events for cross-system communication rather than direct imports
- **Module Pattern**: Follow control module lifecycle for proper resource management
- **Linting**: ESLint with TypeScript rules enforced (note: `@typescript-eslint/no-explicit-any` is disabled)
- **npm run build** every time you are done with building functionalities ! when you release to user, the app must build !

### Extension Development

When creating new functionality:

1. **Control Modules**: For UI extensions, create control modules following the established patterns
2. **Block Renderers**: For custom content types, implement block renderers with proper language detection
3. **Services**: For business logic, create services with event integration
4. **Stores**: For state management, use Zustand with the established patterns

The architecture prioritizes modularity, type safety, and extensibility while maintaining a clean separation of concerns throughout the system.
