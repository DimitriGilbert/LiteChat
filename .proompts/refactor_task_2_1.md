
========
README.md
========
# LiteChat ⚡️

**A Lightweight, Client-Side Only React AI Chat Component Library**

---

## Overview

**LiteChat** empowers developers to effortlessly integrate a feature-rich AI chat interface directly into their React applications, with **zero backend required**. Built with modern React standards and TypeScript, LiteChat is designed to be exceptionally lightweight, performant, and highly composable.

It operates purely within the user's browser, leveraging the power of the **Vercel AI SDK** for direct, client-side interaction with various AI models. Conversation history is securely persisted locally using **IndexedDB** via Dexie.js.

The core philosophy revolves around a **"Bring Your Own API Key" (BYOK)** model, giving end-users control over their AI provider credentials while simplifying deployment for developers. LiteChat is structured as a composable component system, making it easy to customize and integrate seamlessly, especially within ecosystems like **shadcn/ui**.

It is built on Typescript, React 19, Tailwind V4 and uses Shadcn components.

## Core Goals & Philosophy

*   **🚀 Simplicity & Lightweight:** Minimal footprint, easy integration, and no server-side dependencies. Get a chat interface running in minutes.
*   **💻 Client-Centric:** All operations, including AI interaction and storage, happen directly in the user's browser.
*   **🔑 User Empowerment (BYOK):** End-users provide and manage their own API keys, enhancing privacy and control.
*   **🧩 Maximum Composability:** Easily replace or customize individual UI components (like message bubbles, input areas, sidebars) to fit specific design needs.
*   **🌊 Performance:** Optimized for smooth streaming responses with throttled UI updates (~24fps target) to ensure a fluid user experience without overwhelming the browser.
*   **🔧 Agnostic & Flexible:** Designed to work with various AI providers supported by the Vercel AI SDK. Configuration is provided by the library user, not hardcoded.

## Key Features

*   **Pure Client-Side Operation:** No backend needed for core functionality.
*   **Vercel AI SDK Integration:** Leverages `streamText` for efficient, real-time AI responses.
*   **Bring Your Own API Key (BYOK):** Securely managed client-side (user responsibility).
*   **IndexedDB Persistence:** Uses Dexie.js to store conversation history locally.
*   **Composable UI Architecture:** Swap out sub-components easily.
*   **Real-time Streaming:** Displays AI responses token-by-token with configurable UI refresh rates.
*   **Provider/Model Selection:** Built-in UI for users to choose between configured AI providers and models.
*   **TypeScript:** Fully typed for a better developer experience.
*   **shadcn/ui Friendly:** Designed to be packaged and consumed like a `shadcn/ui` registry component.

## Architecture at a Glance

LiteChat follows a modern React component architecture:

1.  **`ChatProvider` (Context API):** Manages the core state, including conversation history, selected models, API keys (in-memory), streaming status, and AI interaction logic.
2.  **`useChatContext` Hook:** Provides access to the shared state and actions within child components.
3.  **Composable UI Components:**
    *   `LiteChat` (Main Wrapper)
        *   `ChatSide` (Sidebar: History, Settings Trigger)
        *   `ChatWrapper` (Main Chat Area)
            *   `ChatContent` (Scrollable message display area)
                *   `MessageBubble` (Individual message rendering, user/AI differentiation)
                    *   `MessageActions` (Copy, Regenerate etc.)
            *   `PromptWrapper` (Input area container)
                *   `PromptForm` (Handles input submission)
                    *   `PromptInput` (Text area for user input)
                    *   `PromptSettings` (Provider/Model selectors)
                    *   `PromptFiles` (Placeholder for file attachments)
                    *   `PromptActions` (Send button, etc.)
4.  **Persistence Layer:** `useChatStorage` hook interacts with `Dexie.js` to manage `conversations` and `messages` tables in IndexedDB.
5.  **AI Interaction:** The `ChatProvider` directly calls the Vercel AI SDK's `streamText` function using the user-configured model instance and API key (if required by the provider client-side).

## Composability Explained

The component structure (`ChatSide`, `ChatWrapper`, `MessageBubble`, `PromptInput`, etc.) is intentionally granular. Users of `LiteChat` can import these individual components and either use the default layout provided by the main `LiteChat` component or construct their own custom chat UI by assembling these (or compatible custom) components, all connected via the `ChatProvider` context.

## Client-Side Focus: Benefits & Considerations

Running entirely client-side means:
*   ✅ No server setup or maintenance costs.
*   ✅ Enhanced user privacy as conversations *can* stay entirely local.
*   ✅ Simplified deployment – just a static React app.
*   ⚠️ Users manage their API keys; storing keys in browser storage (`localStorage`) is a potential security risk users should be aware of. LiteChat facilitates the BYOK pattern but doesn't dictate secure key storage beyond the browser session by default.

---

## Composability Explained & Examples

The component structure (`ChatSide`, `ChatWrapper`, `MessageBubble`, `PromptInput`, etc.) is intentionally granular. Users of `LiteChat` can import these individual components and either use the default layout provided by the main `LiteChat` component or construct their own custom chat UI by assembling these (or compatible custom) components, all connected via the `ChatProvider` context.
========
refactor.todo.md
========
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
========
src/hooks/use-ai-interaction.ts
========
// src/hooks/use-ai-interaction.ts
import { useCallback } from "react";
import { streamText, type CoreMessage } from "ai";
import type {
  AiModelConfig,
  AiProviderConfig,
  Message,
  DbMessage,
} from "@/lib/types"; // Added DbMessage
import { throttle } from "@/lib/throttle";
import { nanoid } from "nanoid";
import { toast } from "sonner";

// --- Updated Interface ---
interface UseAiInteractionProps {
  selectedModel: AiModelConfig | undefined;
  selectedProvider: AiProviderConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
  streamingThrottleRate: number;
  // Core state/setters passed directly
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsAiStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setError: (error: string | null) => void;
  // DB function passed directly
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  // Abort controller ref passed directly
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

// --- Interface remains the same ---
interface PerformAiStreamParams {
  conversationIdToUse: string;
  messagesToSend: CoreMessage[];
  currentTemperature: number;
  currentMaxTokens: number | null;
  currentTopP: number | null;
  currentTopK: number | null;
  currentPresencePenalty: number | null;
  currentFrequencyPenalty: number | null;
  systemPromptToUse: string | null;
}

interface UseAiInteractionReturn {
  performAiStream: (params: PerformAiStreamParams) => Promise<void>;
}

export function useAiInteraction({
  selectedModel,
  selectedProvider,
  getApiKeyForProvider,
  streamingThrottleRate,
  setLocalMessages, // from props
  setIsAiStreaming, // from props
  setError, // from props
  addDbMessage, // from props
  abortControllerRef, // from props
}: UseAiInteractionProps): UseAiInteractionReturn {
  const performAiStream = useCallback(
    async ({
      conversationIdToUse,
      messagesToSend,
      currentTemperature,
      currentMaxTokens,
      currentTopP,
      currentTopK,
      currentPresencePenalty,
      currentFrequencyPenalty,
      systemPromptToUse,
    }: PerformAiStreamParams) => {
      // --- Boilerplate checks remain the same ---
      if (!conversationIdToUse) {
        const err = new Error(
          "Internal Error: No active conversation ID provided.",
        );
        setError(err.message);
        throw err;
      }
      if (!selectedModel || !selectedProvider) {
        const err = new Error("AI provider or model not selected.");
        setError(err.message);
        throw err;
      }
      const apiKey = getApiKeyForProvider(selectedProvider.id);
      const needsKey =
        selectedProvider.requiresApiKey ?? selectedProvider.id !== "mock";
      if (needsKey && !apiKey) {
        const err = new Error(
          `API Key for ${selectedProvider.name} is not set or selected.`,
        );
        setError(err.message);
        toast.error(err.message);
        throw err;
      }

      const assistantMessageId = nanoid();
      const assistantPlaceholderTimestamp = new Date();
      const assistantPlaceholder: Message = {
        id: assistantMessageId,
        conversationId: conversationIdToUse,
        role: "assistant",
        content: "",
        createdAt: assistantPlaceholderTimestamp,
        isStreaming: true,
        streamedContent: "", // Start empty
        error: null,
      };

      setLocalMessages((prev) => [...prev, assistantPlaceholder]);

      setIsAiStreaming(true);
      setError(null);

      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;

      let finalContent = "";

      const throttledStreamUpdate = throttle(() => {
        const currentAccumulatedContent = finalContent;
        setLocalMessages((prev) => {
          const targetMessageIndex = prev.findIndex(
            (msg) => msg.id === assistantMessageId,
          );
          if (
            targetMessageIndex === -1 ||
            !prev[targetMessageIndex].isStreaming
          ) {
            return prev;
          }
          const updatedMessages = [...prev];
          updatedMessages[targetMessageIndex] = {
            ...prev[targetMessageIndex],
            streamedContent: currentAccumulatedContent,
          };
          return updatedMessages;
        });
      }, streamingThrottleRate);

      let streamError: Error | null = null;

      try {
        const messagesForApi: CoreMessage[] = [];
        if (systemPromptToUse) {
          messagesForApi.push({ role: "system", content: systemPromptToUse });
        }
        messagesForApi.push(
          ...messagesToSend.filter((m) => m.role !== "system"),
        );

        const result = streamText({
          model: selectedModel.instance,
          messages: messagesForApi,
          abortSignal: currentAbortController.signal,
          temperature: currentTemperature,
          maxTokens: currentMaxTokens ?? undefined,
          topP: currentTopP ?? undefined,
          topK: currentTopK ?? undefined,
          presencePenalty: currentPresencePenalty ?? undefined,
          frequencyPenalty: currentFrequencyPenalty ?? undefined,
        });

        for await (const delta of result.textStream) {
          finalContent += delta;
          throttledStreamUpdate();
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          streamError = err;
          if (err.name === "AbortError") {
            streamError = null; // Not a real error for the user
          } else {
            console.error(`streamText error:`, err);
            finalContent = `Error: ${err.message || "Failed to get response"}`;
            setError(`AI Error: ${finalContent}`);
            toast.error(`AI Error: ${err.message || "Unknown error"}`);
          }
        } else {
          // Handle non-Error throws if necessary
          console.error("Unknown stream error:", err);
          streamError = new Error("Unknown streaming error");
          finalContent = `Error: ${streamError.message}`;
          setError(`AI Error: ${finalContent}`);
          toast.error(`AI Error: Unknown error`);
        }
      } finally {
        if (abortControllerRef.current === currentAbortController) {
          abortControllerRef.current = null;
        }
        setIsAiStreaming(false);

        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: finalContent,
                  isStreaming: false,
                  streamedContent: undefined,
                  error: streamError ? streamError.message : null,
                }
              : msg,
          ),
        );

        if (!streamError && finalContent.trim() !== "") {
          try {
            await addDbMessage({
              id: assistantMessageId,
              conversationId: conversationIdToUse,
              role: "assistant",
              content: finalContent,
              createdAt: assistantPlaceholderTimestamp,
            });
          } catch (dbErr: unknown) {
            const dbErrorMessage = `Save failed: ${dbErr instanceof Error ? dbErr.message : "Unknown DB error"}`;
            console.error("Failed to save final assistant message:", dbErr);
            setError(`Error saving response: ${dbErrorMessage}`);
            toast.error(`Failed to save response: ${dbErrorMessage}`);
            setLocalMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, error: dbErrorMessage }
                  : msg,
              ),
            );
          }
        } else if (streamError) {
          // Error already set and toasted inside catch block
        } else {
          // Empty content, no need to save or show error
          console.log("DB save skipped due to empty final content.");
        }
      }
    },
    [
      selectedModel,
      selectedProvider,
      getApiKeyForProvider,
      streamingThrottleRate,
      setLocalMessages, // dependency
      setIsAiStreaming, // dependency
      setError, // dependency
      addDbMessage, // dependency
      abortControllerRef, // dependency
    ],
  );

  return {
    performAiStream,
  };
}
========
src/hooks/use-api-keys-management.ts
========
// src/hooks/use-api-keys-management.ts
import { useState, useCallback } from "react";
// REMOVED: import { useChatStorage } from "./use-chat-storage";
import type { DbApiKey } from "@/lib/types";

// --- NEW: Props Interface ---
interface UseApiKeysManagementProps {
  apiKeys: DbApiKey[]; // Pass live array in
  addDbApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteDbApiKey: (id: string) => Promise<void>;
}

interface UseApiKeysManagementReturn {
  // apiKeys: DbApiKey[]; // No longer returned, passed in
  selectedApiKeyId: Record<string, string | null>;
  setSelectedApiKeyId: (providerId: string, keyId: string | null) => void;
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  getApiKeyForProvider: (providerId: string) => string | undefined;
}

// --- MODIFIED: Accept props ---
export function useApiKeysManagement({
  apiKeys, // from props
  addDbApiKey, // from props
  deleteDbApiKey, // from props
}: UseApiKeysManagementProps): UseApiKeysManagementReturn {
  // REMOVED: const { apiKeys, addApiKey: addDbApiKey, deleteApiKey: deleteDbApiKey } = useChatStorage(null);

  const [selectedApiKeyIdState, setSelectedApiKeyIdState] = useState<
    Record<string, string | null>
  >({});

  const setSelectedApiKeyId = useCallback(
    (providerId: string, keyId: string | null) => {
      setSelectedApiKeyIdState((prev) => ({ ...prev, [providerId]: keyId }));
    },
    [],
  );

  const addApiKey = useCallback(
    async (
      name: string,
      providerId: string,
      value: string,
    ): Promise<string> => {
      const keyToAdd = value;
      value = ""; // Clear original value immediately
      // Use passed-in function
      const newId = await addDbApiKey(name, providerId, keyToAdd);
      setSelectedApiKeyId(providerId, newId);
      return newId;
    },
    [addDbApiKey, setSelectedApiKeyId], // Use passed-in function in dependency array
  );

  const deleteApiKey = useCallback(
    async (id: string): Promise<void> => {
      const keyToDelete = apiKeys.find((k) => k.id === id);
      // Use passed-in function
      await deleteDbApiKey(id);
      if (keyToDelete && selectedApiKeyIdState[keyToDelete.providerId] === id) {
        setSelectedApiKeyId(keyToDelete.providerId, null);
      }
    },
    [apiKeys, deleteDbApiKey, selectedApiKeyIdState, setSelectedApiKeyId], // Use passed-in function and apiKeys prop in dependency array
  );

  const getApiKeyForProvider = useCallback(
    (providerId: string): string | undefined => {
      const selectedId = selectedApiKeyIdState[providerId];
      if (!selectedId) return undefined;
      // Find the key in the passed-in live query result
      return apiKeys.find((key) => key.id === selectedId)?.value;
    },
    [apiKeys, selectedApiKeyIdState], // Use passed-in apiKeys prop in dependency array
  );

  return {
    // apiKeys, // No longer returned
    selectedApiKeyId: selectedApiKeyIdState,
    setSelectedApiKeyId,
    addApiKey,
    deleteApiKey,
    getApiKeyForProvider,
  };
}
========
src/hooks/use-chat-context.ts
========
// src/hooks/use-chat-context.ts
import { useContext, createContext } from "react";
import type { ChatContextProps } from "@/lib/types"; // Ensure this type is updated if needed

