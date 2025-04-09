
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
src/context/chat-context.tsx
========
// src/context/chat-context.tsx
import React, { useMemo, useCallback, useState, useRef } from "react";
import type {
  AiProviderConfig,
  ChatContextProps,
  SidebarItemType,
  Message,
  DbConversation,
  DbProject,
} from "@/lib/types";
import { ChatContext } from "@/hooks/use-chat-context";
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
import { nanoid } from "nanoid";

// Props expected by the ChatProvider component
interface ChatProviderProps {
  children: React.ReactNode;
  providers: AiProviderConfig[];
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  streamingThrottleRate?: number;
}

// Helper to decode Uint8Array to string, handling potential errors
const decodeUint8Array = (arr: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(arr);
  } catch (e) {
    console.warn("Failed to decode Uint8Array as UTF-8, trying lossy:", e);
    // Fallback to lossy decoding if strict UTF-8 fails
    return new TextDecoder("utf-8", { fatal: false }).decode(arr);
  }
};

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  providers,
  initialProviderId = null,
  initialModelId = null,
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  streamingThrottleRate = 42,
}) => {
  // --- Core State ---
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
  const apiKeysMgmt = useApiKeysManagement();
  const storage = useChatStorage();
  const handleSelectItem = useCallback(
    (id: string | null, type: SidebarItemType | null) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        toast.info("AI response stopped due to selection change.");
      }
    },
    [],
  );
  const conversationMgmt = useConversationManagement({
    initialSelectedItemId,
    initialSelectedItemType,
    onSelectItem: handleSelectItem,
    toggleDbVfs: storage.toggleVfsEnabled,
  });
  const chatSettings = useChatSettings({
    activeConversationData: conversationMgmt.activeConversationData,
    activeProjectData: conversationMgmt.activeProjectData,
  });
  const chatInput = useChatInput();

  const vfsEnabled = useMemo(() => {
    if (conversationMgmt.selectedItemType === "conversation") {
      return conversationMgmt.activeConversationData?.vfsEnabled ?? false;
    }
    if (conversationMgmt.selectedItemType === "project") {
      return conversationMgmt.activeProjectData?.vfsEnabled ?? false;
    }
    return false;
  }, [
    conversationMgmt.selectedItemType,
    conversationMgmt.activeConversationData,
    conversationMgmt.activeProjectData,
  ]);

  const vfs = useVirtualFileSystem({
    itemId: conversationMgmt.selectedItemId,
    itemType: conversationMgmt.selectedItemType,
    isEnabled: vfsEnabled,
  });

  const aiInteraction = useAiInteraction({
    selectedModel: providerModel.selectedModel,
    selectedProvider: providerModel.selectedProvider,
    getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
    streamingThrottleRate,
    setLocalMessages,
    setIsAiStreaming,
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
    stopStreamingCallback: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    },
    activeSystemPrompt: chatSettings.activeSystemPrompt,
    temperature: chatSettings.temperature,
    maxTokens: chatSettings.maxTokens,
    topP: chatSettings.topP,
    topK: chatSettings.topK,
    presencePenalty: chatSettings.presencePenalty,
    frequencyPenalty: chatSettings.frequencyPenalty,
    isAiStreaming,
    setIsAiStreaming,
    localMessages,
    setLocalMessages,
    isLoadingMessages,
    setIsLoadingMessages,
    error,
    setError,
    addDbMessage: storage.addDbMessage,
    deleteDbMessage: storage.deleteDbMessage,
  });

  // --- Top-Level Handlers ---

  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      const currentPrompt = chatInput.prompt.trim();
      const canSubmit =
        currentPrompt.length > 0 ||
        chatInput.attachedFiles.length > 0 ||
        chatInput.selectedVfsPaths.length > 0;

      if (!canSubmit) return;
      if (isAiStreaming) {
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

      if (
        conversationMgmt.selectedItemType === "project" &&
        conversationMgmt.selectedItemId
      ) {
        parentProjectId = conversationMgmt.selectedItemId;
      } else if (
        conversationMgmt.selectedItemType === "conversation" &&
        conversationMgmt.selectedItemId
      ) {
        parentProjectId =
          conversationMgmt.activeConversationData?.parentId ?? null;
        conversationIdToSubmit = conversationMgmt.selectedItemId;
      }

      if (!conversationIdToSubmit) {
        try {
          const title = currentPrompt.substring(0, 50) || "New Chat";
          const newConvId = await conversationMgmt.createConversation(
            parentProjectId,
            title,
          );
          if (!newConvId)
            throw new Error("Failed to get ID for new conversation.");
          conversationIdToSubmit = newConvId;
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

      // --- VFS Interaction: Upload attached files ---
      let uploadInfo = "";
      if (
        chatInput.attachedFiles.length > 0 &&
        vfsEnabled &&
        vfs.isReady &&
        vfs.configuredItemId === conversationMgmt.selectedItemId &&
        !vfs.isOperationLoading
      ) {
        try {
          await vfs.uploadFiles(chatInput.attachedFiles, "/");
          uploadInfo = `

[User uploaded: ${chatInput.attachedFiles.map((f) => f.name).join(", ")}]`;
          chatInput.clearAttachedFiles();
        } catch (uploadErr) {
          console.error("Failed to upload attached files:", uploadErr);
          toast.error(
            `Failed to upload attached file(s): ${uploadErr instanceof Error ? uploadErr.message : "Unknown error"}`,
          );
          uploadInfo = `

[File upload failed: ${uploadErr instanceof Error ? uploadErr.message : "Unknown error"}]`;
        }
      } else if (chatInput.attachedFiles.length > 0) {
        toast.warning(
          "Files attached, but Virtual Filesystem is not enabled or ready. Files were not uploaded.",
        );
        uploadInfo = `

[Files were attached but not uploaded (VFS inactive)]`;
        chatInput.clearAttachedFiles();
      }

      // --- VFS Interaction: Include selected file content ---
      let vfsContextString = "";
      const pathsIncludedInContext: string[] = [];
      if (
        chatInput.selectedVfsPaths.length > 0 &&
        vfsEnabled &&
        vfs.isReady &&
        vfs.configuredItemId === conversationMgmt.selectedItemId &&
        !vfs.isOperationLoading
      ) {
        const contentPromises = chatInput.selectedVfsPaths.map(async (path) => {
          try {
            const fileData = await vfs.readFile(path);
            const fileContent = decodeUint8Array(fileData);
            let formattedContent = "";
            if (fileContent.length > 1 * 1024 * 1024) {
              toast.warning(
                `File "${path}" is large and only the beginning will be included.`,
              );
              formattedContent = `<vfs_file path="${path}" truncated="true">
${fileContent.substring(0, 10000)}...
</vfs_file>`;
            } else {
              formattedContent = `<vfs_file path="${path}">
${fileContent}
</vfs_file>`;
            }
            pathsIncludedInContext.push(path);
            return formattedContent;
          } catch (readErr) {
            console.error(`Failed to read VFS file ${path}:`, readErr);
            toast.error(
              `Failed to read file "${path}" for context: ${readErr instanceof Error ? readErr.message : "Unknown error"}`,
            );
            return `<vfs_file path="${path}" error="Failed to read" />`;
          }
        });

        const resolvedContents = await Promise.all(contentPromises);
        vfsContextString = `

${resolvedContents.join("

")}`;
      } else if (chatInput.selectedVfsPaths.length > 0) {
        toast.warning(
          "VFS files selected, but Virtual Filesystem is not enabled or ready. Content not included.",
        );
        chatInput.clearSelectedVfsPaths();
      }

      // --- Prepare and Send ---
      const originalUserPrompt = currentPrompt;
      const promptToSendToAI =
        (vfsContextString ? vfsContextString + "

" : "") +
        originalUserPrompt +
        (uploadInfo ? "

" + uploadInfo : ""); // Append upload info for AI context too
      chatInput.setPrompt("");

      if (promptToSendToAI.trim().length > 0) {
        await messageHandling.handleSubmit(
          originalUserPrompt,
          conversationIdToSubmit,
          promptToSendToAI,
          pathsIncludedInContext,
        );
        chatInput.clearSelectedVfsPaths();
      } else {
        console.log("Submission skipped: empty prompt after processing.");
        if (
          uploadInfo.includes("failed") ||
          vfsContextString.includes("error=")
        ) {
          toast.error("Failed to process attached/selected files.");
        }
        chatInput.clearSelectedVfsPaths();
      }
    },
    [
      chatInput,
      isAiStreaming,
      providerModel.selectedProvider,
      providerModel.selectedModel,
      conversationMgmt,
      vfsEnabled,
      vfs,
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
      if (isAiStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      await messageHandling.regenerateMessage(messageId);
    },
    [
      messageHandling,
      conversationMgmt.selectedItemType,
      conversationMgmt.selectedItemId,
      isAiStreaming,
    ],
  );

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
        parentId = conversationMgmt.activeConversationData?.parentId ?? null;
      }
      await conversationMgmt.importConversation(file, parentId);
    },
    [conversationMgmt],
  );

  // --- Context Value Construction ---
  const contextValue: ChatContextProps = useMemo(
    () => ({
      providers,
      selectedProviderId: providerModel.selectedProviderId,
      setSelectedProviderId: providerModel.setSelectedProviderId,
      selectedModelId: providerModel.selectedModelId,
      setSelectedModelId: providerModel.setSelectedModelId,
      apiKeys: apiKeysMgmt.apiKeys,
      selectedApiKeyId: apiKeysMgmt.selectedApiKeyId,
      setSelectedApiKeyId: apiKeysMgmt.setSelectedApiKeyId,
      addApiKey: apiKeysMgmt.addApiKey,
      deleteApiKey: apiKeysMgmt.deleteApiKey,
      getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
      sidebarItems: conversationMgmt.sidebarItems,
      selectedItemId: conversationMgmt.selectedItemId,
      selectedItemType: conversationMgmt.selectedItemType,
      selectItem: conversationMgmt.selectItem,
      createConversation: conversationMgmt.createConversation,
      createProject: conversationMgmt.createProject,
      deleteItem: conversationMgmt.deleteItem,
      renameItem: conversationMgmt.renameItem,
      updateConversationSystemPrompt:
        conversationMgmt.updateConversationSystemPrompt,
      activeConversationData: conversationMgmt.activeConversationData,
      activeProjectData: conversationMgmt.activeProjectData,
      messages: localMessages,
      isLoading: isLoadingMessages,
      isStreaming: isAiStreaming,
      error,
      setError,
      prompt: chatInput.prompt,
      setPrompt: chatInput.setPrompt,
      attachedFiles: chatInput.attachedFiles,
      addAttachedFile: chatInput.addAttachedFile,
      removeAttachedFile: chatInput.removeAttachedFile,
      clearAttachedFiles: chatInput.clearAttachedFiles,
      selectedVfsPaths: chatInput.selectedVfsPaths,
      addSelectedVfsPath: chatInput.addSelectedVfsPath,
      removeSelectedVfsPath: chatInput.removeSelectedVfsPath,
      clearSelectedVfsPaths: chatInput.clearSelectedVfsPaths,
      handleSubmit,
      stopStreaming: messageHandling.stopStreaming,
      regenerateMessage,
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
      vfsEnabled,
      toggleVfsEnabled: conversationMgmt.toggleVfsEnabled,
      vfs: {
        isReady: vfs.isReady,
        configuredItemId: vfs.configuredItemId,
        isLoading: vfs.isLoading,
        isOperationLoading: vfs.isOperationLoading,
        error: vfs.error,
        listFiles: vfs.listFiles,
        readFile: vfs.readFile,
        writeFile: vfs.writeFile,
        deleteItem: vfs.deleteItem,
        createDirectory: vfs.createDirectory,
        downloadFile: vfs.downloadFile,
        uploadFiles: vfs.uploadFiles,
        uploadAndExtractZip: vfs.uploadAndExtractZip,
        downloadAllAsZip: vfs.downloadAllAsZip,
        rename: vfs.rename,
      },
    }),
    [
      providers,
      providerModel,
      apiKeysMgmt,
      conversationMgmt,
      localMessages,
      isLoadingMessages,
      isAiStreaming,
      error,
      setError,
      chatInput,
      handleSubmit,
      messageHandling,
      regenerateMessage,
      chatSettings,
      streamingThrottleRate,
      handleImportConversation,
      vfsEnabled,
      vfs,
    ],
  );

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};
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
src/hooks/use-ai-interaction.ts
========
// src/hooks/use-ai-interaction.ts
import { useCallback } from "react";
import { streamText, type CoreMessage } from "ai";
import type { AiModelConfig, AiProviderConfig, Message } from "@/lib/types";
import { throttle } from "@/lib/throttle"; // Your throttle implementation
import { nanoid } from "nanoid";
import { toast } from "sonner";

