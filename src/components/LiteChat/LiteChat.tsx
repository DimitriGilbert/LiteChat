// src/components/LiteChat/LiteChat.tsx
import React, { useEffect, useCallback, useMemo } from "react"; // Added useMemo
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
import { loadMods } from "@/modding/loader";
import { Toaster } from "@/components/ui/sonner";
import type { CoreMessage, ToolResultPart } from "ai";
import { InputArea } from "@/components/LiteChat/prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { emitter } from "@/lib/litechat/event-emitter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Interaction } from "@/types/litechat/interaction";

// Import control registration hooks/components
import { useConversationListControlRegistration } from "@/hooks/litechat/useConversationListControl";
import { useSettingsControlRegistration } from "@/components/LiteChat/chat/control/Settings";
import { useSidebarToggleControlRegistration } from "@/components/LiteChat/chat/control/SidebarToggleControl";
import { useGlobalModelSelectorRegistration } from "@/components/LiteChat/prompt/control/GlobalModelSelectorRegistration";
import { useParameterControlRegistration } from "@/components/LiteChat/prompt/control/ParameterControlRegistration";
import { useFileControlRegistration } from "@/components/LiteChat/prompt/control/FileControlRegistration";
import { useVfsControlRegistration } from "@/components/LiteChat/prompt/control/VfsControlRegistration";
import { useGitSyncControlRegistration } from "@/components/LiteChat/prompt/control/GitSyncControlRegistration";

// Helper to split combined ID remains the same
const splitModelId = (
  combinedId: string | null,
): { providerId: string | null; modelId: string | null } => {
  if (!combinedId || !combinedId.includes(":")) {
    return { providerId: null, modelId: null };
  }
  const parts = combinedId.split(":");
  const providerId = parts[0];
  const modelId = parts.slice(1).join(":");
  return { providerId, modelId };
};

