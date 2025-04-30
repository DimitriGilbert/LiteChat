// src/components/LiteChat/LiteChat.tsx
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

// Import the registration FUNCTIONS/COMPONENTS
import { registerConversationListControl } from "@/hooks/litechat/registerConversationListControl";
import { registerSettingsControl } from "@/hooks/litechat/registerSettingsControl";
import { registerSidebarToggleControl } from "@/hooks/litechat/registerSidebarToggleControl";
import { registerGlobalModelSelector } from "@/hooks/litechat/registerGlobalModelSelector";
import { registerParameterControl } from "@/hooks/litechat/registerParameterControl";
import { registerFileControl } from "@/hooks/litechat/registerFileControl";
import { RegisterVfsControl } from "@/hooks/litechat/registerVfsControl";
import { registerGitSyncControl } from "@/hooks/litechat/registerGitSyncControl";
import { registerVfsTools } from "@/hooks/litechat/registerVfsTools";
import { registerGitTools } from "@/hooks/litechat/registerGitTools";
import { registerToolSelectorControl } from "@/hooks/litechat/registerToolSelectorControl";
import { RegisterProjectSettingsControl } from "@/hooks/litechat/registerProjectSettingsControl";
import { buildHistoryMessages } from "@/lib/litechat/ai-helpers";

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
  const [isInitializing, setIsInitializing] = useState(true);

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

  const registeredChatControls = useControlRegistryStore(
    (state) => state.chatControls,
  );
  const chatControls = useMemo(
    () => Object.values(registeredChatControls),
    [registeredChatControls],
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
  // Only need setVfsKey from VFS store now
  const { setVfsKey } = useVfsStore(
    useShallow((state) => ({
      setVfsKey: state.setVfsKey,
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

      // 4. Finalize initialization
      if (isMounted) {
        console.log("LiteChat: Initialization complete.");
        setIsInitializing(false);
      }
    };
    initialize();
    return () => {
      isMounted = false;
      console.log("LiteChat: Unmounting, initialization cancelled if pending.");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- VFS Context Management Effect ---
  // This effect now ONLY reacts to the VFS panel opening/closing
  // It determines the appropriate key when the panel opens.
  useEffect(() => {
    if (isVfsPanelOpen) {
      let targetVfsKey: string | null = null;
      if (selectedItemType === "project") {
        targetVfsKey = selectedItemId;
      } else if (selectedItemType === "conversation") {
        const convo = getConversationById(selectedItemId);
        targetVfsKey = convo?.projectId ?? "orphan";
      } else {
        targetVfsKey = "orphan";
      }
      console.log(
        `[LiteChat Effect] VFS Panel Opened. Setting target key: ${targetVfsKey}`,
      );
      setVfsKey(targetVfsKey); // Trigger VFS store to potentially initialize/switch
    } else {
      // Panel is closed. We don't necessarily change the key here,
      // as another context (like Project Settings modal) might be active.
      // The VFS store retains its current key until explicitly changed.
      console.log("[LiteChat Effect] VFS Panel Closed.");
      // REMOVED: setIsVfsEnabledForItem(false);
    }
  }, [
    isVfsPanelOpen,
    selectedItemId,
    selectedItemType,
    getConversationById,
    setVfsKey,
    // REMOVED: setIsVfsEnabledForItem,
  ]);
  // --- End VFS Context Management Effect ---

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

      const effectiveSettings = getEffectiveProjectSettings(currentProjectId);
      const modelToUse =
        effectiveSettings.modelId ??
        useProviderStore.getState().selectedModelId;

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

      const systemPrompt = effectiveSettings.systemPrompt ?? undefined;

      const finalParameters = {
        temperature:
          turnData.parameters?.temperature ?? effectiveSettings.temperature,
        max_tokens:
          turnData.parameters?.max_tokens ?? effectiveSettings.maxTokens,
        top_p: turnData.parameters?.top_p ?? effectiveSettings.topP,
        top_k: turnData.parameters?.top_k ?? effectiveSettings.topK,
        presence_penalty:
          turnData.parameters?.presence_penalty ??
          effectiveSettings.presencePenalty,
        frequency_penalty:
          turnData.parameters?.frequency_penalty ??
          effectiveSettings.frequencyPenalty,
        ...turnData.parameters,
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
    ],
  );

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

      const effectiveSettings = getEffectiveProjectSettings(currentProjectId);
      const modelToUse =
        effectiveSettings.modelId ??
        useProviderStore.getState().selectedModelId;

      if (!modelToUse) {
        toast.error("Please select a model before regenerating.");
        return;
      }
      const { providerId } = splitModelId(modelToUse);
      if (!providerId) {
        toast.error("Invalid model selection for regeneration.");
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

      const systemPrompt = effectiveSettings.systemPrompt ?? undefined;

      const finalParameters = {
        temperature:
          targetInteraction.prompt.parameters?.temperature ??
          effectiveSettings.temperature,
        max_tokens:
          targetInteraction.prompt.parameters?.max_tokens ??
          effectiveSettings.maxTokens,
        top_p:
          targetInteraction.prompt.parameters?.top_p ?? effectiveSettings.topP,
        top_k:
          targetInteraction.prompt.parameters?.top_k ?? effectiveSettings.topK,
        presence_penalty:
          targetInteraction.prompt.parameters?.presence_penalty ??
          effectiveSettings.presencePenalty,
        frequency_penalty:
          targetInteraction.prompt.parameters?.frequency_penalty ??
          effectiveSettings.frequencyPenalty,
        ...targetInteraction.prompt.parameters,
      };
      Object.keys(finalParameters).forEach((key) => {
        if (
          finalParameters[key as keyof typeof finalParameters] === null ||
          finalParameters[key as keyof typeof finalParameters] === undefined
        ) {
          delete finalParameters[key as keyof typeof finalParameters];
        }
      });

      const currentMetadata = {
        ...targetInteraction.prompt.metadata,
        regeneratedFromId: interactionId,
        providerId: providerId,
        modelId: modelToUse,
        attachedFiles: undefined,
        enabledTools: targetInteraction.prompt.metadata?.enabledTools,
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

  const onStopInteraction = useCallback((interactionId: string) => {
    console.log(`LiteChat: Stopping interaction ${interactionId}`);
    AIService.stopInteraction(interactionId);
  }, []);

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
      {/* Render the registration components */}
      <RegisterProjectSettingsControl />
      <RegisterVfsControl />
      <div
        className={cn(
          "flex h-full w-full border border-[--border] rounded-lg overflow-hidden bg-background text-foreground",
        )}
      >
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
      </div>
      {/* Render Main Settings Modal */}
      {isChatControlPanelOpen["settingsModal"] &&
        settingsModalRenderer &&
        settingsModalRenderer()}
      {/* Render Project Settings Modal */}
      {isProjectSettingsModalOpen &&
        projectSettingsModalRenderer &&
        projectSettingsModalRenderer()}
      {/* Update Toaster props */}
      <Toaster richColors position="bottom-left" closeButton />
    </>
  );
};
