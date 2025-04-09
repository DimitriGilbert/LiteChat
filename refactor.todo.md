# LiteChat Modular Refactoring Plan

**Overall Goal:** Refactor LiteChat into a highly modular and extensible library where features like VFS, Projects, Advanced Settings, and Sidebar/History can be optionally included and configured, and custom elements can be easily added.

---

## Phase 1: Core Decoupling & Persistence Separation

### Task 1.1: Isolate Core Chat Context

*   **Goal:** Refactor `ChatProvider` and `useChatContext` to *only* manage essential chat state: `messages`, `isStreaming`, `isLoading`, `error`, `prompt`, `setPrompt`, basic `handleSubmit` structure, `stopStreaming`, `regenerateMessage` structure, and the AI interaction setup (`useAiInteraction` results). Remove direct instantiation/management of VFS, Projects, complex Settings, API Keys, and Sidebar logic from the core provider.
*   **Approach:** Create a new `CoreChatContext`. Move essential state/logic from `ChatProvider` to it. Modify `useAiInteraction` and `useMessageHandling` to rely only on core state and necessary props passed down (like DB functions). `ChatProvider` will become thinner. Update `ChatContextProps` type accordingly.
*   **Testing:**
    *   Write/update tests for the `CoreChatContext` to ensure basic message handling, prompt updates, and streaming state changes work correctly.
    *   Verify that `useAiInteraction` and `useMessageHandling` function correctly when receiving dependencies via props/arguments instead of the old monolithic context.
    *   Ensure basic chat functionality (sending/receiving messages without optional features) remains intact.

### Task 1.2: Separate Persistence Logic

*   **Goal:** Ensure all direct Dexie DB interactions are strictly confined within `useChatStorage` (and `db.ts`). Modify other hooks/components to receive DB functions (like `addDbMessage`, `getConversation`, `createProject`, etc.) as props or via a dedicated `PersistenceContext` if necessary, rather than importing `db` directly or relying on the main context for DB ops.
*   **Approach:** Review all hooks and components. Replace direct `db` imports/usage with functions passed down from where `useChatStorage` is instantiated (likely near the top level, potentially passed into the core provider or a separate persistence provider).
*   **Testing:**
    *   Update tests for hooks like `useConversationManagement`, `useMessageHandling`, `useApiKeysManagement` to mock the passed-in persistence functions.
    *   Verify that components relying on DB operations still function correctly when receiving these operations via props/context.
    *   Test error handling if persistence functions fail.

---

## Phase 2: Feature Module Isolation (Hooks)

### Task 2.1: Modularize Sidebar/History/Project Management

*   **Goal:** Refactor `useConversationManagement` into a self-contained module/hook (`useSidebarManagement` or similar). It should handle fetching sidebar items (projects/convos), selection state, CRUD operations (via passed-in persistence functions), and potentially expose state like `selectedItem`, `sidebarItems`. Its instantiation should become optional.
*   **Approach:** Modify `useConversationManagement` to accept persistence functions as arguments. Remove its direct instantiation from the (now core) `ChatProvider`. The main `LiteChat` component will conditionally instantiate it based on configuration and pass necessary functions/state down. Update `ChatSide` and `ChatHistory` to use this new hook's context/props.
*   **Testing:**
    *   Test the `useSidebarManagement` hook in isolation, mocking persistence functions.
    *   Test the `LiteChat` component with the sidebar enabled and disabled via configuration.
    *   Ensure `ChatSide` and `ChatHistory` render correctly and function as expected when the sidebar module is enabled.
    *   Verify that project/conversation CRUD operations work through the new hook.

### Task 2.2: Modularize Virtual File System (VFS)

*   **Goal:** Make `useVirtualFileSystem` fully optional. Its instantiation and the `vfs` object in the context should only happen if VFS is explicitly enabled via configuration. Components related to VFS (`FileManager`, `SelectedVfsFilesDisplay`, VFS parts of `PromptSettingsAdvanced`, VFS logic in `handleSubmit`) should gracefully handle the VFS module being absent.
*   **Approach:** Modify `ChatProvider` (or the top-level `LiteChat`) to conditionally instantiate `useVirtualFileSystem` based on config. Pass the `vfs` object down (maybe via a dedicated `VfsContext` or props). Update VFS-related components and logic to check for the presence of the `vfs` object/context before attempting to use it. Introduce a `vfsEnabled` config option.
*   **Testing:**
    *   Test the `LiteChat` component with VFS enabled and disabled via configuration.
    *   Verify that VFS components (`FileManager`, etc.) render and function correctly when VFS is enabled.
    *   Ensure VFS components do *not* render or cause errors when VFS is disabled.
    *   Test the `handleSubmit` logic to confirm it correctly includes/excludes VFS context based on the enabled state.
    *   Test the VFS toggle functionality within `PromptSettings`.

### Task 2.3: Modularize API Key Management

*   **Goal:** Make `useApiKeysManagement` optional, primarily needed only if `requiresApiKey` is true for any configured provider *and* the BYOK pattern is desired.
*   **Approach:** Conditionally instantiate `useApiKeysManagement` based on configuration (e.g., `enableApiKeyManagement: true`). Pass its functions (`addApiKey`, `deleteApiKey`, `getApiKeyForProvider`, `selectedApiKeyId`, `setSelectedApiKeyId`) down. Components like `ApiKeySelector` and `SettingsApiKeys` should only render/function if this module is enabled. `useAiInteraction` needs `getApiKeyForProvider` passed in.
*   **Testing:**
    *   Test `LiteChat` with API Key Management enabled and disabled.
    *   Verify `ApiKeySelector` and `SettingsApiKeys` render/function only when enabled.
    *   Test AI interaction (`useAiInteraction`) ensuring it correctly uses the passed `getApiKeyForProvider` function when the module is enabled, and potentially handles the case where it's not needed/provided if the module is disabled (depending on provider config).
    *   Test adding/deleting/selecting API keys via the settings UI when enabled.

