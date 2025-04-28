# LiteChat ⚡️

**Chat Smarter, Your Way.**

LiteChat isn't just another AI chat interface; it's your private, high-performance command center for interacting with the world of artificial intelligence. Built from the ground up with **privacy, speed, and customization** at its core, LiteChat runs entirely within your web browser, ensuring your conversations and valuable API keys never leave your device.

**Why LiteChat?**

*   **True Privacy:** Unlike many cloud-based solutions, LiteChat is **100% client-side**. Your data stays with you. Period. Interact directly with AI providers like OpenAI, Google Gemini, OpenRouter, or your self-hosted Ollama/LM Studio instances without intermediaries.
*   **Blazing Fast:** Experience a fluid, responsive interface thanks to a lightweight design and efficient state management. No server lag, just smooth conversation flow.
*   **Organize Your Thoughts:** Structure your chats with **Projects**. Group related conversations, set project-specific instructions or models, and keep your workspace tidy.
*   **Integrated File Management (VFS):** Go beyond simple text prompts. LiteChat features a built-in **Virtual File System**. Upload files, create folders, and manage assets directly within the interface. Provide files as context to your AI, keeping relevant documents alongside your conversations.
*   **Git Powered:** The VFS isn't just for storage; it's **Git-enabled**. Initialize repositories within VFS folders, clone remote repos (like codebases or notes), commit your changes, pull updates, and push – all from within LiteChat. Perfect for AI-assisted coding, documentation, or version-controlled notes.
*   **Sync Conversations with Git:** Keep your conversations backed up and synchronized across devices by linking them to specific Git repositories. Your chat history becomes part of your version-controlled workflow.
*   **Endlessly Extendable:** LiteChat is built on a **modular, event-driven architecture**. This means you (or the community) can easily create **Mods** to:
    *   Add new UI elements and controls.
    *   Integrate custom tools for the AI to use.
    *   Modify AI behavior with middleware.
    *   Listen to events and trigger custom workflows.
    *   Add new settings tabs.
    *   ...and much more!

LiteChat is for anyone who values privacy, wants fine-grained control over their AI interactions, and loves to tinker and customize their tools. It's your personal AI workbench.

---
## Docker Support


### Docker Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/DimitriGilbert/LiteChat.git
   cd LiteChat
   ```

2. Build the Docker image:
   ```bash
   docker build -t litechat .
   ```

3. Run the container:
   ```bash
   docker run -p 8080:80 litechat
   ```

4. Access LiteChat at `http://localhost:8080`

### Docker Compose

For a more complete setup with CORS proxy configuration:

```yaml
version: '3'

services:
  litechat:
    image: litechat/litechat:latest
    # or build from local Dockerfile:
    # build: .
    ports:
      - "8080:80"
    volumes:
      # Optional: custom NGINX configuration with API proxies
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
```

### CORS Proxy Configuration

Since LiteChat makes direct API calls from the browser, you may need to configure the NGINX server in Docker to act as a reverse proxy for AI providers with restrictive CORS policies.

Edit the included `nginx.conf` and uncomment the proxy section, modifying it for your specific provider endpoints. The Docker setup makes it easy to handle CORS issues without changing your local network configuration.

### Persisting Data

LiteChat stores all data in your browser's IndexedDB. If you want to persist conversations and settings across Docker rebuilds, make sure to use the built-in Git sync functionality to back up your data to a repository.

## Technical Overview (For Integrators & Power Users)

LiteChat is a static React web application designed for local execution and extensibility.

**Core Concepts:**

*   **Client-Side Architecture:** All application logic, data storage (IndexedDB via Dexie), and AI API interactions occur directly within the user's browser. No backend is required for core functionality.
*   **Component-Based UI (React):** Leverages reusable components (e.g., `<ChatCanvas>`, `<PromptWrapper>`, `<FileManager>`) built with shadcn/ui and Tailwind CSS.
*   **State Management (Zustand):** Uses modular Zustand stores for efficient state management (`ConversationStore`, `InteractionStore`, `ProviderStore`, `VfsStore`, etc.).
*   **Controls (`PromptControl`, `ChatControl`):** Encapsulate discrete UI functionalities (e.g., model selection, file attachment, conversation list, settings panels). They manage their UI rendering and state interactions.
*   **Event-Driven (`mitt`):** A central event emitter enables decoupled communication between components, stores, and mods.
*   **Middleware Hooks:** Allow interception and modification of data at critical points (prompt finalization, AI request start, response chunk processing).
*   **Virtual File System (VFS):** Implemented using ZenFS with an IndexedDB backend. Provides file storage and management capabilities within the browser environment.
*   **Git Integration (`isomorphic-git`):** Enables Git operations (clone, commit, pull, push, status) directly on folders within the VFS, interacting with remote repositories via an optional CORS proxy or correctly configured servers.
*   **Conversation Sync:** Leverages the VFS/Git integration to store and sync conversation data (`.json` files containing conversation metadata and interactions) within designated Git repositories.