// Create the context object. We need to provide an initial value,
// but it will be immediately replaced by the ChatProvider.
// Using 'undefined' and checking in the hook is standard practice.
export const ChatContext = createContext<ChatContextProps | undefined>(
  undefined,
);

export const useChatContext = (): ChatContextProps => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    // This error means you tried to use the context consumer
    // outside of the provider.
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
};
========
src/hooks/use-chat-input.ts
========
// src/hooks/use-chat-input.ts
import { useState, useCallback, useMemo } from "react";

interface UseChatInputReturn {
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  // For temporary uploads before sending
  attachedFiles: File[];
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearAttachedFiles: () => void;
  // For including existing VFS files in the next prompt context
  selectedVfsPaths: string[];
  addSelectedVfsPath: (path: string) => void;
  removeSelectedVfsPath: (path: string) => void;
  clearSelectedVfsPaths: () => void;
}

export function useChatInput(): UseChatInputReturn {
  const [prompt, setPrompt] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [selectedVfsPaths, setSelectedVfsPaths] = useState<string[]>([]);

  // --- Temporary Uploads ---
  const addAttachedFile = useCallback((file: File) => {
    setAttachedFiles((prev) => [...prev, file]);
  }, []);

  const removeAttachedFile = useCallback((fileName: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const clearAttachedFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  // --- VFS Context Selection ---
  const addSelectedVfsPath = useCallback((path: string) => {
    setSelectedVfsPaths((prev) =>
      prev.includes(path) ? prev : [...prev, path].sort(),
    );
  }, []);

  const removeSelectedVfsPath = useCallback((path: string) => {
    setSelectedVfsPaths((prev) => prev.filter((p) => p !== path));
  }, []);

  const clearSelectedVfsPaths = useCallback(() => {
    setSelectedVfsPaths([]);
  }, []);

  return useMemo(
    () => ({
      prompt,
      setPrompt,
      attachedFiles,
      addAttachedFile,
      removeAttachedFile,
      clearAttachedFiles,
      selectedVfsPaths,
      addSelectedVfsPath,
      removeSelectedVfsPath,
      clearSelectedVfsPaths,
    }),
    [
      prompt,
      setPrompt,
      attachedFiles,
      addAttachedFile,
      removeAttachedFile,
      clearAttachedFiles,
      selectedVfsPaths,
      addSelectedVfsPath,
      removeSelectedVfsPath,
      clearSelectedVfsPaths,
    ],
  );
}
========
src/hooks/use-chat-settings.ts
========
// src/hooks/use-chat-settings.ts
import { useState, useMemo, useEffect } from "react";
import type { DbConversation, DbProject } from "@/lib/types";

interface UseChatSettingsProps {
  activeConversationData: DbConversation | null;
  activeProjectData: DbProject | null; // Accept active project data
}

interface UseChatSettingsReturn {
  temperature: number;
  setTemperature: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number | null;
  setMaxTokens: React.Dispatch<React.SetStateAction<number | null>>;
  globalSystemPrompt: string;
  setGlobalSystemPrompt: React.Dispatch<React.SetStateAction<string>>;
  activeSystemPrompt: string | null; // Derived: convo-specific or global
  topP: number | null;
  setTopP: React.Dispatch<React.SetStateAction<number | null>>;
  topK: number | null;
  setTopK: React.Dispatch<React.SetStateAction<number | null>>;
  presencePenalty: number | null;
  setPresencePenalty: React.Dispatch<React.SetStateAction<number | null>>;
  frequencyPenalty: number | null;
  setFrequencyPenalty: React.Dispatch<React.SetStateAction<number | null>>;
  theme: "light" | "dark" | "system";
  setTheme: React.Dispatch<React.SetStateAction<"light" | "dark" | "system">>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
}

// Custom hook to apply theme changes to the DOM
function useThemeEffect(theme: "light" | "dark" | "system") {
  useEffect(() => {
    // Skip DOM manipulation during server-side rendering or tests
    if (typeof window === "undefined" || !window.document?.documentElement) {
      return;
    }
    // Skip during Vitest runs if needed
    if (import.meta.env.VITEST) {
      return;
    }

    const root = window.document.documentElement;
    root.classList.remove("light", "dark"); // Remove previous theme classes

    let effectiveTheme = theme;
    // Determine effective theme if 'system' is selected
    if (theme === "system") {
      effectiveTheme =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    }

    // Add the calculated theme class to the root element
    root.classList.add(effectiveTheme);
  }, [theme]); // Re-run effect only when the theme state changes
}

export function useChatSettings({
  activeConversationData,
  // activeProjectData, // Currently unused, but available if needed for project-specific settings
}: UseChatSettingsProps): UseChatSettingsReturn {
  // State for various chat settings
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState<number | null>(null); // Default to null (provider default)
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState(
    "You are a helpful AI assistant.", // Default global prompt
  );
  const [topP, setTopP] = useState<number | null>(null); // Default to null (provider default)
  const [topK, setTopK] = useState<number | null>(null); // Default to null (provider default)
  const [presencePenalty, setPresencePenalty] = useState<number | null>(null); // Default to null (provider default)
  const [frequencyPenalty, setFrequencyPenalty] = useState<number | null>(null); // Default to null (provider default)
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system"); // Default theme
  const [searchTerm, setSearchTerm] = useState(""); // State for message search term

  // Determine the active system prompt: use conversation-specific if available, else global
  const activeSystemPrompt = useMemo(() => {
    // Projects don't have system prompts, only conversations do
    if (activeConversationData?.systemPrompt) {
      return activeConversationData.systemPrompt;
    }
    // Fallback to the global system prompt
    return globalSystemPrompt;
  }, [activeConversationData, globalSystemPrompt]); // Recalculate when conversation data or global prompt changes

  // Apply the theme effect using the custom hook
  useThemeEffect(theme);

  // Return all settings states and setters
  return useMemo(
    () => ({
      temperature,
      setTemperature,
      maxTokens,
      setMaxTokens,
      globalSystemPrompt,
      setGlobalSystemPrompt,
      activeSystemPrompt,
      topP,
      setTopP,
      topK,
      setTopK,
      presencePenalty,
      setPresencePenalty,
      frequencyPenalty,
      setFrequencyPenalty,
      theme,
      setTheme,
      searchTerm,
      setSearchTerm,
    }),
    [
      temperature,
      maxTokens,
      globalSystemPrompt,
      activeSystemPrompt,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      theme,
      searchTerm,
      // Include setters if they might change, though unlikely for useState setters
      setTemperature,
      setMaxTokens,
      setGlobalSystemPrompt,
      setTopP,
      setTopK,
      setPresencePenalty,
      setFrequencyPenalty,
      setTheme,
      setSearchTerm,
    ],
  );
}
========
src/hooks/use-chat-storage.ts
========
// src/hooks/use-chat-storage.ts
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type {
  DbConversation,
  DbMessage,
  DbApiKey,
  DbProject,
  SidebarItemType,
} from "@/lib/types";
import { nanoid } from "nanoid";
import { useCallback } from "react"; // Import useCallback

export function useChatStorage() {
  // === Live Queries (remain the same) ===
  const projects = useLiveQuery(
    () => db.projects.orderBy("updatedAt").reverse().toArray(),
    [],
    [],
  );
  const conversations = useLiveQuery(
    () => db.conversations.orderBy("updatedAt").reverse().toArray(),
    [],
    [],
  );
  const apiKeys = useLiveQuery(
    () => db.apiKeys.orderBy("createdAt").toArray(),
    [],
    [],
  );

  // === Projects (Wrap functions in useCallback) ===
  const createProject = useCallback(
    async (
      name: string = "New Project",
      parentId: string | null = null,
    ): Promise<DbProject> => {
      const newId = nanoid();
      const now = new Date();
      const newProject: DbProject = {
        id: newId,
        name,
        parentId,
        createdAt: now,
        updatedAt: now,
        vfsEnabled: false,
      };
      await db.projects.add(newProject);
      if (parentId) {
        await db.projects.update(parentId, { updatedAt: now });
      }
      return newProject;
    },
    [], // No dependencies needed for this DB operation
  );

  const renameProject = useCallback(
    async (id: string, newName: string): Promise<void> => {
      try {
        await db.projects.update(id, { name: newName, updatedAt: new Date() });
      } catch (error) {
        console.error(`useChatStorage: Failed to update project ${id}`, error);
        throw error;
      }
    },
    [], // No dependencies needed
  );

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    await db.projects.delete(id);
  }, []); // No dependencies needed

  const getProject = useCallback(
    async (id: string): Promise<DbProject | undefined> => {
      return db.projects.get(id);
    },
    [], // No dependencies needed
  );

  const countChildProjects = useCallback(
    async (parentId: string): Promise<number> => {
      return db.projects.where("parentId").equals(parentId).count();
    },
    [], // No dependencies needed
  );

  // === Conversations (Wrap functions in useCallback) ===
  const createConversation = useCallback(
    async (
      parentId: string | null = null,
      title: string = "New Chat",
      initialSystemPrompt?: string | null,
    ): Promise<string> => {
      const newId = nanoid();
      const now = new Date();
      const newConversation: DbConversation = {
        id: newId,
        parentId,
        title,
        systemPrompt: initialSystemPrompt ?? null,
        createdAt: now,
        updatedAt: now,
        vfsEnabled: false,
      };
      await db.conversations.add(newConversation);
      if (parentId) {
        await db.projects.update(parentId, { updatedAt: now });
      }
      return newId;
    },
    [], // No dependencies needed
  );

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    await db.transaction("rw", db.conversations, db.messages, async () => {
      await db.messages.where("conversationId").equals(id).delete();
      await db.conversations.delete(id);
    });
  }, []); // No dependencies needed

  const renameConversation = useCallback(
    async (id: string, newTitle: string): Promise<void> => {
      const now = new Date();
      const conversation = await db.conversations.get(id);
      await db.conversations.update(id, {
        title: newTitle,
        updatedAt: now,
      });
      if (conversation?.parentId) {
        await db.projects.update(conversation.parentId, { updatedAt: now });
      }
    },
    [], // No dependencies needed
  );

  const updateConversationSystemPrompt = useCallback(
    async (id: string, systemPrompt: string | null): Promise<void> => {
      await db.conversations.update(id, {
        systemPrompt: systemPrompt,
        updatedAt: new Date(),
      });
    },
    [], // No dependencies needed
  );

  const getConversation = useCallback(
    async (id: string): Promise<DbConversation | undefined> => {
      return db.conversations.get(id);
    },
    [], // No dependencies needed
  );

  const countChildConversations = useCallback(
    async (parentId: string): Promise<number> => {
      return db.conversations.where("parentId").equals(parentId).count();
    },
    [], // No dependencies needed
  );

  // === VFS Toggle (Wrap in useCallback) ===
  const toggleVfsEnabled = useCallback(
    async (id: string, type: SidebarItemType): Promise<void> => {
      const now = new Date();
      const table = type === "conversation" ? db.conversations : db.projects;
      const current = await table.get(id);

      if (current) {
        await table.update(id, {
          vfsEnabled: !current.vfsEnabled,
          updatedAt: now,
        });
        if (current.parentId) {
          await db.projects.update(current.parentId, { updatedAt: now });
        }
      } else {
        console.warn(`[DB] Item ${id} (${type}) not found for VFS toggle.`);
        throw new Error("Item not found");
      }
    },
    [], // No dependencies needed
  );

  // === Messages (Wrap functions in useCallback) ===
  const getMessagesForConversation = useCallback(
    async (conversationId: string): Promise<DbMessage[]> => {
      return db.messages
        .where("conversationId")
        .equals(conversationId)
        .sortBy("createdAt");
    },
    [], // No dependencies needed
  );

  const addDbMessage = useCallback(
    async (
      messageData: Omit<DbMessage, "id" | "createdAt"> &
        Partial<Pick<DbMessage, "id" | "createdAt">>,
    ): Promise<string> => {
      if (!messageData.conversationId) {
        throw new Error("Cannot add message without a conversationId");
      }
      const newMessage: DbMessage = {
        id: messageData.id ?? nanoid(),
        createdAt: messageData.createdAt ?? new Date(),
        role: messageData.role,
        content: messageData.content,
        conversationId: messageData.conversationId,
        vfsContextPaths: messageData.vfsContextPaths ?? undefined,
      };
      const conversation = await db.conversations.get(
        messageData.conversationId,
      );
      await db.messages.add(newMessage);
      const now = new Date();
      await db.conversations.update(messageData.conversationId, {
        updatedAt: now,
      });
      if (conversation?.parentId) {
        await db.projects.update(conversation.parentId, { updatedAt: now });
      }
      return newMessage.id;
    },
    [], // No dependencies needed
  );

  const updateDbMessageContent = useCallback(
    async (messageId: string, newContent: string): Promise<void> => {
      await db.messages.update(messageId, { content: newContent });
    },
    [], // No dependencies needed
  );

  const deleteDbMessage = useCallback(
    async (messageId: string): Promise<void> => {
      await db.messages.delete(messageId);
    },
    [],
  ); // No dependencies needed

  const getDbMessagesUpTo = useCallback(
    async (convId: string, messageId: string): Promise<DbMessage[]> => {
      const targetMsg = await db.messages.get(messageId);
      if (!targetMsg) return [];
      return db.messages
        .where("conversationId")
        .equals(convId)
        .and((msg) => msg.createdAt.getTime() < targetMsg.createdAt.getTime())
        .sortBy("createdAt");
    },
    [], // No dependencies needed
  );

  const bulkAddMessages = useCallback(
    async (messages: DbMessage[]): Promise<unknown> => {
      return db.messages.bulkAdd(messages);
    },
    [], // No dependencies needed
  );

  const updateConversationTimestamp = useCallback(
    async (id: string, date: Date): Promise<void> => {
      await db.conversations.update(id, { updatedAt: date });
      const conversation = await db.conversations.get(id);
      if (conversation?.parentId) {
        await db.projects.update(conversation.parentId, { updatedAt: date });
      }
    },
    [], // No dependencies needed
  );

  // === API Keys (Wrap functions in useCallback) ===
  const addApiKey = useCallback(
    async (
      name: string,
      providerId: string,
      value: string,
    ): Promise<string> => {
      const newId = nanoid();
      const newKey: DbApiKey = {
        id: newId,
        name,
        providerId,
        value,
        createdAt: new Date(),
      };
      await db.apiKeys.add(newKey);
      return newId;
    },
    [], // No dependencies needed
  );

  const deleteApiKey = useCallback(async (id: string): Promise<void> => {
    await db.apiKeys.delete(id);
  }, []); // No dependencies needed

  // === Data Management (Wrap in useCallback) ===
  const clearAllData = useCallback(async (): Promise<void> => {
    await db.delete();
  }, []); // No dependencies needed

  // Return memoized functions and live query results
  return {
    // Projects
    projects: projects || [],
    createProject,
    renameProject,
    deleteProject,
    getProject,
    countChildProjects,
    // Conversations
    conversations: conversations || [],
    createConversation,
    deleteConversation,
    renameConversation,
    updateConversationSystemPrompt,
    getConversation,
    updateConversationTimestamp,
    countChildConversations,
    // VFS Toggle
    toggleVfsEnabled,
    // Messages
    getMessagesForConversation,
    addDbMessage,
    updateDbMessageContent,
    deleteDbMessage,
    getDbMessagesUpTo,
    bulkAddMessages,
    // API Keys
    apiKeys: apiKeys || [],
    addApiKey,
    deleteApiKey,
    // Data Management
    clearAllData,
  };
}
========
src/hooks/use-conversation-management.ts
========
// src/hooks/use-conversation-management.ts
import { useState, useCallback, useEffect } from "react";
import { useChatStorage } from "./use-chat-storage";
import type {
  DbConversation,
  DbProject,
  SidebarItem,
  SidebarItemType,
  ProjectSidebarItem,
  ConversationSidebarItem,
  DbMessage,
} from "@/lib/types";
import { toast } from "sonner";
import { useLiveQuery } from "dexie-react-hooks";
import { z } from "zod";
import { nanoid } from "nanoid";