// --- Interfaces remain the same ---
interface UseAiInteractionProps {
  selectedModel: AiModelConfig | undefined;
  selectedProvider: AiProviderConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
  streamingThrottleRate: number;
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsAiStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setError: (error: string | null) => void;
  addDbMessage: (
    messageData: Omit<import("@/lib/types").DbMessage, "id" | "createdAt"> &
      Partial<Pick<import("@/lib/types").DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

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
  setLocalMessages,
  setIsAiStreaming,
  setError,
  addDbMessage,
  abortControllerRef,
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

      // console.log(
      //   `[AI Stream ${assistantMessageId}] Adding placeholder message.`,
      // );
      setLocalMessages((prev) => [...prev, assistantPlaceholder]);

      setIsAiStreaming(true);
      setError(null);

      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;
      // console.log(`[AI Stream ${assistantMessageId}] Created AbortController.`);

      // This variable holds the *true* accumulated content.
      let finalContent = "";

      // --- Throttled Update Function (Corrected Logic) ---
      // It no longer needs the chunk as an argument.
      const throttledStreamUpdate = throttle(() => {
        // It reads the *current* value of finalContent from the outer scope.
        const currentAccumulatedContent = finalContent;

        setLocalMessages((prev) => {
          const targetMessageIndex = prev.findIndex(
            (msg) => msg.id === assistantMessageId,
          );
          if (targetMessageIndex === -1) {
            return prev; // Message gone
          }

          const targetMessage = prev[targetMessageIndex];

          // Check if still streaming (prevents updates after finally block)
          if (!targetMessage.isStreaming) {
            // console.log(
            //   `[AI Stream ${assistantMessageId}] Throttled update skipped: Message no longer streaming.`,
            // );
            return prev;
          }

          const updatedMessages = [...prev];
          updatedMessages[targetMessageIndex] = {
            ...targetMessage,
            streamedContent: currentAccumulatedContent, // Use the up-to-date accumulated string
          };
          return updatedMessages;
        });
      }, streamingThrottleRate);

      let streamError: Error | null = null;
      let deltaCount = 0;

      try {
        // --- Stream preparation remains the same ---
        const messagesForApi: CoreMessage[] = [];
        if (systemPromptToUse) {
          messagesForApi.push({ role: "system", content: systemPromptToUse });
        }
        messagesForApi.push(
          ...messagesToSend.filter((m) => m.role !== "system"),
        );

        // console.log(
        //   `[AI Stream ${assistantMessageId}] Sending ${messagesForApi.length} messages to AI. Model: ${selectedModel.id}`,
        // );

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

        // console.log(`[AI Stream ${assistantMessageId}] Starting stream loop.`);
        for await (const delta of result.textStream) {
          deltaCount++;
          // *** Accumulate the ground truth here ***
          finalContent += delta;
          // *** Trigger the throttled UI update (without passing the delta) ***
          throttledStreamUpdate();
        }
        // console.log(
        //   `[AI Stream ${assistantMessageId}] Stream loop finished normally after ${deltaCount} deltas. Final content length: ${finalContent.length}`,
        // );
      } catch (err: unknown) {
        if (err instanceof Error) {
          streamError = err;
          if (err.name === "AbortError") {
            // console.log(
            //   `[AI Stream ${assistantMessageId}] Stream aborted by user after ${deltaCount} deltas.`,
            // );
            // Use the finalContent accumulated up to the abort point
            // console.log(
            //   `[AI Stream ${assistantMessageId}] Abort final content set to (from finalContent): "${finalContent}"`,
            // );
            streamError = null;
          } else {
            console.error(
              `[AI Stream ${assistantMessageId}] streamText error after ${deltaCount} deltas:`,
              err,
            );
            finalContent = `Error: ${err.message || "Failed to get response"}`;
            setError(`AI Error: ${finalContent}`);
            toast.error(`AI Error: ${err.message || "Unknown error"}`);
          }
        }
      } finally {
        // console.log(
        //   `[AI Stream ${assistantMessageId}] Entering finally block. StreamError: ${streamError?.message}`,
        // );

        if (abortControllerRef.current === currentAbortController) {
          abortControllerRef.current = null;
          // console.log(
          //   `[AI Stream ${assistantMessageId}] Cleared matching AbortController ref.`,
          // );
        } else {
          // console.log(
          //   `[AI Stream ${assistantMessageId}] AbortController ref did not match or was already null.`,
          // );
        }

        setIsAiStreaming(false);

        // console.log(
        //   `[AI Stream ${assistantMessageId}] Finalizing message state. Using finalContent (length ${finalContent.length}): "${finalContent.substring(0, 100)}..."`,
        // );

        // Final UI state update uses the complete finalContent
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: finalContent, // The ground truth
                  isStreaming: false,
                  streamedContent: undefined, // Clear the intermediate buffer
                  error: streamError ? streamError.message : null,
                }
              : msg,
          ),
        );
        // console.log(
        //   `[AI Stream ${assistantMessageId}] Final UI state update dispatched.`,
        // );

        // --- DB Save Logic remains the same (uses finalContent) ---
        if (!streamError && finalContent.trim() !== "") {
          // console.log(
          //   `[AI Stream ${assistantMessageId}] Attempting to save final message to DB.`,
          // );
          try {
            await addDbMessage({
              id: assistantMessageId,
              conversationId: conversationIdToUse,
              role: "assistant",
              content: finalContent, // Save the ground truth
              createdAt: assistantPlaceholderTimestamp,
            });
            // console.log(
            //   `[AI Stream ${assistantMessageId}] Assistant message saved to DB successfully.`,
            // );
          } catch (dbErr: unknown) {
            if (dbErr instanceof Error) {
              const dbErrorMessage = `Save failed: ${dbErr.message}`;
              console.error(
                `[AI Stream ${assistantMessageId}] Failed to save final assistant message to DB:`,
                dbErr,
              );
              setError(`Error saving response: ${dbErr.message}`);
              toast.error(`Failed to save response: ${dbErr.message}`);
              setLocalMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, error: dbErrorMessage }
                    : msg,
                ),
              );
              // console.log(
              //   `[AI Stream ${assistantMessageId}] Updated message in UI state with DB save error.`,
              // );
            } else {
              console.error(
                `[AI Stream ${assistantMessageId}] Failed to save final assistant message to DB:`,
                dbErr,
              );
              setError(`Error saving response: ${dbErr}`);
              toast.error(`Failed to save response: ${dbErr}`);
            }
          }
        } else if (streamError) {
          setError(`AI Error: ${streamError.message}`);
          // console.log(
          //   `[AI Stream ${assistantMessageId}] DB save skipped due to stream error.`,
          // );
        } else {
          console.log(
            `[AI Stream ${assistantMessageId}] DB save skipped due to empty or whitespace-only final content.`,
          );
        }
        // console.log(
        //   `[AI Stream ${assistantMessageId}] Exiting finally block.`,
        // );
      }
    },
    [
      selectedModel,
      selectedProvider,
      getApiKeyForProvider,
      streamingThrottleRate,
      setLocalMessages,
      setIsAiStreaming,
      setError,
      addDbMessage,
      abortControllerRef,
    ],
  );

  return {
    performAiStream,
  };
}
========
src/hooks/use-message-handling.ts
========
// src/hooks/use-message-handling.ts
import React, { useCallback, useEffect } from "react";
import type { Message, DbMessage } from "@/lib/types";
import { db } from "@/lib/db";
import { toast } from "sonner";
import type { CoreMessage } from "ai";

