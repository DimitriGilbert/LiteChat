// src/components/LiteChat/LiteChat.tsx
// Entire file content provided due to significant changes in initialization
import React, { useEffect, useCallback, useMemo, useState } from "react";
import { PromptWrapper } from "@/components/LiteChat/prompt/PromptWrapper";
import { ChatCanvas } from "@/components/LiteChat/canvas/ChatCanvas";
import { ChatControlWrapper } from "@/components/LiteChat/chat/ChatControlWrapper";
import { useConversationStore } from "@/store/conversation.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useUIStateStore } from "@/store/ui.store";
import { useControlRegistryStore } from "@/store/control.store";
import type { PromptTurnObject, PromptObject } from "@/types/litechat/prompt";
import { AIService } from "@/services/ai.service";
import { useModStore } from "@/store/mod.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useVfsStore } from "@/store/vfs.store";
import { loadMods } from "@/modding/loader";
import { Toaster } from "@/components/ui/sonner";
import type { CoreMessage } from "ai";
import { InputArea } from "@/components/LiteChat/prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { emitter } from "@/lib/litechat/event-emitter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Import the registration FUNCTIONS
import { registerConversationListControl } from "@/hooks/litechat/registerConversationListControl";
import { registerSettingsControl } from "@/hooks/litechat/registerSettingsControl";
import { registerSidebarToggleControl } from "@/hooks/litechat/registerSidebarToggleControl";
import { registerParameterControl } from "@/hooks/litechat/registerParameterControl";
import { registerFileControl } from "@/hooks/litechat/registerFileControl";
import { registerVfsControl } from "@/hooks/litechat/registerVfsControl"; // Import plain function
import { registerGitSyncControl } from "@/hooks/litechat/registerGitSyncControl";
import { registerVfsTools } from "@/hooks/litechat/registerVfsTools";
import { registerGitTools } from "@/hooks/litechat/registerGitTools";
import { registerToolSelectorControl } from "@/hooks/litechat/registerToolSelectorControl";
import { registerProjectSettingsControl } from "@/hooks/litechat/registerProjectSettingsControl"; // Import plain function
import { buildHistoryMessages } from "@/lib/litechat/ai-helpers";
import { usePromptStateStore } from "@/store/prompt.store";
import { registerGlobalModelSelector } from "@/hooks/litechat/registerGlobalModelSelector";