// Schemas remain the same
const messageImportSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z
    .string()
    .datetime()
    .transform((date) => new Date(date)),
});
const conversationImportSchema = z.array(messageImportSchema);

interface UseConversationManagementProps {
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  onSelectItem: (id: string | null, type: SidebarItemType | null) => void;
  // DB Functions Passed In
  toggleDbVfs: (id: string, type: SidebarItemType) => Promise<void>;
  getProject: (id: string) => Promise<DbProject | undefined>; // Keep getter
  getConversation: (id: string) => Promise<DbConversation | undefined>; // Keep getter
  getMessagesForConversation: (conversationId: string) => Promise<DbMessage[]>;
  bulkAddMessages: (messages: DbMessage[]) => Promise<unknown>;
  updateConversationTimestamp: (id: string, date: Date) => Promise<void>;
  countChildProjects: (parentId: string) => Promise<number>;
  countChildConversations: (parentId: string) => Promise<number>;
}

// MODIFIED Return Type
interface UseConversationManagementReturn {
  sidebarItems: SidebarItem[];
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  createProject: (
    parentId: string | null,
    name?: string,
  ) => Promise<{ id: string; name: string }>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  renameItem: (
    id: string,
    newName: string,
    type: SidebarItemType,
  ) => Promise<void>;
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>;
  exportConversation: (conversationId: string | null) => Promise<void>;
  importConversation: (file: File, parentId: string | null) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  toggleVfsEnabled: () => Promise<void>;
  // REMOVED activeConversationData, activeProjectData
}