**Deployment & CORS:**

LiteChat is designed to be deployed as a static web application (a single HTML, CSS, and JS bundle). You can host it on any standard web server or static hosting platform.

However, because LiteChat makes direct calls from the browser to AI provider APIs (like OpenAI, Ollama, etc.), you might encounter **Cross-Origin Resource Sharing (CORS)** restrictions imposed by those APIs.

**Mitigation Strategies:**

*   **Use APIs Designed for Browser Use:** Some APIs (like OpenRouter) are often configured with permissive CORS headers suitable for direct browser access.
*   **Self-Hosted AI (Ollama, LM Studio):** When running models locally (e.g., via Ollama), ensure the local server is configured to allow requests from the origin where LiteChat is hosted.
    *   **Ollama:** Set the `OLLAMA_ORIGINS` environment variable (e.g., `OLLAMA_ORIGINS=http://your-litechat-domain.com,http://localhost:5173`).
*   **Configure Your Web Server as a Reverse Proxy:** This is the most robust solution for APIs without permissive CORS headers. Your web server forwards the request from LiteChat to the AI provider, effectively bypassing the browser's CORS limitations.
    *   **Nginx:**
        ```nginx
        location /api/openai/ { # Or a path for your specific provider
            # IMPORTANT: Add authentication handling here if needed!
            # Example: proxy_set_header Authorization "Bearer YOUR_SERVER_SIDE_API_KEY";

            proxy_pass https://api.openai.com/; # Forward to the actual API
            proxy_set_header Host api.openai.com;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Handle CORS preflight requests
            if ($request_method = 'OPTIONS') {
                add_header 'Access-Control-Allow-Origin' 'http://your-litechat-domain.com'; # Your LiteChat domain
                add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
                add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type'; # Add other headers if needed
                add_header 'Access-Control-Allow-Credentials' 'true'; # If needed
                add_header 'Access-Control-Max-Age' 1728000;
                add_header 'Content-Type' 'text/plain charset=UTF-8';
                add_header 'Content-Length' 0;
                return 204;
            }

            # Add CORS headers for actual requests
            add_header 'Access-Control-Allow-Origin' 'http://your-litechat-domain.com';
            add_header 'Access-Control-Allow-Credentials' 'true'; # If needed
        }
        ```
        *In LiteChat Provider settings, set the Base URL to `http://your-litechat-domain.com/api/openai/`.*
    *   **Apache (using `.htaccess` or `httpd.conf`):** Requires `mod_proxy`, `mod_headers`, `mod_rewrite`.
        ```apache
        # Enable proxying
        ProxyRequests Off
        ProxyPreserveHost On

        <Location /api/openai/>
            # IMPORTANT: Authentication handling might be needed here
            # RequestHeader set Authorization "Bearer YOUR_SERVER_SIDE_API_KEY"

            ProxyPass https://api.openai.com/
            ProxyPassReverse https://api.openai.com/

            # Handle CORS
            Header always set Access-Control-Allow-Origin "http://your-litechat-domain.com"
            Header always set Access-Control-Allow-Methods "POST, GET, OPTIONS"
            Header always set Access-Control-Allow-Headers "Authorization, Content-Type" # Add others if needed
            Header always set Access-Control-Allow-Credentials "true" # If needed

            # Handle OPTIONS preflight
            RewriteEngine On
            RewriteCond %{REQUEST_METHOD} OPTIONS
            RewriteRule ^(.*)$ $1 [R=204,L]
        </Location>
        ```
        *In LiteChat Provider settings, set the Base URL to `http://your-litechat-domain.com/api/openai/`.*
    *   **Caddy:**
        ```caddyfile
        # Your LiteChat domain
        your-litechat-domain.com {
            # Serve your static LiteChat files
            root * /path/to/your/litechat/dist
            file_server

            # Reverse proxy for OpenAI API
            reverse_proxy /api/openai/* https://api.openai.com {
                # IMPORTANT: Add authentication if needed
                # header_up Authorization "Bearer YOUR_SERVER_SIDE_API_KEY"
                header_up Host {upstream_hostport}
                header_up X-Forwarded-Host {host}
            }

            # Handle CORS globally or within the reverse_proxy block
            @corsMethods {
                method OPTIONS POST GET # Add other methods if needed
            }
            header {
                Access-Control-Allow-Origin "http://your-litechat-domain.com"
                Access-Control-Allow-Methods "GET, POST, OPTIONS"
                Access-Control-Allow-Headers * # Or list specific headers
                Access-Control-Allow-Credentials true # If needed
                Access-Control-Max-Age 86400
            }
            # Respond to OPTIONS preflight requests
            respond @corsMethods 204
        }
        ```
        *In LiteChat Provider settings, set the Base URL to `http://your-litechat-domain.com/api/openai/`.*

