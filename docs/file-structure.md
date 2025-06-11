# File Structure Reference

This document provides a comprehensive reference for LiteChat's project organization, helping developers understand where to find specific functionality and how the codebase is structured.

## Project Root

```
liteChat/
├── docs/                        # Developer documentation
├── public/                      # Static assets and manifest
├── src/                         # Source code
├── package.json                 # Dependencies and scripts
├── README.md                    # Project overview
├── vite.config.ts              # Vite build configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
└── .github/                    # GitHub Actions and templates
```

## Public Directory

```
public/
├── index.html                  # Main HTML template
├── manifest.json               # PWA manifest
├── favicon.ico                 # Application icon
├── icons/                      # PWA icons in various sizes
└── dev.llm.txt                # Development context file
```

## Source Code Structure

### Application Entry Points

```
src/
├── main.tsx                    # React app entry point
├── App.tsx                     # Root component with control module registration
├── index.css                  # Global styles and theme variables
└── vite-env.d.ts              # Vite type definitions
```

### Core Application Components

```
src/components/
├── LiteChat/                   # Main application components
│   ├── LiteChat.tsx           # Primary orchestrator component
│   ├── canvas/                # Conversation display area
│   │   ├── ChatCanvas.tsx     # Main conversation container
│   │   ├── InteractionCard.tsx # Individual message display
│   │   ├── StreamingRenderer.tsx # Real-time response rendering
│   │   └── MarkdownRenderer.tsx # Markdown and code highlighting
│   ├── chat/                  # Sidebar and conversation management
│   │   ├── ChatControlWrapper.tsx # Chat control container
│   │   ├── ConversationList.tsx # Conversation sidebar
│   │   └── ProjectTree.tsx    # Hierarchical project display
│   ├── common/                # Shared UI components
│   │   ├── ErrorBoundary.tsx  # Error handling
│   │   ├── ModalManager.tsx   # Modal system coordinator
│   │   ├── LoadingSpinner.tsx # Loading indicators
│   │   └── icons/             # Custom icon components
│   ├── file-manager/          # VFS interface components
│   │   ├── FileManager.tsx    # Main file manager container
│   │   ├── FileManagerTable.tsx # File/folder listing
│   │   ├── FileManagerToolbar.tsx # File operations toolbar
│   │   └── FileManagerBreadcrumb.tsx # Navigation breadcrumb
│   ├── prompt/                # Prompt input area
│   │   ├── PromptWrapper.tsx  # Prompt container and submission logic
│   │   ├── InputArea.tsx      # Text input component
│   │   └── PromptControlWrapper.tsx # Control module container
│   ├── project-settings/      # Project configuration modals
│   │   ├── ProjectSettingsModal.tsx # Main project settings
│   │   └── tabs/              # Project settings tabs
│   └── settings/              # Application settings
│       ├── SettingsModal.tsx  # Main settings modal
│       └── tabs/              # Settings tab components
├── ui/                        # shadcn/ui primitive components
│   ├── button.tsx             # Button component
│   ├── input.tsx              # Input component
│   ├── dialog.tsx             # Dialog/modal primitives
│   ├── tabs.tsx               # Tab navigation
│   ├── select.tsx             # Select dropdown
│   ├── switch.tsx             # Toggle switch
│   ├── slider.tsx             # Range slider
│   ├── textarea.tsx           # Multi-line text input
│   ├── tooltip.tsx            # Tooltip component
│   ├── popover.tsx            # Popover component
│   ├── scroll-area.tsx        # Custom scrollbar
│   ├── separator.tsx          # Visual separator
│   ├── badge.tsx              # Badge/chip component
│   ├── progress.tsx           # Progress bar
│   └── sonner.tsx             # Toast notifications
└── OnBoardingRant.tsx         # Initial welcome screen
```

### Control Module System