export function useConversationManagement({
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  onSelectItem,
  // Destructure DB Functions
  toggleDbVfs,
  getProject, // Keep getter prop
  getConversation, // Keep getter prop
  getMessagesForConversation,
  bulkAddMessages,
  updateConversationTimestamp,
  countChildProjects,
  countChildConversations,
}: UseConversationManagementProps): UseConversationManagementReturn {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialSelectedItemId,
  );
  const [selectedItemType, setSelectedItemType] =
    useState<SidebarItemType | null>(initialSelectedItemType);
  // REMOVED activeConversationData / activeProjectData state

  const storage = useChatStorage();

  const sidebarItems = useLiveQuery<SidebarItem[]>(() => {
    const allProjects = storage.projects || [];
    const allConversations = storage.conversations || [];
    const combinedItems: SidebarItem[] = [
      ...allProjects.map(
        (p): ProjectSidebarItem => ({ ...p, type: "project" }),
      ),
      ...allConversations.map(
        (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
      ),
    ];
    combinedItems.sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    return combinedItems;
  }, [storage.projects, storage.conversations]);

  // MODIFIED: Selection Logic - Just update state and call prop
  const selectItem = useCallback(
    async (id: string | null, type: SidebarItemType | null) => {
      setSelectedItemId(id);
      setSelectedItemType(type);
      onSelectItem(id, type); // Notify parent (ChatProvider)
      // REMOVED: Fetching active data here
    },
    [onSelectItem],
  );

  // MODIFIED: Toggle VFS - Remove active data refresh
  const toggleVfsEnabled = useCallback(async () => {
    if (!selectedItemId || !selectedItemType) {
      toast.warning("No item selected to toggle VFS.");
      return;
    }
    try {
      await toggleDbVfs(selectedItemId, selectedItemType);
      // REMOVED: Re-fetching active data here
      // Rely on useLiveQuery in storage hook to update sidebarItems eventually
      const item = sidebarItems.find((i) => i.id === selectedItemId);
      const isNowEnabled = item ? !item.vfsEnabled : undefined;
      if (isNowEnabled !== undefined) {
        toast.success(
          `Virtual Filesystem ${isNowEnabled ? "enabled" : "disabled"} for ${selectedItemType}.`,
        );
      } else {
        toast.success(
          `Virtual Filesystem setting updated for ${selectedItemType}.`,
        );
      }
    } catch (err) {
      console.error("Failed to toggle VFS:", err);
      toast.error("Failed to update VFS setting.");
    }
  }, [selectedItemId, selectedItemType, toggleDbVfs, sidebarItems]);

  // --- Creation Logic --- (No change needed)
  const createConversation = useCallback(
    async (
      parentId: string | null,
      title?: string,
      initialSystemPrompt?: string | null,
    ): Promise<string> => {
      const newId = await storage.createConversation(
        parentId,
        title,
        initialSystemPrompt,
      );
      await selectItem(newId, "conversation"); // Select the new item
      return newId;
    },
    [storage, selectItem],
  );

  const createProject = useCallback(
    async (
      parentId: string | null,
      name: string = "New Project",
    ): Promise<{ id: string; name: string }> => {
      const newProject = await storage.createProject(name, parentId);
      return { id: newProject.id, name: newProject.name };
    },
    [storage],
  );

  // --- Deletion Logic --- (No change needed in logic, just dependencies)
  const deleteItem = useCallback(
    async (id: string, type: SidebarItemType): Promise<void> => {
      const currentSelectedId = selectedItemId;

      if (type === "project") {
        try {
          const childProjects = await countChildProjects(id);
          const childConvos = await countChildConversations(id);
          if (childProjects > 0 || childConvos > 0) {
            toast.error("Cannot delete project with items inside.");
            return;
          }
        } catch (countErr) {
          console.error("Failed to check for child items:", countErr);
          toast.error(
            "Could not verify if project is empty. Deletion aborted.",
          );
          return;
        }
      }

      try {
        if (type === "conversation") {
          await storage.deleteConversation(id);
        } else if (type === "project") {
          await storage.deleteProject(id);
        }

        toast.success(`${type === "project" ? "Project" : "Chat"} deleted.`);

        if (currentSelectedId === id) {
          const itemsBeforeDelete = sidebarItems || [];
          const remainingItems = itemsBeforeDelete.filter(
            (item) => item.id !== id,
          );
          remainingItems.sort(
            (a, b) =>
              (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
          );
          const nextItem = remainingItems[0];
          await selectItem(nextItem?.id ?? null, nextItem?.type ?? null);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to delete ${type}:`, err);
        toast.error(`Failed to delete ${type}: ${message}`);
      }
    },
    [
      storage,
      selectedItemId,
      selectItem,
      countChildProjects,
      countChildConversations,
      sidebarItems,
    ],
  );

  // MODIFIED: Renaming Logic - Remove active data refresh
  const renameItem = useCallback(
    async (
      id: string,
      newName: string,
      type: SidebarItemType,
    ): Promise<void> => {
      const trimmedName = newName.trim();
      if (!trimmedName) {
        toast.error("Name cannot be empty.");
        throw new Error("Name cannot be empty.");
      }
      try {
        if (type === "conversation") {
          await storage.renameConversation(id, trimmedName);
        } else if (type === "project") {
          await storage.renameProject(id, trimmedName);
        }
        // REMOVED: Refreshing active data state
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to rename ${type}:`, err);
        toast.error(`Failed to rename ${type}: ${message}`);
        throw err;
      }
    },
    [storage], // Only depends on storage now
  );

  // MODIFIED: Update System Prompt - Remove active data refresh
  const updateConversationSystemPrompt = useCallback(
    async (id: string, systemPrompt: string | null): Promise<void> => {
      const item = sidebarItems.find((i) => i.id === id);
      if (item?.type !== "conversation") {
        console.warn(
          `Attempted to update system prompt for non-conversation item: ${id}`,
        );
        toast.error("Can only update system prompt for conversations.");
        return;
      }
      await storage.updateConversationSystemPrompt(id, systemPrompt);
      // REMOVED: Refreshing active data state
    },
    [storage, sidebarItems], // Depends on storage and sidebarItems
  );

  // --- Import/Export --- (No change needed in logic, just dependencies)
  const exportConversation = useCallback(
    async (conversationId: string | null) => {
      if (!conversationId) {
        toast.error("No conversation selected to export.");
        return;
      }
      try {
        const conversation = await getConversation(conversationId); // Use getter
        const messagesToExport =
          await getMessagesForConversation(conversationId); // Use getter

        if (!conversation) {
          toast.warning("Cannot export non-existent conversation.");
          return;
        }
        const exportData = messagesToExport.map((msg) => ({
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt.toISOString(),
        }));
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const filename = `${conversation.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "chat"}_${conversationId.substring(0, 6)}.json`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Conversation "${conversation.title}" exported.`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Export failed:", err);
        toast.error(`Export failed: ${message}`);
      }
    },
    [getConversation, getMessagesForConversation], // Keep getter dependencies
  );

  const importConversation = useCallback(
    async (file: File, parentId: string | null) => {
      if (!file || file.type !== "application/json") {
        toast.error("Please select a valid JSON file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonString = event.target?.result as string;
          const parsedData = JSON.parse(jsonString);

          const validationResult =
            conversationImportSchema.safeParse(parsedData);
          if (!validationResult.success) {
            console.error("Import validation error:", validationResult.error);
            toast.error(
              `Import failed: Invalid file format. ${validationResult.error.errors[0]?.message || ""}`,
            );
            return;
          }
          const importedMessages = validationResult.data;

          const newConversationTitle = `Imported: ${file.name.replace(/\.json$/i, "").substring(0, 50)}`;
          const newConversationId = await storage.createConversation(
            parentId,
            newConversationTitle,
          );

          if (importedMessages.length > 0) {
            await bulkAddMessages(
              importedMessages.map((msg) => ({
                id: nanoid(),
                role: msg.role,
                content: msg.content,
                createdAt: msg.createdAt,
                conversationId: newConversationId,
              })),
            );
            const lastMessageTime =
              importedMessages[importedMessages.length - 1].createdAt;
            await updateConversationTimestamp(
              newConversationId,
              lastMessageTime,
            );
          }

          await selectItem(newConversationId, "conversation");
          toast.success(
            `Conversation imported successfully as "${newConversationTitle}"!`,
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error("Import failed:", err);
          toast.error(`Import failed: ${message}`);
        }
      };
      reader.onerror = () => {
        toast.error("Failed to read the file.");
      };
      reader.readAsText(file);
    },
    [storage, selectItem, bulkAddMessages, updateConversationTimestamp],
  );

  const exportAllConversations = useCallback(async () => {
    try {
      const allConversations = storage.conversations || [];
      if (allConversations.length === 0) {
        toast.info("No conversations to export.");
        return;
      }
      const exportData = [];
      for (const conversation of allConversations) {
        const messages = await getMessagesForConversation(conversation.id); // Use getter
        exportData.push({
          _litechat_meta: {
            id: conversation.id,
            title: conversation.title,
            systemPrompt: conversation.systemPrompt,
            createdAt: conversation.createdAt.toISOString(),
            updatedAt: conversation.updatedAt.toISOString(),
            parentId: conversation.parentId,
            vfsEnabled: conversation.vfsEnabled,
          },
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt.toISOString(),
          })),
        });
      }
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.download = `litechat_all_conversations_export_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`All ${allConversations.length} conversations exported.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Export All failed:", err);
      toast.error(`Export All failed: ${message}`);
    }
  }, [storage.conversations, getMessagesForConversation]); // Keep getter dependency

  // Effect to load initial item on mount (No change needed)
  useEffect(() => {
    if (initialSelectedItemId && initialSelectedItemType) {
      const timer = setTimeout(() => {
        selectItem(initialSelectedItemId, initialSelectedItemType);
      }, 50);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    sidebarItems: sidebarItems || [],
    selectedItemId,
    selectedItemType,
    selectItem,
    createConversation,
    createProject,
    deleteItem,
    renameItem,
    updateConversationSystemPrompt,
    exportConversation,
    importConversation,
    exportAllConversations,
    toggleVfsEnabled,
    // REMOVED activeConversationData, activeProjectData
  };
}
========
src/hooks/use-debounce.ts
========
// src/hooks/use-debounce.ts
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancel the timeout if value changes (also on delay change or unmount)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Only re-call effect if value or delay changes

  return debouncedValue;
}
========
src/hooks/use-message-handling.ts
========
// src/hooks/use-message-handling.ts
import React, { useCallback, useEffect } from "react";
import type { Message, DbMessage } from "@/lib/types";
import { toast } from "sonner";
import type { CoreMessage } from "ai";

// ... (interfaces remain the same) ...
export interface PerformAiStreamParams {
  conversationIdToUse: string;
  messagesToSend: CoreMessage[];
  currentTemperature: number;
  currentMaxTokens: number | null;
  currentTopP: number | null;
  currentTopK: number | null;
  currentPresencePenalty: number | null;
  currentFrequencyPenalty: number | null;
  systemPromptToUse: string | null;
}

interface UseMessageHandlingProps {
  selectedConversationId: string | null;
  performAiStream: (params: PerformAiStreamParams) => Promise<void>;
  stopStreamingCallback: () => void;
  activeSystemPrompt: string | null;
  temperature: number;
  maxTokens: number | null;
  topP: number | null;
  topK: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
  isAiStreaming: boolean;
  setIsAiStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  localMessages: Message[];
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoadingMessages: boolean;
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: (error: string | null) => void;
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  deleteDbMessage: (messageId: string) => Promise<void>;
  getMessagesForConversation: (conversationId: string) => Promise<DbMessage[]>;
}

interface UseMessageHandlingReturn {
  handleSubmitCore: (
    originalUserPrompt: string,
    currentConversationId: string,
    promptToSendToAI: string,
    vfsContextPaths?: string[],
  ) => Promise<void>;
  regenerateMessageCore: (messageId: string) => Promise<void>;
  stopStreamingCore: () => void;
}
// --- End interfaces ---

export function useMessageHandling({
  selectedConversationId,
  performAiStream,
  stopStreamingCallback,
  activeSystemPrompt,
  temperature,
  maxTokens,
  topP,
  topK,
  presencePenalty,
  frequencyPenalty,
  isAiStreaming,
  // setIsAiStreaming, // Not directly used in this hook's logic flow
  localMessages,
  setLocalMessages, // Setter used below
  // isLoadingMessages, // Not directly used
  setIsLoadingMessages, // Setter used below
  // error, // Not directly used
  setError, // Setter used below
  addDbMessage,
  deleteDbMessage,
  getMessagesForConversation,
}: UseMessageHandlingProps): UseMessageHandlingReturn {
  // --- Message Loading Effect ---
  useEffect(() => {
    let isMounted = true;
    if (selectedConversationId) {
      setIsLoadingMessages(true);
      setError(null);

      getMessagesForConversation(selectedConversationId)
        .then((messagesFromDb) => {
          if (isMounted) {
            setLocalMessages(
              messagesFromDb.map((dbMsg) => ({
                ...dbMsg,
                isStreaming: false,
                streamedContent: undefined,
                error: null,
                vfsContextPaths: dbMsg.vfsContextPaths ?? undefined,
              })),
            );
            setIsLoadingMessages(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error("useMessageHandling: Failed to load messages:", err);
            const message =
              err instanceof Error ? err.message : "Unknown error";
            setError(`Error loading chat: ${message}`);
            toast.error(`Error loading chat: ${message}`);
            setLocalMessages([]);
            setIsLoadingMessages(false);
          }
        });
    } else {
      // Clear state when no conversation is selected
      setLocalMessages([]);
      setIsLoadingMessages(false);
      setError(null);
    }
    return () => {
      isMounted = false;
    };
  }, [
    // --- MODIFIED DEPENDENCY ARRAY ---
    selectedConversationId,
    getMessagesForConversation, // Assume this is stable
    // REMOVED: setIsLoadingMessages, setLocalMessages, setError
    // Add setters back here ONLY if the lint rule complains AND you are sure
    // they are causing instability from the parent. Usually, they are safe to omit.
    setLocalMessages,
    setIsLoadingMessages,
    setError,
  ]);
  // --- End Message Loading Effect ---

  // --- Stop Streaming ---
  const stopStreamingCore = useCallback(() => {
    stopStreamingCallback();
    setLocalMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming
          ? {
              ...msg,
              isStreaming: false,
              content: msg.streamedContent || msg.content || "Stopped by user",
              streamedContent: undefined,
            }
          : msg,
      ),
    );
  }, [stopStreamingCallback, setLocalMessages]);

  // --- Handle Submission ---
  const handleSubmitCore = useCallback(
    async (
      originalUserPrompt: string,
      currentConversationId: string,
      promptToSendToAI: string,
      vfsContextPaths?: string[],
    ) => {
      // ... (handleSubmitCore logic remains the same)
      if (!currentConversationId) {
        setError("Error: Could not determine active conversation.");
        toast.error("Cannot submit message: No active conversation selected.");
        return;
      }

      setError(null);

      const messagesForAi: CoreMessage[] = [
        ...localMessages
          .filter(
            (m) => !m.error && (m.role === "user" || m.role === "assistant"),
          )
          .map((m): CoreMessage => ({ role: m.role, content: m.content })),
        { role: "user", content: promptToSendToAI },
      ];

      const hasUserOrAssistantMessage = messagesForAi.some(
        (m) => m.role === "user" || m.role === "assistant",
      );
      if (!hasUserOrAssistantMessage) {
        console.error("useMessageHandling: Attempting to send empty history.");
        setError("Internal Error: Cannot send empty message list.");
        toast.error("Cannot send message: Chat history is effectively empty.");
        return;
      }

      let userMessageId: string;
      let userMessageForState: Message;
      const userMessageTimestamp = new Date();
      try {
        const userMessageData = {
          role: "user" as const,
          content: originalUserPrompt,
          conversationId: currentConversationId,
          createdAt: userMessageTimestamp,
          vfsContextPaths: vfsContextPaths,
        };
        userMessageId = await addDbMessage(userMessageData);
        userMessageForState = {
          ...userMessageData,
          id: userMessageId,
          isStreaming: false,
          streamedContent: undefined,
          error: null,
          vfsContextPaths: vfsContextPaths ?? undefined,
        };
      } catch (dbError: unknown) {
        console.error(
          "useMessageHandling: Error adding user message:",
          dbError,
        );
        const message =
          dbError instanceof Error ? dbError.message : "Unknown DB error";
        setError(`Error: Could not save your message - ${message}`);
        toast.error(`Error saving message: ${message}`);
        return;
      }

      setLocalMessages((prevMessages) => [
        ...prevMessages,
        userMessageForState,
      ]);

      try {
        await performAiStream({
          conversationIdToUse: currentConversationId,
          messagesToSend: messagesForAi,
          currentTemperature: temperature,
          currentMaxTokens: maxTokens,
          currentTopP: topP,
          currentTopK: topK,
          currentPresencePenalty: presencePenalty,
          currentFrequencyPenalty: frequencyPenalty,
          systemPromptToUse: activeSystemPrompt,
        });
      } catch (err: unknown) {
        console.error(
          "useMessageHandling: Error during performAiStream call:",
          err,
        );
      }
    },
    [
      localMessages,
      addDbMessage,
      performAiStream,
      setError,
      setLocalMessages,
      activeSystemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
    ],
  );

  // --- Regeneration ---
  const regenerateMessageCore = useCallback(
    async (messageId: string) => {
      // ... (regenerateMessageCore logic remains the same)
      const conversationIdToUse = selectedConversationId;
      if (!conversationIdToUse) {
        toast.error("Please select the conversation first.");
        return;
      }
      if (isAiStreaming) {
        toast.warning("Please wait for the current response to finish.");
        return;
      }

      setError(null);

      const messageIndex = localMessages.findIndex((m) => m.id === messageId);
      if (messageIndex < 0) {
        setError("Cannot regenerate non-existent message.");
        toast.error("Cannot find the message to regenerate.");
        return;
      }

      const messageToRegenerate = localMessages[messageIndex];
      if (messageToRegenerate.role !== "assistant") {
        setError("Can only regenerate assistant messages.");
        toast.error("Only AI responses can be regenerated.");
        return;
      }

      const historyForRegen = localMessages
        .slice(0, messageIndex)
        .filter(
          (m) => !m.error && (m.role === "user" || m.role === "assistant"),
        )
        .map((m): CoreMessage => ({ role: m.role, content: m.content }));

      const hasUserOrAssistantMessage = historyForRegen.some(
        (m) => m.role === "user" || m.role === "assistant",
      );
      if (!hasUserOrAssistantMessage) {
        console.error(
          "useMessageHandling: Cannot regenerate with empty history.",
        );
        setError("Internal Error: Cannot regenerate with empty history.");
        toast.error("Cannot regenerate the first message in a chat.");
        return;
      }

      const messagesToDelete = localMessages.slice(messageIndex);
      try {
        const idsToDelete = messagesToDelete
          .map((m) => m.id)
          .filter((id): id is string => !!id);
        if (idsToDelete.length > 0) {
          await Promise.all(idsToDelete.map((id) => deleteDbMessage(id)));
        } else {
          console.warn("Regeneration: No message IDs found to delete from DB.");
        }
      } catch (dbErr: unknown) {
        console.error("useMessageHandling: Error deleting for regen:", dbErr);
        const message =
          dbErr instanceof Error ? dbErr.message : "Unknown DB error";
        setError(`Error preparing regeneration: ${message}`);
        toast.error(`Failed to prepare for regeneration: ${message}`);
        return;
      }

      setLocalMessages((prev) => prev.slice(0, messageIndex));

      try {
        await performAiStream({
          conversationIdToUse: conversationIdToUse,
          messagesToSend: historyForRegen,
          currentTemperature: temperature,
          currentMaxTokens: maxTokens,
          currentTopP: topP,
          currentTopK: topK,
          currentPresencePenalty: presencePenalty,
          currentFrequencyPenalty: frequencyPenalty,
          systemPromptToUse: activeSystemPrompt,
        });
      } catch (err: unknown) {
        console.error("useMessageHandling: Error during regen stream:", err);
      }
    },
    [
      selectedConversationId,
      isAiStreaming,
      localMessages,
      deleteDbMessage,
      performAiStream,
      setError,
      setLocalMessages,
      activeSystemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
    ],
  );

  return {
    handleSubmitCore,
    regenerateMessageCore,
    stopStreamingCore,
  };
}
========
src/hooks/use-provider-model-selection.ts
========
// src/hooks/use-provider-model-selection.ts
import { useState, useEffect, useMemo } from "react";
import type { AiProviderConfig, AiModelConfig } from "@/lib/types";

interface UseProviderModelSelectionProps {
  providers: AiProviderConfig[];
  initialProviderId?: string | null;
  initialModelId?: string | null;
}

interface UseProviderModelSelectionReturn {
  selectedProviderId: string | null;
  setSelectedProviderId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedModelId: string | null;
  setSelectedModelId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedProvider: AiProviderConfig | undefined;
  selectedModel: AiModelConfig | undefined;
}

export function useProviderModelSelection({
  providers,
  initialProviderId = null,
  initialModelId = null,
}: UseProviderModelSelectionProps): UseProviderModelSelectionReturn {
  // Determine the effective initial provider ID
  const getEffectiveInitialProviderId = () => {
    if (
      initialProviderId &&
      providers.some((p) => p.id === initialProviderId)
    ) {
      return initialProviderId; // Use valid initial ID
    }
    if (providers.length > 0) {
      return providers[0].id; // Fallback to first provider if initial is invalid or null
    }
    return null; // No providers, initial is null
  };

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    getEffectiveInitialProviderId, // Initialize state based on logic
  );

  // Determine initial model based on the *effective* initial provider
  const getInitialModelId = (providerId: string | null) => {
    if (!providerId) return null;
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return null;

    // If an initialModelId was provided AND it's valid for the initial provider
    if (
      initialModelId &&
      provider.models.some((m) => m.id === initialModelId)
    ) {
      return initialModelId;
    }
    // Otherwise, use the first model of the initial provider
    return provider.models[0]?.id ?? null;
  };

  const [selectedModelId, setSelectedModelId] = useState<string | null>(() =>
    getInitialModelId(selectedProviderId),
  ); // Initialize model based on initial provider

  // Memoize selected provider/model based on current state
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId),
    [providers, selectedProviderId],
  );

  const selectedModel = useMemo(
    () => selectedProvider?.models.find((m) => m.id === selectedModelId),
    [selectedProvider, selectedModelId],
  );

  // Effect 1: Handle changes in the providers list affecting the selected provider
  useEffect(() => {
    // If the currently selected provider ID is no longer valid in the new list...
    if (
      selectedProviderId &&
      !providers.some((p) => p.id === selectedProviderId)
    ) {
      // ...select the first available provider, or null if the list is empty.
      const newProviderId = providers.length > 0 ? providers[0].id : null;
      // console.log(`[Effect 1] Invalid provider ${selectedProviderId}, switching to ${newProviderId}`);
      setSelectedProviderId(newProviderId);
    }
    // This effect ONLY reacts to the providers list changing.
  }, [providers, selectedProviderId]); // Keep selectedProviderId here to react to invalidation

  // Effect 2: Handle model selection based on the current selectedProvider
  useEffect(() => {
    if (selectedProvider) {
      // Check if the current model ID is valid for the *current* provider
      const currentModelIsValid =
        selectedModelId &&
        selectedProvider.models.some((m) => m.id === selectedModelId);

      if (!currentModelIsValid) {
        // If model is null or invalid, select the first model of the *current* provider
        const firstModelId = selectedProvider.models[0]?.id ?? null;
        // console.log(`[Effect 2] Auto-selecting first model for ${selectedProvider.id}: ${firstModelId}`);
        setSelectedModelId(firstModelId);
      }
      // If model is already valid, do nothing.
    } else {
      // No provider is selected (selectedProviderId is null), ensure model is also null.
      if (selectedModelId !== null) {
        // console.log('[Effect 2] Clearing model ID because no provider selected.');
        setSelectedModelId(null);
      }
    }
    // This effect reacts to the derived selectedProvider changing, or if the model ID changes externally.
  }, [selectedProvider, selectedModelId]); // Removed 'providers' dependency here, handled by Effect 1

  return {
    selectedProviderId,
    setSelectedProviderId,
    selectedModelId,
    setSelectedModelId,
    selectedProvider,
    selectedModel,
  };
}
========
src/hooks/use-virtual-file-system.ts
========
// src/hooks/use-virtual-file-system.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { configureSingle, fs as zenfs_fs } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";
import JSZip from "jszip";
import type { FileSystemEntry, SidebarItemType } from "@/lib/types";
import { toast } from "sonner";

interface UseVirtualFileSystemProps {
  itemId: string | null;
  itemType: SidebarItemType | null;
  isEnabled: boolean;
}

interface UseVirtualFileSystemReturn {
  isReady: boolean;
  isLoading: boolean;
  isOperationLoading: boolean;
  error: string | null;
  configuredItemId: string | null;
  listFiles: (path: string) => Promise<FileSystemEntry[]>;
  readFile: (path: string) => Promise<Uint8Array>;
  writeFile: (path: string, data: Uint8Array | string) => Promise<void>;
  deleteItem: (path: string, recursive?: boolean) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  downloadFile: (path: string, filename?: string) => Promise<void>;
  uploadFiles: (files: FileList | File[], targetPath: string) => Promise<void>;
  uploadAndExtractZip: (file: File, targetPath: string) => Promise<void>;
  downloadAllAsZip: (filename?: string) => Promise<void>;
  rename: (oldPath: string, newPath: string) => Promise<void>;
}

// --- Path Helpers ---
const normalizePath = (path: string): string => {
  return path.replace(/\/g, "/").replace(/\/+/g, "/");
};
const joinPath = (...segments: string[]): string => {
  return normalizePath(
    segments
      .map((s) => s.trim())
      .filter(Boolean)
      .join("/"),
  );
};
const dirname = (path: string): string => {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === -1) return "/";
  if (lastSlash === 0) return "/";
  return normalized.substring(0, lastSlash);
};
// --- End Path Helpers ---

export function useVirtualFileSystem({
  itemId,
  isEnabled,
}: UseVirtualFileSystemProps): UseVirtualFileSystemReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const isMountedRef = useRef(false);
  const configuredFsIdRef = useRef<string | null>(null);
  const configuringForIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    const configureNewFs = async (id: string) => {
      if (!isMountedRef.current) return;

      console.log(
        `[VFS] Configuring global fs for item ID: ${id} using configureSingle`,
      );
      configuringForIdRef.current = id;

      setIsLoading((prev) => (prev ? prev : true));
      setIsOperationLoading(false);
      setError(null);
      setIsReady(false);

      try {
        await configureSingle({ backend: IndexedDB });

        if (
          isMountedRef.current &&
          configuringForIdRef.current === id &&
          itemId === id
        ) {
          configuredFsIdRef.current = id;
          setIsReady(true);
          setError(null);
          console.log(
            `[VFS] Global fs configured successfully for ${id}. Hook is ready.`,
          );
        } else {
          console.log(
            `[VFS] Configuration for ${id} finished, but hook state changed (mounted: ${isMountedRef.current}, target: ${itemId}, configuredFor: ${configuringForIdRef.current}). State not updated for ready.`,
          );
          if (itemId !== id) {
            setIsReady(false);
            configuredFsIdRef.current = null;
          }
        }
      } catch (err) {
        console.error(`[VFS] Configuration failed for ${id}:`, err);
        if (isMountedRef.current && itemId === id) {
          const errorMsg = `Failed to configure filesystem: ${err instanceof Error ? err.message : String(err)}`;
          setError((prev) => (prev === errorMsg ? prev : errorMsg));
          setIsReady(false);
          configuredFsIdRef.current = null;
        }
      } finally {
        if (configuringForIdRef.current === id) {
          setIsLoading(false);
          configuringForIdRef.current = null;
        }
      }
    };

    if (itemId && isEnabled) {
      if (itemId !== configuredFsIdRef.current) {
        configureNewFs(itemId);
      } else {
        if (!isReady) setIsReady(true);
        if (isLoading) setIsLoading(false);
        if (error !== null) setError(null);
        console.log(`[VFS] Already configured for ${itemId}. State ensured.`);
      }
    } else {
      if (isReady) setIsReady(false);
      if (configuredFsIdRef.current !== null) {
        configuredFsIdRef.current = null;
        console.log(
          "[VFS] Cleared configured FS ID and readiness due to disable/unselect.",
        );
      }
      if (isLoading) setIsLoading(false);
      if (isOperationLoading) setIsOperationLoading(false);
      if (error !== null) setError(null);
    }

    return () => {
      isMountedRef.current = false;
      console.log("[VFS] Cleanup effect triggered.");
    };
  }, [itemId, isEnabled, isReady, isLoading, isOperationLoading, error]); // Added state dependencies to ensure consistency check runs

  // --- Internal implementations (original functions renamed) ---
  const checkReadyInternal = useCallback(() => {
    if (!isReady || configuredFsIdRef.current !== itemId) {
      const message =
        "Filesystem is not ready or not configured for the current item.";
      // toast.error(message); // Avoid toast in check, let caller handle
      console.error(
        `[VFS] Operation prevented: ${message} (isReady: ${isReady}, configuredId: ${configuredFsIdRef.current}, expectedId: ${itemId})`,
      );
      throw new Error(message);
    }
    return zenfs_fs;
  }, [isReady, itemId]);

  const listFilesInternal = useCallback(
    async (path: string): Promise<FileSystemEntry[]> => {
      const fs = checkReadyInternal();
      const normalized = normalizePath(path);
      try {
        const entries = await fs.promises.readdir(normalized);
        const stats = await Promise.all(
          entries.map(async (name) => {
            const fullPath = joinPath(normalized, name);
            try {
              const stat = await fs.promises.stat(fullPath);
              return {
                name,
                path: fullPath,
                isDirectory: stat.isDirectory(),
                size: stat.size,
                lastModified: stat.mtime,
              };
            } catch (statErr) {
              console.error(`[VFS] Failed to stat ${fullPath}:`, statErr);
              return null; // Skip files that fail to stat
            }
          }),
        );
        return stats.filter((s): s is FileSystemEntry => s !== null);
      } catch (err) {
        if (err instanceof Error && (err as any).code === "ENOENT") {
          console.warn(`[VFS] Directory not found for listing: ${normalized}`);
          return []; // Return empty array if dir doesn't exist
        }
        console.error(`[VFS] Failed to list directory ${normalized}:`, err);
        toast.error(
          `Error listing files: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err; // Re-throw other errors
      }
    },
    [checkReadyInternal],
  );

  const readFileInternal = useCallback(
    async (path: string): Promise<Uint8Array> => {
      const fs = checkReadyInternal();
      return fs.promises.readFile(normalizePath(path));
    },
    [checkReadyInternal],
  );

  const createDirectoryInternalImpl = useCallback(
    async (path: string): Promise<void> => {
      const fs = checkReadyInternal();
      const normalized = normalizePath(path);
      try {
        await fs.promises.mkdir(normalized, { recursive: true });
      } catch (err) {
        if (err instanceof Error && (err as any).code === "EEXIST") {
          return; // Directory already exists, not an error
        }
        console.error(`[VFS] Failed to create directory ${normalized}:`, err);
        toast.error(
          `Error creating directory: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      }
    },
    [checkReadyInternal],
  );

  const writeFileInternal = useCallback(
    async (path: string, data: Uint8Array | string): Promise<void> => {
      const fs = checkReadyInternal();
      const normalized = normalizePath(path);
      const parentDir = dirname(normalized);
      setIsOperationLoading(true);
      try {
        if (parentDir !== "/") {
          await createDirectoryInternalImpl(parentDir);
        }
        await fs.promises.writeFile(normalized, data);
      } catch (err) {
        console.error(`[VFS] Failed to write file ${normalized}:`, err);
        if (!(err instanceof Error && (err as any).code === "EEXIST")) {
          toast.error(
            `Error writing file: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        throw err;
      } finally {
        setIsOperationLoading(false);
      }
    },
    [checkReadyInternal, createDirectoryInternalImpl],
  );

  const deleteItemInternal = useCallback(
    async (path: string, recursive: boolean = false): Promise<void> => {
      const fs = checkReadyInternal();
      const normalized = normalizePath(path);
      setIsOperationLoading(true);
      try {
        const stat = await fs.promises.stat(normalized);
        if (stat.isDirectory()) {
          await fs.promises.rm(normalized, { recursive });
        } else {
          await fs.promises.unlink(normalized);
        }
      } catch (err) {
        console.error(`[VFS] Failed to delete ${normalized}:`, err);
        toast.error(
          `Error deleting item: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      } finally {
        setIsOperationLoading(false);
      }
    },
    [checkReadyInternal],
  );

  const createDirectoryActual = useCallback(
    async (path: string): Promise<void> => {
      setIsOperationLoading(true);
      try {
        await createDirectoryInternalImpl(path);
      } catch (err) {
        // Error handled in internal impl
      } finally {
        setIsOperationLoading(false);
      }
    },
    [createDirectoryInternalImpl],
  );

  const downloadFileInternal = useCallback(
    async (path: string, filename?: string): Promise<void> => {
      try {
        const data = await readFileInternal(normalizePath(path));
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const normalized = normalizePath(path);
        link.download =
          filename || normalized.substring(normalized.lastIndexOf("/") + 1);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(`[VFS] Failed to download ${path}:`, err);
        if (
          !(
            err instanceof Error &&
            err.message.startsWith("Filesystem is not ready")
          )
        ) {
          toast.error(
            `Error downloading file: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    },
    [readFileInternal],
  );

  const uploadFilesInternal = useCallback(
    async (files: FileList | File[], targetPath: string): Promise<void> => {
      const normalizedTargetPath = normalizePath(targetPath);
      setIsOperationLoading(true);
      let successCount = 0;
      let errorCount = 0;
      try {
        await createDirectoryInternalImpl(normalizedTargetPath);

        const fileArray = Array.from(files);
        for (const file of fileArray) {
          const filePath = joinPath(normalizedTargetPath, file.name);
          try {
            const buffer = await file.arrayBuffer();
            await writeFileInternal(filePath, new Uint8Array(buffer));
            successCount++;
          } catch (err) {
            errorCount++;
            console.error(`[VFS] Failed to upload ${file.name}:`, err);
          }
        }

        if (errorCount > 0) {
          toast.error(
            `Finished uploading. ${successCount} files succeeded, ${errorCount} failed.`,
          );
        } else if (successCount > 0) {
          toast.success(
            `Successfully uploaded ${successCount} file(s) to ${normalizedTargetPath}.`,
          );
        }
      } catch (err) {
        console.error("[VFS] General upload error:", err);
        if (
          !(
            err instanceof Error &&
            (err.message.startsWith("Filesystem is not ready") ||
              (err as any).code === "EEXIST")
          )
        ) {
          toast.error(
            `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } finally {
        setIsOperationLoading(false);
      }
    },
    [createDirectoryInternalImpl, writeFileInternal],
  );

  const uploadAndExtractZipInternal = useCallback(
    async (file: File, targetPath: string): Promise<void> => {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        toast.error("Please select a valid ZIP file.");
        return;
      }
      setIsOperationLoading(true);
      const normalizedTargetPath = normalizePath(targetPath);
      try {
        await createDirectoryInternalImpl(normalizedTargetPath);

        const zip = await JSZip.loadAsync(file);
        const fileWritePromises: Promise<void>[] = [];

        zip.forEach((relativePath, zipEntry) => {
          const fullTargetPath = joinPath(normalizedTargetPath, zipEntry.name);
          if (zipEntry.dir) {
            fileWritePromises.push(createDirectoryInternalImpl(fullTargetPath));
          } else {
            const writePromise = zipEntry
              .async("uint8array")
              .then((content) => {
                return writeFileInternal(fullTargetPath, content);
              });
            fileWritePromises.push(writePromise);
          }
        });

        await Promise.all(fileWritePromises);
        toast.success(
          `Successfully extracted "${file.name}" to ${normalizedTargetPath}.`,
        );
      } catch (err) {
        console.error(`[VFS] Failed to extract zip ${file.name}:`, err);
        if (
          !(
            err instanceof Error &&
            (err.message.startsWith("Filesystem is not ready") ||
              (err as any).code === "EEXIST")
          )
        ) {
          toast.error(
            `ZIP extraction failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        throw err;
      } finally {
        setIsOperationLoading(false);
      }
    },
    [createDirectoryInternalImpl, writeFileInternal],
  );

  const downloadAllAsZipInternal = useCallback(
    async (filename?: string): Promise<void> => {
      setIsOperationLoading(true);
      const zip = new JSZip();
      try {
        checkReadyInternal();

        const addFolderToZip = async (folderPath: string, zipFolder: JSZip) => {
          const entries = await listFilesInternal(folderPath);
          for (const entry of entries) {
            if (entry.isDirectory) {
              const subFolder = zipFolder.folder(entry.name);
              if (subFolder) {
                await addFolderToZip(entry.path, subFolder);
              }
            } else {
              const content = await readFileInternal(entry.path);
              zipFolder.file(entry.name, content);
            }
          }
        };

        await addFolderToZip("/", zip);

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        const defaultFilename = `vfs_export_${configuredFsIdRef.current || "current"}.zip`;
        link.download = filename || defaultFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Filesystem exported as ZIP.");
      } catch (err) {
        console.error("[VFS] Failed to download all as zip:", err);
        if (
          !(
            err instanceof Error &&
            err.message.startsWith("Filesystem is not ready")
          )
        ) {
          toast.error(
            `ZIP export failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        throw err;
      } finally {
        setIsOperationLoading(false);
      }
    },
    [checkReadyInternal, listFilesInternal, readFileInternal],
  );

  const renameInternal = useCallback(
    async (oldPath: string, newPath: string): Promise<void> => {
      const fs = checkReadyInternal();
      const normalizedOld = normalizePath(oldPath);
      const normalizedNew = normalizePath(newPath);
      setIsOperationLoading(true);
      try {
        const parentDir = dirname(normalizedNew);
        if (parentDir !== "/") {
          await createDirectoryInternalImpl(parentDir);
        }
        await fs.promises.rename(normalizedOld, normalizedNew);
      } catch (err) {
        console.error(
          `[VFS] Failed to rename ${normalizedOld} to ${normalizedNew}:`,
          err,
        );
        if (
          !(
            err instanceof Error &&
            (err.message.startsWith("Filesystem is not ready") ||
              (err as any).code === "EEXIST")
          )
        ) {
          toast.error(
            `Rename failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        throw err;
      } finally {
        setIsOperationLoading(false);
      }
    },
    [checkReadyInternal, createDirectoryInternalImpl],
  );

  // --- Return original interface, conditionally calling dummy or internal funcs ---
  return {
    isReady: isReady,
    isLoading: isLoading,
    isOperationLoading: isOperationLoading,
    error: error,
    configuredItemId: configuredFsIdRef.current,
    listFiles: listFilesInternal,
    readFile: readFileInternal,
    writeFile: writeFileInternal,
    deleteItem: deleteItemInternal,
    createDirectory: createDirectoryActual,
    downloadFile: downloadFileInternal,
    uploadFiles: uploadFilesInternal,
    uploadAndExtractZip: uploadAndExtractZipInternal,
    downloadAllAsZip: downloadAllAsZipInternal,
    rename: renameInternal,
  };
}
========
src/context/chat-context.tsx
========
// src/context/chat-context.tsx
import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react";
import type {
  AiProviderConfig,
  ChatContextProps,
  CoreChatContextProps,
  SidebarItemType,
  Message,
  DbConversation,
  DbProject,
  DbApiKey, // Keep DbApiKey
  SidebarItem, // Keep SidebarItem
} from "@/lib/types";
import { ChatContext } from "@/hooks/use-chat-context";
import { CoreChatContext } from "@/context/core-chat-context";
import { useProviderModelSelection } from "@/hooks/use-provider-model-selection";
import { useApiKeysManagement } from "@/hooks/use-api-keys-management";
import { useConversationManagement } from "@/hooks/use-conversation-management";
import { useChatSettings } from "@/hooks/use-chat-settings";
import { useAiInteraction } from "@/hooks/use-ai-interaction";
import { useChatInput } from "@/hooks/use-chat-input";
import { useMessageHandling } from "@/hooks/use-message-handling";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useVirtualFileSystem } from "@/hooks/use-virtual-file-system";
import { toast } from "sonner";

// ... (interfaces and decodeUint8Array remain the same) ...
interface ChatProviderProps {
  children: React.ReactNode;
  providers: AiProviderConfig[];
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  streamingThrottleRate?: number;
}

const decodeUint8Array = (arr: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(arr);
  } catch (e) {
    console.warn("Failed to decode Uint8Array as UTF-8, trying lossy:", e);
    return new TextDecoder("utf-8", { fatal: false }).decode(arr);
  }
};

// Keep EMPTY constants for default values if needed, but don't pass them directly if live data exists
const EMPTY_API_KEYS: DbApiKey[] = [];
const EMPTY_SIDEBAR_ITEMS: SidebarItem[] = [];

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  providers,
  initialProviderId = null,
  initialModelId = null,
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  streamingThrottleRate = 42,
}) => {
  // --- Core State Management ---
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatInput = useChatInput();

  const setError = useCallback((newError: string | null) => {
    setErrorState(newError);
    if (newError) {
      console.error("Chat Error Context:", newError);
    }
  }, []);

  // --- Hook Instantiation ---
  const providerModel = useProviderModelSelection({
    providers,
    initialProviderId,
    initialModelId,
  });
  const storage = useChatStorage(); // Contains live query results

  const apiKeysMgmt = useApiKeysManagement({
    // Pass the LIVE data from storage here
    apiKeys: storage.apiKeys || EMPTY_API_KEYS,
    addDbApiKey: storage.addApiKey,
    deleteDbApiKey: storage.deleteApiKey,
  });

  const stopStreamingCallback = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const handleSelectItem = useCallback(
    (id: string | null, type: SidebarItemType | null) => {
      stopStreamingCallback();
      chatInput.clearSelectedVfsPaths();
      chatInput.clearAttachedFiles();
      setMessages([]);
      setIsLoadingMessages(!!id);
      setErrorState(null);
      // Log selection change
      console.log(
        `[ChatProvider] handleSelectItem called: ID=${id}, Type=${type}`,
      );
    },
    [stopStreamingCallback, chatInput],
  );

  const conversationMgmt = useConversationManagement({
    initialSelectedItemId,
    initialSelectedItemType,
    onSelectItem: handleSelectItem,
    toggleDbVfs: storage.toggleVfsEnabled,
    getProject: storage.getProject,
    getConversation: storage.getConversation,
    getMessagesForConversation: storage.getMessagesForConversation,
    bulkAddMessages: storage.bulkAddMessages,
    updateConversationTimestamp: storage.updateConversationTimestamp,
    countChildProjects: storage.countChildProjects,
    countChildConversations: storage.countChildConversations,
  });

  // --- Derive active data directly from storage based on selection ---
  // FIX 1: Correct dependencies and lookup logic for activeItemData
  const activeItemData = useMemo(() => {
    const { selectedItemId, selectedItemType } = conversationMgmt;
    console.log(
      `[ChatProvider] Recalculating activeItemData for ID: ${selectedItemId}, Type: ${selectedItemType}`,
    );
    if (!selectedItemId || !selectedItemType) return null;

    // Perform lookup inside the memo using the latest storage values
    if (selectedItemType === "conversation") {
      // Use the live array from storage directly inside the memo
      return storage.conversations.find((c) => c.id === selectedItemId) || null;
    } else if (selectedItemType === "project") {
      // Use the live array from storage directly inside the memo
      return storage.projects.find((p) => p.id === selectedItemId) || null;
    }
    return null;
    // Depend ONLY on the stable ID and Type from conversationMgmt state
  }, [conversationMgmt, storage.conversations, storage.projects]); // Keep storage arrays here because the *lookup* needs the latest data

  const activeConversationData = useMemo(() => {
    return conversationMgmt.selectedItemType === "conversation"
      ? (activeItemData as DbConversation | null)
      : null;
  }, [conversationMgmt.selectedItemType, activeItemData]);

  const activeProjectData = useMemo(() => {
    return conversationMgmt.selectedItemType === "project"
      ? (activeItemData as DbProject | null)
      : null;
  }, [conversationMgmt.selectedItemType, activeItemData]);
  // --- End Derive active data ---

  const chatSettings = useChatSettings({
    activeConversationData: activeConversationData,
    activeProjectData: activeProjectData,
  });

  // --- VFS (remains disabled) ---
  const vfsEnabled = useMemo(() => false, []);
  const vfs = useVirtualFileSystem({
    itemId: conversationMgmt.selectedItemId,
    itemType: conversationMgmt.selectedItemType,
    isEnabled: vfsEnabled,
  });
  useEffect(() => {
    if (!vfsEnabled && chatInput.selectedVfsPaths.length > 0) {
      chatInput.clearSelectedVfsPaths();
    }
  }, [vfsEnabled, chatInput]);
  // --- End VFS ---

  // --- AI Interaction & Message Handling ---
  const aiInteraction = useAiInteraction({
    selectedModel: providerModel.selectedModel,
    selectedProvider: providerModel.selectedProvider,
    getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
    streamingThrottleRate,
    setLocalMessages: setMessages,
    setIsAiStreaming: setIsStreaming,
    setError,
    addDbMessage: storage.addDbMessage,
    abortControllerRef,
  });

  const messageHandling = useMessageHandling({
    selectedConversationId:
      conversationMgmt.selectedItemType === "conversation"
        ? conversationMgmt.selectedItemId
        : null,
    performAiStream: aiInteraction.performAiStream,
    stopStreamingCallback,
    activeSystemPrompt: chatSettings.activeSystemPrompt,
    temperature: chatSettings.temperature,
    maxTokens: chatSettings.maxTokens,
    topP: chatSettings.topP,
    topK: chatSettings.topK,
    presencePenalty: chatSettings.presencePenalty,
    frequencyPenalty: chatSettings.frequencyPenalty,
    isAiStreaming: isStreaming,
    setIsAiStreaming: setIsStreaming,
    localMessages: messages,
    setLocalMessages: setMessages,
    isLoadingMessages: isLoadingMessages,
    setIsLoadingMessages: setIsLoadingMessages,
    error: error,
    setError,
    addDbMessage: storage.addDbMessage,
    deleteDbMessage: storage.deleteDbMessage,
    getMessagesForConversation: storage.getMessagesForConversation,
  });

  // --- Top-Level Handlers ---
  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      const currentPrompt = chatInput.prompt.trim();
      const canSubmit =
        currentPrompt.length > 0 || chatInput.attachedFiles.length > 0;

      if (!canSubmit) return;
      if (isStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      if (!providerModel.selectedProvider || !providerModel.selectedModel) {
        setError("Error: Please select an AI Provider and Model first.");
        toast.error("Please select an AI Provider and Model.");
        return;
      }

      let conversationIdToSubmit: string | null = null;
      let parentProjectId: string | null = null;

      // Determine parent and target conversation ID based on current selection
      if (
        conversationMgmt.selectedItemType === "project" &&
        conversationMgmt.selectedItemId
      ) {
        parentProjectId = conversationMgmt.selectedItemId;
      } else if (
        conversationMgmt.selectedItemType === "conversation" &&
        conversationMgmt.selectedItemId
      ) {
        // Use the memoized activeConversationData to find parentId
        parentProjectId = activeConversationData?.parentId ?? null;
        conversationIdToSubmit = conversationMgmt.selectedItemId;
      }

      // If no conversation is selected (e.g., a project is selected, or nothing is), create one
      if (!conversationIdToSubmit) {
        try {
          const title = currentPrompt.substring(0, 50) || "New Chat";
          // Create conversation, potentially under the selected project (parentProjectId)
          const newConvId = await conversationMgmt.createConversation(
            parentProjectId,
            title,
          );
          if (!newConvId)
            throw new Error("Failed to get ID for new conversation.");
          conversationIdToSubmit = newConvId;
          // Note: createConversation already selects the new item, triggering message load
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          setError(`Error: Could not start chat - ${message}`);
          toast.error(`Failed to start chat: ${message}`);
          return;
        }
      }

      if (!conversationIdToSubmit) {
        setError("Error: Could not determine target conversation for submit.");
        toast.error("Could not determine target conversation.");
        return;
      }

      // --- VFS/Upload Handling (remains disabled for now) ---
      let uploadInfo = "";
      if (chatInput.attachedFiles.length > 0) {
        toast.warning("File attaching is temporarily disabled for debugging.");
        uploadInfo = `
          [File attaching disabled]`;
        chatInput.clearAttachedFiles();
      }
      const pathsIncludedInContext: string[] = [];
      if (chatInput.selectedVfsPaths.length > 0) {
        toast.warning("VFS context is temporarily disabled for debugging.");
        chatInput.clearSelectedVfsPaths();
      }
      // --- End VFS/Upload Handling ---

      const originalUserPrompt = currentPrompt;
      const promptToSendToAI = originalUserPrompt + uploadInfo;

      chatInput.setPrompt(""); // Clear input immediately

      // Only proceed if there's actual text content to send
      if (promptToSendToAI.trim().length > 0) {
        await messageHandling.handleSubmitCore(
          originalUserPrompt,
          conversationIdToSubmit,
          promptToSendToAI,
          pathsIncludedInContext,
        );
      } else {
        console.log(
          "Submission skipped: empty prompt after processing VFS/uploads.",
        );
        // If only files were attached (and uploads worked), we might still want
        // to add a user message indicating files were sent, even if text prompt is empty.
        // For now, it skips if the text part is empty.
      }
    },
    [
      chatInput,
      isStreaming,
      providerModel.selectedProvider,
      providerModel.selectedModel,
      conversationMgmt, // Includes selectedItemId/Type and createConversation
      activeConversationData, // Memoized derived state for parentId lookup
      setError,
      messageHandling,
    ],
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (
        conversationMgmt.selectedItemType !== "conversation" ||
        !conversationMgmt.selectedItemId
      ) {
        toast.error("Please select the conversation containing the message.");
        return;
      }
      if (isStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      await messageHandling.regenerateMessageCore(messageId);
    },
    [
      messageHandling,
      conversationMgmt.selectedItemType,
      conversationMgmt.selectedItemId,
      isStreaming,
    ],
  );

  const stopStreaming = useCallback(() => {
    messageHandling.stopStreamingCore();
    toast.info("AI response stopped.");
  }, [messageHandling]);

  const handleImportConversation = useCallback(
    async (file: File) => {
      let parentId: string | null = null;
      if (
        conversationMgmt.selectedItemType === "project" &&
        conversationMgmt.selectedItemId
      ) {
        parentId = conversationMgmt.selectedItemId;
      } else if (
        conversationMgmt.selectedItemType === "conversation" &&
        conversationMgmt.selectedItemId
      ) {
        parentId = activeConversationData?.parentId ?? null;
      }
      await conversationMgmt.importConversation(file, parentId);
    },
    [conversationMgmt, activeConversationData],
  );

  // --- Context Value Construction ---
  const coreContextValue: CoreChatContextProps = useMemo(
    () => ({
      messages,
      setMessages,
      isLoadingMessages,
      setIsLoadingMessages,
      isStreaming,
      setIsStreaming,
      error,
      setError,
      prompt: chatInput.prompt,
      setPrompt: chatInput.setPrompt,
      handleSubmitCore: messageHandling.handleSubmitCore,
      stopStreamingCore: messageHandling.stopStreamingCore,
      regenerateMessageCore: messageHandling.regenerateMessageCore,
      abortControllerRef,
    }),
    [
      messages,
      isLoadingMessages,
      isStreaming,
      error,
      setError,
      chatInput.prompt,
      chatInput.setPrompt,
      messageHandling.handleSubmitCore,
      messageHandling.stopStreamingCore,
      messageHandling.regenerateMessageCore,
    ],
  );

  const fullContextValue: ChatContextProps = useMemo(
    () => ({
      providers,
      selectedProviderId: providerModel.selectedProviderId,
      setSelectedProviderId: providerModel.setSelectedProviderId,
      selectedModelId: providerModel.selectedModelId,
      setSelectedModelId: providerModel.setSelectedModelId,
      // FIX 2: Provide live data, not static empty arrays
      apiKeys: storage.apiKeys || EMPTY_API_KEYS,
      sidebarItems: conversationMgmt.sidebarItems || EMPTY_SIDEBAR_ITEMS,
      selectedApiKeyId: apiKeysMgmt.selectedApiKeyId,
      setSelectedApiKeyId: apiKeysMgmt.setSelectedApiKeyId,
      addApiKey: apiKeysMgmt.addApiKey,
      deleteApiKey: apiKeysMgmt.deleteApiKey,
      getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
      selectedItemId: conversationMgmt.selectedItemId,
      selectedItemType: conversationMgmt.selectedItemType,
      selectItem: conversationMgmt.selectItem,
      createConversation: conversationMgmt.createConversation,
      createProject: conversationMgmt.createProject,
      deleteItem: conversationMgmt.deleteItem,
      renameItem: conversationMgmt.renameItem,
      updateConversationSystemPrompt:
        conversationMgmt.updateConversationSystemPrompt,
      messages: coreContextValue.messages,
      isLoading: coreContextValue.isLoadingMessages, // Use isLoadingMessages alias
      isStreaming: coreContextValue.isStreaming,
      error: coreContextValue.error,
      setError: coreContextValue.setError,
      prompt: coreContextValue.prompt,
      setPrompt: coreContextValue.setPrompt,
      handleSubmit,
      stopStreaming,
      regenerateMessage,
      attachedFiles: chatInput.attachedFiles,
      addAttachedFile: chatInput.addAttachedFile,
      removeAttachedFile: chatInput.removeAttachedFile,
      clearAttachedFiles: chatInput.clearAttachedFiles,
      selectedVfsPaths: chatInput.selectedVfsPaths,
      addSelectedVfsPath: chatInput.addSelectedVfsPath,
      removeSelectedVfsPath: chatInput.removeSelectedVfsPath,
      clearSelectedVfsPaths: chatInput.clearSelectedVfsPaths,
      temperature: chatSettings.temperature,
      setTemperature: chatSettings.setTemperature,
      maxTokens: chatSettings.maxTokens,
      setMaxTokens: chatSettings.setMaxTokens,
      globalSystemPrompt: chatSettings.globalSystemPrompt,
      setGlobalSystemPrompt: chatSettings.setGlobalSystemPrompt,
      activeSystemPrompt: chatSettings.activeSystemPrompt,
      topP: chatSettings.topP,
      setTopP: chatSettings.setTopP,
      topK: chatSettings.topK,
      setTopK: chatSettings.setTopK,
      presencePenalty: chatSettings.presencePenalty,
      setPresencePenalty: chatSettings.setPresencePenalty,
      frequencyPenalty: chatSettings.frequencyPenalty,
      setFrequencyPenalty: chatSettings.setFrequencyPenalty,
      theme: chatSettings.theme,
      setTheme: chatSettings.setTheme,
      streamingThrottleRate,
      searchTerm: chatSettings.searchTerm,
      setSearchTerm: chatSettings.setSearchTerm,
      exportConversation: conversationMgmt.exportConversation,
      importConversation: handleImportConversation,
      exportAllConversations: conversationMgmt.exportAllConversations,
      clearAllData: storage.clearAllData,
      vfsEnabled: false, // Keep disabled
      toggleVfsEnabled: conversationMgmt.toggleVfsEnabled,
      vfs: {
        // Dummy VFS object
        isReady: false,
        configuredItemId: null,
        isLoading: false,
        isOperationLoading: false,
        error: "VFS Disabled for Debug",
        listFiles: async () => [],
        readFile: async () => {
          throw new Error("VFS Disabled");
        },
        writeFile: async () => {
          throw new Error("VFS Disabled");
        },
        deleteItem: async () => {
          throw new Error("VFS Disabled");
        },
        createDirectory: async () => {
          throw new Error("VFS Disabled");
        },
        downloadFile: async () => {
          throw new Error("VFS Disabled");
        },
        uploadFiles: async () => {
          throw new Error("VFS Disabled");
        },
        uploadAndExtractZip: async () => {
          throw new Error("VFS Disabled");
        },
        downloadAllAsZip: async () => {
          throw new Error("VFS Disabled");
        },
        rename: async () => {
          throw new Error("VFS Disabled");
        },
      },
      getConversation: storage.getConversation,
      getProject: storage.getProject,
    }),
    [
      // Dependencies (ensure stability where possible)
      providers,
      providerModel.selectedProviderId,
      providerModel.setSelectedProviderId,
      providerModel.selectedModelId,
      providerModel.setSelectedModelId,
      storage.apiKeys, // Live data
      conversationMgmt.sidebarItems, // Live data
      apiKeysMgmt.selectedApiKeyId,
      apiKeysMgmt.setSelectedApiKeyId,
      apiKeysMgmt.addApiKey,
      apiKeysMgmt.deleteApiKey,
      apiKeysMgmt.getApiKeyForProvider,
      conversationMgmt.selectedItemId,
      conversationMgmt.selectedItemType,
      conversationMgmt.selectItem,
      conversationMgmt.createConversation,
      conversationMgmt.createProject,
      conversationMgmt.deleteItem,
      conversationMgmt.renameItem,
      conversationMgmt.updateConversationSystemPrompt,
      conversationMgmt.exportConversation,
      conversationMgmt.exportAllConversations,
      conversationMgmt.toggleVfsEnabled,
      coreContextValue, // Memoized core state
      handleSubmit, // useCallback
      stopStreaming, // useCallback
      regenerateMessage, // useCallback
      handleImportConversation, // useCallback
      chatInput, // Memoized input state
      chatSettings, // Memoized settings state
      streamingThrottleRate,
      storage.clearAllData, // useCallback from storage
      storage.getConversation, // useCallback from storage
      storage.getProject, // useCallback from storage
    ],
  );

  // Log when messages state changes
  useEffect(() => {
    console.log("[ChatProvider] Messages state updated:", messages);
  }, [messages]);

  // Log when loading state changes
  useEffect(() => {
    console.log(
      "[ChatProvider] isLoadingMessages state updated:",
      isLoadingMessages,
    );
  }, [isLoadingMessages]);

  return (
    <CoreChatContext.Provider value={coreContextValue}>
      <ChatContext.Provider value={fullContextValue}>
        {children}
      </ChatContext.Provider>
    </CoreChatContext.Provider>
  );
};
========
src/context/core-chat-context.ts
========
import { createContext, useContext } from "react";
import type { CoreChatContextProps } from "@/lib/types";

export const CoreChatContext = createContext<CoreChatContextProps | undefined>(
  undefined,
);

export const useCoreChatContext = (): CoreChatContextProps => {
  const context = useContext(CoreChatContext);
  if (context === undefined) {
    throw new Error(
      "useCoreChatContext must be used within a CoreChatProvider (implicitly via ChatProvider)",
    );
  }
  return context;
};
========
src/lib/db.ts
========
// src/lib/db.ts
import Dexie, { type Table } from "dexie";
import type { DbConversation, DbMessage, DbApiKey, DbProject } from "./types"; // Import DbProject

export class ChatDatabase extends Dexie {
  projects!: Table<DbProject, string>; // Add projects table
  conversations!: Table<DbConversation, string>;
  messages!: Table<DbMessage, string>;
  apiKeys!: Table<DbApiKey, string>;

  constructor() {
    super("LiteChatDatabase");
    // Bump version number when schema changes
    this.version(4).stores({
      // Added projects table with index on parentId
      projects: "++id, name, parentId, createdAt, updatedAt",
      // Added parentId index to conversations
      conversations: "id, parentId, createdAt, updatedAt",
      // Added vfsContextPaths to messages (Dexie handles optional fields)
      messages: "id, conversationId, createdAt, vfsContextPaths",
      apiKeys: "id, name, providerId, createdAt",
    });
    // Define previous versions for migration
    this.version(3).stores({
      projects: "++id, name, parentId, createdAt, updatedAt",
      conversations: "id, parentId, createdAt, updatedAt",
      messages: "id, conversationId, createdAt", // Old messages schema
      apiKeys: "id, name, providerId, createdAt",
    });
    this.version(2).stores({
      conversations: "id, createdAt, updatedAt", // Older schema
      messages: "id, conversationId, createdAt",
      apiKeys: "id, name, providerId, createdAt",
    });
    // No upgrade function needed for adding an optional field like vfsContextPaths
  }
}

export const db = new ChatDatabase();
========
src/lib/throttle.ts
========
// Simple throttle function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let lastFunc: NodeJS.Timeout | undefined;
  let lastRan: number | undefined;
  return function (...args: Parameters<T>) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const context = this;
    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      if (lastFunc) clearTimeout(lastFunc);
      lastFunc = setTimeout(
        () => {
          if (Date.now() - (lastRan ?? 0) >= limit) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        },
        limit - (Date.now() - (lastRan ?? 0)),
      );
    }
  };
}
========
src/lib/types.ts
========
// src/lib/types.ts