// Interface for AI stream parameters
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

// Props received by the hook
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
}

// Return type of the hook
interface UseMessageHandlingReturn {
  handleSubmit: (
    originalUserPrompt: string,
    currentConversationId: string,
    promptToSendToAI: string,
    vfsContextPaths?: string[],
  ) => Promise<void>;
  regenerateMessage: (messageId: string) => Promise<void>;
  stopStreaming: () => void;
}

// Hook implementation
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
  localMessages,
  setLocalMessages,
  setIsLoadingMessages,
  setError,
  addDbMessage,
  deleteDbMessage,
}: UseMessageHandlingProps): UseMessageHandlingReturn {
  // --- Message Loading Effect ---
  useEffect(() => {
    let isMounted = true;
    if (selectedConversationId) {
      setIsLoadingMessages(true);
      setError(null);

      db.messages
        .where("conversationId")
        .equals(selectedConversationId)
        .sortBy("createdAt")
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
            setError(`Error loading chat: ${err.message}`);
            toast.error(`Error loading chat: ${err.message}`);
            setLocalMessages([]);
            setIsLoadingMessages(false);
          }
        });
    } else {
      setLocalMessages([]);
      setIsLoadingMessages(false);
      setError(null);
    }
    return () => {
      isMounted = false;
    };
  }, [
    selectedConversationId,
    setIsLoadingMessages,
    setLocalMessages,
    setError,
  ]);

  // --- Stop Streaming ---
  const stopStreaming = useCallback(() => {
    stopStreamingCallback();
    setLocalMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming
          ? {
              ...msg,
              isStreaming: false,
              content: msg.streamedContent || msg.content || "Stopped",
              streamedContent: undefined,
            }
          : msg,
      ),
    );
  }, [stopStreamingCallback, setLocalMessages]);

  // --- Handle Submission ---
  const handleSubmit = useCallback(
    async (
      originalUserPrompt: string,
      currentConversationId: string,
      promptToSendToAI: string,
      vfsContextPaths?: string[],
    ) => {
      if (!currentConversationId) {
        setError("Error: Could not determine active conversation.");
        return;
      }

      setError(null);

      let userMessageId: string;
      let userMessageForState: Message;
      const userMessageTimestamp = new Date();

      // Prepare message history for AI *before* saving the new user message
      const messagesForAi = await new Promise<CoreMessage[]>((resolve) => {
        setLocalMessages((currentMessages) => {
          const history = currentMessages
            .filter((m) => !m.error)
            .map((m): CoreMessage => ({ role: m.role, content: m.content }));
          history.push({ role: "user", content: promptToSendToAI });
          resolve(history);
          return currentMessages;
        });
      });

      const hasUserOrAssistantMessage = messagesForAi.some(
        (m) => m.role === "user" || m.role === "assistant",
      );
      if (!hasUserOrAssistantMessage) {
        console.error("useMessageHandling: Attempting to send empty history.");
        setError("Internal Error: Cannot send empty message list.");
        return;
      }

      // Save user message to DB (using original prompt)
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
          vfsContextPaths: vfsContextPaths ?? undefined,
        };
      } catch (dbError: unknown) {
        console.error(
          "useMessageHandling: Error adding user message:",
          dbError,
        );
        if (dbError instanceof Error) {
          setError(`Error: Could not save your message - ${dbError.message}`);
          toast.error(`Error saving message: ${dbError.message}`);
        } else {
          setError("Error: Could not save your message");
          toast.error("Error saving message");
        }
        return;
      }

      // Update local state with user message (using original prompt)
      setLocalMessages((prevMessages) => [
        ...prevMessages,
        userMessageForState,
      ]);

      // Call AI stream function
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
      addDbMessage,
      performAiStream,
      setError,
      activeSystemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      setLocalMessages,
    ],
  );

  // --- Regeneration ---
  const regenerateMessage = useCallback(
    async (messageId: string) => {
      const conversationIdToUse = selectedConversationId;
      if (!conversationIdToUse || isAiStreaming) {
        if (isAiStreaming)
          toast.warning("Please wait for the current response.");
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

      // Get history
      const historyForRegen = localMessages
        .slice(0, messageIndex)
        .filter((m) => !m.error)
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

      // Delete messages from DB
      const messagesToDelete = localMessages.slice(messageIndex);
      try {
        await Promise.all(messagesToDelete.map((m) => deleteDbMessage(m.id)));
      } catch (dbErr: unknown) {
        console.error("useMessageHandling: Error deleting for regen:", dbErr);
        if (dbErr instanceof Error) {
          setError(`Error preparing regeneration: ${dbErr.message}`);
          toast.error("Failed to prepare for regeneration : " + dbErr.message);
        } else {
          setError("Unknown error preparing regeneration");
          toast.error("Failed to prepare for regeneration.");
        }
        return;
      }

      // Update local state
      setLocalMessages((prev) => prev.slice(0, messageIndex));

      // Call AI stream function
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
      activeSystemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      setLocalMessages,
    ],
  );

  return {
    handleSubmit,
    regenerateMessage,
    stopStreaming,
  };
}
========
src/lib/types.ts
========
// src/lib/types.ts