```
src/controls/
├── components/                 # UI components for control modules
│   ├── assistant-settings/    # Assistant behavior settings
│   ├── auto-title/            # Auto-title generation control
│   ├── canvas-actions/        # Message action buttons
│   ├── file-control/          # File attachment control
│   ├── global-model-selector/ # Model selection control
│   ├── image-generation/      # Image generation control
│   ├── parameter-control/     # AI parameter controls
│   ├── provider-settings/     # Provider configuration
│   ├── reasoning-control/     # Reasoning mode toggle
│   ├── system-prompt/         # System prompt override
│   ├── usage-display/         # Token usage indicator
│   ├── vfs-control/           # VFS file selection
│   └── web-search/            # Web search toggle
└── modules/                   # Control module implementations
    ├── AssistantSettingsModule.ts # Assistant settings tab
    ├── AutoTitleControlModule.ts # Auto-title functionality
    ├── CopyActionControlModule.ts # Copy message action
    ├── FileControlModule.ts   # File attachment system
    ├── GeneralSettingsModule.ts # General settings tab
    ├── GitToolsModule.ts      # Git operation tools
    ├── GlobalModelSelectorModule.ts # Global model selection
    ├── ImageGenerationControlModule.ts # Image generation
    ├── ParameterControlModule.ts # AI parameter controls
    ├── ProviderSettingsModule.ts # Provider management
    ├── ReasoningControlModule.ts # Reasoning mode
    ├── RegenerateActionControlModule.ts # Regenerate response
    ├── SystemPromptControlModule.ts # System prompt override
    ├── ThemeSettingsControlModule.ts # Theme settings
    ├── UrlParameterControlModule.ts # URL parameter handling
    ├── UsageDisplayControlModule.ts # Token usage display
    ├── VfsControlModule.ts    # VFS file selection
    ├── VfsToolsModule.ts      # VFS AI tools
    └── WebSearchControlModule.ts # Web search functionality
```

### State Management

```
src/store/
├── conversation.store.ts       # Conversations and sync repositories
├── interaction.store.ts        # AI interactions and streaming
├── project.store.ts           # Project hierarchy management
├── provider.store.ts          # AI provider and model configuration
├── settings.store.ts          # Application settings
├── ui.store.ts                # UI state (modals, panels, etc.)
├── vfs.store.ts               # Virtual file system state
├── input.store.ts             # Prompt input and file attachments
├── prompt.store.ts            # Next prompt state
├── control.store.ts           # Control module registry
├── mod.store.ts               # Modding system state
└── rules.store.ts             # Rules and tags for prompt engineering
```

### Service Layer

```
src/services/
├── ai.service.ts              # AI model interaction and streaming
├── conversation.service.ts    # Conversation management logic
├── interaction.service.ts     # Interaction processing
├── persistence.service.ts     # Database operations
├── import-export.service.ts   # Data import/export functionality
├── sync.service.ts            # Git synchronization logic
├── model-fetcher.ts           # AI model list fetching
└── event-action-coordinator.service.ts # Event-to-store routing
```

### Core Libraries

```
src/lib/
├── litechat/                  # Core LiteChat utilities
│   ├── initialization.ts     # App startup and module initialization
│   ├── event-emitter.ts      # Central event bus
│   ├── db.ts                 # Dexie database schema
│   ├── vfs-operations.ts     # VFS file operations
│   ├── vfs-git-operations.ts # Git operations on VFS
│   ├── file-manager-utils.ts # File path utilities
│   ├── provider-helpers.ts   # AI provider utilities
│   ├── ai-helpers.ts         # AI interaction helpers
│   ├── constants.ts          # Application constants
│   └── markdown-utils.ts     # Markdown processing utilities
└── utils.ts                  # General utility functions
```

### Type Definitions

