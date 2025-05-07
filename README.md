# LiteChat

**LiteChat** is a modular, extensible, and privacy-focused AI chat application for power users, developers, and teams. It supports multiple AI providers (OpenAI, Google Gemini, OpenRouter, Ollama, OpenAI-compatible APIs, and more), advanced prompt engineering, project-based organization, virtual file systems (VFS), Git sync, rules/tags, modding, and a highly customizable UI.

---

## Table of Contents

- [Features](#features)
- [Install](#install)
- [Docker & CORS](#docker--cors)
- [Project Structure](#project-structure)
- [Core Concepts](#core-concepts)
- [Getting Started](#getting-started)
- [Providers & Models](#providers--models)
- [Projects & Conversations](#projects--conversations)
- [Prompt Controls & Chat Controls](#prompt-controls--chat-controls)
- [Virtual File System (VFS)](#virtual-file-system-vfs)
- [Git Sync](#git-sync)
- [Rules & Tags](#rules--tags)
- [Modding System](#modding-system)
- [Import/Export & Data Management](#importexport--data-management)
- [Theming & Customization](#theming--customization)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Development & Contributing](#development--contributing)
- [License](#license)

---

## Features

- **Multi-provider support:** OpenAI, Google Gemini, OpenRouter, Ollama, OpenAI-compatible APIs, and more.
- **Project-based organization:** Organize conversations into projects, with hierarchical project trees.
- **Advanced prompt controls:** Per-turn system prompt, rules/tags, tool selection, structured output, web search, reasoning, and more.
- **Virtual File System (VFS):** Per-project files, attach files to prompts, manage files in a browser-based filesystem, attach VFS files to prompts, and preview files.
- **Git integration:** Link projects/conversations to Git repositories, sync conversations as JSON, and perform Git operations (clone, pull, push, commit, status) directly in the UI.
- **Rules & Tags:** Define reusable prompt snippets and organize them with tags, apply them per-project, per-conversation, or per-turn.
- **Modding system:** Register custom controls, tools, middleware, and settings tabs via user scripts or remote mods.
- **Import/Export:** Export/import conversations, projects, or full configuration (including settings, providers, rules, mods, etc.).
- **Custom theming:** Light, dark, Tiju, and fully custom themes with user-defined colors, fonts, and code block themes.
- **Streaming markdown/code rendering:** Real-time markdown and code block rendering during AI response streaming.
- **Token/context usage display:** Visual indicator of context window usage for the selected model.
- **Auto-title generation:** Generate conversation titles using a dedicated model and prompt.
- **Interaction rating:** Rate assistant responses from -5 to +5 for feedback or future training.
- **Error boundaries:** Robust error handling with user-friendly error reports and GitHub issue integration.
- **Extensive keyboard navigation and accessibility.**

---

## Install

### Download the Latest Release

You can download the latest release directly with `curl`:

```bash
curl -L -o litechat.zip https://github.com/DimitriGilbert/LiteChat/releases/latest/download/litechat-nightly.zip
unzip litechat.zip -d litechat
cd litechat
```

Or download and extract in one line:

```bash
curl -L https://github.com/DimitriGilbert/LiteChat/releases/latest/download/litechat-nightly.zip | bsdtar -xf- -C ./litechat
cd litechat
```

### Start a Local HTTP Server

You can serve the static files with any simple HTTP server. Here are one-liners for various languages:

#### Python

```bash
# Python 3.x
python3 -m http.server 8080
# Python 2.x
python -m SimpleHTTPServer 8080
```

#### Node.js

```bash
npx serve -l 8080 .
# or
npx http-server -p 8080 .
```

#### Ruby

```bash
ruby -run -e httpd . -p 8080
```

#### Go

```bash
go run -e "http.ListenAndServe(`:8080`, http.FileServer(http.Dir(`.`)))"
```

#### PHP

```bash
php -S 0.0.0.0:8080
```

#### Perl

```bash
perl -MHTTP::Server::Simple -e 'HTTP::Server::Simple->new(8080)->run'
```

Now open [http://localhost:8080](http://localhost:8080) in your browser.

---

## Docker & CORS

### Docker

A sample `docker/nginx.conf` is provided for serving LiteChat with Nginx. You can use the following `Dockerfile` to build a static server image:

```dockerfile
FROM nginx:alpine
COPY ./public /usr/share/nginx/html
COPY ./docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Build and run:

```bash
docker build -t litechat .
docker run -d -p 8080:80 litechat
```

### CORS

If you are using local models (Ollama, LMStudio, etc.) or custom API endpoints, you may need to enable CORS on your backend. For example, for Ollama:

- Start Ollama with CORS enabled:
  ```bash
  OLLAMA_ORIGIN='*' ollama serve
  ```
- For OpenAI-compatible APIs, check your server's documentation for CORS headers.

If you use the built-in file manager and VFS, **no server-side CORS is needed** for local file operations.

---

## Project Structure

```
.
├── src/
│   ├── components/
│   │   ├── LiteChat/
│   │   │   ├── canvas/           # Chat canvas, interaction cards, streaming, empty states
│   │   │   ├── chat/             # Sidebar, conversation/project list, controls
│   │   │   ├── common/           # Shared UI components, icons, error boundary, etc.
│   │   │   ├── file-manager/     # VFS file manager, dialogs, toolbar, etc.
│   │   │   ├── project-settings/ # Project settings modal and tabs
│   │   │   ├── prompt/           # Prompt input, controls, wrappers
│   │   │   ├── settings/         # Settings modal, tabs, provider management, etc.
│   │   │   └── ui/               # UI primitives (button, input, dialog, etc.)
│   ├── hooks/                    # Registration hooks for controls/tools
│   ├── lib/                      # Utility functions, VFS, provider helpers, etc.
│   ├── modding/                  # Mod API factory, loader
│   ├── services/                 # AI, conversation, interaction, persistence, sync, etc.
│   ├── store/                    # Zustand stores for all app state
│   ├── types/                    # TypeScript types for all core concepts
│   └── index.css                 # Tailwind and custom styles
├── public/                       # Static assets, icons, manifest, etc.
├── README.md                     # This file
└── ...
```

---

## Core Concepts

### Providers & Models

- **Providers**: Each provider (OpenAI, Google, OpenRouter, Ollama, etc.) is configured with its own API key, base URL, and enabled models.
- **Models**: Models are fetched from the provider's API or defined statically. You can enable/disable models per provider and globally order them for selection.
- **API Keys**: API keys are stored per provider and can be managed in the settings.

### Projects & Conversations

- **Projects**: Organize conversations into projects. Projects can be nested (tree structure), and each project can have its own default settings, rules, tags, and VFS.
- **Conversations**: Each conversation belongs to a project (or is "orphaned" if not assigned). Conversations store their own metadata, sync status, and history.

### Prompt Controls & Chat Controls

- **Prompt Controls**: UI controls that appear in the prompt input area (e.g., system prompt, rules/tags, tool selector, file attachment, web search, reasoning, structured output, etc.). Controls can be registered by core or mods.
- **Chat Controls**: Controls that appear in the sidebar, header, or other layout areas (e.g., settings, project settings, VFS modal, sidebar toggle, etc.).
- **Registration**: Controls and tools are registered via hooks in `src/hooks/litechat/` and can be extended by mods.

### Virtual File System (VFS)

- **Per-project VFS**: Each project has its own virtual filesystem, stored in IndexedDB via ZenFS. Files can be uploaded, organized, renamed, deleted, and attached to prompts.
- **File Manager**: Full-featured file manager UI with upload, folder creation, drag-and-drop, download, and ZIP extraction/export.
- **VFS Modal**: Attach files from the VFS to prompts via a modal or inline controls.

### Git Sync

- **Sync Repositories**: Configure remote Git repositories (with optional credentials) to sync conversations as JSON files.
- **Linking**: Link conversations to a sync repo; sync status is tracked and displayed.
- **Git Operations**: Clone, pull, push, commit, and check status directly from the UI (per project or conversation).

### Rules & Tags

- **Rules**: Define reusable prompt snippets (system, before, after) that can be applied globally, per-project, per-conversation, or per-turn.
- **Tags**: Organize rules into tags; tags can be activated per-turn or set as project defaults.
- **Rules/Tags Controls**: UI for activating rules/tags for the next turn, and for managing them in settings.

### Modding System

- **Mods**: User scripts or remote mods can register prompt/chat controls, tools, middleware, and settings tabs.
- **API**: Mods have access to a safe API for interacting with the app, registering controls, tools, and listening to events.
- **Settings Tabs**: Mods can add custom settings tabs to the main settings modal.

### Import/Export & Data Management

- **Single Conversation**: Import/export individual conversations as JSON or Markdown.
- **Project Export**: Export entire projects (including sub-projects and conversations).
- **Full Configuration**: Import/export the entire app state (settings, providers, projects, conversations, rules, tags, mods, sync repos, etc.) with fine-grained options.
- **Danger Zone**: Clear all local data from the browser.

### Theming & Customization

- **Themes**: Light, dark, Tiju, and fully custom themes.
- **Custom Colors**: User-defined CSS variables for all theme colors.
- **Fonts & Layout**: Custom font family, font size, and chat max width.
- **Code Block Themes**: Select from preset PrismJS themes or provide a custom URL.

---

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Run the development server:**

   ```bash
   npm run dev
   # or
   pnpm dev
   ```

3. **Open LiteChat in your browser:**

   ```
   http://localhost:3000
   ```

4. **First-time setup:**
   - Add an API key (if required by your provider).
   - Add a provider configuration (OpenAI, Google, OpenRouter, Ollama, etc.).
   - Enable at least one model for the provider.
   - Start your first chat!

---

## Providers & Models

- **Add API Keys**: Go to Settings → Providers & Models → API Keys.
- **Add Provider**: Settings → Providers & Models → Configuration.
- **Enable Models**: In the provider's edit section, enable models for global use.
- **Model Order**: Drag and drop models in "Model Order" tab to set their display order.
- **Model Details**: Click a model name to view its full metadata.

---

## Projects & Conversations

- **Create Projects**: Use the sidebar to create projects and sub-projects.
- **Move Conversations**: Assign conversations to projects for organization.
- **Project Settings**: Each project can override system prompt, model, parameters, rules, tags, and sync repo.
- **Project VFS**: Each project has its own virtual filesystem.

---

## Prompt Controls & Chat Controls

- **Prompt Controls**: Appear below the input area. Includes:
  - System Prompt (per-turn override)
  - Rules & Tags (activate for next turn)
  - Tool Selector (enable/disable tools, set max steps)
  - File Attachment (upload or attach VFS files)
  - VFS Trigger (open VFS modal)
  - Web Search (enable for next turn)
  - Reasoning (enable for next turn)
  - Structured Output (set JSON schema for output)
  - Usage Display (context/token usage indicator)
  - Auto-Title (enable for first message)
  - Git Sync (link conversation to sync repo)
- **Chat Controls**: Appear in sidebar, header, or modals. Includes:
  - Conversation List
  - Settings
  - Project Settings
  - Sidebar Toggle
  - VFS Modal

---

## Virtual File System (VFS)

- **Per-project VFS**: Each project (and orphaned conversations) has a dedicated filesystem.
- **File Manager**: Upload, download, rename, delete, create folders, extract ZIPs, export as ZIP.
- **Attach Files**: Select files in the VFS and attach them to the next prompt.
- **Preview**: Preview text, image, audio, and video files before sending.

---

## Git Sync

- **Configure Repos**: Settings → Git → Sync Repositories.
- **Link Conversations**: Use the Git Sync control in the prompt area to link a conversation to a repo.
- **Sync Status**: See sync status in the sidebar and prompt controls.
- **Git Operations**: Clone, pull, push, commit, and check status from the file manager or settings.

---

## Rules & Tags

- **Manage Rules/Tags**: Settings → Rules & Tags.
- **Apply Rules/Tags**: Use the Rules/Tags control in the prompt area to activate for the next turn.
- **Project Defaults**: Set default rules/tags for a project in Project Settings.

---

## Modding System

- **Enable Mods**: Settings → Mods.
- **Add Mod**: Provide a script URL or paste code directly.
- **Register Controls/Tools**: Mods can add prompt/chat controls, tools, middleware, and settings tabs.
- **API**: Mods have access to a safe API for interacting with the app and state.

---

## Import/Export & Data Management

- **Single Conversation**: Import/export as JSON or Markdown.
- **Project Export**: Export a project and all its conversations.
- **Full Export/Import**: Export/import the entire app state with fine-grained options.
- **Clear All Data**: Danger zone in Settings → Data.

---

## Theming & Customization

- **Themes**: Light, dark, Tiju, or custom.
- **Custom Colors**: Define your own CSS variables for all theme colors.
- **Fonts**: Set custom font family and size.
- **Chat Max Width**: Control the width of the chat area.
- **Code Block Themes**: Choose from preset PrismJS themes or provide a custom URL.

---

## Keyboard Shortcuts

- **Enter**: Send message
- **Shift+Enter**: New line in input
- **Ctrl/Cmd+K**: Focus search/filter in sidebar
- **Ctrl/Cmd+S**: Save in dialogs/forms
- **Esc**: Close modals, cancel editing
- **Tab**: Navigate controls

---

## Development & Contributing

- **Tech Stack**: React, Zustand, TypeScript, Tailwind CSS, Dexie (IndexedDB), ZenFS, ai-sdk, isomorphic-git, etc.
- **Modular Architecture**: All controls, tools, and features are registered via hooks and can be extended by mods.
- **Strict Linting**: See `.eslintrc` and code style rules.
- **Testing**: (TBD) Playwright and Vitest planned.
- **Contributions**: PRs and issues welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) (coming soon).

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**LiteChat** is an open-source project. Feedback, bug reports, and contributions are welcome!

---

**Note:** This README is up to date as of May 2025 and reflects the current state of the codebase, including all major features, architectural changes, and UI/UX improvements. If you find any discrepancies, please open an issue or PR.