import type { CoreMessage } from "ai";
import type { FileSystem } from "@zenfs/core"; // Keep if needed elsewhere, but not directly in context type

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
  parentId: string | null; // ID of the parent project, null for root
  vfsEnabled: boolean; // Flag for Virtual File System
}

export interface DbConversation extends DbBase {
  title: string;
  systemPrompt: string | null;
  parentId: string | null; // ID of the parent project, null for root
  vfsEnabled: boolean; // Flag for Virtual File System
}

export interface DbMessage extends Pick<DbBase, "id" | "createdAt"> {
  conversationId: string;
  role: Role;
  content: string;
  vfsContextPaths?: string[]; // ADDED: Paths of VFS files included in context
}

export interface DbApiKey extends Pick<DbBase, "id" | "createdAt"> {
  name: string;
  providerId: string;
  value: string; // Store the actual key value (consider security implications)
}

// --- UI & State Types ---
export interface Message extends CoreMessage {
  id?: string; // Optional ID for UI state before DB save
  conversationId?: string; // Optional for UI state
  createdAt?: Date; // Optional for UI state
  isStreaming?: boolean; // Flag for streaming state
  streamedContent?: string; // Intermediate streamed content
  error?: string | null; // Error associated with the message
  vfsContextPaths?: string[]; // ADDED: Paths of VFS files included in context
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
  id: string; // e.g., 'gpt-4o', 'claude-3-opus'
  name: string; // User-friendly name, e.g., "GPT-4o"
  instance: any; // The actual AI SDK model instance
  contextWindow?: number; // Optional: Token limit
}