export const LiteChat: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);

  // --- Store Hooks ---
  // Use specific selectors or shallow for ConversationStore
  const {
    selectedItemId,
    selectedItemType,
    loadSidebarItems,
    getConversationById,
    getEffectiveProjectSettings,
  } = useConversationStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      loadSidebarItems: state.loadSidebarItems,
      addConversation: state.addConversation,
      selectItem: state.selectItem,
      getConversationById: state.getConversationById,
      getEffectiveProjectSettings: state.getEffectiveProjectSettings,
    })),
  );
  // Use specific selectors or shallow for InteractionStore
  const { interactions, status: interactionStatus } = useInteractionStore(
    useShallow((state) => ({
      interactions: state.interactions,
      status: state.status,
    })),
  );
  // Use specific selectors or shallow for UIStateStore
  const {
    globalError,
    isSidebarCollapsed,
    isChatControlPanelOpen,
    isProjectSettingsModalOpen,
  } = useUIStateStore(
    useShallow((state) => ({
      globalError: state.globalError,
      isSidebarCollapsed: state.isSidebarCollapsed,
      isChatControlPanelOpen: state.isChatControlPanelOpen,
      isProjectSettingsModalOpen: state.isProjectSettingsModalOpen,
    })),
  );
  const isVfsPanelOpen = isChatControlPanelOpen["vfs"] ?? false;

  // Use a stable selector for chatControls to prevent re-renders if the object reference changes but content is the same
  const chatControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.chatControls)),
  );

  // Get store actions needed for initialization (stable references)
  const { loadDbMods, setLoadedMods } = useModStore(
    useShallow((state) => ({
      loadDbMods: state.loadDbMods,
      setLoadedMods: state.setLoadedMods,
    })),
  );
  const { loadInitialData: loadProviderData } = useProviderStore(
    useShallow((state) => ({
      loadInitialData: state.loadInitialData,
    })),
  );
  const { loadSettings } = useSettingsStore(
    useShallow((state) => ({
      loadSettings: state.loadSettings,
    })),
  );
  const { setVfsKey } = useVfsStore(
    useShallow((state) => ({
      setVfsKey: state.setVfsKey,
    })),
  );
  const { initializePromptState, resetPromptState } = usePromptStateStore(
    useShallow((state) => ({
      initializePromptState: state.initializePromptState,
      resetPromptState: state.resetPromptState,
    })),
  );

  // --- Initialization Effect ---
  useEffect(() => {
    let isMounted = true;
    const initializeApp = async () => {
      console.log("LiteChat: Starting initialization...");
      setIsInitializing(true); // Set loading state immediately

      try {
        // --- Step 1: Load Core Data ---
        console.log("LiteChat: Loading core data...");
        await loadSettings();
        if (!isMounted) return;
        console.log("LiteChat: Settings loaded.");
        await loadProviderData();
        if (!isMounted) return;
        console.log("LiteChat: Provider data loaded.");
        await loadSidebarItems(); // Load conversations and projects
        if (!isMounted) return;
        console.log("LiteChat: Sidebar items loaded.");

        // --- Step 2: Register Core Controls & Tools ---
        console.log("LiteChat: Registering core controls and tools...");
        registerConversationListControl();
        registerSettingsControl();
        registerSidebarToggleControl();
        registerGlobalModelSelector();
        registerParameterControl();
        registerFileControl();
        registerGitSyncControl();
        registerVfsTools();
        registerGitTools();
        registerToolSelectorControl();
        registerVfsControl(); // Call plain function
        registerProjectSettingsControl(); // Call plain function
        console.log("LiteChat: Core controls and tools registered.");
        if (!isMounted) return;

        // --- Step 3: Load Mods ---
        console.log("LiteChat: Loading mods...");
        await loadDbMods();
        if (!isMounted) return;
        console.log("LiteChat: DB Mods loaded.");
        const currentDbMods = useModStore.getState().dbMods;
        console.log(`LiteChat: Processing ${currentDbMods.length} mods...`);
        const loadedModInstances = await loadMods(currentDbMods);
        if (!isMounted) return;
        setLoadedMods(loadedModInstances);
        console.log(`LiteChat: ${loadedModInstances.length} mods processed.`);

        // --- Step 4: Initialize Prompt State ---
        // Get initial context AFTER sidebar items are loaded
        const initialSelectedItemId =
          useConversationStore.getState().selectedItemId;
        const initialSelectedItemType =
          useConversationStore.getState().selectedItemType;
        const initialProjectId =
          initialSelectedItemType === "project"
            ? initialSelectedItemId
            : initialSelectedItemType === "conversation"
              ? (useConversationStore
                  .getState()
                  .getConversationById(initialSelectedItemId)?.projectId ??
                null)
              : null;
        // Use the getEffectiveProjectSettings from the store directly
        const initialEffectiveSettings = useConversationStore
          .getState()
          .getEffectiveProjectSettings(initialProjectId);
        initializePromptState(initialEffectiveSettings);
        console.log(
          "LiteChat: Initial prompt state initialized.",
          initialEffectiveSettings,
        );
      } catch (error) {
        console.error("LiteChat: Initialization failed:", error);
        toast.error(
          `Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Optionally set an error state in UIStore
        useUIStateStore.getState().setGlobalError("Initialization failed.");
      } finally {
        // --- Step 5: Finalize Initialization ---
        if (isMounted) {
          console.log("LiteChat: Initialization complete.");
          setIsInitializing(false); // Clear loading state
        }
      }
    };

    initializeApp();

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("LiteChat: Unmounting, initialization cancelled if pending.");
      // Consider adding unregistration logic here if necessary,
      // though usually not needed for singleton stores/controls.
    };
    // Run this effect only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once

  // --- Effect to update Prompt State on Context Change ---
  useEffect(() => {
    // Skip if still initializing to avoid race conditions
    if (isInitializing) return;

    const currentProjectId =
      selectedItemType === "project"
        ? selectedItemId
        : selectedItemType === "conversation"
          ? (getConversationById(selectedItemId)?.projectId ?? null)
          : null;

    console.log(
      `[LiteChat Effect] Context changed (Item: ${selectedItemId}, Type: ${selectedItemType}). Calculating effective settings for Project ID: ${currentProjectId}`,
    );
    // Use the stable reference from the store hook
    const effectiveSettings = getEffectiveProjectSettings(currentProjectId);
    // Use the stable reference from the store hook
    initializePromptState(effectiveSettings);
    console.log(
      "[LiteChat Effect] Prompt state updated based on context change.",
      effectiveSettings,
    );
  }, [
    selectedItemId,
    selectedItemType,
    getConversationById, // Stable reference from store hook
    getEffectiveProjectSettings, // Stable reference from store hook
    initializePromptState, // Stable reference from store hook
    isInitializing, // Include isInitializing to prevent running before init finishes
  ]);

  // --- VFS Context Management Effect ---
  useEffect(() => {
    let targetVfsKey: string | null = null;
    if (isVfsPanelOpen) {
      if (selectedItemType === "project") {
        targetVfsKey = selectedItemId;
      } else if (selectedItemType === "conversation") {
        const convo = getConversationById(selectedItemId);
        targetVfsKey = convo?.projectId ?? "orphan"; // Use 'orphan' key for non-project convos
      } else {
        targetVfsKey = "orphan"; // Default to orphan if nothing selected
      }
      console.log(
        `[LiteChat Effect] VFS Panel Opened/Context Changed. Setting target key: ${targetVfsKey}`,
      );
    } else {
      targetVfsKey = null; // Set to null when panel is closed
      console.log(
        "[LiteChat Effect] VFS Panel Closed. Setting target key: null",
      );
    }
    // Call setVfsKey only if the target key actually changes
    // Access VFS store state directly here as it's less likely to cause loops
    if (useVfsStore.getState().vfsKey !== targetVfsKey) {
      setVfsKey(targetVfsKey); // Use stable reference from store hook
    }
  }, [
    isVfsPanelOpen,
    selectedItemId,
    selectedItemType,
    getConversationById, // Stable reference from store hook
    setVfsKey, // Stable reference from store hook
  ]);

  // --- Prompt Submission Handler ---
  const handlePromptSubmit = useCallback(
    async (turnData: PromptTurnObject) => {
      // Get necessary state/actions using getState() inside the callback
      const conversationState = useConversationStore.getState();
      const uiStateActions = useUIStateStore.getState();
      const promptState = usePromptStateStore.getState(); // Get current prompt state

      let currentConvId =
        conversationState.selectedItemType === "conversation"
          ? conversationState.selectedItemId
          : null;
      const currentProjectId =
        conversationState.selectedItemType === "project"
          ? conversationState.selectedItemId
          : conversationState.selectedItemType === "conversation"
            ? (conversationState.getConversationById(
                conversationState.selectedItemId,
              )?.projectId ?? null)
            : null;

      // Get settings for THIS turn from the PromptStateStore
      const modelToUse = promptState.modelId;
      const systemPrompt =
        conversationState.getEffectiveProjectSettings(currentProjectId)
          .systemPrompt ?? undefined;

      if (!modelToUse) {
        toast.error("Please select a model before sending a message.");
        return;
      }

      // Create new conversation if needed
      if (!currentConvId) {
        console.log("LiteChat: No conversation selected, creating new one...");
        try {
          // Use actions obtained via getState()
          const newId = await conversationState.addConversation({
            title: "New Chat",
            projectId: currentProjectId,
          });
          await conversationState.selectItem(newId, "conversation");
          // Re-fetch state after selection to ensure it's updated
          currentConvId = useConversationStore.getState().selectedItemId;
          if (currentConvId !== newId) {
            console.error(
              "LiteChat: Mismatch between created ID and selected ID after selection!",
            );
            currentConvId = newId; // Fallback to the ID returned by addConversation
          }
          console.log(
            `LiteChat: New conversation created (${currentConvId}), selected, and InteractionStore synced.`,
          );
          // Use action obtained via getState()
          setTimeout(() => uiStateActions.setFocusInputFlag(true), 0);
        } catch (error) {
          console.error("LiteChat: Failed to create new conversation", error);
          toast.error("Failed to start new chat.");
          return;
        }
      }

      // Build message history
      const currentHistory = useInteractionStore.getState().interactions;
      const completedHistory = currentHistory.filter(
        (i) => i.status === "COMPLETED" && i.type === "message.user_assistant",
      );
      const messages: CoreMessage[] = buildHistoryMessages(completedHistory);

      // Add current user message
      if (turnData.content) {
        messages.push({ role: "user", content: turnData.content });
      } else if (turnData.metadata?.attachedFiles?.length) {
        // Add an empty user message if only files are attached
        messages.push({ role: "user", content: "" });
      } else {
        console.error("LiteChat: Attempting to submit with no content.");
        toast.error("Cannot send an empty message.");
        return;
      }

      // Combine parameters from prompt state and turn data
      const finalParameters = {
        temperature: promptState.temperature,
        max_tokens: promptState.maxTokens,
        top_p: promptState.topP,
        top_k: promptState.topK,
        presence_penalty: promptState.presencePenalty,
        frequency_penalty: promptState.frequencyPenalty,
        ...(turnData.parameters ?? {}), // Turn-specific params override prompt state
      };

      // Remove null/undefined parameters
      Object.keys(finalParameters).forEach((key) => {
        if (
          finalParameters[key as keyof typeof finalParameters] === null ||
          finalParameters[key as keyof typeof finalParameters] === undefined
        ) {
          delete finalParameters[key as keyof typeof finalParameters];
        }
      });

      // Prepare final AI payload
      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages,
        parameters: finalParameters,
        metadata: {
          ...turnData.metadata,
          modelId: modelToUse, // Ensure modelId from prompt state is included
        },
        // Tools and toolChoice will be added by AIService based on metadata
      };

      emitter.emit("prompt:finalised", { prompt: aiPayload });
      console.log("LiteChat: Submitting prompt to AIService:", aiPayload);

      try {
        await AIService.startInteraction(aiPayload, turnData);
        console.log("LiteChat: AIService interaction started.");
        // Reset prompt state AFTER successful submission start
        resetPromptState(); // Use stable reference from hook
        // Re-initialize based on current context
        const effectiveSettings =
          conversationState.getEffectiveProjectSettings(currentProjectId);
        initializePromptState(effectiveSettings); // Use stable reference from hook
      } catch (e) {
        console.error("LiteChat: Error starting AI interaction:", e);
        toast.error(
          `Failed to start AI interaction: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [
      // Include stable references from hooks as dependencies
      initializePromptState,
      resetPromptState,
      // buildHistoryMessages is a stable import
    ],
  );

  // --- Regeneration Handler ---
  const onRegenerateInteraction = useCallback(
    async (interactionId: string) => {
      console.log(`LiteChat: Regenerating interaction ${interactionId}`);
      // Get necessary state/actions using getState() inside the callback
      const interactionStore = useInteractionStore.getState();
      const conversationState = useConversationStore.getState();
      const promptState = usePromptStateStore.getState(); // Get current prompt state

      const targetInteraction = interactionStore.interactions.find(
        (i) => i.id === interactionId,
      );

      if (!targetInteraction || !targetInteraction.prompt) {
        console.error(
          `LiteChat: Cannot regenerate - interaction ${interactionId} or its prompt not found.`,
        );
        toast.error("Cannot regenerate: Original interaction data missing.");
        return;
      }

      if (targetInteraction.type !== "message.user_assistant") {
        console.error(
          `LiteChat: Cannot regenerate non-user_assistant interaction: ${interactionId}`,
        );
        toast.error("Can only regenerate from a user message interaction.");
        return;
      }

      const currentConversation = conversationState.getConversationById(
        targetInteraction.conversationId,
      );
      const currentProjectId = currentConversation?.projectId ?? null;

      // Use the current prompt state for regeneration
      const modelToUse = promptState.modelId;
      const systemPrompt =
        conversationState.getEffectiveProjectSettings(currentProjectId)
          .systemPrompt ?? undefined;

      if (!modelToUse) {
        toast.error("Please select a model before regenerating.");
        return;
      }

      // Build history up to the point of regeneration
      const historyUpToIndex = targetInteraction.index;
      const historyInteractions = interactionStore.interactions
        .filter(
          (i) =>
            i.conversationId === targetInteraction.conversationId &&
            i.index < historyUpToIndex &&
            i.status === "COMPLETED" &&
            i.type === "message.user_assistant",
        )
        .sort((a, b) => a.index - b.index);

      const messages: CoreMessage[] = buildHistoryMessages(historyInteractions);

      // Add the user message from the interaction being regenerated
      if (
        targetInteraction.prompt?.content &&
        typeof targetInteraction.prompt.content === "string"
      ) {
        messages.push({
          role: "user",
          content: targetInteraction.prompt.content,
        });
      } else if (targetInteraction.prompt?.metadata?.attachedFiles?.length) {
        // Add an empty user message if the original prompt only had files
        messages.push({ role: "user", content: "" });
      } else {
        console.error(
          `LiteChat: Cannot regenerate - missing or invalid user prompt content in interaction ${interactionId}.`,
        );
        toast.error("Cannot regenerate: Original user prompt missing.");
        return;
      }

      // Combine parameters from prompt state and original prompt
      const finalParameters = {
        temperature: promptState.temperature,
        max_tokens: promptState.maxTokens,
        top_p: promptState.topP,
        top_k: promptState.topK,
        presence_penalty: promptState.presencePenalty,
        frequency_penalty: promptState.frequencyPenalty,
        ...(targetInteraction.prompt.parameters ?? {}), // Original params override prompt state for regen
      };
      Object.keys(finalParameters).forEach((key) => {
        if (
          finalParameters[key as keyof typeof finalParameters] === null ||
          finalParameters[key as keyof typeof finalParameters] === undefined
        ) {
          delete finalParameters[key as keyof typeof finalParameters];
        }
      });

      // Preserve enabled tools from the original prompt
      const enabledTools =
        targetInteraction.prompt.metadata?.enabledTools ?? [];

      // Prepare metadata for the regeneration payload
      const currentMetadata = {
        ...targetInteraction.prompt.metadata,
        regeneratedFromId: interactionId,
        modelId: modelToUse, // Use current model from prompt state
        attachedFiles: undefined, // Files are processed into messages, not needed in metadata here
        enabledTools: enabledTools, // Preserve original tools
      };

      // Prepare final AI payload for regeneration
      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages,
        parameters: finalParameters,
        metadata: currentMetadata,
        // Tools and toolChoice will be added by AIService based on metadata
      };

      emitter.emit("prompt:finalised", { prompt: aiPayload });
      console.log(
        `LiteChat: Submitting regeneration request for ${interactionId}:`,
        aiPayload,
      );

      try {
        // Pass the original promptTurnObject as the second argument
        await AIService.startInteraction(aiPayload, targetInteraction.prompt);
        console.log(
          `LiteChat: AIService regeneration interaction started for ${interactionId}.`,
        );
      } catch (e) {
        console.error(
          `LiteChat: Error starting regeneration for ${interactionId}:`,
          e,
        );
        toast.error("Failed to start regeneration.");
      }
    },
    [
      // buildHistoryMessages is a stable import
    ],
  );

  // --- Stop Interaction Handler ---
  const onStopInteraction = useCallback((interactionId: string) => {
    console.log(`LiteChat: Stopping interaction ${interactionId}`);
    AIService.stopInteraction(interactionId);
  }, []);

  // --- Memoized Controls ---
  // These selectors depend only on chatControls state, which is stable itself
  const sidebarControls = useMemo(
    () =>
      chatControls
        .filter(
          (c) =>
            (c.panel ?? "main") === "sidebar" && (c.show ? c.show() : true),
        )
        .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)),
    [chatControls],
  );

  const sidebarFooterControls = useMemo(
    () =>
      chatControls
        .filter(
          (c) => c.panel === "sidebar-footer" && (c.show ? c.show() : true),
        )
        .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)),
    [chatControls],
  );

  const headerControls = useMemo(
    () =>
      chatControls
        .filter((c) => c.panel === "header" && (c.show ? c.show() : true))
        .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)),
    [chatControls],
  );

  // --- Memoized Modal Renderers ---
  // Find the renderers once and memoize them
  const settingsModalRenderer = useMemo(
    () =>
      chatControls.find((c) => c.id === "core-settings-trigger")
        ?.settingsRenderer,
    [chatControls],
  );

  const projectSettingsModalRenderer = useMemo(
    () =>
      chatControls.find((c) => c.id === "core-project-settings-trigger")
        ?.settingsRenderer,
    [chatControls],
  );

  // Determine current conversation ID for ChatCanvas
  const currentConversationIdForCanvas =
    selectedItemType === "conversation" ? selectedItemId : null;

  // --- Render Logic ---
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">
            Initializing LiteChat...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "flex h-full w-full border border-[--border] rounded-lg overflow-hidden bg-background text-foreground",
        )}
      >
        {/* Sidebar */}
        <div
          className={cn(
            "hidden md:flex flex-col border-r border-[--border] bg-card",
            "transition-[width] duration-300 ease-in-out",
            "flex-shrink-0 overflow-hidden",
            isSidebarCollapsed ? "w-16" : "w-64",
          )}
        >
          <div className={cn("flex-grow overflow-y-auto overflow-x-hidden")}>
            <div className={cn(isSidebarCollapsed ? "hidden" : "block")}>
              <ChatControlWrapper
                controls={sidebarControls}
                panelId="sidebar"
                renderMode="full"
                className="h-full"
              />
            </div>
            <div className={cn(isSidebarCollapsed ? "block" : "hidden")}>
              <ChatControlWrapper
                controls={sidebarControls}
                panelId="sidebar"
                renderMode="icon"
                className="flex flex-col items-center gap-2 p-2"
              />
            </div>
          </div>
          <div
            className={cn(
              "flex-shrink-0 border-t border-[--border] p-2",
              isSidebarCollapsed
                ? "flex flex-col items-center gap-2"
                : "flex items-center justify-between",
            )}
          >
            <ChatControlWrapper
              controls={sidebarFooterControls}
              panelId="sidebar-footer"
              renderMode={isSidebarCollapsed ? "icon" : "full"}
              className={cn(
                "flex",
                isSidebarCollapsed ? "flex-col gap-2" : "items-center gap-1",
              )}
            />
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex flex-col flex-grow min-w-0">
          <div className="flex items-center justify-end p-2 border-b border-[--border] bg-card flex-shrink-0">
            <ChatControlWrapper
              controls={headerControls}
              panelId="header"
              className="flex items-center justify-end gap-1"
            />
          </div>

          <ChatCanvas
            conversationId={currentConversationIdForCanvas}
            interactions={interactions}
            onRegenerateInteraction={onRegenerateInteraction}
            onStopInteraction={onStopInteraction}
            status={interactionStatus}
            className="flex-grow overflow-y-hidden p-4 space-y-4"
          />

          {globalError && (
            <div className="p-2 bg-destructive text-destructive-foreground text-sm text-center">
              Error: {globalError}
            </div>
          )}

          <PromptWrapper
            InputAreaRenderer={InputArea}
            onSubmit={handlePromptSubmit}
            className="border-t border-[--border] bg-card flex-shrink-0"
          />
        </div>

        {/* Right Drawer (VFS) - Rendered conditionally by ChatControlWrapper */}
        <ChatControlWrapper
          controls={chatControls} // Pass all controls
          panelId="drawer_right"
          renderMode="full"
          // No specific className needed here, panel component handles its own styling
        />
      </div>

      {/* Render Modals - Use the memoized renderers */}
      {isChatControlPanelOpen["settingsModal"] &&
        settingsModalRenderer &&
        settingsModalRenderer()}
      {isProjectSettingsModalOpen &&
        projectSettingsModalRenderer &&
        projectSettingsModalRenderer()}

      <Toaster richColors position="bottom-left" closeButton />
    </>
  );
};