export const LiteChat: React.FC = () => {
  // --- Store Hooks ---
  const {
    selectedItemId, // Use selectedItemId
    selectedItemType, // Use selectedItemType
    loadSidebarItems, // Use loadSidebarItems
    addConversation,
    selectItem, // Use selectItem
    getProjectById, // Get project selector
  } = useConversationStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      loadSidebarItems: state.loadSidebarItems,
      addConversation: state.addConversation,
      selectItem: state.selectItem,
      getProjectById: state.getProjectById,
    })),
  );
  const {
    interactions,
    status: interactionStatus,
    setCurrentConversationId,
  } = useInteractionStore(
    useShallow((state) => ({
      interactions: state.interactions,
      status: state.status,
      setCurrentConversationId: state.setCurrentConversationId,
    })),
  );
  // Only select the state needed for layout, not the modal open state itself
  const { globalError, isSidebarCollapsed } = useUIStateStore(
    useShallow((state) => ({
      globalError: state.globalError,
      isSidebarCollapsed: state.isSidebarCollapsed,
    })),
  );
  // Select the modal open state separately for the modal renderer
  const isSettingsModalOpen = useUIStateStore(
    (state) => state.isChatControlPanelOpen["settingsModal"] ?? false,
  );

  const registeredChatControls = useControlRegistryStore(
    (state) => state.chatControls,
  );
  // Memoize the derived control lists
  const chatControls = useMemo(
    () => Object.values(registeredChatControls),
    [registeredChatControls],
  );
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
  const { loadSettings, globalSystemPrompt } = useSettingsStore(
    useShallow((state) => ({
      loadSettings: state.loadSettings,
      globalSystemPrompt: state.globalSystemPrompt,
    })),
  );

  // --- Register Core Controls ---
  useConversationListControlRegistration();
  useSettingsControlRegistration();
  useSidebarToggleControlRegistration();
  useGlobalModelSelectorRegistration();
  useParameterControlRegistration();
  useFileControlRegistration();
  useVfsControlRegistration();
  useGitSyncControlRegistration();

  // --- Initialization Effect ---
  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      console.log("LiteChat: Starting initialization...");
      if (!isMounted) return;
      await loadSettings();
      console.log("LiteChat: Settings loaded.");
      if (!isMounted) return;
      await loadProviderData();
      console.log("LiteChat: Provider data loaded.");
      if (!isMounted) return;
      await loadSidebarItems(); // Use loadSidebarItems
      console.log("LiteChat: Sidebar items loaded.");
      if (!isMounted) return;
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
      if (isMounted) console.log("LiteChat: Initialization complete.");
    };
    initialize();
    return () => {
      isMounted = false;
      console.log("LiteChat: Unmounting, initialization cancelled if pending.");
    };
  }, [
    loadSidebarItems, // Use loadSidebarItems
    loadDbMods,
    setLoadedMods,
    loadProviderData,
    loadSettings,
  ]);

  // --- History Construction Helper --- (remains the same)
  const buildHistoryMessages = useCallback(
    (historyInteractions: Interaction[]): CoreMessage[] => {
      return historyInteractions.flatMap((i): CoreMessage[] => {
        const msgs: CoreMessage[] = [];
        if (i.prompt?.content && typeof i.prompt.content === "string") {
          msgs.push({ role: "user", content: i.prompt.content });
        }
        if (i.response && typeof i.response === "string") {
          msgs.push({ role: "assistant", content: i.response });
        }
        if (i.metadata?.toolCalls && Array.isArray(i.metadata.toolCalls)) {
          msgs.push({
            role: "assistant",
            content: i.metadata.toolCalls,
          });
        }
        if (i.metadata?.toolResults && Array.isArray(i.metadata.toolResults)) {
          i.metadata.toolResults.forEach((result: ToolResultPart) => {
            msgs.push({
              role: "tool",
              content: [result],
            });
          });
        }
        return msgs;
      });
    },
    [],
  );

  // --- Prompt Submission Handler ---
  const handlePromptSubmit = useCallback(
    async (turnData: PromptTurnObject) => {
      let currentConvId =
        selectedItemType === "conversation" ? selectedItemId : null;
      const currentProjectId =
        selectedItemType === "project"
          ? selectedItemId
          : selectedItemType === "conversation"
            ? (useConversationStore
                .getState()
                .getConversationById(selectedItemId)?.projectId ?? null)
            : null;

      const setFocusInputFlag = useUIStateStore.getState().setFocusInputFlag;

      const selectedModelCombinedId =
        useProviderStore.getState().selectedModelId;
      if (!selectedModelCombinedId) {
        toast.error("Please select a model before sending a message.");
        return;
      }

      if (!currentConvId) {
        console.log("LiteChat: No conversation selected, creating new one...");
        try {
          currentConvId = await addConversation({
            title: "New Chat",
            projectId: currentProjectId, // Add to current project if any
          });
          selectItem(currentConvId, "conversation"); // Use selectItem
          setTimeout(() => setFocusInputFlag(true), 0);
          await new Promise((resolve) => setTimeout(resolve, 0));
          console.log(
            `LiteChat: New conversation created and selected: ${currentConvId}`,
          );
        } catch (error) {
          console.error("LiteChat: Failed to create new conversation", error);
          toast.error("Failed to start new chat.");
          return;
        }
      }

      const interactionState = useInteractionStore.getState();
      if (interactionState.currentConversationId !== currentConvId) {
        console.log(
          `LiteChat: Syncing InteractionStore to conversation ${currentConvId}`,
        );
        setCurrentConversationId(currentConvId);
        setTimeout(() => setFocusInputFlag(true), 0);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const currentHistory = useInteractionStore.getState().interactions;
      const completedHistory = currentHistory.filter(
        (i) => i.status === "COMPLETED" && i.type === "message.user_assistant",
      );
      const messages: CoreMessage[] = buildHistoryMessages(completedHistory);

      if (turnData.content) {
        messages.push({ role: "user", content: turnData.content });
      } else {
        console.warn("LiteChat: Submitting prompt without text content.");
      }

      // Determine system prompt: Project > Global
      const project = getProjectById(currentProjectId);
      const systemPrompt =
        project?.systemPrompt ?? globalSystemPrompt ?? undefined;

      // TODO: Determine model/parameters: Project > Global

      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages,
        parameters: turnData.parameters, // TODO: Merge with project/global defaults
        metadata: turnData.metadata,
      };

      emitter.emit("prompt:finalised", { prompt: aiPayload });
      console.log("LiteChat: Submitting prompt to AIService:", aiPayload);

      try {
        await AIService.startInteraction(aiPayload, turnData);
        console.log("LiteChat: AIService interaction started.");
      } catch (e) {
        console.error("LiteChat: Error starting AI interaction:", e);
        toast.error(
          `Failed to start AI interaction: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [
      selectedItemId,
      selectedItemType,
      addConversation,
      selectItem,
      setCurrentConversationId,
      globalSystemPrompt,
      buildHistoryMessages,
      getProjectById,
    ],
  );

  // --- Regeneration Handler --- (Needs update for project context)
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

      // --- Get current conversation and project context ---
      const currentConversation = useConversationStore
        .getState()
        .getConversationById(targetInteraction.conversationId);
      const currentProjectId = currentConversation?.projectId ?? null;
      const project = getProjectById(currentProjectId);
      // ---

      // --- Determine Model ---
      // TODO: Use Project setting -> Global setting
      const selectedModelCombinedId =
        useProviderStore.getState().selectedModelId;
      if (!selectedModelCombinedId) {
        toast.error("Please select a model before regenerating.");
        return;
      }
      const { providerId, modelId } = splitModelId(selectedModelCombinedId);
      if (!providerId || !modelId) {
        toast.error("Invalid model selection for regeneration.");
        return;
      }
      // ---

      const historyUpToIndex = targetInteraction.index;
      const historyInteractions = interactionStore.interactions
        .filter(
          (i) =>
            i.conversationId === targetInteraction.conversationId && // Ensure history is from the same conversation
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
      } else {
        console.error(
          `LiteChat: Cannot regenerate - missing or invalid user prompt content in interaction ${interactionId}.`,
        );
        toast.error("Cannot regenerate: Original user prompt missing.");
        return;
      }

      // Determine system prompt: Project > Global
      const systemPrompt =
        project?.systemPrompt ??
        useSettingsStore.getState().globalSystemPrompt ??
        undefined;

      // TODO: Determine parameters: Project > Global > Interaction snapshot

      const currentMetadata = {
        ...targetInteraction.prompt.metadata,
        regeneratedFromId: interactionId,
        providerId: providerId,
        modelId: modelId,
      };

      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages,
        parameters: targetInteraction.prompt.parameters, // TODO: Merge with project/global
        metadata: currentMetadata,
      };

      emitter.emit("prompt:finalised", { prompt: aiPayload });
      console.log(
        `LiteChat: Submitting regeneration request for ${interactionId}:`,
        aiPayload,
      );

      try {
        // Pass the original prompt turn object for snapshotting
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
    [buildHistoryMessages, getProjectById],
  );

  // --- Stop Handler --- (remains the same)
  const onStopInteraction = useCallback((interactionId: string) => {
    console.log(`LiteChat: Stopping interaction ${interactionId}`);
    AIService.stopInteraction(interactionId);
  }, []);

  // --- Memoize Control Lists ---
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

  // Find the settings modal renderer once
  const settingsModalRenderer = useMemo(
    () =>
      chatControls.find((c) => c.id === "core-settings-trigger")
        ?.settingsRenderer,
    [chatControls],
  );

  // Determine the current conversation ID for ChatCanvas
  const currentConversationIdForCanvas =
    selectedItemType === "conversation" ? selectedItemId : null;

  return (
    <>
      {/* Main Chat Layout */}
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
          {/* Main sidebar content area */}
          <div className={cn("flex-grow overflow-y-auto overflow-x-hidden")}>
            {/* Always render the wrapper, control visibility with classes */}
            <div className={cn(isSidebarCollapsed ? "hidden" : "block")}>
              <ChatControlWrapper
                controls={sidebarControls}
                panelId="sidebar"
                renderMode="full"
                className="h-full" // Ensure wrapper takes height
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
          {/* Footer */}
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

        {/* Main Chat Area - Should shrink/grow */}
        <div className="flex flex-col flex-grow min-w-0">
          {/* Header */}
          <div className="flex items-center justify-end p-2 border-b border-[--border] bg-card flex-shrink-0">
            <ChatControlWrapper
              controls={headerControls} // Use memoized header controls
              panelId="header"
              className="flex items-center justify-end gap-1"
            />
          </div>

          {/* Chat Canvas */}
          <ChatCanvas
            conversationId={currentConversationIdForCanvas} // Pass the derived ID
            interactions={interactions}
            onRegenerateInteraction={onRegenerateInteraction}
            onStopInteraction={onStopInteraction}
            status={interactionStatus}
            className="flex-grow overflow-y-auto p-4 space-y-4"
          />

          {/* Global Error Display */}
          {globalError && (
            <div className="p-2 bg-destructive text-destructive-foreground text-sm text-center">
              Error: {globalError}
            </div>
          )}

          {/* Prompt Input Area */}
          <PromptWrapper
            InputAreaRenderer={InputArea}
            onSubmit={handlePromptSubmit}
            className="border-t border-[--border] bg-card flex-shrink-0"
          />
        </div>
      </div>

      {/* Render the Settings Modal only when needed */}
      {isSettingsModalOpen && settingsModalRenderer && settingsModalRenderer()}

      {/* Toast Notifications */}
      <Toaster richColors position="top-right" />
    </>
  );
};
