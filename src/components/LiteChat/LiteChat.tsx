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
// Removed unused ToolCallPart import
import type { CoreMessage, ToolResultPart } from "ai"; // Import tool types
import { InputArea } from "./prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { emitter } from "@/lib/litechat/event-emitter";
import { cn } from "@/lib/utils";
// Removed unused InteractionCard import
import { toast } from "sonner";
import type { Interaction } from "@/types/litechat/interaction"; // Import Interaction type

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

  // --- History Construction Helper ---
  const buildHistoryMessages = (
    historyInteractions: Interaction[],
  ): CoreMessage[] => {
    return historyInteractions.flatMap((i): CoreMessage[] => {
      const msgs: CoreMessage[] = [];
      // Add user message if it exists and is string
      if (i.prompt?.content && typeof i.prompt.content === "string") {
        msgs.push({ role: "user", content: i.prompt.content });
      }
      // Add assistant message (text part)
      if (i.response && typeof i.response === "string") {
        msgs.push({ role: "assistant", content: i.response });
      }
      // Add tool calls and results from metadata if they exist
      if (i.metadata?.toolCalls && Array.isArray(i.metadata.toolCalls)) {
        msgs.push({
          role: "assistant",
          content: i.metadata.toolCalls, // Pass the array of tool calls
        });
      }
      if (i.metadata?.toolResults && Array.isArray(i.metadata.toolResults)) {
        i.metadata.toolResults.forEach((result: ToolResultPart) => {
          msgs.push({
            role: "tool",
            content: [result], // Wrap individual result in an array as per CoreMessage spec
          });
        });
      }
      return msgs;
    });
  };

  // --- Prompt Submission Handler ---
  const handlePromptSubmit = useCallback(
    async (turnData: PromptTurnObject) => {
      let currentConvId = selectedConversationId;

      if (!currentConvId) {
        console.log("LiteChat: No conversation selected, creating new one...");
        try {
          currentConvId = await addConversation({ title: "New Chat" });
          selectConversation(currentConvId);
          await new Promise((resolve) => setTimeout(resolve, 0)); // Allow state update
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
        await new Promise((resolve) => setTimeout(resolve, 0)); // Allow state update
      }

      // Get the latest interactions for history building
      const currentHistory = useInteractionStore.getState().interactions;
      // Filter for completed interactions to build history
      const completedHistory = currentHistory.filter(
        (i) => i.status === "COMPLETED",
      );
      const messages: CoreMessage[] = buildHistoryMessages(completedHistory);

      // Add the current user turn to the messages
      // TODO: Handle multi-modal turnData.content properly
      if (typeof turnData.content === "string" && turnData.content.trim()) {
        messages.push({ role: "user", content: turnData.content });
      } else if (typeof turnData.content === "object") {
        console.warn("Multi-modal content in turnData not fully handled yet.");
        // Placeholder for multi-modal content
        messages.push({
          role: "user",
          content: [{ type: "text", text: "[User provided content]" }],
        });
      }

      const systemPrompt = globalSystemPrompt || undefined;

      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages,
        parameters: turnData.parameters,
        metadata: turnData.metadata,
        // toolChoice: 'auto', // Example: Let AI decide if tools are available
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
      buildHistoryMessages, // Add helper to dependencies
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

      // History should go up to the index *before* the one being regenerated
      const historyUpToIndex = targetInteraction.index;
      // Get completed interactions before the target index
      const historyInteractions = interactionStore.interactions
        .filter((i) => i.index < historyUpToIndex && i.status === "COMPLETED")
        // Ensure we only include the latest completed version for each index
        .reduce(
          (acc, i) => {
            const existing = acc[i.index];
            if (
              !existing ||
              (i.startedAt &&
                existing.startedAt &&
                i.startedAt > existing.startedAt)
            ) {
              acc[i.index] = i;
            }
            return acc;
          },
          {} as Record<number, Interaction>,
        );

      const messages: CoreMessage[] = buildHistoryMessages(
        Object.values(historyInteractions).sort((a, b) => a.index - b.index),
      );

      // Add the user prompt from the interaction being regenerated
      if (
        targetInteraction.prompt?.content &&
        typeof targetInteraction.prompt.content === "string"
      ) {
        messages.push({
          role: "user",
          content: targetInteraction.prompt.content,
        });
      } else {
        // Handle potential multi-modal prompt content if necessary
        console.error(
          `LiteChat: Cannot regenerate - missing or invalid user prompt content in interaction ${interactionId}.`,
        );
        toast.error("Cannot regenerate: Original user prompt missing.");
        return;
      }

      const systemPrompt =
        useSettingsStore.getState().globalSystemPrompt || undefined;

      // Use the original turn data's parameters and metadata, but mark as regeneration
      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages,
        parameters: targetInteraction.prompt.parameters,
        metadata: {
          ...targetInteraction.prompt.metadata,
          regeneratedFromId: interactionId, // Mark the source
        },
        // toolChoice: 'auto', // Consider tool choice for regeneration
      };

      emitter.emit("prompt:finalised", { prompt: aiPayload });
      console.log(
        `LiteChat: Submitting regeneration request for ${interactionId}:`,
        aiPayload,
      );

      try {
        // Pass the original PromptTurnObject as the initiating data for the new interaction
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
    [buildHistoryMessages], // Add helper to dependencies
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

        {/* Chat Canvas - Pass allInteractions */}
        {/* Line 398 */}
        <ChatCanvas
          conversationId={selectedConversationId}
          interactions={interactions}
          // interactionRenderer prop removed as ChatCanvas handles rendering internally
          onRegenerateInteraction={onRegenerateInteraction}
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