export interface AiProviderConfig {
  id: string; // e.g., 'openai', 'anthropic', 'google'
  name: string; // User-friendly name, e.g., "OpenAI"
  models: AiModelConfig[];
  requiresApiKey?: boolean; // Does this provider need an API key client-side? (default: true)
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
// Define the shape of the VFS object within the context
interface VfsContextObject {
  isReady: boolean; // ADDED: Is the FS configured and ready?
  configuredItemId: string | null; // ADDED: Which item ID is it configured for?
  isLoading: boolean; // Is the VFS hook currently loading/configuring?
  isOperationLoading: boolean; // ADDED: Is a VFS operation (write, delete, etc.) in progress?
  error: string | null; // Any configuration error?
  // Include all the functions returned by the useVirtualFileSystem hook
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

export interface ChatContextProps {
  // Provider/Model Selection
  providers: AiProviderConfig[];
  selectedProviderId: string | null;
  setSelectedProviderId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedModelId: string | null;
  setSelectedModelId: React.Dispatch<React.SetStateAction<string | null>>;

  // API Key Management
  apiKeys: DbApiKey[];
  selectedApiKeyId: Record<string, string | null>; // Map: providerId -> selectedKeyId
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
  activeConversationData: DbConversation | null;
  activeProjectData: DbProject | null;

