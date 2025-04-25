# LiteChat ⚡️ (Rewrite v6)

A **modular**, **event-driven**, **client-side only** React AI chat component library designed for extensibility and customization.

---

## Overview

This version of LiteChat represents a fundamental architectural shift towards **true modularity and extensibility**. The previous iteration, while functional, suffered from tight coupling between components and state management, making it difficult to extend, customize, or use as a standalone library.

The core goals of this rewrite are:

1.  **Component Independence:** UI components (`PromptWrapper`, `ChatCanvas`, etc.) and functional units (Controls) should operate as independently as possible.
2.  **Centralized State, Decoupled Logic:** Utilize Zustand for state management, but keep business logic (AI interaction, persistence, control handling) separate in services and hooks, minimizing direct component dependencies on complex state shapes.
3.  **Event-Driven Communication:** Employ an event emitter (`mitt`) for cross-component communication and extensibility, allowing different parts of the application (including future mods) to react to significant events (e.g., `CONVERSATION_SELECTED`, `INTERACTION_STARTED`).
4.  **Control-Based Functionality:** Encapsulate discrete features (model selection, file handling, settings panels, sidebars) into `PromptControl` and `ChatControl` units. These controls manage their specific UI, state interactions, and data contributions.
5.  **Middleware Pipeline:** Implement middleware hooks (`PROMPT_TURN_FINALIZE`, `INTERACTION_BEFORE_START`, etc.) allowing Controls and Mods to intercept and modify data flow at critical points (e.g., altering prompt data before sending to AI, processing response chunks).
6.  **Clear Data Models:** Define distinct data structures:
    *   `PromptTurnObject`: Represents the user's input for a single turn (content, parameters, metadata from controls). Output of `PromptWrapper`.
    *   `PromptObject`: Represents the final payload sent to the AI Service (includes history, system prompt, tools, final parameters/metadata). Aligned with AI SDK requirements.
    *   `Interaction`: Represents a logical unit/turn in the conversation (user input + AI response, tool execution, system message), linked via `parentId` and ordered by `index`. Stores a snapshot of the initiating `PromptTurnObject`.
    *   `Conversation`: Core metadata for a chat thread.
7.  **Modding as a First-Class Citizen:** The architecture is designed from the ground up to support runtime modding via the event emitter, middleware hooks, and control registration APIs (`LiteChatModApi`).
8.  **Robust Persistence:** Use Dexie for reliable client-side storage, managed via a dedicated `PersistenceService`. Controls needing persistent configuration (e.g., Provider settings) interact with this service.

---

## Architecture

### Core Components

*   **`<LiteChat>`:** The main orchestrator component. Initializes stores, loads data and mods, renders core layout, and wires together major sub-components. Constructs the final `PromptObject` for AI calls.
*   **`<PromptWrapper>`:** Manages the user input area.
    *   Renders a dynamic `InputArea` component.
    *   Renders registered `PromptControl` triggers and panels via `<PromptControlWrapper>`.
    *   Collects data from controls (`getParameters`, `getMetadata`).
    *   Runs `PROMPT_TURN_FINALIZE` middleware from controls.
    *   Outputs a `PromptTurnObject` on submit.
*   **`<ChatCanvas>`:** Displays the conversation history.
    *   Renders `Interaction` objects fetched from `InteractionStore`.
    *   Uses `interactionRenderer` prop for displaying completed/static interactions (handling revisions via `parentId`).
    *   Uses `streamingInteractionsRenderer` prop for displaying currently streaming interactions.
*   **`<ChatControlWrapper>`:** A layout component that renders registered `ChatControl` components into designated panels (e.g., 'sidebar', 'header').

### Controls

*   **`PromptControl`:** Self-contained units adding functionality to the prompt area (e.g., model selection, file attachment, parameter sliders). They contribute parameters/metadata and can run middleware on the `PromptTurnObject`.
*   **`ChatControl`:** Self-contained units adding functionality to the overall chat UI (e.g., conversation list sidebar, settings button/modal, status indicators). They render UI into specific panels and can interact with stores/events.

### State Management (Zustand)

*   **`InteractionStore`:** Manages `Interaction[]` for the selected conversation, including streaming state for multiple concurrent interactions.
*   **`ConversationStore`:** Manages `Conversation[]` list and selection.
*   **`ControlRegistryStore`:** Stores registered `PromptControl` and `ChatControl` configurations, including their middleware functions.
*   **`ProviderStore`:** Manages provider configurations (`DbProviderConfig`), API keys (`DbApiKey`), runtime selection state (`selectedProviderId`, `selectedModelId`), and related persistence.
*   **`SettingsStore`:** Global application settings (theme, default parameters).
*   **`ModStore`:** Manages mod definitions (`DbMod`) from DB and loaded runtime instances (`ModInstance`).
*   **`UIStateStore`:** Transient UI state (modal visibility, panel states).
*   *(Future: `VfsStore`)*

### Services

*   **`AIService`:** Handles communication with AI SDKs. Takes the final `PromptObject`, runs `INTERACTION_BEFORE_START` middleware, manages streaming, runs `INTERACTION_PROCESS_CHUNK` middleware, updates `InteractionStore`.
*   **`PersistenceService`:** Centralizes Dexie database operations (CRUD for Conversations, Interactions, Mods, Providers, API Keys, Settings).
*   **`ModLoader` (`src/modding/loader.ts`):** Loads and executes mod scripts, providing them with the `LiteChatModApi`.

### Events & Modding

*   **`emitter` (`src/lib/litechat/event-emitter.ts`):** A `mitt` instance for decoupled communication.
*   **`ModEvent` (`src/types/litechat/modding.ts`):** Defines standard event names.
*   **`ModMiddlewareHook` (`src/types/litechat/modding.ts`):** Defines standard middleware interception points.
*   **`LiteChatModApi` (`src/types/litechat/modding.ts`):** The API surface exposed to mods for registration, event listening, middleware, context access, and utilities.

---

## Getting Started (Development)

1.  Clone the repository.
2.  Run `npm install` (or your package manager's install command).
3.  Run `npm run dev` to start the Vite development server.

*(Add library usage instructions here once it's packaged)*

---

## License

MIT