import type { CoreMessage } from "ai";
// Removed FileSystem import as it's not directly used in context types

// --- Basic Types ---
export type Role = "user" | "assistant" | "system";
export type SidebarItemType = "conversation" | "project";

// --- Database Schemas ---
export interface DbBase {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbProject extends DbBase {
  name: string;
  parentId: string | null;
  vfsEnabled: boolean;
}

export interface DbConversation extends DbBase {
  title: string;
  systemPrompt: string | null;
  parentId: string | null;
  vfsEnabled: boolean;
}

export interface DbMessage extends Pick<DbBase, "id" | "createdAt"> {
  conversationId: string;
  role: Role;
  content: string;
  vfsContextPaths?: string[];
}

export interface DbApiKey extends Pick<DbBase, "id" | "createdAt"> {
  name: string;
  providerId: string;
  value: string;
}

// --- UI & State Types ---
export interface Message extends CoreMessage {
  id?: string;
  conversationId?: string;
  createdAt?: Date;
  isStreaming?: boolean;
  streamedContent?: string;
  error?: string | null;
  vfsContextPaths?: string[];
}

export interface SidebarItemBase extends DbBase {
  type: SidebarItemType;
}
export interface ProjectSidebarItem extends DbProject, SidebarItemBase {
  type: "project";
}
export interface ConversationSidebarItem
  extends DbConversation,
    SidebarItemBase {
  type: "conversation";
}
export type SidebarItem = ProjectSidebarItem | ConversationSidebarItem;

// --- AI Configuration ---
export interface AiModelConfig {
  id: string;
  name: string;
  instance: any;
  contextWindow?: number;
}

export interface AiProviderConfig {
  id: string;
  name: string;
  models: AiModelConfig[];
  requiresApiKey?: boolean;
}

// --- Virtual File System ---
export interface FileSystemEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: Date;
}

