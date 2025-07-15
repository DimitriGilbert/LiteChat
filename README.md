# LiteChat

**LiteChat** is a modular, extensible, and privacy-focused AI chat application designed for power users, developers, and teams. It supports multiple AI providers, advanced prompt engineering, project-based organization, and powerful developer features like virtual file systems, Git integration, and a comprehensive modding system.

## ✨ Key Features

### 🔒 **Privacy-First Architecture**
- **100% Client-Side**: All data stored locally in your browser using IndexedDB
- **No Server Dependencies**: Core functionality requires no backend services
- **Full Data Control**: Export/import your entire configuration or specific data types (conversations, projects, settings, API keys, providers, rules, tags, mods, sync repos, MCP servers, prompt templates, and agents).

### 🤖 **Multi-Provider AI Support**
- **OpenRouter**: Access to 300+ models through unified API
- **OpenAI**: GPT-4x, o3-mini, o4-mini, o3, o3-pro, with reasoning and tool support
- **Google Gemini**: Gemini Pro models with multimodal capabilities
- **Anthropic Claude**: Sonnet, Opus, ...
- **Local Providers**: Ollama, LMStudio, and other OpenAI-compatible APIs
- **Advanced Features**: Streaming, reasoning, tool execution, ...

### 🌐 **Everyone's Favorite Features**
- **Send text files to any LLM**: Even those who say they do not support file uploads
- **Multimodal support**: If a model support a file type, you can send it to it
- **Auto title generation**: The AI will generate a title for your conversation
- **Conversation export**: Export your conversation to a file
- **Message regeneration**: When the model falls on its face, you can regenerate the message
- **Conversation Sync**: Sync conversations with Git repositories for a "poor man" no thrill sync solution.
- **Prompt Library**: Create, manage, and use reusable prompt templates

### 💻 **Power User Features**
- **Workflow Automation**: Create, save, and execute multi-step AI workflows with automated sequences, variable mapping, and intelligent orchestration
- **Agents**: Create, manage, and use powerful AI agents and their associated tasks.
- **Tool System**: AI can read/write files, execute Git commands, and more, including tools from MCP servers.
- **Text Triggers**: Powerful inline commands for prompt automation (e.g., `@.rules.auto;`, `@.tools.activate vfs_read_file;`, `@.params.temp 0.7;`)
- **Race**: you can send the same prompt to multiple models at once and see the results
- **Mermaid Diagrams**: Real-time diagram rendering with full Mermaid.js support
- **Response editor**: edit the response after it has been generated to remove the fluff and save on tokens
- **Rules**: you can add rules to the AI to guide its behavior, **tags** are here to bundle rules together
- **Regenerate with**: regenerate the message with a different model

