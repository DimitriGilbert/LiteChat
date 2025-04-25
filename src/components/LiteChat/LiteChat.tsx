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
// Removed unused db import
import { Toaster } from "@/components/ui/sonner";
import type { CoreMessage } from "ai";
import { InputArea } from "./prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { emitter } from "@/lib/litechat/event-emitter"; // Import emitter
import { useConversationListControlRegistration } from "./chat/control/ConversationList";
import { useSettingsControlRegistration } from "./chat/control/Settings";
import { useModelProviderControlRegistration } from "./prompt/control/ModelProvider";

export const LiteChat: React.FC = () => {
  const { selectedConversationId, loadConversations } = useConversationStore(
    useShallow((state) => ({
      selectedConversationId: state.selectedConversationId,
      loadConversations: state.loadConversations,
    })),
  );
  const {
    interactions,
    status: interactionStatus,
    // Removed unused streamingInteractionIds
  } = useInteractionStore(
    useShallow((state) => ({
      interactions: state.interactions,
      status: state.status,
      // streamingInteractionIds: state.streamingInteractionIds, // Removed
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

  // Register core controls
  useConversationListControlRegistration();
  useSettingsControlRegistration();
  useModelProviderControlRegistration();

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      if (!isMounted) return;
      await loadSettings();
      if (!isMounted) return;
      await loadProviderData();
      if (!isMounted) return;
      await loadConversations();
      if (!isMounted) return;
      await loadDbMods();
      if (!isMounted) return;
      try {
        const currentDbMods = useModStore.getState().dbMods;
        if (!isMounted) return;
        const loaded = await loadMods(currentDbMods);
        if (isMounted) setLoadedMods(loaded);
      } catch (error) {
        console.error("LiteChat: Failed to load mods:", error);
      }
      if (isMounted) console.log("LiteChat: Initialization complete.");
    };
    initialize();
    return () => {
      isMounted = false;
    };
  }, [
    loadConversations,
    loadDbMods,
    setLoadedMods,
    loadProviderData,
    loadSettings,
  ]);

  const handlePromptSubmit = async (turnData: PromptTurnObject) => {
    let currentConvId = selectedConversationId;
    if (!currentConvId) {
      currentConvId = await useConversationStore
        .getState()
        .addConversation({ title: "New Chat" });
      useConversationStore.getState().selectConversation(currentConvId);
      await new Promise((resolve) => setTimeout(resolve, 0)); // Allow state update
    }
    const interactionState = useInteractionStore.getState();
    if (interactionState.currentConversationId !== currentConvId) {
      interactionState.setCurrentConversationId(currentConvId);
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

    // TODO: Get conversation-specific system prompt override
    const systemPrompt = defaultSystemPrompt;

    const aiPayload: PromptObject = {
      system: systemPrompt,
      messages: messages,
      parameters: turnData.parameters,
      metadata: turnData.metadata,
    };

    emitter.emit("prompt:finalised", { prompt: aiPayload }); // Emit event before AI call

    try {
      await AIService.startInteraction(aiPayload, turnData);
    } catch (e) {
      console.error("Error starting AI interaction:", e);
    }
  };

  const sidebarControls = chatControls
    .filter(
      (c) => (c.panel ?? "main") === "sidebar" && (c.show ? c.show() : true),
    )
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  return (
    <div className="flex h-full w-full border rounded-lg overflow-hidden bg-background text-foreground">
      <ChatControlWrapper
        controls={sidebarControls}
        panelId="sidebar"
        className="w-64 border-r hidden md:flex flex-col bg-card"
      />
      <div className="flex flex-col flex-grow min-w-0">
        <ChatCanvas
          conversationId={selectedConversationId}
          interactions={interactions}
          // Removed unused allInteractions parameter
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
        {globalError && (
          <div className="p-2 bg-destructive text-destructive-foreground text-sm text-center">
            Error: {globalError}
          </div>
        )}
        <PromptWrapper
          InputAreaRenderer={(props) => <InputArea {...props} />}
          onSubmit={handlePromptSubmit}
          className="border-t bg-card flex-shrink-0"
        />
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
};
