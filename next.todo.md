# LiteChat Improvement & Refactor Roadmap

This document details a comprehensive plan to address the issues and feature requests you raised. Each task includes a description, rationale, and a list of all files likely to be affected. The plan is structured to allow LLM agents (or developers) to work incrementally and safely, minimizing risk of regressions.

---

## **A. Performance: Reduce Excessive Component Refresh (High CPU While Typing)**

### **Goal**
- Minimize unnecessary re-renders, especially during prompt typing, to reduce CPU usage.

### **Actions**
1. **Audit State Management**
   - Ensure prompt/attached files state is local to `PromptForm` and not propagated via context.
   - Avoid passing large/rapidly-changing state (like prompt) through context.

2. **Memoization**
   - Use `React.memo` and `useMemo` for components that do not need to re-render on every keystroke.
   - Audit `useChatContext` and `useCoreChatContext` consumers for unnecessary context usage.

3. **Optimize Context Value Construction**
   - Split context further if needed (e.g., separate prompt state from chat state).

4. **Throttle Expensive Effects**
   - Throttle or debounce any effects triggered by prompt changes.

### **Files to Review/Modify**
- `src/components/lite-chat/prompt-form.tsx`
- `src/components/lite-chat/prompt-input.tsx`
- `src/context/chat-context.tsx`
- `src/hooks/use-chat-context.ts`
- `src/hooks/use-chat-input.ts`
- Any component using `useChatContext` or `useCoreChatContext`
- `src/components/lite-chat/chat-content.tsx` (ensure message list is not re-rendering on prompt change)

---

## **B. VFS Per Project (Shared Among Project Chats) & Common VFS for Orphan Chats**

### **Goal**
- VFS should be shared among all chats within a project.
- Chats not in a project should share a single "orphan" VFS.

### **Actions**
1. **VFS Keying Logic**
   - Refactor VFS instantiation to use `projectId` as the key for project chats.
   - For orphan chats, use a special key (e.g., `"orphan"`).

2. **UI/UX**
   - Indicate in the UI when a chat is using a shared VFS.

3. **Migration**
   - Migrate existing VFS data if necessary.

### **Files to Review/Modify**
- `src/hooks/use-virtual-file-system.ts`
- `src/context/chat-context.tsx`
- `src/components/lite-chat/file-manager.tsx`
- `src/lib/types.ts` (if VFS context object needs new fields)
- `src/hooks/use-chat-storage.ts` (if VFS metadata is stored in DB)
- Any VFS-related UI (e.g., VFS toggle, settings)

---

## **C. Optional: Encrypted Storage with Password**

### **Goal**
- Allow users to encrypt VFS and/or API keys with a password.

