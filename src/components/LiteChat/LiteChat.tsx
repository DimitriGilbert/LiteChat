// src/components/LiteChat/LiteChat.tsx
import React, { useEffect, useCallback } from "react";
import { PromptWrapper } from "./prompt/PromptWrapper";
import { ChatCanvas } from "./canvas/ChatCanvas";
import { ChatControlWrapper } from "./chat/ChatControlWrapper";
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
import { InputArea } from "./prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { emitter } from "@/lib/litechat/event-emitter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Interaction } from "@/types/litechat/interaction";

// Import control registration hooks/components
import { useConversationListControlRegistration } from "./chat/control/ConversationList";
import { useSettingsControlRegistration } from "./chat/control/Settings";
import { useGlobalModelSelectorRegistration } from "./prompt/control/GlobalModelSelectorRegistration";
import { useParameterControlRegistration } from "./prompt/control/ParameterControlRegistration";
import { useFileControlRegistration } from "./prompt/control/FileControlRegistration";
import { useVfsControlRegistration } from "./prompt/control/VfsControlRegistration";

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
  // --- Store Hooks --- (remain the same)
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

  // --- Register Core Controls --- (remains the same)
  useConversationListControlRegistration();
  useSettingsControlRegistration();
  useGlobalModelSelectorRegistration();
  useParameterControlRegistration();
  useFileControlRegistration();
  useVfsControlRegistration();

  // --- Initialization Effect --- (remains the same)
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

  // --- History Construction Helper --- (remains the same)
  const buildHistoryMessages = useCallback(
    (historyInteractions: Interaction[]): CoreMessage[] => {
      return historyInteractions.flatMap((i): CoreMessage[] => {
        const msgs: CoreMessage[] = [];
        // Add user message if it exists in the interaction's prompt
        if (i.prompt?.content && typeof i.prompt.content === "string") {
          msgs.push({ role: "user", content: i.prompt.content });
        }
        // Add assistant response if it exists
        if (i.response && typeof i.response === "string") {
          msgs.push({ role: "assistant", content: i.response });
        }
        // Add tool calls if they exist in metadata
        if (i.metadata?.toolCalls && Array.isArray(i.metadata.toolCalls)) {
          msgs.push({
            role: "assistant",
            content: i.metadata.toolCalls,
          });
        }
        // Add tool results if they exist in metadata
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
      let currentConvId = selectedConversationId;

      const selectedModelCombinedId =
        useProviderStore.getState().selectedModelId;
      if (!selectedModelCombinedId) {
        toast.error("Please select a model before sending a message.");
        return;
      }

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

      // --- REMOVED: User interaction creation block ---

      // Now prepare the AI payload using history *before* the current turn
      // Fetch history *before* this turn starts
      const currentHistory = useInteractionStore.getState().interactions;
      // Filter for completed interactions only to build history
      const completedHistory = currentHistory.filter(
        (i) => i.status === "COMPLETED" && i.type === "message.user_assistant",
      );
      const messages: CoreMessage[] = buildHistoryMessages(completedHistory);

      // Add the current user message from turnData to the history for the AI call
      if (turnData.content) {
        messages.push({ role: "user", content: turnData.content });
        // TODO: Handle potential file content addition to messages if needed by SDK
      } else {
        // Handle cases where there might be only files/VFS data?
        // This might require adding a placeholder or specific handling based on SDK.
        console.warn("LiteChat: Submitting prompt without text content.");
        // Potentially add a placeholder user message if required by the model
        // messages.push({ role: 'user', content: '[User submitted files/data]' });
      }

      const systemPrompt = globalSystemPrompt || undefined;

      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages, // History now includes the latest user message
        parameters: turnData.parameters,
        metadata: turnData.metadata, // Metadata from controls
        // tools and toolChoice will be added by AIService based on registry
      };

      emitter.emit("prompt:finalised", { prompt: aiPayload });
      console.log("LiteChat: Submitting prompt to AIService:", aiPayload);

      try {
        // Start the AI interaction, passing the original turnData
        // AIService will now create the single Interaction object
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
      buildHistoryMessages,
    ],
  );

  // --- Regeneration Handler ---
  const onRegenerateInteraction = useCallback(
    async (interactionId: string) => {
      console.log(`LiteChat: Regenerating interaction ${interactionId}`);
      const interactionStore = useInteractionStore.getState();
      // Find the interaction to regenerate FROM (this interaction contains the prompt)
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

      // Ensure it's a user_assistant type interaction we're regenerating
      if (targetInteraction.type !== "message.user_assistant") {
        console.error(
          `LiteChat: Cannot regenerate non-user_assistant interaction: ${interactionId}`,
        );
        toast.error("Can only regenerate from a user message interaction.");
        return;
      }

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

      const historyUpToIndex = targetInteraction.index;
      // Fetch history *before* the interaction being regenerated
      // Filter for completed interactions only
      const historyInteractions = interactionStore.interactions
        .filter(
          (i) =>
            i.index < historyUpToIndex &&
            i.status === "COMPLETED" &&
            i.type === "message.user_assistant", // Ensure we only take completed turns
        )
        .sort((a, b) => a.index - b.index); // Sort by index

      const messages: CoreMessage[] = buildHistoryMessages(historyInteractions);

      // Add the user prompt content *from the interaction being regenerated*
      if (
        targetInteraction.prompt?.content &&
        typeof targetInteraction.prompt.content === "string"
      ) {
        messages.push({
          role: "user",
          content: targetInteraction.prompt.content,
        });
        // TODO: Handle potential file content from targetInteraction.prompt if needed
      } else {
        console.error(
          `LiteChat: Cannot regenerate - missing or invalid user prompt content in interaction ${interactionId}.`,
        );
        toast.error("Cannot regenerate: Original user prompt missing.");
        return;
      }

      const systemPrompt =
        useSettingsStore.getState().globalSystemPrompt || undefined;

      // Use original parameters/metadata from the prompt object within the interaction
      const currentMetadata = {
        ...targetInteraction.prompt.metadata,
        regeneratedFromId: interactionId, // Link to the interaction ID being regenerated
        providerId: providerId, // Use current selection
        modelId: modelId, // Use current selection
      };

      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages, // History includes the user message being regenerated
        parameters: targetInteraction.prompt.parameters,
        metadata: currentMetadata,
      };

      emitter.emit("prompt:finalised", { prompt: aiPayload });
      console.log(
        `LiteChat: Submitting regeneration request for ${interactionId}:`,
        aiPayload,
      );

      try {
        // Start interaction, passing the original prompt data (PromptTurnObject)
        // AIService will create a *new* interaction object for this regeneration attempt,
        // linked via parentId implicitly by the history calculation.
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
    [buildHistoryMessages], // Dependencies might need adjustment
  );

  // --- Stop Handler --- (remains the same)
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
    <>
      {/* Main Chat Layout */}
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

          {/* Chat Canvas */}
          <ChatCanvas
            conversationId={selectedConversationId}
            interactions={interactions} // Pass the full interactions list
            onRegenerateInteraction={onRegenerateInteraction}
            onStopInteraction={onStopInteraction} // Pass the handler
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
      </div>

      {/* Render the Settings Modal */}
      {settingsModalRenderer && settingsModalRenderer()}

      {/* Toast Notifications */}
      <Toaster richColors position="top-right" />
    </>
  );
};