// --- Chat Context ---

// Core Context Definition
export interface CoreChatContextProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoadingMessages: boolean;
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>;
  isStreaming: boolean;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: (error: string | null) => void;
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  handleSubmitCore: (
    originalUserPrompt: string,
    currentConversationId: string,
    promptToSendToAI: string,
    vfsContextPaths?: string[],
  ) => Promise<void>;
  stopStreamingCore: () => void;
  regenerateMessageCore: (messageId: string) => Promise<void>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

// VFS object within the context
interface VfsContextObject {
  isReady: boolean;
  configuredItemId: string | null;
  isLoading: boolean;
  isOperationLoading: boolean;
  error: string | null;
  listFiles: (path: string) => Promise<FileSystemEntry[]>;
  readFile: (path: string) => Promise<Uint8Array>;
  writeFile: (path: string, data: Uint8Array | string) => Promise<void>;
  deleteItem: (path: string, recursive?: boolean) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  downloadFile: (path: string, filename?: string) => Promise<void>;
  uploadFiles: (files: FileList | File[], targetPath: string) => Promise<void>;
  uploadAndExtractZip: (file: File, targetPath: string) => Promise<void>;
  downloadAllAsZip: (filename?: string) => Promise<void>;
  rename: (oldPath: string, newPath: string) => Promise<void>;
}