### **Actions**
1. **Feasibility Study**
   - Research IndexedDB encryption libraries (e.g., [crypto-js](https://github.com/brix/crypto-js), [dexie-encrypted](https://github.com/dfahlander/Dexie.js/tree/master/addons/Dexie-encrypted)).

2. **Password Management**
   - UI for setting/unlocking password.
   - Store password in memory only (never persist).

3. **Encryption Layer**
   - Encrypt/decrypt VFS and API key data at rest.

4. **Error Handling**
   - Handle wrong password, password reset, etc.

### **Files to Review/Modify**
- `src/lib/db.ts`
- `src/hooks/use-chat-storage.ts`
- `src/context/chat-context.tsx`
- `src/components/lite-chat/settings-modal.tsx`
- `src/components/lite-chat/settings-data-management.tsx`
- Any VFS or API key management code

---

## **D. Global Error Boundary**

### **Goal**
- Catch unexpected React errors and display a user-friendly message.

### **Actions**
1. **Add Error Boundary Component**
   - Implement a top-level error boundary.

2. **Wrap Main App**
   - Wrap `<LiteChat>` or `<App>` with the error boundary.

### **Files to Review/Modify**
- `src/App.tsx`
- New file: `src/components/error-boundary.tsx`
- (Optional) `src/components/lite-chat/chat.tsx`

---

## **E. E2E Testing with Puppeteer/Playwright**

### **Goal**
- Replace or supplement unit tests with robust end-to-end (E2E) tests.

### **Actions**
1. **Setup E2E Test Framework**
   - Choose Puppeteer or Playwright.
   - Add scripts/configuration.

2. **Write E2E Scenarios**
   - Test chat flow, VFS, API key management, settings, etc.

3. **CI Integration**
   - Add E2E tests to CI pipeline.

### **Files to Add/Modify**
- `e2e/` (new directory for E2E tests)
- `package.json` (add scripts/deps)
- `.github/workflows/` or CI config
- Remove or mark `.notest.tsx` files as deprecated

---

## **F. Keyboard Shortcuts (Configurable, Non-Conflicting)**

### **Goal**
- Add keyboard shortcuts for common actions, with user override and no default conflicts.

### **Actions**
1. **Shortcut Registry**
   - Implement a registry for shortcuts with default and user-defined mappings.

2. **Settings UI**
   - Add a new "Shortcuts" tab in settings modal for user customization.

3. **Event Handling**
   - Listen for shortcuts at the app level, but avoid system/browser conflicts.

### **Files to Add/Modify**
- `src/components/lite-chat/settings-modal.tsx`
- New: `src/components/lite-chat/settings-shortcuts.tsx`
- `src/context/chat-context.tsx` (shortcut registry in context)
- `src/App.tsx` (global event listener)
- `src/lib/types.ts` (shortcut config types)

---

## **G. Message List UX Improvements**

### **Goal**
- Prevent forced scroll-to-bottom during streaming unless user is at bottom.
- Allow folding/unfolding of entire messages.
- Add codeblock headers with file type.

### **Actions**
1. **Scroll Behavior**
   - Only auto-scroll if user is at bottom when new message arrives.

2. **Message Folding**
   - Add fold/unfold action to message bubble.

3. **Codeblock Header**
   - Parse codeblocks for language/file type and display a header.

### **Files to Add/Modify**
- `src/components/lite-chat/chat-content.tsx`
- `src/components/lite-chat/message-bubble.tsx`
- `src/components/lite-chat/message-actions.tsx`
- `src/lib/types.ts` (if message folding state is tracked)

---

## **H. Plugin System (User-Provided Script or URL)**

### **Goal**
- Allow users to load plugins (JS scripts or URLs) to extend LiteChat.

### **Actions**
1. **Plugin Loader**
   - Implement safe dynamic import of user scripts/URLs.

2. **Plugin API**
   - Define a minimal API for plugins (e.g., register actions, tabs, etc.).

3. **Settings UI**
   - Add a "Plugins" tab in settings modal for managing plugins.

4. **Security**
   - Warn users about risks of third-party scripts.

### **Files to Add/Modify**
- New: `src/plugins/` (plugin loader, API)
- `src/context/chat-context.tsx` (plugin registration)
- `src/components/lite-chat/settings-modal.tsx`
- New: `src/components/lite-chat/settings-plugins.tsx`
- `src/lib/types.ts` (plugin types)
________________
# LiteChat Mod System Implementation Plan

This plan outlines the steps to implement a client-side modding system for LiteChat, allowing users to extend functionality via JavaScript loaded from URLs or potentially direct input.

---

## **Phase 1: Core Infrastructure & Persistence**

### **Goal**
- Set up the basic structure, database schema, and context integration for mods.

### **Actions**
1.  **Create Directory Structure:**
    - Create `src/mods/` directory.
    - Inside `src/mods/`, create initial files:
      - `api.ts`: Defines the `LiteChatModApi` interface exposed to mods.
      - `loader.ts`: Handles fetching, executing, and managing mods.
      - `types.ts`: Specific types related to mods (e.g., `DbMod`, `ModInstance`).
      - `events.ts`: Defines an event emitter instance or mechanism.

2.  **Database Schema (`src/lib/db.ts`):**
    - Add a new `mods` table to `ChatDatabase`.
    - Schema: `++id, name, sourceUrl, scriptContent, enabled, createdAt, loadOrder`
      - `id`: Auto-incrementing primary key or nanoid.
      - `name`: User-defined name for the mod.
      - `sourceUrl`: URL if loaded from a remote source (nullable).
      - `scriptContent`: The actual JS code if entered directly (nullable).
      - `enabled`: Boolean flag to enable/disable the mod.
      - `createdAt`: Timestamp.
      - `loadOrder`: Optional number for controlling execution order (default 0).
    - **Important:** Bump the Dexie schema version number.

3.  **Storage Hook (`src/hooks/use-chat-storage.ts`):**
    - Add `mods` live query: `useLiveQuery(() => db.mods.orderBy('loadOrder').toArray(), [], [])`.
    - Add CRUD functions for mods:
      - `addMod(modData: Omit<DbMod, 'id' | 'createdAt'>): Promise<string>`
      - `updateMod(id: string, changes: Partial<DbMod>): Promise<void>` (for enabling/disabling, renaming, changing order)
      - `deleteMod(id: string): Promise<void>`
      - `getMods(): Promise<DbMod[]>` (or rely on the live query)

4.  **Mod Types (`src/mods/types.ts`):**
    - Define `DbMod` interface matching the DB schema.
    - Define `ModInstance` interface (representing a loaded mod): `{ id: string, name: string, api: LiteChatModApi, error?: Error | string }` (or similar).

5.  **Context Integration (`src/context/chat-context.tsx`):**
    - Add state to hold loaded `ModInstance[]`.
    - Add state/refs to hold mod-registered items:
      - `modPromptActions: CustomPromptAction[]`
      - `modMessageActions: CustomMessageAction[]`
      - `modSettingsTabs: CustomSettingTab[]`
      - `modEventListeners: Map<string, Function[]>` (or similar structure)
    - Inject `useChatStorage` results for mods.
    - Initialize the mod loader on mount.
    - Pass mod-related state and registration functions down through the context value.
    - Merge built-in `custom...` props with `mod...` state before passing down in `fullContextValue`.

### **Files to Modify**
- `src/lib/db.ts`
- `src/hooks/use-chat-storage.ts`
- `src/context/chat-context.tsx`

### **Files to Create**
- `src/mods/api.ts`
- `src/mods/loader.ts`
- `src/mods/types.ts`
- `src/mods/events.ts`

---

## **Phase 2: Mod API Definition & Event Emitter**

### **Goal**
- Define the stable API surface that mods will interact with.
- Implement a basic event emitter for decoupling.

### **Actions**
1.  **Event Emitter (`src/mods/events.ts`):**
    - Implement or use a simple event emitter class (e.g., using `Map<string, Set<Function>>`).
    - Export an instance: `export const modEvents = new ModEventEmitter();`
    - Define methods: `on(event, listener)`, `off(event, listener)`, `emit(event, ...args)`.

2.  **Mod API Definition (`src/mods/api.ts`):**
    - Define the `LiteChatModApi` interface.
    - **Registration Functions:**
      - `registerPromptAction(action: CustomPromptAction): void`
      - `registerMessageAction(action: CustomMessageAction): void`
      - `registerSettingsTab(tab: CustomSettingTab): void`
    - **Event Listener Functions:**
      - `on(eventName: string, callback: (...args: any[]) => void): () => void` (returns an unsubscribe function)
    - **Context Access (Read-only Subset):**
      - `getContextSnapshot(): Readonly<Partial<ChatContextProps>>` (Provide a safe, read-only snapshot of key context values like `selectedItemId`, `messages`, etc. Avoid exposing setters directly initially).
    - **Utilities:**
      - `showToast(type: 'success' | 'error' | 'info' | 'warning', message: string): void`
      - `log(level: 'log' | 'warn' | 'error', ...args: any[]): void` (Prefixed with mod name)
    - **Middleware Hooks (Define structure, implement later):**
      - `addMiddleware(hookName: string, callback: Function): () => void` (returns unsubscribe)

3.  **Define Event Names & Payloads (Constants/Types in `src/mods/api.ts` or `types.ts`):**
    - `'app:loaded'`
    - `'chat:selected'` (payload: `{ id: string | null, type: SidebarItemType | null }`)
    - `'chat:created'` (payload: `{ id: string, type: SidebarItemType, parentId: string | null }`)
    - `'chat:deleted'` (payload: `{ id: string, type: SidebarItemType }`)
    - `'message:beforeSubmit'` (payload: `{ prompt: string, attachedFiles: File[], vfsPaths: string[] }`) -> *Middleware candidate*
    - `'message:submitted'` (payload: `{ message: Message }`)
    - `'response:start'` (payload: `{ conversationId: string }`)
    - `'response:chunk'` (payload: `{ chunk: string, conversationId: string }`) -> *Middleware candidate*
    - `'response:done'` (payload: `{ message: Message }`)
    - `'vfs:fileWritten'` (payload: `{ path: string }`)
    - `'vfs:fileRead'` (payload: `{ path: string }`)
    - `'vfs:fileDeleted'` (payload: `{ path: string }`)
    - `'vfs:contextAdded'` (payload: `{ paths: string[] }`)
    - `'settings:opened'`
    - `'settings:closed'`
    - `'mod:loaded'` (payload: `{ id: string, name: string }`)
    - `'mod:error'` (payload: `{ id: string, name: string, error: Error | string }`)

4.  **Define Middleware Hook Names (Constants/Types):**
    - `'middleware:submitPrompt'` (payload: `{ prompt: string, attachedFiles: File[], vfsPaths: string[] }`, returns: `Promise<payload | false>`)
    - `'middleware:processResponseChunk'` (payload: `{ chunk: string, conversationId: string }`, returns: `Promise<string | false>`)
    - `'middleware:renderMessage'` (payload: `{ message: Message }`, returns: `Promise<Message | false>`)
    - `'middleware:vfsWrite'` (payload: `{ path: string, data: Uint8Array | string }`, returns: `Promise<{ path: string, data: Uint8Array | string } | false>`)

### **Files to Modify**
- `src/mods/api.ts`
- `src/mods/events.ts`
- `src/mods/types.ts`

---

## **Phase 3: Mod Loader Implementation**

### **Goal**
- Implement the logic to fetch, execute, and manage the lifecycle of mods.

### **Actions**
1.  **Loader Logic (`src/mods/loader.ts`):**
    - Create a `ModLoader` class or set of functions.
    - `loadMods(dbMods: DbMod[]): Promise<ModInstance[]>`:
      - Iterates through enabled `dbMods`.
      - For each mod:
        - Fetch script content if `sourceUrl` exists.
        - Prepare the `LiteChatModApi` instance for this mod (pass mod `id`, `name`, context accessors, registration functions bound to the context/state setters).
        - Execute the script using `new Function('modApi', scriptContent)(modApiInstance)`.
        - Wrap execution in `try...catch` to handle mod errors.
        - Store the `ModInstance` (including API instance and potential error).
        - Emit `'mod:loaded'` or `'mod:error'`.
    - `unloadMod(id: string)`: (Optional for dynamic unloading) - Would need to call unsubscribe functions returned by `api.on()` and `api.addMiddleware()`, and remove registered actions/tabs. Simpler to just require reload for now.
    - `createApiForMod(mod: DbMod, context: ChatContextProps, registrationCallbacks: {...}): LiteChatModApi`: Helper to construct the API object passed to the mod script.

2.  **Context Integration (`src/context/chat-context.tsx`):**
    - On mount (`useEffect`), fetch mods from storage (`storage.getMods()` or use live query).
    - Call `modLoader.loadMods()` with the fetched mods.
    - Store the resulting `ModInstance[]` in state.
    - Implement registration callback functions (e.g., `registerModPromptAction`, `registerModEventListener`) that update the context state (`modPromptActions`, `modEventListeners`, etc.). Pass these callbacks to the `ModLoader` when creating the API instance.

### **Files to Modify**
- `src/mods/loader.ts`
- `src/context/chat-context.tsx`
- `src/mods/api.ts` (Refine API based on loader needs)

---

## **Phase 4: UI Implementation (Settings Tab)**

### **Goal**
- Create the "Mods" tab within the settings modal for user management.

### **Actions**
1.  **Create Settings Component (`src/components/lite-chat/settings-mods.tsx`):**
    - Use `useChatContext` to get mod state (`loadedMods`, `dbMods` via `storage`) and DB functions (`addMod`, `updateMod`, `deleteMod`).
    - **Security Warning:** Display a prominent, non-dismissible warning about the risks of running third-party code.
    - **Add Mod Form:**
      - Input for Mod Name.
      - Input for Source URL (optional).
      - Textarea for Script Content (optional, maybe hidden by default).
      - Button to "Add Mod".
    - **Mod List:**
      - Display `dbMods` from storage.
      - For each mod:
        - Show Name, Source (URL or "Direct Script").
        - Show Status (Loaded, Error, Disabled). Display error message if applicable.
        - Enable/Disable Toggle (`Switch` component calling `updateMod`).
        - Edit Button (Optional - to change name/source).
        - Delete Button (calling `deleteMod` with confirmation).
        - Load Order Input (Optional).
    - Handle loading/error states during add/delete operations.

2.  **Integrate into Settings Modal (`src/components/lite-chat/settings-modal.tsx`):**
    - Import `SettingsMods`.
    - Add a `TabsTrigger` for "Mods".
    - Add a `TabsContent` rendering `<SettingsMods />`.

### **Files to Create**
- `src/components/lite-chat/settings-mods.tsx`

### **Files to Modify**
- `src/components/lite-chat/settings-modal.tsx`

---

## **Phase 5: Event Emission & Middleware Integration**

### **Goal**
- Trigger defined events and run middleware hooks at appropriate points in the LiteChat codebase.

### **Actions**
1.  **Emit Events:**
    - Import `modEvents` from `src/mods/events.ts`.
    - Add `modEvents.emit('eventName', payload)` calls in relevant locations:
      - `ChatProvider`: `app:loaded`, `settings:opened`/`closed` (when modal state changes).
      - `useSidebarManagement`: `chat:selected`, `chat:created`, `chat:deleted`.
      - `useMessageHandling`/`useAiInteraction`: `message:submitted`, `response:start`, `response:chunk`, `response:done`.
      - `useVirtualFileSystem`: `vfs:fileWritten`, `vfs:fileRead`, `vfs:fileDeleted`.
      - `handleSubmit` in `ChatProvider`: `vfs:contextAdded`.
      - `ModLoader`: `mod:loaded`, `mod:error`.

2.  **Implement Middleware Execution Points:**
    - Identify locations for hooks (e.g., start of `handleSubmitCore`, inside the `streamText` loop, before rendering `MessageBubble`, before `vfs.writeFile`).
    - Create helper functions (e.g., in `src/mods/loader.ts` or `context`) like `runMiddleware(hookName, initialPayload)`.
    - This function retrieves registered middleware callbacks for the `hookName` from context state.
    - It executes them sequentially (using `async/await` and `reduce` or a loop), passing the output of one as the input to the next.
    - If any middleware returns `false`, the chain stops, and the original action might be cancelled.
    - Replace direct calls with calls wrapped in the middleware runner where appropriate. *Start with 1-2 key middleware hooks (e.g., `submitPrompt`) to prove the concept.*

### **Files to Modify**
- `src/context/chat-context.tsx` (to store middleware callbacks and potentially provide `runMiddleware`)
- `src/hooks/useSidebarManagement.ts`
- `src/hooks/useMessageHandling.ts`
- `src/hooks/useAiInteraction.ts`
- `src/hooks/use-virtual-file-system.ts`
- `src/mods/loader.ts` (if `runMiddleware` helper lives there)
- Potentially `src/components/lite-chat/message-bubble.tsx` (for render middleware)

---

## **Phase 6: Testing & Documentation**

### **Goal**
- Ensure the mod system works reliably and is documented.

### **Actions**
1.  **Manual Testing:**
    - Create simple test mods (e.g., one that adds a prompt button, one that listens to messages, one that shows toasts on events).
    - Test adding mods via URL and direct script.
    - Test enabling/disabling mods.
    - Test deleting mods.
    - Test error handling for broken mods.
    - Test event listeners and middleware hooks.
2.  **Documentation (`README.md`):**
    - Add a "Modding API" section.
    - Explain how to add mods via the UI.
    - Document the available `LiteChatModApi` methods, events (with payloads), and middleware hooks (with payloads/return types).
    - Include security warnings.
    - Provide a simple example mod script.
3.  **Code Comments:** Add comments explaining the mod system's architecture, especially in `loader.ts`, `api.ts`, and context integration points.

### **Files to Modify**
- `README.md`
- Various source files (add comments)

---

## **Summary Table**

| Task | Description | Key Files/Dirs | Phase |
|------|-------------|----------------|-------|
| A | Setup Dirs & Files | `src/mods/` | 1 |
| B | DB Schema & Storage | `db.ts`, `use-chat-storage.ts` | 1 |
| C | Mod Types | `src/mods/types.ts` | 1 |
| D | Context Integration (Initial) | `chat-context.tsx` | 1 |
| E | Event Emitter | `src/mods/events.ts` | 2 |
| F | Mod API Definition | `src/mods/api.ts` | 2 |
| G | Define Events & Hooks | `src/mods/api.ts`, `types.ts` | 2 |
| H | Mod Loader Logic | `src/mods/loader.ts` | 3 |
| I | Context Integration (Loader) | `chat-context.tsx` | 3 |
| J | Settings UI Component | `settings-mods.tsx` | 4 |
| K | Integrate Settings UI | `settings-modal.tsx` | 4 |
| L | Emit Events in Code | Various hooks, context | 5 |
| M | Implement Middleware Runner | `loader.ts` or context | 5 |
| N | Integrate Middleware Hooks | Various hooks, context | 5 |
| O | Testing | Manual | 6 |
| P | Documentation | `README.md`, comments | 6 |

---

## **Execution Notes**

- Implement phase by phase, ensuring stability before moving on.
- Prioritize security warnings early (Phase 4).
- Start with event listeners before tackling the more complex middleware hooks.
- Keep the initial Mod API surface minimal and expand cautiously.
- Thoroughly test error conditions (invalid scripts, network errors fetching URLs).

________________
---

## **I. Increase Unit Test Coverage (Non-Mock, Realistic UI Tests)**

### **Goal**
- Add meaningful unit tests for untested logic, focusing on real user flows.

### **Actions**
1. **Identify Untested Areas**
   - Review `.notest.tsx` and other files for missing coverage.

2. **Write Tests**
   - Focus on hooks, context, and critical UI flows.
   - Avoid excessive mocking; use realistic data and flows.

3. **Refactor for Testability**
   - If needed, refactor code to make it more testable (e.g., dependency injection).

### **Files to Add/Modify**
- `src/test/components/lite-chat/` (convert `.notest.tsx` to `.test.tsx`)
- `src/test/hooks/`
- `src/hooks/` (if refactoring for testability)
- `src/context/`
- `src/components/lite-chat/`

---

# **Summary Table**

| Task | Description | Key Files |
|------|-------------|-----------|
| A | Performance: Reduce re-renders | `prompt-form.tsx`, `chat-context.tsx`, `use-chat-input.ts`, etc. |
| B | VFS per project/orphan | `use-virtual-file-system.ts`, `chat-context.tsx`, `file-manager.tsx` |
| C | Encryption (optional) | `db.ts`, `use-chat-storage.ts`, `settings-modal.tsx` |
| D | Error boundary | `App.tsx`, `error-boundary.tsx` |
| E | E2E tests | `e2e/`, `package.json`, `.notest.tsx` |
| F | Shortcuts (configurable) | `settings-modal.tsx`, `settings-shortcuts.tsx`, `chat-context.tsx` |
| G | Message UX | `chat-content.tsx`, `message-bubble.tsx`, `message-actions.tsx` |
| H | Plugin system | `plugins/`, `chat-context.tsx`, `settings-plugins.tsx` |
| I | Unit tests | `test/`, `hooks/`, `components/lite-chat/` |

---

# **Execution Notes**

- **Each task should be implemented in isolation and tested before merging.**
- **All changes should be accompanied by relevant unit/E2E tests.**
- **Documentation (README, code comments) should be updated as features are added.**
- **Major refactors (A, B, H) should be done in feature branches.**
- **Plugin system (H) should be designed with security in mind.**

---