### 🛠️ **Developer-Focused Features**
- **Code Block Enhancements**: Filepath syntax, individual downloads, ZIP exports
- **Codeblock editor**: you can edit the codeblock content directly in the browser, and use it in the follow up chats !
- **Virtual File System**: Browser-based filesystem with full CRUD operations
- **Git Integration**: Clone, commit, push, pull directly in the browser
- **Structured Output**: you can ask the AI to return a structured output, like a JSON, a table, a list, etc. (untested ^^')
- **Formedible codeblock**: LLMs can use the `formedible` codeblock to create a form to interact with the user in a deterministice maner using the [Formedible](https://github.com/DimitriGilbert/Formedible) library.

> If you have a 1000 LoC to spare, you can create you own custom Codeblock renderer see [FormedibleBlockRendererModule](src/controls/modules/FormedibleBlockRendererModule.ts) for an example.

### 📁 **Project Organization**
- **Hierarchical Projects**: Organize conversations in nested project structures
- **Per-Project Settings**: Custom models, prompts, and configurations
- **Rules & Tags**: Reusable prompt engineering with organization

### 🔌 **MCP (Model Context Protocol) Integration**
- **HTTP and Stdio MCP Servers**: Connect to external MCP servers via HTTP Server-Sent Events, HTTP Stream Transport and Stdio (via [node ./bin/mcp-bridge.js](./bin/mcp-bridge.js))
- **Automatic Tool Discovery**: Tools from MCP servers are automatically available to the AI
- **Graceful Error Handling**: Configurable retry logic with exponential backoff
- **Connection Management**: Real-time status monitoring and manual retry capabilities
- **Secure Authentication**: Support for custom headers and API key authentication

### ⚙️ **Extensibility & Customization**
- **Modding System**: Safe, sandboxed extension API for custom functionality
- **Control Modules**: Modular UI components with clean separation of concerns
- **Event-Driven Architecture**: Decoupled communication for maintainability
- **Build-Time Configuration**: Ship with pre-configured setups for teams/demos
- **Custom Themes**: Full visual customization with CSS variables

## 🌐 Try LiteChat

**Public Version**: [https://litechat.dbuild.dev](https://litechat.dbuild.dev) (hosted on GitHub Pages)

## 📚 Documentation

For comprehensive documentation, see the [`docs/`](./docs/) directory:

- **[Getting Started Guide](./docs/readme.md)** - Architecture overview and development setup
- **[AI Integration](./docs/ai-integration.md)** - Provider setup, streaming, and tool execution
- **[MCP Integration](./docs/mcp-integration.md)** - Model Context Protocol server integration and external tools
- **[MCP Bridge Specification](./docs/mcp-bridge-spec.md)** - MCP bridge protocol and implementation details
- **[Virtual File System](./docs/vfs.md)** - Browser-based filesystem and file operations
- **[Git Integration](./docs/git.md)** - Repository management and conversation sync
- **[Canvas Features](./docs/canvas-features.md)** - Code blocks, diagrams, and interaction controls
- **[Block Renderer System](./docs/block-renderer-system.md)** - Universal block rendering architecture
- **[Workflow System](./docs/workflow-system.md)** - Multi-step AI automation and workflow orchestration
- **[Text Triggers](./better_input_trigger.md)** - Inline command system for prompt automation with autocomplete
- **[Modding System](./docs/modding.md)** - Extension API and custom functionality
- **[Build & Deployment](./docs/build-deployment.md)** - Development, configuration, and deployment
- **[Control Module System](./docs/control-modules.md)** - Modular UI architecture
- **[Event System](./docs/event-system.md)** - Event-driven communication patterns
- **[State Management](./docs/state-management.md)** - Zustand stores and data flow
- **[Components](./docs/components.md)** - UI component architecture and patterns
- **[Services](./docs/services.md)** - Core service layer and business logic
- **[API Reference](./docs/api-reference.md)** - Complete API documentation
- **[Types](./docs/types.md)** - TypeScript type definitions and interfaces
- **[File Structure](./docs/file-structure.md)** - Project organization and file layout
- **[Persistence](./docs/persistence.md)** - Data storage and persistence layer

## 🚀 Quick Start

### Using Pre-built Release

```bash
# Download and extract the latest release
curl -L https://litechat.dbuild.dev/release/latest.zip -o litechat.zip
unzip litechat.zip -d litechat
cd litechat

# Start a local server (choose one)
python3 -m http.server 8080              # Python
npx http-server -p 8080 .                # Node.js
php -S localhost:8080                    # PHP

# Open http://localhost:8080 in your browser
```

### Development Setup

```bash
# Clone and setup
git clone https://github.com/user/litechat.git
cd litechat
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

> **Note**: AI assistance is highly recommended for development. See the [development documentation](./docs/index.md) for detailed setup instructions. 
> You have access to an [llm.txt](./docs/llm.dev.txt) file to help you with your development.

## Docker & CORS

### Docker

LiteChat uses a minimal Docker setup based on [lipanski/docker-static-website](https://github.com/lipanski/docker-static-website) (~80KB image) with BusyBox httpd for optimal performance and size.

#### Manual Docker Build

```bash
# Build your app first
npm run build

# Build Docker image
docker build -t litechat .

# Run container (serves on port 3000)
docker run -d -p 8080:3000 litechat

# Or use Docker Compose (includes MCP bridge service)
docker-compose up -d
```

#### Docker Compose with MCP Bridge

The included `docker-compose.yml` provides a complete setup with MCP bridge:

```yaml
# Environment variables (create .env file)
LITECHAT_PORT=8080
MCP_BRIDGE_PORT=3001
MCP_BRIDGE_VERBOSE=false

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f litechat
docker-compose logs -f mcp-bridge
```

**Services included:**
- **litechat**: Main application (port configurable via `LITECHAT_PORT`)
- **mcp-bridge**: MCP bridge service (port configurable via `MCP_BRIDGE_PORT`)

**Environment Variables:**
- `LITECHAT_PORT`: External port for LiteChat (default: 8080)
- `MCP_BRIDGE_PORT`: External port for MCP bridge (default: 3001)
- `MCP_BRIDGE_INTERNAL_PORT`: Internal container port (default: 3001)
- `MCP_BRIDGE_VERBOSE`: Enable verbose logging (default: false)

#### Automated Build with Builder Script

The builder script supports automatic Docker image creation and publishing:

```bash
# Build and create Docker image (but don't push)
bin/builder --release v1.0.0 --docker-repo myuser/litechat --no-publish

# Build, create, and push Docker image to Docker Hub
bin/builder --release v1.0.0 --docker-repo myuser/litechat

# Build multiple language versions with Docker (creates language-specific images)
bin/builder --release v1.0.0 --docker-repo myuser/litechat
```

**Builder Options:**
- `--docker-repo <repo>`: Docker repository (e.g., `myuser/litechat`)
- `--release <name>`: Release name used as Docker tag
- `--no-publish`: Create images locally without pushing to registry

**Docker Tags Created:**

*Single Language Build:*
- `myuser/litechat:v1.0.0` (release-specific tag)
- `myuser/litechat:latest` (always updated to latest release)

*Multi-Language Build:*
- `myuser/litechat:v1.0.0` (default language: en)
- `myuser/litechat:latest` (always points to default)
- `myuser/litechat:v1.0.0-fr` (French version)
- `myuser/litechat:v1.0.0-de` (German version)
- `myuser/litechat:v1.0.0-es` (Spanish version)
- etc. (one for each detected language)

#### Docker Configuration

The image uses BusyBox httpd with SPA (Single Page Application) routing configured in `docker/httpd.conf`. The configuration:
- Serves all routes through `index.html` for client-side routing
- Supports gzip compression (if `.gz` files are provided)
- Runs on port 3000 by default
- Minimal footprint (~80KB base image)

### CORS

If using local models (Ollama, LMStudio, etc.) or custom API endpoints, you might need to configure CORS on your AI backend server. LiteChat makes direct requests from the browser.

- **Ollama:** Start Ollama with `OLLAMA_ORIGIN='*'` (or a more specific origin like `http://localhost:8080`) environment variable. Example: `OLLAMA_ORIGIN='*' ollama serve`.
- **OpenAI-Compatible APIs (e.g., LMStudio):** Check your server's documentation for enabling CORS headers.

**No server-side CORS is needed for LiteChat's internal VFS operations** as they happen entirely in the browser via IndexedDB.

Gemini says no, for now. And if you are trying [from the web](https://litechat.dbuild.dev) on https, well, you can't talk to http endpoints... (so probably no local providers...)

## Architecture Overview

LiteChat follows a modular, event-driven architecture designed for extensibility and maintainability:

- **100% Client-Side**: All data stored locally using IndexedDB
- **Control Module System**: UI features encapsulated as pluggable modules
- **Event-Driven Communication**: Decoupled components using mitt event emitter
- **Zustand State Management**: Domain-specific stores with immutable updates
- **Virtual File System**: Browser-based filesystem using ZenFS + IndexedDB
- **Modding API**: Safe, controlled interface for external extensions

## Core Technologies

- **Tech Stack**: React 19, TypeScript, Zustand, Vite, Tailwind CSS, shadcn/ui
- **Data Storage**: Dexie.js (IndexedDB), ZenFS (VFS backend)
- **AI Integration**: Vercel AI SDK with multiple provider support
- **Version Control**: isomorphic-git for browser-based Git operations
- **Extensibility**: Event-driven architecture with controlled modding API

## Development & Contributing

- **Linting & Formatting**: ESLint and Prettier are used
- **Testing**: Vitest for unit/integration tests
- **Contributions**: Pull Requests and GitHub Issues are welcome!
- **Architecture**: See [Control Module System](./docs/control-modules.md) documentation to understand LiteChat's core architecture

For detailed development setup, contribution guidelines, and architectural information, see the [documentation](./docs/).

## WHY.... ???

If you have made it through the whole AI slope (but still relevant) part, first of all, congratulation, you are deserveful (I am sure that is a word !) of these human written words ! And you might be asking yourself that question: `WHY ?`

I am a happy [t3.chat](https://t3.chat) user but I was (and well, after adding them to my chat, I AM) missing a few features - like the ability to chain AI interactions into automated workflows (because who doesn't want their AI to do the work while they make coffee?). So I did what every sane person on the internet nowdays does, whine at length to the support in an (Oh so thoughtfully crafted) email.

I already toyed a bit before with [my Bash AI chat](https://ai-gents.dbuild.dev/) (yes, Bash, because, I mean, why not ?) and these features I asked were what I was missing from it (plus a UI, but how hard can UI be, I have done that before !) and after receiving a very fast (like within the hour for the real support problem and 2 more for a complete feedback on my lengthy boat of an email/wishlist) and insightful (and detailled, and thoughtful, and ... ! best support exchange with a company when it comes to a fat) "nope", my hubris took over ! 

How hard can it be? Right? You've created this [Bash AI chat](https://ai-gents.dbuild.dev/) (did I tell you it was in bash? Oh right, sorry...) in less than a week, you've done a big fat frontend project before, you just have to, you know... 🤝 ! easy ! 

SUUURE budd, sure ! (spoiler alert, no !) So sure in fact that I was going to through fat rocks at myself, I wanted it local "only" (no server what so ever) AND, I was only going to use [t3.chat](https://t3.chat) to ENTIRELY "vibecode" the thing (several of my arms articulation thank me very much !), because i was going to do that on a budget, aaand... why not ? tis supposed to be the Future ! right !? ... right ??!

I caved in after a few weeks and reused Cursor when the complete project was around 250k tokens in total (giving it all to gemini was possible but the results were crap) and targeted file feeding was becoming a real chore... plus at some point, things are so interdependant that you end up with significant portions of your code base anyway... (Sorry [t3.chat](https://t3.chat) team ^^' )

I am very much more on the "function over form" team so you may find some ... meeeh, let's call them discutable choices, especially in the UI departement ! Tabbed dialogs ? Button placement from hell ? The "so close therefore so infuriating" vibe ? Blame gemini ! (or Theo, [his chat](https://t3.chat) did that !).

> Plus I am almost out of cursor requests and there is no way in hell I am refactoring this madness manually ! It all has to be split anyway, sssoo, you know... (spoiler for the astute readers ? mmmaaayyybeeee!)

It was fun though ! And now I have my own chat app ! And so can you :D !

If you would like to know what "the AI" has top say about this project (and what I have to say about that :P), checkout the [AI-says](./docs/ai-says.md).

## License

MIT License. See [LICENSE](LICENSE) file for details.

---

**LiteChat** is an open-source project. Feedback, bug reports, and contributions are highly encouraged!