// Full Context (Superset including Core + Optional Modules)
export interface ChatContextProps {
  // Provider/Model Selection
  providers: AiProviderConfig[];
  selectedProviderId: string | null;
  setSelectedProviderId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedModelId: string | null;
  setSelectedModelId: React.Dispatch<React.SetStateAction<string | null>>;

  // API Key Management
  apiKeys: DbApiKey[];
  selectedApiKeyId: Record<string, string | null>;
  setSelectedApiKeyId: (providerId: string, keyId: string | null) => void;
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  getApiKeyForProvider: (providerId: string) => string | undefined;

  // Sidebar / Item Management
  sidebarItems: SidebarItem[];
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  createProject: (
    parentId: string | null,
    name?: string,
  ) => Promise<{ id: string; name: string }>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  renameItem: (
    id: string,
    newName: string,
    type: SidebarItemType,
  ) => Promise<void>;
  updateConversationSystemPrompt: (
    id: string,
    systemPrompt: string | null,
  ) => Promise<void>;
  // activeConversationData: DbConversation | null;
  // activeProjectData: DbProject | null;

  // Messages & Streaming (Core)
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  setError: (error: string | null) => void;

  // Input Handling (Core + Optional)
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  handleSubmit: (e?: React.FormEvent<HTMLFormElement>) => Promise<void>;
  stopStreaming: () => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  attachedFiles: File[];
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearAttachedFiles: () => void;
  selectedVfsPaths: string[];
  addSelectedVfsPath: (path: string) => void;
  removeSelectedVfsPath: (path: string) => void;
  clearSelectedVfsPaths: () => void;

  // Settings
  temperature: number;
  setTemperature: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number | null;
  setMaxTokens: React.Dispatch<React.SetStateAction<number | null>>;
  globalSystemPrompt: string;
  setGlobalSystemPrompt: React.Dispatch<React.SetStateAction<string>>;
  activeSystemPrompt: string | null; // Keep derived prompt
  topP: number | null;
  setTopP: React.Dispatch<React.SetStateAction<number | null>>;
  topK: number | null;
  setTopK: React.Dispatch<React.SetStateAction<number | null>>;
  presencePenalty: number | null;
  setPresencePenalty: React.Dispatch<React.SetStateAction<number | null>>;
  frequencyPenalty: number | null;
  setFrequencyPenalty: React.Dispatch<React.SetStateAction<number | null>>;
  theme: "light" | "dark" | "system";
  setTheme: React.Dispatch<React.SetStateAction<"light" | "dark" | "system">>;
  streamingThrottleRate: number;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;

  // Import/Export & Data Management
  exportConversation: (conversationId: string | null) => Promise<void>;
  importConversation: (file: File) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  clearAllData: () => Promise<void>;

  // Virtual File System
  vfsEnabled: boolean;
  toggleVfsEnabled: () => Promise<void>;
  vfs: VfsContextObject;

  // Pass required DB functions
  getConversation: (id: string) => Promise<DbConversation | undefined>;
  getProject: (id: string) => Promise<DbProject | undefined>;
}
========
src/lib/utils.ts
========
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
========
src/components/lite-chat/chat.tsx
========
// src/components/lite-chat/chat.tsx
import React, { useState } from "react";
import { ChatProvider } from "@/context/chat-context";
import { ChatSide } from "./chat-side";
import { ChatWrapper } from "./chat-wrapper";
import type { AiProviderConfig, SidebarItemType } from "@/lib/types"; // Import SidebarItemType
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Export sub-components for composability
// ... (keep existing exports) ...
export { ChatContent } from "./chat-content";
export { ChatHistory } from "./chat-history";
export { ChatSide } from "./chat-side";
export { ChatWrapper } from "./chat-wrapper";
export { MessageActions } from "./message-actions";
export { MemoizedMessageBubble as MessageBubble } from "./message-bubble";
export { ModelSelector } from "./model-selector";
export { PromptActions } from "./prompt-actions";
export { PromptFiles } from "./prompt-files";
export { PromptForm } from "./prompt-form";
export { PromptInput } from "./prompt-input";
export { PromptSettings } from "./prompt-settings";
export { PromptWrapper } from "./prompt-wrapper";
export { ProviderSelector } from "./provider-selector";
export { SettingsModal } from "./settings-modal";
export { useChatContext } from "@/hooks/use-chat-context";
export { ChatProvider } from "@/context/chat-context";
export type {
  AiProviderConfig,
  AiModelConfig,
  Message,
  DbProject, // Export DbProject if needed by consumers
  DbConversation, // Export DbConversation if needed by consumers
  SidebarItem, // Export SidebarItem if needed by consumers
  SidebarItemType, // Export SidebarItemType if needed by consumers
} from "@/lib/types";

interface LiteChatProps {
  providers: AiProviderConfig[];
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null; // Renamed from initialConversationId
  initialSelectedItemType?: SidebarItemType | null; // Added
  streamingThrottleRate?: number;
  className?: string;
  defaultSidebarOpen?: boolean;
  SideComponent?: React.ComponentType<{ className?: string }>;
  WrapperComponent?: React.ComponentType<{ className?: string }>;
}

export const LiteChat: React.FC<LiteChatProps> = ({
  providers,
  initialProviderId,
  initialModelId,
  initialSelectedItemId, // Use new prop
  initialSelectedItemType, // Use new prop
  streamingThrottleRate,
  className,
  defaultSidebarOpen = true,
  SideComponent = ChatSide,
  WrapperComponent = ChatWrapper,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);

  return (
    <ChatProvider
      providers={providers}
      initialProviderId={initialProviderId}
      initialModelId={initialModelId}
      initialSelectedItemId={initialSelectedItemId} // Pass new prop
      initialSelectedItemType={initialSelectedItemType} // Pass new prop
      streamingThrottleRate={streamingThrottleRate}
    >
      <div
        className={cn(
          "flex h-full w-full overflow-hidden bg-gray-900 border border-gray-700 rounded-lg shadow-sm",
          className,
        )}
      >
        {/* Sidebar */}
        {sidebarOpen && (
          <SideComponent
            className={cn(
              "w-72 flex-shrink-0",
              "hidden md:flex", // Standard responsive behavior
            )}
          />
        )}

        {/* Mobile Sidebar (Drawer - Example, requires extra implementation) */}
        {/* {sidebarOpen && (
          <div className="md:hidden fixed inset-0 bg-black/50 z-40">
             <SideComponent className="w-72 h-full absolute left-0 top-0 z-50" />
          </div>
        )} */}

        {/* Main Chat Area Wrapper */}
        <div className="flex-grow flex flex-col relative w-full min-w-0">
          {/* Sidebar Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute top-3 left-3 z-10 text-gray-400 hover:text-white hover:bg-gray-700 md:hidden", // Only show on small screens
            )}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? (
              <XIcon className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </Button>

          {/* Render the main chat content */}
          <WrapperComponent className="h-full" />
        </div>
      </div>
    </ChatProvider>
  );
};
========
src/components/lite-chat/chat-side.tsx
========
// src/components/lite-chat/chat-side.tsx
import React, { useState, useRef } from "react";
import { ChatHistory } from "./chat-history"; // Will be updated next
import { SettingsModal } from "./settings-modal";
import { Button } from "@/components/ui/button";
import {
  SettingsIcon,
  PlusIcon,
  FolderPlusIcon,
  DownloadIcon,
} from "lucide-react"; // Add FolderPlusIcon
import { cn } from "@/lib/utils";
// Removed Upload/Download icons if handled elsewhere (like history items)
import { useChatContext } from "@/hooks/use-chat-context";
import { toast } from "sonner"; // Import toast

interface ChatSideProps {
  className?: string;
}

