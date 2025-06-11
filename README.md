# LiteChat

**LiteChat** is a modular, extensible, and privacy-focused AI chat application designed for power users, developers, and teams. It supports multiple AI providers, advanced prompt engineering, project-based organization, and powerful developer features like virtual file systems, Git integration, and a comprehensive modding system.

## ✨ Key Features

### 🔒 **Privacy-First Architecture**
- **100% Client-Side**: All data stored locally in your browser using IndexedDB
- **No Server Dependencies**: Core functionality requires no backend services
- **Full Data Control**: Export/import your data at any time

### 🤖 **Multi-Provider AI Support**
- **OpenAI**: GPT-4, GPT-3.5, with reasoning and tool support
- **Google Gemini**: Gemini Pro models with multimodal capabilities
- **Anthropic Claude**: Via OpenAI-compatible interface
- **OpenRouter**: Access to 100+ models through unified API
- **Local Providers**: Ollama, LMStudio, and other OpenAI-compatible APIs
- **Advanced Features**: Streaming, reasoning, tool execution, image generation

### 🌐 **Everyone's Favorite Features**
- **Send text files to any LLM**: Even those who say they do not support file uploads
- **Multimodal support**: If a model support a file type, you can send it to it
- **Auto title generation**: The AI will generate a title for your conversation
- **Conversation export**: Export your conversation to a file
- **Message regeneration**: When the model falls on its face, you can regenerate the message

### 💻 **Power User Features**
- **Mermaid Diagrams**: Real-time diagram rendering with full Mermaid.js support
- **Virtual File System**: Browser-based filesystem with full CRUD operations
- **Race**: you can send the same prompt to multiple models at once and see the results
- **Regen with**: regenerate the message with a different model
- **Response editor**: edit the response after it has been generated to remove the fluff and save on tokens

### 🛠️ **Developer-Focused Features**
- **Git Integration**: Clone, commit, push, pull directly in the browser
- **Code Block Enhancements**: Filepath syntax, individual downloads, ZIP exports
- **Tool System**: AI can read/write files, execute Git commands, and more

### 📁 **Project Organization**
- **Hierarchical Projects**: Organize conversations in nested project structures
- **Per-Project Settings**: Custom models, prompts, and configurations
- **Rules & Tags**: Reusable prompt engineering with organization
- **Conversation Sync**: Link conversations to Git repositories for version control

### ⚙️ **Extensibility & Customization**
- **Modding System**: Safe, sandboxed extension API for custom functionality
- **Control Modules**: Modular UI components with clean separation of concerns
- **Event-Driven Architecture**: Decoupled communication for maintainability
- **Build-Time Configuration**: Ship with pre-configured setups for teams/demos
- **Custom Themes**: Full visual customization with CSS variables

## 🌐 Try LiteChat

**Online Demo**: [https://litechat.dbuild.dev](https://litechat.dbuild.dev) (hosted on GitHub Pages)

## 📚 Documentation

For comprehensive documentation, see the [`docs/`](./docs/) directory:

- **[Getting Started Guide](./docs/index.md)** - Architecture overview and development setup
- **[AI Integration](./docs/ai-integration.md)** - Provider setup, streaming, and tool execution
- **[Virtual File System](./docs/vfs.md)** - Browser-based filesystem and file operations
- **[Git Integration](./docs/git.md)** - Repository management and conversation sync
- **[Canvas Features](./docs/canvas-features.md)** - Code blocks, diagrams, and interaction controls
- **[Modding System](./docs/modding.md)** - Extension API and custom functionality
- **[Build & Deployment](./docs/build-deployment.md)** - Development, configuration, and deployment
- **[Control Module System](./docs/control-modules.md)** - Modular UI architecture
- **[Event System](./docs/event-system.md)** - Event-driven communication patterns
- **[State Management](./docs/state-management.md)** - Zustand stores and data flow

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

I am a happy [t3.chat](https://t3.chat) user but I was (and well, after adding them to my chat, I AM) missing a few features. So I did what every sane person on the internet nowdays does, whine at length to the support in an (Oh so thoughtfully crafted) email.

I already toyed a bit before with [my Bash AI chat](https://ai-gents.dbuild.dev/) (yes, Bash, because, I mean, why not ?) and these features I asked were what I was missing from it (plus a UI, but how hard can UI be, I have done that before !) and after receiving a very fast (like within the hour for the real support problem and 2 more for a complete feedback on my lengthy boat of an email/wishlist) and insightful (and detailled, and thoughtful, and ... ! best support exchange with a company when it comes to a fat) "nope", my hubris took over ! 

How hard can it be? Right? You've created this [Bash AI chat](https://ai-gents.dbuild.dev/) (did I tell you it was in bash? Oh right, sorry...) in less than a week, you've done a big fat frontend project before, you just have to, you know... 🤝 ! easy ! 

SUUURE budd, sure ! (spoiler alert, no !) So sure in fact that I am going to through fat rocks at myself, I wanted it local "only" (no server what so ever) AND, I am only going to use [t3.chat](https://t3.chat) to ENTIRELY "vibecode" the thing, because why not ? tis supposed to be the Future, right ?

I caved in after a few weeks and reused Cursor when the complete project was around 250k tokens in total (giving it all to gemini was possible but the results where crap) and targeted file feeding was becoming a real chore... plus at some point, things are so interdependant that you end up with significant portions of your code base anyway... (Sorry [t3.chat](https://t3.chat) team ^^' )

It was fun though ! And now I have my own chat app ! And so can you :D !

If you would like to know what "the AI" has top say about this project, checkout the [AI-says](./docs/ai-says.md).


## License

MIT License. See [LICENSE](LICENSE) file for details.

---

**LiteChat** is an open-source project. Feedback, bug reports, and contributions are highly encouraged!
