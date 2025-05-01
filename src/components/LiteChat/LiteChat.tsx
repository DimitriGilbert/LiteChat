// src/components/LiteChat/LiteChat.tsx
// Entire file content provided
import React, {
  useEffect,
  useCallback,
  useMemo,
  useState,
  useRef,
} from "react";
import { PromptWrapper } from "@/components/LiteChat/prompt/PromptWrapper";
import { ChatCanvas } from "@/components/LiteChat/canvas/ChatCanvas";
import { ChatControlWrapper } from "@/components/LiteChat/chat/ChatControlWrapper";
import { useConversationStore } from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useUIStateStore } from "@/store/ui.store";
import { useControlRegistryStore } from "@/store/control.store";
import type { PromptTurnObject } from "@/types/litechat/prompt";
// Import NEW services
import { ConversationService } from "@/services/conversation.service";
import { InteractionService } from "@/services/interaction.service";
import { useModStore } from "@/store/mod.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useVfsStore } from "@/store/vfs.store";
import { loadMods } from "@/modding/loader";
import { Toaster } from "@/components/ui/sonner";
// CoreMessage and buildHistoryMessages are no longer needed here
import { InputArea } from "@/components/LiteChat/prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { registerConversationListControl } from "@/hooks/litechat/registerConversationListControl";
import { registerSettingsControl } from "@/hooks/litechat/registerSettingsControl";
import { registerSidebarToggleControl } from "@/hooks/litechat/registerSidebarToggleControl";
import { registerParameterControl } from "@/hooks/litechat/registerParameterControl";
import { registerFileControl } from "@/hooks/litechat/registerFileControl";
import { registerVfsControl } from "@/hooks/litechat/registerVfsControl";
import { registerGitSyncControl } from "@/hooks/litechat/registerGitSyncControl";
import { registerVfsTools } from "@/hooks/litechat/registerVfsTools";
import { registerGitTools } from "@/hooks/litechat/registerGitTools";
import { registerToolSelectorControl } from "@/hooks/litechat/registerToolSelectorControl";
import { registerProjectSettingsControl } from "@/hooks/litechat/registerProjectSettingsControl";
import { usePromptStateStore } from "@/store/prompt.store";
import { registerGlobalModelSelector } from "@/hooks/litechat/registerGlobalModelSelector";
import { registerSystemPromptControl } from "@/hooks/litechat/registerSystemPromptControl";

