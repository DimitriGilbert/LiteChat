# LiteChat Developer Documentation

This documentation provides comprehensive technical guidance for developers working on or extending LiteChat. LiteChat is a modular, extensible, privacy-focused AI chat application built with React, TypeScript, and a sophisticated plugin system.

## Architecture Overview

LiteChat follows a modular, event-driven architecture designed for extensibility and maintainability:

- **100% Client-Side**: All data stored locally using IndexedDB
- **Control Module System**: UI features encapsulated as pluggable modules
- **Event-Driven Communication**: Decoupled components using mitt event emitter
- **Zustand State Management**: Domain-specific stores with immutable updates
- **Virtual File System**: Browser-based filesystem using ZenFS + IndexedDB
- **Modding API**: Safe, controlled interface for external extensions

## Documentation Structure

### Core Architecture
- [Control Module System](./control-modules.md) - The backbone of LiteChat's modular UI architecture
- [Event System](./event-system.md) - Event-driven communication patterns and implementation
- [State Management](./state-management.md) - Zustand stores, actions, and data flow
- [Persistence Layer](./persistence.md) - Database schema, transactions, and data operations

### Key Features
- [Virtual File System](./vfs.md) - Browser-based filesystem implementation and usage
- [Modding System](./modding.md) - Plugin architecture and API for extensions
- [AI Integration](./ai-integration.md) - Provider management, streaming, and tool execution
- [Git Integration](./git.md) - Version control features and conversation sync
- [Canvas Features](./canvas-features.md) - Code blocks, Mermaid diagrams, ZIP downloads, and interaction controls
- [Workflow System](./workflow-system.md) - Multi-step AI automation and workflow orchestration
- [Prompt Library](./control-modules.md#prompt-library-module) - Reusable prompt templates with dynamic variables

### Implementation Guides
- [Build & Deployment](./build-deployment.md) - Development setup, build-time configuration, and deployment strategies
- [Component Development](./components.md) - UI component patterns and best practices
- [Service Layer](./services.md) - Business logic organization and patterns

### Reference
- [File Structure](./file-structure.md) - Complete project organization reference
- [Type Definitions](./types.md) - Key TypeScript interfaces and types
- [API Reference](./api-reference.md) - Core APIs and their usage

## Quick Start for Developers

1. **Project Setup**
   ```bash
   npm install
   npm run dev
   ```

2. **Key Entry Points**
   - [`src/App.tsx`](../src/App.tsx) - Control module registration and app setup
   - [`src/components/LiteChat/LiteChat.tsx`](../src/components/LiteChat/LiteChat.tsx) - Main application component
   - [`src/lib/litechat/initialization.ts`](../src/lib/litechat/initialization.ts) - Startup sequence and initialization

3. **Core Concepts to Understand**
   - **Control Modules**: How UI features are encapsulated and registered
   - **Event Flow**: How components communicate through events
   - **Store Actions**: How state changes are triggered and handled
   - **VFS Context**: How the virtual filesystem switches between projects

## Development Principles

### 1. Modular Architecture
- UI features are implemented as `ControlModule`s in [`src/controls/modules/`](../src/controls/modules/)
- Each module manages its own state and UI components
- Dependencies between modules are explicit and resolved at initialization

### 2. Event-Driven Communication
- All inter-component communication uses the central event emitter
- State changes trigger events, not direct method calls
- Request/response pattern for actions (e.g., `settingsEvent.setThemeRequest` → `settingsEvent.themeChanged`)

### 3. Immutable State Updates
- Zustand stores use Immer middleware for safe state mutations
- Event-driven actions ensure predictable state changes
- Store methods emit events after state updates

### 4. Type Safety
- Comprehensive TypeScript coverage with strict typing
- Event payloads are strongly typed via `ModEventPayloadMap`
- Interface segregation for clean module contracts

### 5. Controlled Extensibility
- Modding API provides safe extension points
- Internal implementation details are not exposed to mods
- Event system allows controlled interaction with core functionality

## Common Development Tasks

### Adding a New Control Module
1. Create module class implementing `ControlModule` interface
2. Add UI components in [`src/controls/components/`](../src/controls/components/)
3. Register module in [`src/App.tsx`](../src/App.tsx) `controlModulesToRegister` array
4. Implement `initialize()`, `register()`, and `destroy()` lifecycle methods

### Adding New Events
1. Define event names in [`src/types/litechat/events/`](../src/types/litechat/events/)
2. Add payload types to appropriate `EventPayloads` interface
3. Update `ModEventPayloadMap` for event emitter typing
4. Emit events from appropriate components/services

### Creating New Stores
1. Create store file in [`src/store/`](../src/store/) following naming convention
2. Implement state interface and actions
3. Add `getRegisteredActionHandlers()` for event integration
4. Register store in [`EventActionCoordinatorService`](../src/services/event-action-coordinator.service.ts)

## Contributing Guidelines

- Follow existing code patterns and naming conventions
- Ensure all new functionality is covered by TypeScript types
- Use the event system for component communication
- Test integration with the control module system
- Document any new APIs or architectural decisions

## Next Steps

Start with the [Control Module System](./control-modules.md) documentation to understand LiteChat's core architecture, then explore specific areas based on your development needs.
