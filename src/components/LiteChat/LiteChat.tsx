// src/components/LiteChat/LiteChat.tsx
import React, { useEffect, useMemo } from "react"; // Import useMemo
import { PromptWrapper } from "./prompt/PromptWrapper";
import { ChatCanvas } from "./canvas/ChatCanvas";
import { ChatControlWrapper } from "./chat/ChatControlWrapper";
import { StreamingInteractionRenderer } from "./canvas/StreamingInteractionRenderer";
import { useConversationStore } from "@/store/conversation.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useUIStateStore } from "@/store/ui.store";
import { useControlRegistryStore } from "@/store/control.store";
import type {
  PromptTurnObject,
  PromptObject,
} from "@/types/litechat/prompt.types";
import { AIService } from "@/services/ai.service";
import { useModStore } from "@/store/mod.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { loadMods } from "@/modding/loader";
import { db } from "@/lib/litechat/db";
import { Toaster } from "@/components/ui/sonner";
import type { CoreMessage } from "ai";
import { InputArea } from "./prompt/InputArea";
import { useShallow } from "zustand/react/shallow";

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
    streamingInteractionIds,
  } = useInteractionStore(
    useShallow((state) => ({
      interactions: state.interactions,
      status: state.status,
      streamingInteractionIds: state.streamingInteractionIds,
    })),
  );
  const globalError = useUIStateStore((state) => state.globalError);

  // --- FIX: Select the object, not the values array ---
  const registeredChatControls = useControlRegistryStore(
    (state) => state.chatControls,
  );
  // Derive the array inside the component
  const chatControls = useMemo(
    () => Object.values(registeredChatControls),
    [registeredChatControls], // Re-run only when the controls object reference changes
  );
  // --- END FIX ---

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

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates after unmount
    const initialize = async () => {
      console.log("LiteChat: Initializing...");
      // Prevent multiple initializations if StrictMode runs effects twice
      if (!isMounted) return;
      await loadSettings();
      if (!isMounted) return;
      await loadProviderData();
      if (!isMounted) return;
      await loadConversations();
      if (!isMounted) return;
      await loadDbMods();
      if (!isMounted) return;
      // TODO: Select initial/last conversation
      try {
        // Get potentially updated mods state after loading
        const currentDbMods = useModStore.getState().dbMods;
        if (!isMounted) return;
        const loaded = await loadMods(currentDbMods);
        if (isMounted) {
          setLoadedMods(loaded);
        }
      } catch (error) {
        console.error("LiteChat: Failed to load mods:", error);
      }
      if (isMounted) {
        console.log("LiteChat: Initialization complete.");
      }
    };
    initialize();
    return () => {
      isMounted = false; // Cleanup flag
    };
    // Add all dependencies for the effect
  }, [
    loadConversations,
    loadDbMods,
    setLoadedMods,
    loadProviderData,
    loadSettings,
  ]);

  const handlePromptSubmit = async (turnData: PromptTurnObject) => {
    console.log("Prompt turn submitted:", turnData);
    let currentConvId = selectedConversationId;
    let isNewConversation = false;

    if (!currentConvId) {
      // Use await directly on the async action
      currentConvId = await useConversationStore
        .getState()
        .addConversation({ title: "New Chat" });
      // Select the new conversation immediately after getting the ID
      useConversationStore.getState().selectConversation(currentConvId);
      isNewConversation = true;
      // Give state a chance to settle - though ideally selection should trigger necessary updates
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const interactionState = useInteractionStore.getState();
    // Ensure the interaction store is pointing to the right conversation
    if (interactionState.currentConversationId !== currentConvId) {
      interactionState.setCurrentConversationId(currentConvId);
      // If it was just created, interactions should be empty, no need to wait for load
      if (!isNewConversation) {
        await new Promise((resolve) => setTimeout(resolve, 0)); // Allow store update if loading existing
      }
    }

    // Re-fetch history *after* potential conversation switch
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
          interactionRenderer={(interaction, allInteractions) => (
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