export const ChatSide: React.FC<ChatSideProps> = ({ className }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const {
    // selectItem, // No longer needed directly here
    createConversation,
    createProject, // Use createProject
    selectedItemId,
    selectedItemType,
    importConversation, // Get import function from context
  } = useChatContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State to track which new project should start in edit mode
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const handleCreateChat = async () => {
    // Determine parentId based on current selection
    let parentId: string | null = null;
    if (selectedItemType === "project") {
      parentId = selectedItemId;
    } else if (selectedItemType === "conversation") {
      // If a chat is selected, find its parent project ID
      // This requires access to the full item data, maybe context needs to provide it?
      // Or, simpler: just create at root if a chat is selected.
      // Let's go with the simpler approach for now.
      parentId = null; // Create at root if a chat is selected
      console.log("Creating chat at root because a conversation was selected.");
    }
    // createConversation now selects the new chat automatically
    await createConversation(parentId);
  };

  const handleCreateProject = async () => {
    // Determine parentId based on current selection
    let parentId: string | null = null;
    if (selectedItemType === "project") {
      parentId = selectedItemId;
    } else if (selectedItemType === "conversation") {
      // Create at root if a chat is selected (consistent with handleCreateChat)
      parentId = null;
      console.log(
        "Creating project at root because a conversation was selected.",
      );
    }
    try {
      const { id: newProjectId } = await createProject(parentId);
      // Set the ID of the project that should start editing
      setEditingProjectId(newProjectId);
      // We don't select it here, ChatHistory will handle focus/edit state
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project.");
    }
  };

  // Callback for ChatHistory to clear the editing state flag
  const onEditComplete = (id: string) => {
    if (editingProjectId === id) {
      setEditingProjectId(null);
    }
  };

  // --- Import Handling ---
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Use the context's importConversation (which handles parentId logic)
      importConversation(file);
    }
    // Reset file input value so the same file can be selected again
    if (event.target) {
      event.target.value = "";
    }
  };

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-gray-800 border-r border-gray-700",
        className,
      )}
    >
      {/* Action Buttons */}
      <div className="p-3 border-b border-gray-700 flex gap-2">
        <Button
          variant="outline"
          className="flex-1 justify-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white h-9"
          onClick={handleCreateChat}
          title="New Chat"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Chat</span>
        </Button>
        <Button
          variant="outline"
          className="flex-1 justify-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white h-9"
          onClick={handleCreateProject}
          title="New Project"
        >
          <FolderPlusIcon className="h-4 w-4" />
          <span>Project</span>
        </Button>
      </div>

      {/* History Area */}
      <div className="flex-grow overflow-hidden flex flex-col">
        {/* Pass editingProjectId and callback to ChatHistory */}
        <ChatHistory
          className="flex-grow"
          editingItemId={editingProjectId}
          onEditComplete={onEditComplete}
        />
      </div>

      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        style={{ display: "none" }}
      />

      {/* Settings & Import Buttons */}
      <div className="border-t border-gray-700 p-3 space-y-2 bg-gray-800">
        {/* Add Import Button Here */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm h-9 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
          onClick={handleImportClick}
        >
          {/* You might want an UploadIcon here */}
          <DownloadIcon className="h-4 w-4 transform rotate-180" />{" "}
          {/* Simple upload visual */}
          Import Chat (.json)
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm h-9 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
          onClick={() => setIsSettingsOpen(true)}
        >
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </aside>
  );
};
========
src/components/lite-chat/chat-history.tsx
========
// src/components/lite-chat/chat-history.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DownloadIcon,
  Trash2Icon,
  EditIcon,
  FolderIcon,
  MessageSquareIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SidebarItem } from "@/lib/types";
import { toast } from "sonner";

// --- History Item Component ---
interface HistoryItemProps {
  item: SidebarItem;
  isSelected: boolean;
  startInEditMode: boolean;
  onEditComplete: (id: string) => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
  item,
  isSelected,
  startInEditMode,
  onEditComplete,
}) => {
  const {
    selectItem,
    deleteItem,
    renameItem,
    exportConversation, // Keep for conversations
  } = useChatContext();

  const [isEditing, setIsEditing] = useState(startInEditMode); // Initialize directly
  const currentItemName = item.type === "project" ? item.name : item.title;
  const [editedName, setEditedName] = useState(currentItemName);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameBeforeEdit = useRef(currentItemName);

  useEffect(() => {
    if (!isEditing) {
      const newName = item.type === "project" ? item.name : item.title;
      setEditedName(newName);
      nameBeforeEdit.current = newName;
    }
  }, [item, isEditing]);

  useEffect(() => {
    if (startInEditMode) {
      setIsEditing(true);
      nameBeforeEdit.current = item.type === "project" ? item.name : item.title;
      setEditedName(nameBeforeEdit.current);
    }
  }, [startInEditMode, item]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(async () => {
    const trimmedName = editedName.trim();
    if (trimmedName && trimmedName !== nameBeforeEdit.current) {
      console.log(
        `HistoryItem: Attempting rename for ${item.type} ${item.id} from "${nameBeforeEdit.current}" to "${trimmedName}"`,
      );
      try {
        await renameItem(item.id, trimmedName, item.type);
        toast.success(
          `${item.type === "project" ? "Project" : "Chat"} renamed.`,
        );
        setIsEditing(false);
        onEditComplete(item.id);
      } catch (error) {
        console.error("HistoryItem: Rename failed", error);
        setEditedName(nameBeforeEdit.current);
        toast.error(`Failed to rename ${item.type}.`);
        setIsEditing(false);
        onEditComplete(item.id);
      }
    } else if (!trimmedName) {
      toast.error("Name cannot be empty.");
    } else {
      console.log(
        `HistoryItem: Rename skipped for ${item.id} (no change or only whitespace)`,
      );
      setIsEditing(false);
      onEditComplete(item.id);
    }
  }, [editedName, item.id, item.type, renameItem, onEditComplete]);

  const handleCancel = useCallback(() => {
    setEditedName(nameBeforeEdit.current);
    setIsEditing(false);
    onEditComplete(item.id);
  }, [onEditComplete, item.id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const handleExportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === "conversation") {
      exportConversation(item.id);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const name = item.type === "project" ? item.name : item.title;
    const confirmationMessage =
      item.type === "project"
        ? `Delete project "${name}"? This cannot be undone.` // Simplified message for now
        : `Delete chat "${name}" and all its messages? This cannot be undone.`;
    if (window.confirm(confirmationMessage)) {
      deleteItem(item.id, item.type);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    nameBeforeEdit.current = item.type === "project" ? item.name : item.title;
    setEditedName(nameBeforeEdit.current);
    setIsEditing(true);
  };

  const handleClick = () => {
    if (!isEditing) {
      selectItem(item.id, item.type);
    }
  };

  const Icon = item.type === "project" ? FolderIcon : MessageSquareIcon;
  const displayName = item.type === "project" ? item.name : item.title;
  const indentLevel = item.parentId ? 1 : 0; // Basic indent for now

  return (
    <div
      className={cn(
        "flex items-center justify-between p-2 rounded-md cursor-pointer group text-sm",
        "hover:bg-gray-700",
        isSelected && !isEditing && "bg-gray-600 text-white",
        isEditing && "bg-gray-700 ring-1 ring-blue-600",
      )}
      style={{ paddingLeft: `${0.5 + indentLevel * 1}rem` }}
      onClick={handleClick}
      title={displayName}
    >
      <Icon className="h-4 w-4 mr-2 flex-shrink-0 text-gray-400" />

      {isEditing ? (
        <Input
          ref={inputRef}
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-grow h-6 px-1 py-0 text-sm bg-gray-800 border-gray-600 focus:ring-1 focus:ring-blue-500"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="truncate flex-grow pr-2">{displayName}</span>
      )}

      <div
        className={cn(
          "flex items-center gap-0.5 flex-shrink-0",
          isEditing
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 transition-opacity",
        )}
      >
        {isEditing ? (
          <>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-green-500 hover:text-green-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSave();
                    }}
                    aria-label="Save name"
                  >
                    <CheckIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Save (Enter)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-gray-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancel();
                    }}
                    aria-label="Cancel edit"
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Cancel (Esc)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        ) : (
          <>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-white"
                    onClick={handleEditClick}
                    aria-label="Rename"
                  >
                    <EditIcon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Rename</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {item.type === "conversation" && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400 hover:text-white"
                      onClick={handleExportClick}
                      aria-label="Export this chat"
                    >
                      <DownloadIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Export chat</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-500 hover:text-red-400"
                    onClick={handleDeleteClick}
                    aria-label={`Delete ${item.type}`}
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Delete {item.type}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>
    </div>
  );
};

// --- Main Chat History Component ---
interface ChatHistoryProps {
  className?: string;
  editingItemId: string | null;
  onEditComplete: (id: string) => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  className,
  editingItemId,
  onEditComplete,
}) => {
  const { sidebarItems, selectedItemId } = useChatContext();

  // Display all items flat for now, sorted by the query (updatedAt desc)
  const itemsToDisplay = sidebarItems;

  return (
    <ScrollArea className={cn("flex-grow h-0", className)}>
      <div className="p-2 space-y-1">
        {itemsToDisplay.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4 px-2">
            No projects or chats yet. Use the buttons above to create one.
          </p>
        )}
        {itemsToDisplay.map((item) => (
          <HistoryItem
            key={item.id}
            item={item}
            isSelected={item.id === selectedItemId}
            startInEditMode={item.id === editingItemId}
            onEditComplete={onEditComplete}
          />
        ))}
      </div>
    </ScrollArea>
  );
};
================

Task 2.1: Modularize Sidebar/History/Project Management.
Goal: Refactor useConversationManagement into an optional, self-contained hook/module (e.g., useSidebarManagement).
Responsibilities: Hook should handle fetching sidebar items (projects/convos), selection state, and CRUD operations via passed-in persistence functions. Expose state like 'selectedItem', 'sidebarItems'.
Approach: Modify useConversationManagement (rename to useSidebarManagement). It must accept persistence functions (create/rename/delete/get items) as props/config. Remove its direct instantiation from the core ChatProvider. LiteChat component will instantiate it conditionally based on config.
UI Updates: Update ChatSide/ChatHistory components to use the new hook's output (props or context).
Testing Requirements: Test the useSidebarManagement hook in isolation, mocking persistence functions. Test the LiteChat component with the sidebar enabled/disabled via configuration. Ensure ChatSide/ChatHistory render and function correctly when the module is enabled. Verify project/conversation CRUD operations work through the new hook.
Project Structure:
.
├── changes.diff
├── components.json
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── plop
├── prompt_4_coding_mod
├── prompt_4_patch
├── public
│   └── vite.svg
├── README.md
├── refactor.todo.md
├── src
│   ├── App.css
│   ├── App.tsx
│   ├── assets
│   │   └── react.svg
│   ├── components
│   │   ├── lite-chat
│   │   │   ├── api-key-selector.tsx
│   │   │   ├── chat-content.tsx
│   │   │   ├── chat-header-actions.tsx
│   │   │   ├── chat-header.tsx
│   │   │   ├── chat-history.tsx
│   │   │   ├── chat-side.tsx
│   │   │   ├── chat.tsx
│   │   │   ├── chat-wrapper.tsx
│   │   │   ├── file-manager.tsx
│   │   │   ├── message-actions.tsx
│   │   │   ├── message-bubble.tsx
│   │   │   ├── model-selector.tsx
│   │   │   ├── prompt-actions.tsx
│   │   │   ├── prompt-files.tsx
│   │   │   ├── prompt-form.tsx
│   │   │   ├── prompt-input.tsx
│   │   │   ├── prompt-settings-advanced.tsx
│   │   │   ├── prompt-settings.tsx
│   │   │   ├── prompt-wrapper.tsx
│   │   │   ├── provider-selector.tsx
│   │   │   ├── selected-vfs-files-display.tsx
│   │   │   ├── settings-api-keys.tsx
│   │   │   ├── settings-assistant.tsx
│   │   │   ├── settings-data-management.tsx
│   │   │   ├── settings-general.tsx
│   │   │   └── settings-modal.tsx
│   │   └── ui
│   │       ├── alert.tsx
│   │       ├── button.tsx
│   │       ├── checkbox.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── radio-group.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── skeleton.tsx
│   │       ├── slider.tsx
│   │       ├── sonner.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       └── tooltip.tsx
│   ├── context
│   │   ├── chat-context.tsx
│   │   └── core-chat-context.ts
│   ├── hooks
│   │   ├── use-ai-interaction.ts
│   │   ├── use-api-keys-management.ts
│   │   ├── use-chat-context.ts
│   │   ├── use-chat-input.ts
│   │   ├── use-chat-settings.ts
│   │   ├── use-chat-storage.ts
│   │   ├── use-conversation-management.ts
│   │   ├── use-debounce.ts
│   │   ├── use-message-handling.ts
│   │   ├── use-provider-model-selection.ts
│   │   └── use-virtual-file-system.ts
│   ├── index.css
│   ├── lib
│   │   ├── db.ts
│   │   ├── throttle.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   ├── main.tsx
│   ├── test
│   │   ├── components
│   │   │   └── lite-chat
│   │   │       ├── api-key-selector.test.tsx
│   │   │       ├── chat-header.test.tsx
│   │   │       ├── chat-history.notest.tsx
│   │   │       ├── message-bubble.notest.tsx
│   │   │       ├── model-selector.notest.tsx
│   │   │       ├── prompt-actions.notest.tsx
│   │   │       ├── prompt-files.notest.tsx
│   │   │       ├── prompt-input.notest.tsx
│   │   │       ├── settings-api-keys.notest.tsx
│   │   │       ├── settings-assistant.notest.tsx
│   │   │       ├── settings-data-management.notest.tsx
│   │   │       └── settings-general.notest.tsx
│   │   ├── hooks
│   │   │   ├── use-api-keys-management.test.ts
│   │   │   ├── use-chat-input.test.ts
│   │   │   ├── use-chat-settings.test.ts
│   │   │   └── use-provider-model-selection.test.ts
│   │   └── setup.ts
│   └── vite-env.d.ts
├── tailwind.config.ts
├── td
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts

14 directories, 102 files
follow these rules when working
"When providing code modifications or examples:

1.  **No Ellipses:** Do **not** use ellipses (`...`) within code blocks to omit code. Show the actual code needed.
2.  **Separate Blocks:** Present modifications for each file, or distinct logical changes within a file, in **separate Markdown code blocks**.
3.  **Context is Key:** Include enough surrounding code (e.g., function/class definition, import block, relevant lines before/after the change) to make the location and context of the modification **absolutely clear**.
4.  **Conciseness:** Do **not** include excessively large chunks of unchanged code. Focus on the modified lines plus the necessary context.
5.  **Minimal Comments:** Only add comments if they explain the *reason* for a non-obvious change or add critical clarification. **NO** comments that just state what the code is doing or the variable is.
6.  **Full Files:** If providing a completely new file or a full rewrite of an existing one, providing the entire file content in a single block is acceptable and preferred."