export const LiteChat: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);

  // --- Store Hooks  ---
  const { selectedItemId, selectedItemType, loadSidebarItems } =
    useConversationStore(
      useShallow((state) => ({
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
        loadSidebarItems: state.loadSidebarItems,
        getConversationById: state.getConversationById,
      })),
    );
  const { getEffectiveProjectSettings } = useProjectStore(
    useShallow((state) => ({
      getProjectById: state.getProjectById,
      getEffectiveProjectSettings: state.getEffectiveProjectSettings,
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
  const chatControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.chatControls)),
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
  // Get only initializePromptState from PromptStateStore
  const { initializePromptState } = usePromptStateStore(
    useShallow((state) => ({
      initializePromptState: state.initializePromptState,
      // resetTransientParameters removed
    })),
  );

  // --- Initialization Effect (remains the same) ---
  useEffect(() => {
    let isMounted = true;
    const initializeApp = async () => {
      console.log("LiteChat: Starting initialization...");
      setIsInitializing(true);

      try {
        console.log("LiteChat: Loading core data...");
        await loadSettings();
        if (!isMounted) return;
        console.log("LiteChat: Settings loaded.");
        await loadProviderData();
        if (!isMounted) return;
        console.log("LiteChat: Provider data loaded.");
        await loadSidebarItems();
        if (!isMounted) return;
        console.log("LiteChat: Sidebar items loaded.");

        console.log("LiteChat: Registering core controls and tools...");
        registerConversationListControl();
        registerSettingsControl();
        registerSidebarToggleControl();
        registerGlobalModelSelector();
        registerSystemPromptControl(); // Add the call here
        registerParameterControl();
        registerFileControl();
        registerGitSyncControl();
        registerVfsTools();
        registerGitTools();
        registerToolSelectorControl();
        registerVfsControl();
        registerProjectSettingsControl();
        console.log("LiteChat: Core controls and tools registered.");
        if (!isMounted) return;

        console.log("LiteChat: Loading mods...");
        await loadDbMods();
        if (!isMounted) return;
        console.log("LiteChat: DB Mods loaded.");
        const currentDbMods = useModStore.getState().dbMods;
        console.log(`LiteChat: Processing ${currentDbMods.length} mods...`);
        const loadedModInstances = await loadMods(currentDbMods);
        if (!isMounted) return;
        setLoadedMods(loadedModInstances);
        console.log(`LiteChat: ${loadedModInstances.length} mods processed.`);

        // Initialize prompt state AFTER core data and controls are ready
        // Use getState() here as we are outside the render cycle effectively
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
                  .getConversationById(initialSelectedItemId)?.projectId ??
                null)
              : null;
        const initialEffectiveSettings = useProjectStore
          .getState()
          .getEffectiveProjectSettings(initialProjectId);
        // Use getState() for prompt store action as well
        usePromptStateStore
          .getState()
          .initializePromptState(initialEffectiveSettings);
        console.log(
          "LiteChat: Initial prompt state initialized.",
          initialEffectiveSettings,
        );
      } catch (error) {
        console.error("LiteChat: Initialization failed:", error);
        toast.error(
          `Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        useUIStateStore.getState().setGlobalError("Initialization failed.");
      } finally {
        if (isMounted) {
          console.log("LiteChat: Initialization complete.");
          setIsInitializing(false);
        }
      }
    };

    initializeApp();

    return () => {
      isMounted = false;
      console.log("LiteChat: Unmounting, initialization cancelled if pending.");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Keep dependencies empty for one-time init

  // --- Effect to update Prompt State on Context Change ---
  // Store previous context to prevent unnecessary updates
  const prevContextRef = useRef<{
    itemId: string | null;
    itemType: string | null;
  }>({ itemId: null, itemType: null });

  useEffect(() => {
    if (isInitializing) return;

    const currentContext = {
      itemId: selectedItemId,
      itemType: selectedItemType,
    };

    // Only update if the context has actually changed
    if (
      currentContext.itemId !== prevContextRef.current.itemId ||
      currentContext.itemType !== prevContextRef.current.itemType
    ) {
      const currentProjectId =
        selectedItemType === "project"
          ? selectedItemId
          : selectedItemType === "conversation"
            ? (useConversationStore
                .getState()
                .getConversationById(selectedItemId)?.projectId ?? null)
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

      // Update the ref with the new context
      prevContextRef.current = currentContext;
    }
  }, [
    selectedItemId,
    selectedItemType,
    getEffectiveProjectSettings,
    initializePromptState,
    isInitializing,
  ]); // Dependencies remain the same

  // --- VFS Context Management Effect (remains the same) ---
  useEffect(() => {
    let targetVfsKey: string | null = null;
    if (isVfsPanelOpen) {
      if (selectedItemType === "project") {
        targetVfsKey = selectedItemId;
      } else if (selectedItemType === "conversation") {
        const convo = useConversationStore
          .getState()
          .getConversationById(selectedItemId);
        targetVfsKey = convo?.projectId ?? "orphan";
      } else {
        targetVfsKey = "orphan";
      }
      console.log(
        `[LiteChat Effect] VFS Panel Opened/Context Changed. Setting target key: ${targetVfsKey}`,
      );
    } else {
      targetVfsKey = null;
      console.log(
        "[LiteChat Effect] VFS Panel Closed. Setting target key: null",
      );
    }
    if (useVfsStore.getState().vfsKey !== targetVfsKey) {
      setVfsKey(targetVfsKey);
    }
  }, [isVfsPanelOpen, selectedItemId, selectedItemType, setVfsKey]);

  // --- Prompt Submission Handler (UPDATED) ---
  const handlePromptSubmit = useCallback(
    async (turnData: PromptTurnObject) => {
      const conversationState = useConversationStore.getState();
      const uiStateActions = useUIStateStore.getState();
      // Get current prompt state *before* potential conversation creation
      const currentPromptState = usePromptStateStore.getState();

      let currentConvId =
        conversationState.selectedItemType === "conversation"
          ? conversationState.selectedItemId
          : null;
      const currentProjectId =
        conversationState.selectedItemType === "project"
          ? conversationState.selectedItemId
          : conversationState.selectedItemType === "conversation"
            ? (conversationState.getConversationById(
                conversationState.selectedItemId,
              )?.projectId ?? null)
            : null;

      // Create conversation if needed
      if (!currentConvId) {
        console.log("LiteChat: No conversation selected, creating new one...");
        try {
          const newId = await conversationState.addConversation({
            title: "New Chat",
            projectId: currentProjectId,
          });
          await conversationState.selectItem(newId, "conversation");
          currentConvId = useConversationStore.getState().selectedItemId;
          if (currentConvId !== newId) {
            console.error(
              "LiteChat: Mismatch between created ID and selected ID after selection!",
            );
          }
          console.log(
            `LiteChat: New conversation created (${currentConvId}), selected.`,
          );
          setTimeout(() => uiStateActions.setFocusInputFlag(true), 0);
        } catch (error) {
          console.error("LiteChat: Failed to create new conversation", error);
          toast.error("Failed to start new chat.");
          return;
        }
      }

      // --- Delegate prompt processing to ConversationService ---
      console.log("LiteChat: Submitting turn data to ConversationService...");
      try {
        // Add the currently selected model from PromptStateStore to the turnData metadata
        // This ensures the model selected *just before* submit is used.
        const finalTurnData = {
          ...turnData,
          metadata: {
            ...turnData.metadata,
            modelId: currentPromptState.modelId, // Read from prompt state
          },
        };

        await ConversationService.submitPrompt(finalTurnData);
        console.log("LiteChat: ConversationService processing initiated.");

        // --- UI Cleanup AFTER calling the service ---
        // clearAttachedFiles() is called by PromptWrapper now
        // resetTransientParameters() is removed as parameters are handled differently
        // Control state clearing is handled by PromptWrapper calling clearOnSubmit

        // Focus input for the next turn
        uiStateActions.setFocusInputFlag(true);
      } catch (error) {
        // Errors during submission initiation are caught here
        console.error("LiteChat: Error submitting prompt:", error);
        // Toast is likely handled within ConversationService
      }
    },
    [
      // Dependencies updated
    ],
  );

  // --- Regeneration Handler (UPDATED) ---
  const onRegenerateInteraction = useCallback(
    async (interactionId: string) => {
      console.log(`LiteChat: Regenerating interaction ${interactionId}`);
      try {
        // --- Delegate regeneration to ConversationService ---
        await ConversationService.regenerateInteraction(interactionId);
        console.log(
          `LiteChat: ConversationService regeneration initiated for ${interactionId}.`,
        );
        // --- UI Cleanup AFTER calling the service ---
        // resetTransientParameters() removed
        // Control state clearing is handled by PromptWrapper calling clearOnSubmit
        // Focus input
        useUIStateStore.getState().setFocusInputFlag(true);
      } catch (error) {
        console.error("LiteChat: Error regenerating interaction:", error);
        // Toast handled by service
      }
    },
    [
      // Dependencies updated
    ],
  );

  // --- Stop Interaction Handler (remains the same) ---
  const onStopInteraction = useCallback((interactionId: string) => {
    console.log(`LiteChat: Stopping interaction ${interactionId}`);
    InteractionService.abortInteraction(interactionId);
  }, []);

  // --- Memoized Controls (remain the same) ---
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

  // --- Memoized Modal Renderers (remain the same) ---
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

  // --- Render Logic (remains the same) ---
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
                : "flex items-center justify-center",
            )}
          >
            <ChatControlWrapper
              controls={sidebarFooterControls}
              panelId="sidebar-footer"
              renderMode={isSidebarCollapsed ? "icon" : "full"}
              className={cn(
                "flex",
                isSidebarCollapsed
                  ? "flex-col gap-2 items-center"
                  : "items-center gap-1 justify-center",
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
            onStopInteraction={onStopInteraction} // Pass updated handler
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
            onSubmit={handlePromptSubmit} // Pass updated handler
            className="border-t border-[--border] bg-card flex-shrink-0"
          />
        </div>

        {/* Right Drawer (VFS) */}
        <ChatControlWrapper
          controls={chatControls}
          panelId="drawer_right"
          renderMode="full"
        />
      </div>

      {/* Render Modals */}
      {isChatControlPanelOpen["settingsModal"] &&
        settingsModalRenderer &&
        settingsModalRenderer()}
      {isProjectSettingsModalOpen &&
        projectSettingsModalRenderer &&
        projectSettingsModalRenderer()}

      <Toaster richColors position="bottom-right" closeButton />
    </>
  );
};
