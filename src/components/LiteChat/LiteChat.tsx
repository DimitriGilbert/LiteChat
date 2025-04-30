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
  const {
    selectedItemId,
    selectedItemType,
    loadSidebarItems,
    addConversation,
    selectItem,
    getConversationById,
    getEffectiveProjectSettings,
  } = useConversationStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      loadSidebarItems: state.loadSidebarItems,
      addConversation: state.addConversation,
      selectItem: state.selectItem,
      getProjectById: state.getProjectById,
      getConversationById: state.getConversationById,
      getEffectiveProjectSettings: state.getEffectiveProjectSettings,
      isLoading: state.isLoading,
    })),
  );
  const { interactions, status: interactionStatus } = useInteractionStore(
    useShallow((state) => ({
      interactions: state.interactions,
      status: state.status,
    })),
  );
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

  const { loadDbMods, setLoadedMods } = useModStore(
    useShallow((state) => ({
      loadDbMods: state.loadDbMods,
      setLoadedMods: state.setLoadedMods,
      isLoading: state.isLoading,
    })),
  );
  const { loadInitialData: loadProviderData } = useProviderStore(
    useShallow((state) => ({
      loadInitialData: state.loadInitialData,
      isLoading: state.isLoading,
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
    const initialize = async () => {
      console.log("LiteChat: Starting initialization...");
      setIsInitializing(true);
      if (!isMounted) return;

      // 1. Load core data
      await loadSettings();
      console.log("LiteChat: Settings loaded.");
      if (!isMounted) return;
      await loadProviderData();
      console.log("LiteChat: Provider data loaded.");
      if (!isMounted) return;
      await loadSidebarItems();
      console.log("LiteChat: Sidebar items loaded.");
      if (!isMounted) return;

      // 2. Register core controls and tools
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

      // 3. Load mods
      await loadDbMods();
      console.log("LiteChat: DB Mods loaded.");
      if (!isMounted) return;
      try {
        const currentDbMods = useModStore.getState().dbMods;
        console.log(`LiteChat: Loading ${currentDbMods.length} mods...`);
        if (!isMounted) return;
        const loaded = await loadMods(currentDbMods);
        if (isMounted) {
          setLoadedMods(loaded);
          console.log(`LiteChat: ${loaded.length} mods processed.`);
        }
      } catch (error) {
        console.error("LiteChat: Failed to load mods:", error);
      }

      // 4. Initialize Prompt State based on initial context
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
                .getConversationById(initialSelectedItemId)?.projectId ?? null)
            : null;
      const initialEffectiveSettings =
        getEffectiveProjectSettings(initialProjectId);
      initializePromptState(initialEffectiveSettings);
      console.log(
        "LiteChat: Initial prompt state initialized.",
        initialEffectiveSettings,
      );

      // 5. Finalize initialization
      if (isMounted) {
        console.log("LiteChat: Initialization complete.");
        setIsInitializing(false);
      }
    };
    initialize();
    return () => {
      isMounted = false;
      console.log("LiteChat: Unmounting, initialization cancelled if pending.");
      // Consider adding unregistration logic here if necessary,
      // though usually not needed for singleton stores/controls.
    };
    // Keep dependencies minimal for initialization
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Effect to update Prompt State on Context Change ---
  useEffect(() => {
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
    const effectiveSettings = getEffectiveProjectSettings(currentProjectId);
    initializePromptState(effectiveSettings);
    console.log(
      "[LiteChat Effect] Prompt state updated based on context change.",
      effectiveSettings,
    );
  }, [
    selectedItemId,
    selectedItemType,
    getConversationById, // Stable reference from store
    getEffectiveProjectSettings, // Stable reference from store
    initializePromptState, // Stable reference from store
    isInitializing,
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
    if (useVfsStore.getState().vfsKey !== targetVfsKey) {
      setVfsKey(targetVfsKey);
    }
  }, [
    isVfsPanelOpen,
    selectedItemId,
    selectedItemType,
    getConversationById, // Stable reference
    setVfsKey, // Stable reference
  ]);

  // --- Prompt Submission Handler ---
  const handlePromptSubmit = useCallback(
    async (turnData: PromptTurnObject) => {
      let currentConvId =
        useConversationStore.getState().selectedItemType === "conversation"
          ? useConversationStore.getState().selectedItemId
          : null;
      const currentProjectId =
        useConversationStore.getState().selectedItemType === "project"
          ? useConversationStore.getState().selectedItemId
          : useConversationStore.getState().selectedItemType === "conversation"
            ? (useConversationStore
                .getState()
                .getConversationById(
                  useConversationStore.getState().selectedItemId,
                )?.projectId ?? null)
            : null;

      const setFocusInputFlag = useUIStateStore.getState().setFocusInputFlag;

      // Get settings for THIS turn from the PromptStateStore
      const promptState = usePromptStateStore.getState();
      const modelToUse = promptState.modelId;
      const systemPrompt =
        getEffectiveProjectSettings(currentProjectId).systemPrompt ?? undefined;

      if (!modelToUse) {
        toast.error("Please select a model before sending a message.");
        return;
      }

      if (!currentConvId) {
        console.log("LiteChat: No conversation selected, creating new one...");
        try {
          const newId = await addConversation({
            title: "New Chat",
            projectId: currentProjectId,
          });
          await selectItem(newId, "conversation");
          currentConvId = useConversationStore.getState().selectedItemId;
          if (currentConvId !== newId) {
            console.error(
              "LiteChat: Mismatch between created ID and selected ID after selection!",
            );
            currentConvId = newId;
          }
          console.log(
            `LiteChat: New conversation created (${currentConvId}), selected, and InteractionStore synced.`,
          );
          setTimeout(() => setFocusInputFlag(true), 0);
        } catch (error) {
          console.error("LiteChat: Failed to create new conversation", error);
          toast.error("Failed to start new chat.");
          return;
        }
      }

      const currentHistory = useInteractionStore.getState().interactions;
      const completedHistory = currentHistory.filter(
        (i) => i.status === "COMPLETED" && i.type === "message.user_assistant",
      );
      const messages: CoreMessage[] = buildHistoryMessages(completedHistory);

      if (turnData.content) {
        messages.push({ role: "user", content: turnData.content });
      } else if (turnData.metadata?.attachedFiles?.length) {
        messages.push({ role: "user", content: "" });
      } else {
        console.error("LiteChat: Attempting to submit with no content.");
        toast.error("Cannot send an empty message.");
        return;
      }

      const finalParameters = {
        temperature: promptState.temperature,
        max_tokens: promptState.maxTokens,
        top_p: promptState.topP,
        top_k: promptState.topK,
        presence_penalty: promptState.presencePenalty,
        frequency_penalty: promptState.frequencyPenalty,
        ...(turnData.parameters ?? {}),
      };

      Object.keys(finalParameters).forEach((key) => {
        if (
          finalParameters[key as keyof typeof finalParameters] === null ||
          finalParameters[key as keyof typeof finalParameters] === undefined
        ) {
          delete finalParameters[key as keyof typeof finalParameters];
        }
      });

      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages,
        parameters: finalParameters,
        metadata: {
          ...turnData.metadata,
          modelId: modelToUse,
        },
      };

      emitter.emit("prompt:finalised", { prompt: aiPayload });
      console.log("LiteChat: Submitting prompt to AIService:", aiPayload);

      try {
        await AIService.startInteraction(aiPayload, turnData);
        console.log("LiteChat: AIService interaction started.");
        // Reset prompt state AFTER successful submission start
        resetPromptState();
        // Re-initialize based on current context
        const effectiveSettings = getEffectiveProjectSettings(currentProjectId);
        initializePromptState(effectiveSettings);
      } catch (e) {
        console.error("LiteChat: Error starting AI interaction:", e);
        toast.error(
          `Failed to start AI interaction: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [
      addConversation,
      selectItem,
      buildHistoryMessages,
      getEffectiveProjectSettings,
      resetPromptState,
      initializePromptState,
    ],
  );

  // --- Regeneration Handler ---
  const onRegenerateInteraction = useCallback(
    async (interactionId: string) => {
      console.log(`LiteChat: Regenerating interaction ${interactionId}`);
      const interactionStore = useInteractionStore.getState();
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

      const currentConversation = getConversationById(
        targetInteraction.conversationId,
      );
      const currentProjectId = currentConversation?.projectId ?? null;

      // Use the current prompt state for regeneration
      const promptState = usePromptStateStore.getState();
      const modelToUse = promptState.modelId;
      const systemPrompt =
        getEffectiveProjectSettings(currentProjectId).systemPrompt ?? undefined;

      if (!modelToUse) {
        toast.error("Please select a model before regenerating.");
        return;
      }

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

      if (
        targetInteraction.prompt?.content &&
        typeof targetInteraction.prompt.content === "string"
      ) {
        messages.push({
          role: "user",
          content: targetInteraction.prompt.content,
        });
      } else if (targetInteraction.prompt?.metadata?.attachedFiles?.length) {
        messages.push({ role: "user", content: "" });
      } else {
        console.error(
          `LiteChat: Cannot regenerate - missing or invalid user prompt content in interaction ${interactionId}.`,
        );
        toast.error("Cannot regenerate: Original user prompt missing.");
        return;
      }

      const finalParameters = {
        temperature: promptState.temperature,
        max_tokens: promptState.maxTokens,
        top_p: promptState.topP,
        top_k: promptState.topK,
        presence_penalty: promptState.presencePenalty,
        frequency_penalty: promptState.frequencyPenalty,
        ...(targetInteraction.prompt.parameters ?? {}),
      };
      Object.keys(finalParameters).forEach((key) => {
        if (
          finalParameters[key as keyof typeof finalParameters] === null ||
          finalParameters[key as keyof typeof finalParameters] === undefined
        ) {
          delete finalParameters[key as keyof typeof finalParameters];
        }
      });

      const enabledTools =
        targetInteraction.prompt.metadata?.enabledTools ?? [];

      const currentMetadata = {
        ...targetInteraction.prompt.metadata,
        regeneratedFromId: interactionId,
        modelId: modelToUse,
        attachedFiles: undefined,
        enabledTools: enabledTools,
      };

      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages,
        parameters: finalParameters,
        metadata: currentMetadata,
      };

      emitter.emit("prompt:finalised", { prompt: aiPayload });
      console.log(
        `LiteChat: Submitting regeneration request for ${interactionId}:`,
        aiPayload,
      );

      try {
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
    [buildHistoryMessages, getConversationById, getEffectiveProjectSettings],
  );

  // --- Stop Interaction Handler ---
  const onStopInteraction = useCallback((interactionId: string) => {
    console.log(`LiteChat: Stopping interaction ${interactionId}`);
    AIService.stopInteraction(interactionId);
  }, []);

  // --- Memoized Controls ---
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
