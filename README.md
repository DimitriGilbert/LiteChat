# LiteChat

**LiteChat** is a modular, extensible, and privacy-focused AI chat application for power users, developers, and teams. It supports multiple AI providers (OpenAI, Google Gemini, OpenRouter, Ollama, OpenAI-compatible APIs, and more), advanced prompt engineering, project-based organization, virtual file systems (VFS), Git sync, rules/tags, modding, and a highly customizable UI. LiteChat is **100% client-side**, meaning all your data, including API keys and conversations, stays in your browser unless you explicitly use features like Git sync.

---

## Table of Contents

- [Features](#features)
- [Install](#install)
- [Docker & CORS](#docker--cors)
- [Project Structure](#project-structure)
- [Core Concepts](#core-concepts)
  - [Providers & Models](#providers--models)
  - [Projects & Conversations](#projects--conversations)
  - [Control Modules & UI](#control-modules--ui)
  - [Virtual File System (VFS)](#virtual-file-system-vfs)
  - [Git Sync](#git-sync)
  - [Rules & Tags](#rules--tags)
  - [Modding System](#modding-system)
  - [Event System](#event-system)
- [Getting Started (Development)](#getting-started-development)
- [Key UI Components & Controls](#key-ui-components--controls)
  - [Prompt Area Controls](#prompt-area-controls)
  - [Chat Area Controls](#chat-area-controls)
  - [Settings Modal Tabs](#settings-modal-tabs)
- [Data Management & Privacy](#data-management--privacy)
  - [Import/Export](#importexport)
  - [Local Storage](#local-storage)
- [Theming & Customization](#theming--customization)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Development & Contributing](#development--contributing)
- [License](#license)

---

## Features

- **Multi-provider support:** OpenAI, Google Gemini, OpenRouter, Ollama, OpenAI-compatible APIs.
- **100% Client-Side:** All data (API keys, conversations, settings) stored locally in your browser using IndexedDB. No server-side components for core chat functionality.
- **Build-Time Configuration:** Load custom system prompts and complete user configurations from files at build time for personalized setups.
- **Project-based organization:** Organize conversations into projects, with a hierarchical project tree.
- **Advanced prompt controls:** Per-turn system prompt overrides, rules/tags, tool selection, structured output (JSON schema), web search toggles, reasoning toggles, and file attachments.
- **Virtual File System (VFS):** Per-project and shared "orphan" filesystems. Manage files directly in the browser (upload, download, create folders, rename, delete, ZIP export/import). Attach VFS files to prompts.
- **Git integration:** Link projects/conversations to Git repositories. Sync conversations as JSON. Perform Git operations (clone, pull, push, commit, status) directly in the UI, operating on the VFS.
- **Rules & Tags:** Define reusable prompt snippets (system, before user, after user) and organize them with tags. Apply per-project, per-conversation, or per-turn.
- **Modding system:** Extend LiteChat by registering custom UI controls, tools, middleware, and settings tabs via user scripts or remote mods using a controlled API.
- **Import/Export:** Export/import individual conversations (JSON, Markdown), projects (JSON including conversations), or the full application configuration (settings, providers, projects, rules, mods, etc.).
- **Custom theming:** Light, dark, "Tiju" (custom palette), and fully user-defined themes (CSS variables for colors, fonts, layout).
- **Streaming Markdown & Code Rendering:** Real-time rendering of Markdown and syntax-highlighted code blocks as AI responses stream in.
- **Token/Context Usage Display:** Visual indicator of estimated context window usage for the selected model.
- **Auto-Title Generation:** Automatically generate conversation titles using a dedicated model and prompt.
- **Interaction Rating:** Rate assistant responses from -5 to +5 for feedback.
- **Robust Error Handling:** User-friendly error boundaries and reporting.
- **Extensive Keyboard Navigation and Accessibility.**
- **Event-Driven Architecture:** Core interactions and state changes managed via an event bus for decoupling and extensibility.
- **Modular Control System:** UI features are built as `ControlModule`s, ensuring a clean separation of concerns and allowing for easy extension.

---

## Install

### Download the Latest Release

You can download the latest release directly:

```bash
# Using curl and bsdtar (recommended for preserving structure)
curl -L https://github.com/DimitriGilbert/LiteChat/releases/latest/download/litechat-nightly.zip | bsdtar -xf- -C ./litechat
cd litechat

# Or using curl and unzip (ensure your unzip handles nested directories correctly)
# curl -L -o litechat.zip https://github.com/DimitriGilbert/LiteChat/releases/latest/download/litechat-nightly.zip
# unzip litechat.zip -d litechat
# cd litechat
```

### Start a Local HTTP Server

LiteChat is a static web application. Serve the `dist` (or `public` if running from source after build) directory with any simple HTTP server.

#### Python

```bash
# Python 3.x (from the directory containing index.html)
python3 -m http.server 8080
# Python 2.x
# python -m SimpleHTTPServer 8080
```

#### Node.js

```bash
# From the directory containing index.html
npx serve -l 8080 .
# or
# npx http-server -p 8080 .
```

#### Other Languages (Ruby, Go, PHP, Perl)

Refer to the `README.md` in the repository for one-liners for other languages.

Now open [http://localhost:8080](http://localhost:8080) in your browser.

---

## Docker & CORS

### Docker

A sample `docker/nginx.conf` is provided. You can use the following `Dockerfile` (ensure paths are correct for your build output, typically `dist`):

```dockerfile
FROM nginx:alpine
COPY ./dist /usr/share/nginx/html  # Assuming your build output is in 'dist'
COPY ./docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Build and run:

```bash
docker build -t litechat .
docker run -d -p 8080:80 litechat
```

### CORS

If using local models (Ollama, LMStudio, etc.) or custom API endpoints, you might need to configure CORS on your AI backend server. LiteChat makes direct requests from the browser.

- **Ollama:** Start Ollama with `OLLAMA_ORIGIN='*'` (or a more specific origin like `http://localhost:8080`) environment variable. Example: `OLLAMA_ORIGIN='*' ollama serve`.
- **OpenAI-Compatible APIs (e.g., LMStudio):** Check your server's documentation for enabling CORS headers.

**No server-side CORS is needed for LiteChat's internal VFS operations** as they happen entirely in the browser via IndexedDB.

---

## Project Structure

The project structure is designed for modularity and clarity:

```
.
├── public/                       # Static assets, icons, manifest.json, index.html
├── src/
│   ├── App.tsx                   # Main application component, ControlModule registration
│   ├── main.tsx                  # React entry point
│   ├── index.css                 # Global styles, Tailwind directives, theme variables
│   ├── assets/                   # Static assets like images, fonts (if any)
│   ├── components/
│   │   ├── LiteChat/             # Core application UI components
│   │   │   ├── canvas/           # Chat canvas, interaction cards, streaming logic
│   │   │   ├── chat/             # Sidebar, conversation/project list, chat area controls
│   │   │   ├── common/           # Shared UI (ErrorBoundary, Modals, Loaders, etc.)
│   │   │   ├── file-manager/     # VFS UI components
│   │   │   ├── project-settings/ # Project settings modal and its tabs
│   │   │   ├── prompt/           # Prompt input area, control wrappers
│   │   │   └── settings/         # Main settings modal and its tabs
│   │   ├── ui/                   # shadcn/ui primitive components (Button, Input, etc.)
│   │   └── OnBoardingRant.tsx    # Initial welcome/setup component
│   ├── controls/
│   │   ├── components/           # UI components specific to ControlModules
│   │   │   ├── assistant-settings/ # UI for assistant behavior settings tab
│   │   │   ├── auto-title/       # UI for auto-title prompt control
│   │   │   ├── ... (other control-specific UI)
│   │   └── modules/              # ControlModule class definitions
│   │       ├── AutoTitleControlModule.ts
│   │       ├── ... (other ControlModule files)
│   ├── hooks/                    # Custom React hooks (e.g., useItemEditing)
│   ├── lib/
│   │   ├── litechat/             # Core LiteChat utilities (DB, AI helpers, VFS, etc.)
│   │   └── utils.ts              # General utility functions (e.g., cn for Tailwind)
│   ├── modding/                  # Modding API factory and loader
│   ├── services/                 # Business logic services (AI, Conversation, Persistence, etc.)
│   ├── store/                    # Zustand state stores for different domains
│   ├── types/
│   │   ├── litechat/             # Core TypeScript type definitions for the application
│   │   │   ├── events/           # Event name constants and payload types
│   │   │   └── ... (chat.ts, control.ts, interaction.ts, etc.)
│   │   └── vite-env.d.ts         # Vite environment types
│   ├── vite-env.d.ts             # Vite environment types (duplicate, consider removing one)
├── tailwind.config.ts            # Tailwind CSS configuration
├── vite.config.ts                # Vite build configuration
├── tsconfig.json                 # Main TypeScript configuration
├── package.json                  # Project dependencies and scripts
└── README.md                     # This file
```

---

## Core Concepts

### Providers & Models

- **Providers**: Configurations for AI services (OpenAI, Google, OpenRouter, Ollama, OpenAI-Compatible). Each has its own API key (optional for local providers), base URL (for Ollama/Compatible), and a list of enabled models.
- **Models**: Fetched from provider APIs (if supported) or defined statically. Users can enable/disable models per provider. A global sort order determines their appearance in selectors.
- **API Keys**: Stored locally per provider. Managed in Settings.

### Projects & Conversations

- **Projects**: Organize conversations hierarchically. Each project can have default settings (system prompt, model, parameters, rules, tags) that override global or parent project settings. Each project has its own VFS.
- **Conversations**: Belong to a project or are "orphaned" (sharing a common VFS). Store metadata, sync status, and interaction history.

### Control Modules & UI

- **Control Modules (`ControlModule`)**: Encapsulate UI features and their logic (e.g., File Attachment, System Prompt Override, Settings Tabs). They register `PromptControl`s (in the prompt input area) or `ChatControl`s (in other layout areas like sidebar, header).
  - **Lifecycle**: `initialize()` for setup, `register()` for UI/tool/middleware registration, `destroy()` for cleanup.
  - **UI Components**: Modules manage their own React components, passing the module instance as a prop. Components use module getters/setters and a `notifyComponentUpdate` callback for reactivity.
- **Prompt Controls (`PromptControl`)**: UI elements appearing below the prompt input (e.g., file attach, rules selector). Contribute parameters or metadata to the AI prompt.
- **Chat Controls (`ChatControl`)**: UI elements in the sidebar, header, or modals (e.g., settings button, VFS modal trigger).
- **Registration**: Defined in `App.tsx`, instantiated and managed by `performFullInitialization`. Visual order of prompt controls is based on registration sequence.

### Virtual File System (VFS)

- **Per-Context VFS**: Each project has its own VFS. Orphaned conversations share a common "orphan" VFS. A dedicated "sync_repos" VFS is used for Git operations.
- **Browser-Based**: Implemented using **ZenFS** with an **IndexedDB** backend, all within the browser.
- **File Manager**: UI for uploading, downloading, creating folders, renaming, deleting, and managing files. Supports ZIP export/import.
- **Prompt Attachment**: Files from the active VFS can be attached to prompts.

### Git Sync

- **Sync Repositories**: Configure remote Git repositories (HTTPS with optional username/password or token) in Settings.
- **Conversation Sync**: Link individual conversations to a configured sync repository. Conversations are synced as JSON files within a `.litechat/conversations/` directory in the repo.
- **Git Operations**: UI for clone, pull, push, commit, and status checks, operating on the "sync_repos" VFS.

### Rules & Tags

- **Rules**: Reusable text snippets (system prompt modifications, text to inject before/after user input).
- **Tags**: Organize rules. Activating a tag applies all its linked rules.
- **Application**: Rules/tags can be set as defaults per-project or activated per-turn via a prompt control.

### Modding System

- **Mods**: User scripts (loaded via URL or pasted code) can extend LiteChat.
- **`LiteChatModApi`**: A controlled API for mods to register prompt/chat controls, AI tools, middleware, and custom settings tabs. Mods cannot directly access internal stores or components.
- **Security**: Users are warned about the risks of running untrusted code.

### Event System

- **`mitt` Event Emitter**: A central event bus (`emitter`) for decoupled communication between components, modules, and services.
- **Event Definitions**: String-based event names (e.g., `conversationEvent.SELECTED_ITEM_CHANGED`) and typed payloads are defined in `src/types/litechat/events/`.
- **Action Requests**: Many store actions are triggered by "request" events (e.g., `providerEvent.ADD_API_KEY_REQUEST`), which are listened to by the `EventActionCoordinatorService` that then calls the appropriate store action.
- **State Changes**: Stores emit events after their state has changed (e.g., `providerEvent.API_KEYS_CHANGED`).

### State Management (Zustand)

- **Modular Stores**: Zustand stores (`src/store/*.store.ts`) manage specific application domains (conversations, providers, settings, UI state, etc.).
- **Access**: React components use Zustand hooks (preferably with `useShallow`). Services and `ControlModule`s use `store.getState()`.
- **Event-Driven Updates**: Stores primarily update their state in response to action request events and then emit state change events.

---

## Getting Started (Development)

1. **Prerequisites:** Node.js (v18+ recommended), npm or pnpm.

2. **Install dependencies:**

   ```bash
   npm install
   # or
   # pnpm install
   ```

3. **Run the development server:**

   ```bash
   npm run dev
   # or
   # pnpm dev
   ```

   This usually starts Vite on `http://localhost:5173` (or the port specified by `--host` if used, e.g., `http://localhost:3000`).

4. **Open LiteChat in your browser.**

5. **First-Time Setup (In-App):**
   - If using providers requiring API keys (OpenAI, Google, OpenRouter), add your key in `Settings` -> `Providers & Models` -> `API Keys`.
   - Add a provider configuration in `Settings` -> `Providers & Models` -> `Configuration`.
   - Enable at least one model for that provider.
   - Start chatting!

---

## Key UI Components & Controls

### Prompt Area Controls

Managed by `ControlModule`s and rendered by `<PromptControlWrapper>`:

- **Global Model Selector**: Choose the AI model for the next turn.
- **Auto-Title Toggle**: Enable/disable automatic title generation for the first message of a new chat.
- **Usage Display**: Shows estimated token usage against the selected model's context window.
- **Reasoning Toggle**: Enable/disable reasoning/chain-of-thought generation (if model supports).
- **Web Search Toggle**: Enable/disable web search for the next turn (if model supports).
- **File Attachment**: Upload files directly to the prompt.
- **VFS Attachment Trigger**: Open VFS modal to attach files from the Virtual File System.
- **Rules & Tags Selector**: Activate predefined rules or tags for the next turn.
- **System Prompt Override**: Set a system prompt specifically for the next turn, overriding project/global defaults.
- **Tool Selector**: Enable/disable available AI tools for the next turn and set max tool execution steps.
- **Parameter Adjustments**: Fine-tune AI parameters (temperature, top_p, etc.) for the next turn.
- **Structured Output**: Define a JSON schema for the AI's output (if model supports).
- **Git Sync (Conversation)**: Link the current conversation to a Git sync repository.

### Chat Area Controls

Managed by `ControlModule`s and rendered by `<ChatControlWrapper>` in different layout panels:

- **Sidebar:**
  - `ConversationListControlModule`: Displays the project and conversation tree.
- **Sidebar Footer:**
  - `SidebarToggleControlModule`: Collapses/expands the sidebar.
  - `SettingsControlModule` (Trigger): Opens the main Settings modal.
- **Header:**
  - (Currently, header controls might be part of specific modules like Project Settings trigger, or could be added by mods).
- **Modals (Managed by `ModalManager`):**
  - `SettingsControlModule` (Modal): Main application settings.
  - `ProjectSettingsControlModule` (Modal): Settings specific to the selected project.
  - `VfsControlModule` (Modal): Full-screen Virtual File System manager.

### Settings Modal Tabs

Registered by `ControlModule`s or mods:

- **General**: UI settings, streaming preferences.
- **Theme**: Base theme, custom fonts, colors, code block themes.
- **Providers & Models**: Manage API keys, provider configurations, enable/fetch models, global model order.
- **Assistant**: Default system prompt, AI parameters, tool settings, auto-title configuration.
- **Rules & Tags**: Create and manage reusable prompt rules and organizational tags.
- **Git**: Configure Git user details and Sync Repositories.
- **Data**: Import/export data, clear local storage.
- **Mods**: Manage installed mods (add, enable/disable, remove).
- _(Custom tabs can be added by mods)_

---

## Data Management & Privacy

LiteChat prioritizes user privacy and local data control.

### Import/Export

- **Single Conversation**: Export/import as JSON (including all messages and metadata) or Markdown (formatted chat log).
- **Project Export**: Export an entire project, including its sub-projects and all conversations within them, as a single JSON file.
- **Full Configuration**: Export or import the entire application state. This includes:
  - All settings (General, Theme, Assistant, etc.)
  - API Keys
  - Provider Configurations (including fetched model lists and enabled models)
  - Projects and their specific settings
  - All Conversations and their Interactions
  - Rules and Tags
  - Mod configurations (source URLs or scripts)
  - Git Sync Repository configurations
  - Fine-grained selection of what to include in the import/export is available.
- **Danger Zone**: A "Clear All Data" option in `Settings -> Data` allows users to completely wipe all LiteChat data from their browser's IndexedDB.

### Local Storage

- **IndexedDB**: All user data (conversations, API keys, settings, VFS files, etc.) is stored in the browser's IndexedDB via Dexie.js.
- **No Cloud Sync (by default)**: LiteChat does not send your data to any cloud service by default. Data remains local unless you configure and use the Git Sync feature.
- **API Keys**: Stored locally and only sent directly to the respective AI provider when making API calls. They are not sent to any LiteChat-affiliated server.

---

## Theming & Customization

- **Base Themes**: Includes "Light", "Dark", "System" (follows OS preference), and "Tiju" (a custom color palette with light/dark variants).
- **Custom Theme (`custom`)**:
  - **Colors**: Users can define custom CSS variables for all core UI colors (background, foreground, primary, accent, card, etc.) via the Theme settings tab.
  - **Fonts**: Set a custom font family (e.g., "Inter, sans-serif") and base font size.
- **Chat Max Width**: Control the maximum width of the chat message area for readability.
- **Code Block Themes**: Choose from a list of preset PrismJS themes for syntax highlighting or provide a URL to a custom PrismJS theme CSS file.

---

## Keyboard Shortcuts

Standard web application shortcuts apply. Key specific interactions:

- **Enter** (in prompt input): Send message.
- **Shift+Enter** (in prompt input): New line.
- **Ctrl/Cmd+K**: Often used by command palettes (if a control implements one, e.g., in VFS or model selection).
- **Ctrl/Cmd+S**: Standard save shortcut in dialogs/forms (browser dependent).
- **Esc**: Close modals, cancel editing in input fields.
- **Tab/Shift+Tab**: Navigate between focusable elements.

(Specific keyboard shortcuts for actions like "New Chat", "Toggle Sidebar" may be added by `ControlModule`s or mods.)

---

## Development & Contributing

- **Tech Stack**: React 19, TypeScript, Zustand, Vite, Tailwind CSS, shadcn/ui, Dexie.js (IndexedDB), ZenFS (VFS backend), `ai` (VFS SDK), `isomorphic-git` (browser Git).
- **Architecture**: Modular via `ControlModule`s, event-driven state updates, service layer for business logic.
- **Linting & Formatting**: ESLint and Prettier are used. See `.eslintrc.js` (or `eslint.config.js`) and Prettier config in `package.json`.
- **Testing**: Vitest for unit/integration tests. (Playwright for E2E tests is planned).
- **Contributions**: Pull Requests and GitHub Issues are welcome! Please follow coding style and contribution guidelines (CONTRIBUTING.md - to be created).

---

## License

MIT License. See [LICENSE](LICENSE) file for details.

---

**LiteChat** is an open-source project. Feedback, bug reports, and contributions are highly encouraged!

---