---

## Developer & Modder Documentation

This section details the architecture and APIs for developers extending or modifying LiteChat.

### Architecture

*   **Core Components:**
    *   `<LiteChat>`: Main orchestrator, initializes stores, loads data/mods, renders layout. Connects major sub-systems.
    *   `<PromptWrapper>`: Manages user input area. Renders `InputArea`, `PromptControl` triggers/panels via `<PromptControlWrapper>`. Collects data from controls (`getParameters`, `getMetadata`), handles file attachment display, runs `PROMPT_TURN_FINALIZE` middleware, outputs `PromptTurnObject` on submit.
    *   `<ChatCanvas>`: Displays conversation history (`Interaction` objects). Uses `UserPromptDisplay`, `InteractionCard` (for completed/revisions), and `StreamingInteractionCard` (for live responses).
    *   `<ChatControlWrapper>`: Renders registered `ChatControl` components into designated panels (e.g., 'sidebar', 'header', 'sidebar-footer') based on `panelId` and `renderMode`.
    *   `<FileManager>`: Provides the UI for the Virtual File System, including toolbar, file/folder table (`FileManagerTable`, `FileManagerRow`), context menus, and dialogs (`CloneDialog`, `CommitDialog`).
    *   `<SettingsModal>`: Tabbed dialog for application configuration.
*   **Controls:**
    *   `PromptControl`: Self-contained units adding functionality to the prompt area (e.g., model selection, file attachment, parameter sliders, VFS access). They contribute parameters/metadata and can run middleware on the `PromptTurnObject`. Defined in `src/types/litechat/prompt.ts`.
    *   `ChatControl`: Self-contained units adding functionality to the overall chat UI (e.g., conversation list sidebar, settings button, status indicators). They render UI into specific panels and can interact with stores/events. Defined in `src/types/litechat/chat.ts`.
*   **State Management (Zustand):** Modular stores (`src/store/`) manage specific data domains:
    *   `InteractionStore`: Manages `Interaction[]` for the selected conversation, including streaming state (`streamingInteractionIds`, `activeStreamBuffers`).
    *   `ConversationStore`: Manages `Conversation[]` and `Project[]` lists, the tree structure, selection state (`selectedItemId`, `selectedItemType`), and Git sync status/operations.
    *   `ControlRegistryStore`: Stores registered `PromptControl`, `ChatControl`, middleware functions, and tool definitions/implementations.
    *   `ProviderStore`: Manages provider configurations (`DbProviderConfig`), API keys (`DbApiKey`), runtime model selection (`selectedModelId`), global model sort order, and related persistence/fetching logic.
    *   `SettingsStore`: Global application settings (theme, default parameters, Git user config).
    *   `ModStore`: Manages mod definitions (`DbMod`) from DB and loaded runtime instances (`ModInstance`), including custom settings tabs.
    *   `UIStateStore`: Transient UI state (modal visibility, panel states, sidebar collapse state, focus flags).
    *   `VfsStore`: Manages the Virtual File System state (nodes, childrenMap, current path, selected files) and interacts with `VfsOps`.
    *   `InputStore`: Manages files attached to the *next* prompt submission, including their content. Cleared after successful submission.