### Task 2.4: Modularize Advanced Settings

*   **Goal:** Separate basic settings (Provider/Model) from advanced ones (Temperature, TopP, System Prompt, etc.). Make the advanced settings panel (`PromptSettingsAdvanced`) and the underlying state management in `useChatSettings` optional.
*   **Approach:** Split `useChatSettings` if necessary, or make parts of its state conditional. `PromptSettings` would always show basic selectors, but the "Advanced" toggle and `PromptSettingsAdvanced` component would only render if an `enableAdvancedSettings` config is true. `useAiInteraction` needs the relevant parameters (temp, topP etc.) passed in, potentially falling back to defaults if advanced settings are disabled.
*   **Testing:**
    *   Test `LiteChat` with Advanced Settings enabled and disabled.
    *   Verify the "Advanced" toggle and `PromptSettingsAdvanced` panel appear only when enabled.
    *   Test that AI interactions use the correct parameters (either from advanced settings when enabled, or defaults when disabled).
    *   Ensure basic provider/model selection still works regardless of the advanced settings state.
    *   Test system prompt application (global vs. conversation-specific) based on whether advanced settings are enabled.

---

## Phase 3: Configuration & Extensibility

### Task 3.1: Implement Configuration Layer

*   **Goal:** Define and implement a configuration object passed to the main `LiteChat` component to enable/disable features (Sidebar/Projects, VFS, API Key Management, Advanced Settings) and potentially provide initial settings.
*   **Approach:** Define a `LiteChatConfig` type in `types.ts`. Modify the `LiteChat` component to accept this config prop. Use the config values to conditionally instantiate hooks and render components as implemented in Phase 2.
*   **Testing:**
    *   Test various combinations of `LiteChatConfig` options (e.g., sidebar only, VFS + advanced settings, minimal core, etc.).
    *   Verify that the correct modules are instantiated and UI elements are rendered based on the provided config.
    *   Test passing initial settings via the config object.

### Task 3.2: Define Extensibility API for Actions

*   **Goal:** Allow users to add custom buttons/actions to the prompt area (`PromptActions`) and message bubbles (`MessageActions`).
*   **Approach:** Modify `PromptActions` and `MessageActions` to accept an optional array of custom action definitions (e.g., `{ id: string, icon: ReactNode, onClick: (context) => void, tooltip: string }`). These actions would receive relevant context (like the message object for `MessageActions`, or core chat functions for `PromptActions`) via the `onClick` handler. Define the structure in `types.ts`. Update `LiteChat` props to accept these custom actions.
*   **Testing:**
    *   Write tests demonstrating how to pass custom actions to `LiteChat`.
    *   Verify that custom actions render correctly in `PromptActions` and `MessageActions`.
    *   Test that the `onClick` handlers for custom actions are called and receive the expected context.

### Task 3.3: Define Extensibility API for Settings

*   **Goal:** Allow users to add custom tabs to the Settings modal (`SettingsModal`) and potentially sections to the advanced prompt settings (`PromptSettingsAdvanced`).
*   **Approach:** Modify `SettingsModal` and potentially `PromptSettingsAdvanced` to accept an array of custom setting definitions (e.g., `{ id: string, title: string, component: React.ComponentType<CustomSettingsProps> }`). The custom component would receive necessary context/functions. Define the structure in `types.ts`. Update `LiteChat` props to accept these custom settings.
*   **Testing:**
    *   Write tests demonstrating how to pass custom settings definitions to `LiteChat`.
    *   Verify that custom settings tabs/sections render correctly in `SettingsModal` / `PromptSettingsAdvanced`.
    *   Test that the custom setting components mount and can interact with passed-in context/functions.

---

## Phase 4: UI Component Decoupling & Documentation

### Task 4.1: Decouple UI Components

*   **Goal:** Review major UI components (`MessageBubble`, `ChatContent`, `PromptInput`, `ChatHeader`, etc.) and ensure they rely on the minimum necessary context or props, rather than the entire monolithic context (which should no longer exist).
*   **Approach:** Refactor components to accept specific data/functions via props or smaller, focused contexts (like `CoreChatContext`, `PersistenceContext`, `VfsContext` if created). Replace `useChatContext()` calls with more specific hooks or prop drilling where appropriate and manageable.
*   **Testing:**
    *   Update existing component tests to reflect the new props/context dependencies.
    *   Ensure components render correctly with the refactored data flow.
    *   Perform integration tests to verify the overall UI still works cohesively.

### Task 4.2: Update Documentation & Examples

*   **Goal:** Update `README.md` and any examples to reflect the new modular architecture, configuration options, and extensibility APIs.
*   **Approach:** Rewrite sections on architecture, composability, and features. Add details on the `LiteChatConfig` object. Provide clear examples of how to enable/disable features and add custom actions/settings.
*   **Testing:** (Manual)
    *   Review the updated README for clarity, accuracy, and completeness.
    *   Run the updated examples to ensure they work as described.
    *   Verify that the documentation accurately reflects the final implementation and configuration options.
