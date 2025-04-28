// src/components/LiteChat/LiteChat.tsx
import React, { useEffect, useCallback, useMemo } from "react";
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
import type { CoreMessage, ToolResultPart, ToolCallPart } from "ai"; // Import necessary types
import { InputArea } from "@/components/LiteChat/prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { emitter } from "@/lib/litechat/event-emitter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Interaction } from "@/types/litechat/interaction";

// Import control registration hooks/components from their new locations
import { useConversationListControlRegistration } from "@/hooks/litechat/useConversationListControl";
import { useSettingsControlRegistration } from "@/hooks/litechat/useSettingsControlRegistration"; // Updated path
import { useSidebarToggleControlRegistration } from "@/hooks/litechat/useSidebarToggleControlRegistration"; // Updated path
import { useGlobalModelSelectorRegistration } from "@/hooks/litechat/useGlobalModelSelectorRegistration"; // Updated path
import { useParameterControlRegistration } from "@/hooks/litechat/useParameterControlRegistration"; // Updated path
import { useFileControlRegistration } from "@/hooks/litechat/useFileControlRegistration"; // Updated path
import { useVfsControlRegistration } from "@/hooks/litechat/useVfsControlRegistration"; // Updated path
import { useGitSyncControlRegistration } from "@/hooks/litechat/useGitSyncControlRegistration"; // Updated path

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
    selectedItemId,
    selectedItemType,
    loadSidebarItems,
    addConversation,
    selectItem,
    getProjectById,
    getConversationById, // Added for convenience
  } = useConversationStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      loadSidebarItems: state.loadSidebarItems,
      addConversation: state.addConversation,
      selectItem: state.selectItem,
      getProjectById: state.getProjectById,
      getConversationById: state.getConversationById, // Added
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
  const { globalError, isSidebarCollapsed } = useUIStateStore(
    useShallow((state) => ({
      globalError: state.globalError,
      isSidebarCollapsed: state.isSidebarCollapsed,
    })),
  );
  const isSettingsModalOpen = useUIStateStore(
    (state) => state.isChatControlPanelOpen["settingsModal"] ?? false,
  );

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
  useSettingsControlRegistration(); // Uses imported hook
  useSidebarToggleControlRegistration(); // Uses imported hook
  useGlobalModelSelectorRegistration(); // Uses imported hook
  useParameterControlRegistration(); // Uses imported hook
  useFileControlRegistration(); // Uses imported hook
  useVfsControlRegistration(); // Uses imported hook
  useGitSyncControlRegistration(); // Uses imported hook

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
      await loadSidebarItems();
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
    loadSidebarItems,
    loadDbMods,
    setLoadedMods,
    loadProviderData,
    loadSettings,
  ]);

  // --- History Construction Helper ---
  // Updated to handle tool calls and results correctly
  const buildHistoryMessages = useCallback(
    (historyInteractions: Interaction[]): CoreMessage[] => {
      return historyInteractions.flatMap((i): CoreMessage[] => {
        const msgs: CoreMessage[] = [];

        // Add user message (if it exists)
        // Note: File content is handled by AIService before the call
        if (i.prompt?.content && typeof i.prompt.content === "string") {
          // For history, we only need the text part. Files are handled in the *current* turn.
          msgs.push({ role: "user", content: i.prompt.content });
        } else if (
          i.prompt?.metadata?.attachedFiles &&
          i.prompt.metadata.attachedFiles.length > 0 &&
          !i.prompt?.content // Handle case where only files were attached
        ) {
          // Add a placeholder or summary if needed, but often just the assistant response is enough context
          // For simplicity, we might omit the user turn if it was *only* files and no text.
          // Or, add a generic placeholder:
          // msgs.push({ role: 'user', content: '[Files attached]' });
        }

        // Add assistant response (text part)
        if (i.response && typeof i.response === "string") {
          msgs.push({ role: "assistant", content: i.response });
        }

        // Add assistant tool calls (parse from stored strings)
        if (i.metadata?.toolCalls && Array.isArray(i.metadata.toolCalls)) {
          const validToolCalls: ToolCallPart[] = [];
          i.metadata.toolCalls.forEach((callStr) => {
            try {
              const parsedCall = JSON.parse(callStr);
              // Basic validation for ToolCallPart structure
              if (
                parsedCall &&
                parsedCall.type === "tool-call" &&
                parsedCall.toolCallId &&
                parsedCall.toolName &&
                parsedCall.args !== undefined
              ) {
                validToolCalls.push(parsedCall as ToolCallPart);
              } else {
                console.warn(
                  "[LiteChat] buildHistory: Invalid tool call structure after parsing:",
                  callStr,
                );
              }
            } catch (e) {
              console.error(
                "[LiteChat] buildHistory: Failed to parse tool call string:",
                callStr,
                e,
              );
            }
          });
          if (validToolCalls.length > 0) {
            // Add a single message with an array of tool calls
            msgs.push({
              role: "assistant",
              content: validToolCalls, // Assign the array of ToolCallPart
            });
          }
        }

        // Add tool results (parse from stored strings)
        if (i.metadata?.toolResults && Array.isArray(i.metadata.toolResults)) {
          const validToolResults: ToolResultPart[] = [];
          i.metadata.toolResults.forEach((resultStr) => {
            try {
              const parsedResult = JSON.parse(resultStr);
              // Basic validation for ToolResultPart structure
              if (
                parsedResult &&
                parsedResult.type === "tool-result" &&
                parsedResult.toolCallId &&
                parsedResult.toolName &&
                parsedResult.result !== undefined
              ) {
                validToolResults.push(parsedResult as ToolResultPart);
              } else {
                console.warn(
                  "[LiteChat] buildHistory: Invalid tool result structure after parsing:",
                  resultStr,
                );
              }
            } catch (e) {
              console.error(
                "[LiteChat] buildHistory: Failed to parse tool result string:",
                resultStr,
                e,
              );
            }
          });
          if (validToolResults.length > 0) {
            // Add a single message with an array of tool results
            msgs.push({
              role: "tool",
              content: validToolResults, // Assign the array of ToolResultPart
            });
          }
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
            ? (getConversationById(selectedItemId)?.projectId ?? null)
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
            projectId: currentProjectId,
          });
          selectItem(currentConvId, "conversation");
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
      // Use the updated buildHistoryMessages
      const messages: CoreMessage[] = buildHistoryMessages(completedHistory);

      // Add the current user input as the last message
      // AIService will handle injecting file content into this message if needed
      if (turnData.content) {
        messages.push({ role: "user", content: turnData.content });
      } else if (turnData.metadata?.attachedFiles?.length) {
        // If only files are attached, add an empty user message for AIService to populate
        messages.push({ role: "user", content: "" });
      } else {
        // This case should be prevented by PromptWrapper's submit check, but handle defensively
        console.error("LiteChat: Attempting to submit with no content.");
        toast.error("Cannot send an empty message.");
        return;
      }

      const project = getProjectById(currentProjectId);
      const systemPrompt =
        project?.systemPrompt ?? globalSystemPrompt ?? undefined;

      // Construct the initial AI payload. File content processing happens in AIService.
      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages, // Now includes the current user message text
        parameters: turnData.parameters,
        metadata: turnData.metadata, // Pass metadata (including basic file info)
      };

      emitter.emit("prompt:finalised", { prompt: aiPayload });
      console.log("LiteChat: Submitting prompt to AIService:", aiPayload);

      try {
        // Pass the original turnData (with file content) to AIService
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
      buildHistoryMessages, // Use updated helper
      getProjectById,
      getConversationById, // Added dependency
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
      const project = getProjectById(currentProjectId);

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

      // Fetch history up to the interaction *before* the one being regenerated
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

      // Use the updated buildHistoryMessages
      const messages: CoreMessage[] = buildHistoryMessages(historyInteractions);

      // Add the user message content from the interaction being regenerated
      if (
        targetInteraction.prompt?.content &&
        typeof targetInteraction.prompt.content === "string"
      ) {
        messages.push({
          role: "user",
          content: targetInteraction.prompt.content,
        });
      } else if (targetInteraction.prompt?.metadata?.attachedFiles?.length) {
        // If only files were attached in the original prompt
        messages.push({ role: "user", content: "" });
      } else {
        console.error(
          `LiteChat: Cannot regenerate - missing or invalid user prompt content in interaction ${interactionId}.`,
        );
        toast.error("Cannot regenerate: Original user prompt missing.");
        return;
      }

      const systemPrompt =
        project?.systemPrompt ??
        useSettingsStore.getState().globalSystemPrompt ??
        undefined;

      // Metadata for the AI payload (not the interaction itself yet)
      const currentMetadata = {
        ...targetInteraction.prompt.metadata,
        regeneratedFromId: interactionId,
        providerId: providerId, // Ensure provider/model are set for this specific call
        modelId: modelId,
        // Remove attachedFiles from metadata sent to AI, AIService handles it
        attachedFiles: undefined,
      };

      const aiPayload: PromptObject = {
        system: systemPrompt,
        messages: messages, // History + current user message text
        parameters: targetInteraction.prompt.parameters,
        metadata: currentMetadata,
      };

      emitter.emit("prompt:finalised", { prompt: aiPayload });
      console.log(
        `LiteChat: Submitting regeneration request for ${interactionId}:`,
        aiPayload,
      );

      try {
        // Pass the original PromptTurnObject (targetInteraction.prompt)
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
    [buildHistoryMessages, getProjectById, getConversationById], // Use updated helper
  );

  // --- Stop Handler ---
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

  const settingsModalRenderer = useMemo(
    () =>
      chatControls.find((c) => c.id === "core-settings-trigger")
        ?.settingsRenderer,
    [chatControls],
  );

  const currentConversationIdForCanvas =
    selectedItemType === "conversation" ? selectedItemId : null;

  return (
    <>
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
            className="flex-grow overflow-y-auto p-4 space-y-4"
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

      {isSettingsModalOpen && settingsModalRenderer && settingsModalRenderer()}

      <Toaster richColors position="top-right" />
    </>
  );
};