*   **Services (`src/services/`):**
    *   `AIService`: Handles communication with AI SDKs (`@ai-sdk`). Takes the final `PromptObject`, runs `INTERACTION_BEFORE_START` middleware, manages streaming via `streamText`, processes file content into messages, handles tool calls/results, runs `INTERACTION_PROCESS_CHUNK` middleware, updates `InteractionStore`.
    *   `PersistenceService`: Centralizes Dexie database operations (CRUD for all persistent data types). Handles DB schema versioning and upgrades.
    *   `ModLoader` (`src/modding/loader.ts`): Loads and executes mod scripts (from URL or direct content), providing them with the `LiteChatModApi`.
    *   `model-fetcher.ts`: Fetches available model lists from provider APIs (OpenAI, OpenRouter, Ollama, etc.) with caching.
    *   `vfs-operations.ts`: Implements file system operations (list, read, write, delete, mkdir, rename, zip, Git ops) using ZenFS and isomorphic-git. Handles user feedback via `toast`.
*   **Data Models (`src/types/litechat/`):** Defines core data structures:
    *   `PromptTurnObject`: Represents user's input turn data, including file content. Snapshot stored in `Interaction.prompt`.
    *   `PromptObject`: Final payload sent to `AIService`, file content processed into `messages`.
    *   `Interaction`: Logical unit/turn in conversation (user input + AI response/tool call).
    *   `Conversation`: Metadata for a chat thread, linked to `Project`.
    *   `Project`: Folder-like structure for organizing conversations, stores path.
    *   `DbProviderConfig`, `DbApiKey`, `SyncRepo`, `DbMod`: Database representations.
    *   `VfsNode` (`VfsFile`, `VfsDirectory`): Nodes within the Virtual File System.
    *   `AttachedFileMetadata`: Structure for files attached to the prompt input.
*   **Events & Modding (`src/lib/litechat/event-emitter.ts`, `src/types/litechat/modding.ts`):**
    *   `emitter`: Central `mitt` instance for pub/sub.
    *   `ModEvent`: Standardized event names (e.g., `CONVERSATION_SELECTED`, `INTERACTION_STARTED`, `VFS_FILE_WRITTEN`).
    *   `ModMiddlewareHook`: Standardized middleware hooks (e.g., `PROMPT_TURN_FINALIZE`, `INTERACTION_BEFORE_START`).
    *   `LiteChatModApi`: The API surface exposed to mods (see below).

### Modding API (`LiteChatModApi`)

Mods receive an API object (`LiteChatModApi`) upon loading, enabling interaction with LiteChat:

*   **Control Registration:**
    *   `registerPromptControl(control: PromptControl): () => void`
    *   `registerChatControl(control: ChatControl): () => void`
*   **Settings:**
    *   `registerSettingsTab(tab: CustomSettingTab): () => void`
*   **AI Tools:**
    *   `registerTool<P>(toolName: string, definition: Tool<P>, implementation?: ToolImplementation<P>): () => void`
*   **Event Handling:**
    *   `on<E extends ModEventName>(eventName: E, callback: (payload: ModEventPayloadMap[E]) => void): () => void`
*   **Middleware:**
    *   `addMiddleware<H extends ModMiddlewareHookName>(hookName: H, callback: MiddlewareCallback<H>): () => void`
*   **Context Access:**
    *   `getContextSnapshot(): ReadonlyChatContextSnapshot` (Provides a safe, read-only view of key application states)
*   **Utilities:**
    *   `showToast(type: 'success' | 'error' | 'info' | 'warning', message: string): void`
    *   `log(level: 'log' | 'warn' | 'error', ...args: any[]): void`
*   **Identification:**
    *   `readonly modId: string`
    *   `readonly modName: string`

*(Refer to `src/types/litechat/modding.ts` for detailed type definitions of payloads, controls, etc.)*

### Getting Started (Development)

1.  **Prerequisites:** Node.js, npm/pnpm/yarn.
2.  **Clone:** `git clone <repository-url>`
3.  **Install:** `cd litechat && npm install` (or equivalent)
4.  **Run Dev Server:** `npm run dev`
5.  **Access:** Open the URL provided by Vite (usually `http://localhost:5173`).

### Contribution Guidelines

*   Follow the coding style enforced by Prettier (`npm run format`).
*   Adhere strictly to the modification rules provided in prompts when working with AI assistance (No ellipses, separate blocks, context is key, etc.).
*   Write clear commit messages.
*   Ensure new features or significant changes include relevant updates to types and potentially tests (if applicable).

---

## License

MIT
