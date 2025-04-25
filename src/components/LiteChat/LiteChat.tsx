// src/components/LiteChat/LiteChat.tsx
import React, { useEffect } from "react";
import { PromptWrapper } from "./prompt/PromptWrapper";
import { ChatCanvas } from "./canvas/ChatCanvas";
import { ChatControlWrapper } from "./chat/ChatControlWrapper";
import { StreamingInteractionRenderer } from "./canvas/StreamingInteractionRenderer";
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
import type { CoreMessage } from "ai";
import { InputArea } from "./prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { emitter } from "@/lib/litechat/event-emitter";
import { cn } from "@/lib/utils";

// Import control registration hooks/components
import { useConversationListControlRegistration } from "./chat/control/ConversationList";
import { useSettingsControlRegistration } from "./chat/control/Settings";
import { useModelProviderControlRegistration } from "./prompt/control/ModelProvider";

export const LiteChat: React.FC = () => {
  // --- Store Hooks ---
  const { selectedConversationId, loadConversations, addConversation } =
    useConversationStore(
      useShallow((state) => ({
        selectedConversationId: state.selectedConversationId,
        loadConversations: state.loadConversations,
        addConversation: state.addConversation,
        selectConversation: state.selectConversation,
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
  const globalError = useUIStateStore((state) => state.globalError);
  const registeredChatControls = useControlRegistryStore(
    (state) => state.chatControls,
  );
  const chatControls = React.useMemo(
    () => Object.values(registeredChatControls),
    [registeredChatControls],
  );
  const { loadDbMods, setLoadedMods } = useModStore(
    useShallow((state) => ({
      loadDbMods: state.loadDbMods,
      setLoadedMods: state.setLoadedMods,
    })),
  );
  const loadProviderData = useProviderStore((state) => state.loadInitialData);
  const { loadSettings, defaultSystemPrompt } = useSettingsStore(
    useShallow((state) => ({
      loadSettings: state.loadSettings,
      defaultSystemPrompt: state.defaultSystemPrompt,
    })),
  );

  // --- Register Core Controls ---
  // These hooks run once on mount and register the controls
  useConversationListControlRegistration();
  useSettingsControlRegistration();
  useModelProviderControlRegistration();

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
      await loadConversations();
      console.log("LiteChat: Conversations loaded.");
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
    loadConversations,
    loadDbMods,
    setLoadedMods,
    loadProviderData,
    loadSettings,
  ]);

  // --- Prompt Submission Handler ---
  const handlePromptSubmit = async (turnData: PromptTurnObject) => {
    let currentConvId = selectedConversationId;

    if (!currentConvId) {
      console.log("LiteChat: No conversation selected, creating new one...");
      try {
        currentConvId = await addConversation({ title: "New Chat" });
        useConversationStore.getState().selectConversation(currentConvId);
        await new Promise((resolve) => setTimeout(resolve, 0));
        console.log(
          `LiteChat: New conversation created and selected: ${currentConvId}`,
        );
      } catch (error) {
        console.error("LiteChat: Failed to create new conversation", error);
        return;
      }
    }

    const interactionState = useInteractionStore.getState();
    if (interactionState.currentConversationId !== currentConvId) {
      console.log(
        `LiteChat: Syncing InteractionStore to conversation ${currentConvId}`,
      );
      setCurrentConversationId(currentConvId);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const currentHistory = useInteractionStore.getState().interactions;
    const messages: CoreMessage[] = currentHistory
      .filter(
        (i) => i.type === "message.user_assistant" && i.status === "COMPLETED",
      )
      .flatMap((i) => [
        i.prompt ? { role: "user", content: i.prompt.content as string } : null,
        i.response ? { role: "assistant", content: i.response } : null,
      ])
      .filter((m): m is CoreMessage => m !== null);

    messages.push({ role: "user", content: turnData.content as string });

    const systemPrompt = defaultSystemPrompt;

    const aiPayload: PromptObject = {
      system: systemPrompt,
      messages: messages,
      parameters: turnData.parameters,
      metadata: turnData.metadata,
    };

    emitter.emit("prompt:finalised", { prompt: aiPayload });
    console.log("LiteChat: Submitting prompt to AIService:", aiPayload);

    try {
      await AIService.startInteraction(aiPayload, turnData);
      console.log("LiteChat: AIService interaction started.");
    } catch (e) {
      console.error("LiteChat: Error starting AI interaction:", e);
    }
  };

  // --- Render Logic ---
  const sidebarControls = chatControls
    .filter(
      (c) => (c.panel ?? "main") === "sidebar" && (c.show ? c.show() : true),
    )
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  // Find the settings modal renderer
  const settingsModalRenderer = chatControls.find(
    (c) => c.id === "core-settings-trigger",
  )?.settingsRenderer;

  return (
    <div
      className={cn(
        "flex h-full w-full border rounded-lg overflow-hidden bg-background text-foreground",
      )}
    >
      {/* Sidebar */}
      <ChatControlWrapper
        controls={sidebarControls}
        panelId="sidebar"
        className="w-64 border-r hidden md:flex flex-col bg-card"
      />

      {/* Main Chat Area */}
      <div className="flex flex-col flex-grow min-w-0">
        {/* Header Area - Example using ChatControlWrapper */}
        <ChatControlWrapper
          controls={chatControls}
          panelId="header"
          className="flex items-center justify-end p-2 border-b bg-card flex-shrink-0" // Example styling
        />

        {/* Chat Canvas */}
        <ChatCanvas
          conversationId={selectedConversationId}
          interactions={interactions}
          interactionRenderer={(interaction) => (
            <div
              key={interaction.id}
              className="p-3 my-2 border rounded-md shadow-sm bg-card"
            >
              <div className="text-xs text-muted-foreground mb-1">
                Idx:{interaction.index}{" "}
                {interaction.parentId &&
                  `(Parent:${interaction.parentId.substring(0, 4)})`}{" "}
                | {interaction.type} | {interaction.status}
              </div>
              {interaction.prompt && (
                <pre className="text-xs bg-muted p-1 rounded mb-1 overflow-x-auto">
                  TurnData: {JSON.stringify(interaction.prompt)}
                </pre>
              )}
              <pre className="text-sm whitespace-pre-wrap">
                {typeof interaction.response === "string" ||
                interaction.response === null
                  ? interaction.response
                  : JSON.stringify(interaction.response)}
              </pre>
            </div>
          )}
          streamingInteractionsRenderer={(ids) => (
            <StreamingInteractionRenderer interactionIds={ids} />
          )}
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
          InputAreaRenderer={(props) => <InputArea {...props} />}
          onSubmit={handlePromptSubmit}
          className="border-t bg-card flex-shrink-0"
        />
      </div>

      {/* Render the Settings Modal if its renderer exists */}
      {settingsModalRenderer && settingsModalRenderer()}

      {/* Toast Notifications */}
      <Toaster richColors position="top-right" />
    </div>
  );
};