```
src/types/
├── litechat/                  # LiteChat-specific types
│   ├── events/                # Event definitions
│   │   ├── app.events.ts      # Application lifecycle events
│   │   ├── conversation.events.ts # Conversation events
│   │   ├── interaction.events.ts # AI interaction events
│   │   ├── project.events.ts  # Project management events
│   │   ├── provider.events.ts # Provider configuration events
│   │   ├── settings.events.ts # Settings events
│   │   ├── ui.events.ts       # UI state events
│   │   ├── vfs.events.ts      # VFS events
│   │   ├── prompt.events.ts   # Prompt events
│   │   ├── input.events.ts    # Input events
│   │   ├── mod.events.ts      # Modding events
│   │   ├── rules.events.ts    # Rules and tags events
│   │   ├── sync.events.ts     # Sync events
│   │   ├── canvas.events.ts   # Canvas events
│   │   └── control.registry.events.ts # Control registry events
│   ├── chat.ts                # Conversation and message types
│   ├── interaction.ts         # AI interaction types
│   ├── project.ts             # Project structure types
│   ├── provider.ts            # AI provider and model types
│   ├── settings.ts            # Application settings types
│   ├── vfs.ts                 # Virtual file system types
│   ├── prompt.ts              # Prompt and input types
│   ├── control.ts             # Control module types
│   ├── modding.ts             # Modding system types
│   ├── rules.ts               # Rules and tags types
│   └── sync.ts                # Git sync types
└── vite-env.d.ts              # Vite environment types
```

### Modding System

```
src/modding/
├── api-factory.ts             # Creates ModApi instances for mods
└── loader.ts                  # Loads and executes mod scripts
```

### Custom Hooks

```
src/hooks/
├── useItemEditing.ts          # Generic item editing state
├── useScrollToBottom.ts       # Auto-scroll behavior
├── useDebounce.ts             # Debounced values
└── useLocalStorage.ts         # Local storage integration
```

## Key File Relationships

### Module Registration Flow
1. `App.tsx` - Defines `controlModulesToRegister` array
2. `LiteChat.tsx` - Calls `performFullInitialization`
3. `initialization.ts` - Handles module instantiation and registration
4. Control modules register UI components via ModApi
5. Component wrappers render registered controls

### Event System Flow
1. `event-emitter.ts` - Central mitt instance
2. `events/` directory - Event name and payload definitions
3. `modding.ts` - `ModEventPayloadMap` aggregates all event types
4. `event-action-coordinator.service.ts` - Routes events to stores
5. Stores register action handlers for events

### State Management Flow
1. Components emit request events
2. `EventActionCoordinatorService` routes to store actions
3. Stores update state using Immer middleware
4. Stores emit change events
5. Components react to state changes

### VFS Context Flow
1. `LiteChat.tsx` - Determines VFS context based on selection
2. `vfs.store.ts` - Manages VFS initialization and switching
3. `vfs-operations.ts` - Low-level file operations
4. `file-manager/` components - UI for file operations

## Configuration Files

### Build Configuration
- `vite.config.ts` - Vite bundler configuration with plugins
- `tsconfig.json` - TypeScript compiler options
- `tailwind.config.js` - Tailwind CSS customization

### Package Configuration
- `package.json` - Dependencies, scripts, and metadata
- `.github/workflows/` - CI/CD pipeline definitions

## Development Patterns

### File Naming Conventions
- **Components**: PascalCase (e.g., `ChatCanvas.tsx`)
- **Stores**: kebab-case with `.store.ts` suffix
- **Services**: kebab-case with `.service.ts` suffix
- **Types**: kebab-case with `.ts` suffix
- **Events**: kebab-case with `.events.ts` suffix

### Import Organization
```typescript
// External libraries
import React from 'react';
import { create } from 'zustand';

// Internal components
import { Button } from '@/components/ui/button';
import { ChatCanvas } from '@/components/LiteChat/canvas/ChatCanvas';

// Services and utilities
import { PersistenceService } from '@/services/persistence.service';
import { emitter } from '@/lib/litechat/event-emitter';

// Types
import type { Conversation } from '@/types/litechat/chat';
```

### Directory Guidelines
- **Components**: Group by feature area (e.g., `canvas/`, `prompt/`)
- **Stores**: One store per domain with clear responsibilities
- **Services**: Business logic separated from UI concerns
- **Types**: Mirror the directory structure for easy navigation

This file structure supports LiteChat's modular architecture while maintaining clear separation of concerns and making the codebase navigable for developers. 