  // Messages & Streaming
  messages: Message[];
  isLoading: boolean; // Loading messages state
  isStreaming: boolean; // AI response streaming state
  error: string | null; // General chat error
  setError: (error: string | null) => void;

  // Input Handling
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  handleSubmit: (e?: React.FormEvent<HTMLFormElement>) => Promise<void>;
  stopStreaming: () => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  attachedFiles: File[];
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearAttachedFiles: () => void;
  selectedVfsPaths: string[]; // ADDED: Paths selected for context
  addSelectedVfsPath: (path: string) => void; // ADDED
  removeSelectedVfsPath: (path: string) => void; // ADDED
  clearSelectedVfsPaths: () => void; // ADDED

  // Settings
  temperature: number;
  setTemperature: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number | null;
  setMaxTokens: React.Dispatch<React.SetStateAction<number | null>>;
  globalSystemPrompt: string;
  setGlobalSystemPrompt: React.Dispatch<React.SetStateAction<string>>;
  activeSystemPrompt: string | null; // Derived system prompt
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

  // Import/Export
  exportConversation: (conversationId: string | null) => Promise<void>;
  importConversation: (file: File) => Promise<void>; // Simplified signature for context
  exportAllConversations: () => Promise<void>;

  // Virtual File System
  vfsEnabled: boolean; // Is VFS enabled for the *currently selected* item?
  toggleVfsEnabled: () => Promise<void>; // Function to toggle the DB flag and refresh state
  vfs: VfsContextObject; // Use the defined interface here
}
================

Task 1.1: Isolate Core Chat Context.
Goal: Refactor ChatProvider/useChatContext into a minimal CoreChatContext.
Core State: Manage ONLY essential chat state: messages, isStreaming, isLoading, error, prompt, setPrompt, basic handleSubmit structure, stopStreaming, regenerateMessage structure, and AI interaction results (from useAiInteraction).
Approach: Create a new CoreChatContext. Move essential state/logic from ChatProvider to it. Remove direct instantiation/management of VFS, Projects, complex Settings, API Keys, and Sidebar logic from the core provider.
Hook Updates: Modify useAiInteraction and useMessageHandling to rely only on core state and necessary props passed down (like DB functions).
Type Updates: Update ChatContextProps type in src/lib/types.ts accordingly to reflect the minimal core context.
Testing Requirements: Write/update unit tests for the new CoreChatContext ensuring basic message handling, prompt updates, and streaming state changes work. Verify useAiInteraction/useMessageHandling function correctly with dependencies passed via props/args. Ensure basic chat functionality (send/receive without optional features) remains intact after refactoring.
Project Structure:
.
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
│   │   │   ├── chat-header copy.txt
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
│   │   └── chat-context.tsx
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

14 directories, 101 files
follow these rules when working
"When providing code modifications or examples:

1.  **No Ellipses:** Do **not** use ellipses (`...`) within code blocks to omit code. Show the actual code needed.
2.  **Separate Blocks:** Present modifications for each file, or distinct logical changes within a file, in **separate Markdown code blocks**.
3.  **Context is Key:** Include enough surrounding code (e.g., function/class definition, import block, relevant lines before/after the change) to make the location and context of the modification **absolutely clear**.
4.  **Conciseness:** Do **not** include excessively large chunks of unchanged code. Focus on the modified lines plus the necessary context.
5.  **Minimal Comments:** Only add comments if they explain the *reason* for a non-obvious change or add critical clarification. **NO** comments that just state what the code is doing or the variable is.
6.  **Full Files:** If providing a completely new file or a full rewrite of an existing one, providing the entire file content in a single block is acceptable and preferred."
