// src/components/LiteChat/LiteChat.tsx
import React, { useEffect, useCallback } from "react";
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
// Import CoreMessage type correctly
import type { CoreMessage } from "ai";
import { InputArea } from "./prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { emitter } from "@/lib/litechat/event-emitter";
import { cn } from "@/lib/utils";
import { InteractionCard } from "./canvas/InteractionCard";
import { toast } from "sonner";

// Import control registration hooks/components
import { useConversationListControlRegistration } from "./chat/control/ConversationList";
import { useSettingsControlRegistration } from "./chat/control/Settings";
import { useModelProviderControlRegistration } from "./prompt/control/ModelProvider";
import { useParameterControlRegistration } from "./prompt/control/ParameterControlRegistration";
import { useFileControlRegistration } from "./prompt/control/FileControlRegistration";
import { useVfsControlRegistration } from "./prompt/control/VfsControlRegistration";

export const LiteChat: React.FC = () => {
  // --- Store Hooks ---
  const {
    selectedConversationId,
    loadConversations,
    addConversation,
    selectConversation,
  } = useConversationStore(
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
  // Use correct action name from ProviderStore
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
  useModelProviderControlRegistration();
  useParameterControlRegistration();
  useFileControlRegistration();
  useVfsControlRegistration();

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
  const handlePromptSubmit = useCallback(
    async (turnData: PromptTurnObject) => {
      let currentConvId = selectedConversationId;

      if (!currentConvId) {
        console.log("LiteChat: No conversation selected, creating new one...");
        try {
          currentConvId = await addConversation({ title: "New Chat" });
          selectConversation(currentConvId);
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
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const currentHistory = useInteractionStore.getState().interactions;
      // Corrected mapping: Ensure only valid CoreMessages are included
      const messages: CoreMessage[] = currentHistory
        .filter(
          (i) =>
            i.type === "message.user_assistant" && i.status === "COMPLETED",
        )
        .flatMap((i): CoreMessage[] => {
          // Return CoreMessage[] explicitly
          const msgs: CoreMessage[] = [];
          // Ensure prompt content is string before adding user message
          if (i.prompt?.content && typeof i.prompt.content === "string") {
            msgs.push({ role: "user", content: i.prompt.content });
          }
          // Ensure response is string before adding assistant message
          if (i.response && typeof i.response === "string") {
            msgs.push({ role: "assistant", content: i.response });
          }
          // TODO: Handle non-string/complex assistant responses if needed
          return msgs;
        }); // No need for filter(Boolean) after flatMap if logic is correct

      // Add the current user turn to the messages
      if (typeof turnData.content === "string" && turnData.content.trim()) {
        messages.push({ role: "user", content: turnData.content });
      } else if (typeof turnData.content === "object") {
        console.warn("Multi-modal content in turnData not fully handled yet.");
        messages.push({ role: "user", content: "[User provided content]" });
      }

      const systemPrompt = globalSystemPrompt;

      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages, // Use the correctly typed array
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
        toast.error(
          `Failed to start AI interaction: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [
      selectedConversationId,
      addConversation,
      selectConversation,
      setCurrentConversationId,
      globalSystemPrompt,
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

      const historyUpToIndex = targetInteraction.index;
      const historyUpToParent = interactionStore.interactions.filter(
        (i) => i.index < historyUpToIndex,
      );

      // Corrected mapping
      const messages: CoreMessage[] = historyUpToParent
        .filter(
          (i) =>
            i.type === "message.user_assistant" && i.status === "COMPLETED",
        )
        .flatMap((i): CoreMessage[] => {
          // Return CoreMessage[] explicitly
          const msgs: CoreMessage[] = [];
          if (i.prompt?.content && typeof i.prompt.content === "string") {
            msgs.push({ role: "user", content: i.prompt.content });
          }
          if (i.response && typeof i.response === "string") {
            msgs.push({ role: "assistant", content: i.response });
          }
          return msgs;
        }); // No need for filter

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

      const systemPrompt = useSettingsStore.getState().globalSystemPrompt;

      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages, // Use correctly typed array
        parameters: targetInteraction.prompt.parameters,
        metadata: {
          ...targetInteraction.prompt.metadata,
          regeneratedFromId: interactionId,
        },
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
    [globalSystemPrompt],
  );

  // --- Stop Handler ---
  const onStopInteraction = useCallback((interactionId: string) => {
    console.log(`LiteChat: Stopping interaction ${interactionId}`);
    AIService.stopInteraction(interactionId);
  }, []);

  // --- Render Logic ---
  const sidebarControls = chatControls
    .filter(
      (c) => (c.panel ?? "main") === "sidebar" && (c.show ? c.show() : true),
    )
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

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
        {/* Header Area */}
        <ChatControlWrapper
          controls={chatControls}
          panelId="header"
          className="flex items-center justify-end p-2 border-b bg-card flex-shrink-0"
        />

        {/* Chat Canvas - Remove unused allInteractions prop */}
        <ChatCanvas
          conversationId={selectedConversationId}
          interactions={interactions}
          interactionRenderer={(interaction /* Removed allInteractions */) => (
            <InteractionCard
              key={interaction.id}
              interaction={interaction}
              // allInteractions={allInteractions} // Removed
              onRegenerate={onRegenerateInteraction}
            />
          )}
          streamingInteractionsRenderer={(ids) => (
            <StreamingInteractionRenderer
              interactionIds={ids}
              onStop={onStopInteraction}
            />
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

      {/* Render the Settings Modal */}
      {settingsModalRenderer && settingsModalRenderer()}

      {/* Toast Notifications */}
      <Toaster richColors position="top-right" />
    </div>
  );
};
