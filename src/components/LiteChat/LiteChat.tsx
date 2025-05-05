// src/components/LiteChat/LiteChat.tsx
// FULL FILE - Adapted for Mobile Responsiveness
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
import type { PromptTurnObject, InputAreaRef } from "@/types/litechat/prompt";
import { ConversationService } from "@/services/conversation.service";
import { InteractionService } from "@/services/interaction.service";
import { useModStore } from "@/store/mod.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { useVfsStore } from "@/store/vfs.store";
import { useRulesStore } from "@/store/rules.store";
import { loadMods } from "@/modding/loader";
import { Toaster } from "@/components/ui/sonner";
import { InputArea } from "@/components/LiteChat/prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Menu, X } from "lucide-react";
import { usePromptStateStore } from "@/store/prompt.store";

// Define the type for the registration functions prop
export type RegistrationFunction = () => void;

interface LiteChatProps {
  controls?: RegistrationFunction[]; // Use the correct prop name 'controls'
}

export const LiteChat: React.FC<LiteChatProps> = ({
  controls = [], // Default to empty array
}) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const inputAreaRef = useRef<InputAreaRef>(null); // Ref for InputArea

  // --- Store Hooks ---
  const selectedItemId = useConversationStore((state) => state.selectedItemId);
  const selectedItemType = useConversationStore(
    (state) => state.selectedItemType,
  );
  const loadSidebarItems = useConversationStore(
    (state) => state.loadSidebarItems,
  );
  const getConversationById = useConversationStore(
    (state) => state.getConversationById,
  );
  const { getEffectiveProjectSettings } = useProjectStore(
    useShallow((state) => ({
      projects: state.projects,
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
    isVfsModalOpen,
  } = useUIStateStore(
    useShallow((state) => ({
      globalError: state.globalError,
      isSidebarCollapsed: state.isSidebarCollapsed,
      isChatControlPanelOpen: state.isChatControlPanelOpen,
      isProjectSettingsModalOpen: state.isProjectSettingsModalOpen,
      isVfsModalOpen: state.isVfsModalOpen,
    })),
  );
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
  const { initializePromptState } = usePromptStateStore(
    useShallow((state) => ({
      initializePromptState: state.initializePromptState,
    })),
  );
  const { loadRulesAndTags } = useRulesStore(
    useShallow((state) => ({
      loadRulesAndTags: state.loadRulesAndTags,
    })),
  );

  // --- Mobile Sidebar Toggle Handler ---
  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen((prev) => !prev);
  }, []);

  // Close mobile sidebar when an item is selected (e.g., conversation)
  useEffect(() => {
    if (isMobileSidebarOpen) {
      setIsMobileSidebarOpen(false);
    }
    // Intentionally only run when selection changes, not when sidebar opens/closes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId, selectedItemType]);

  // --- Focus Input Helper ---
  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputAreaRef.current?.focus();
    });
  }, []);

  // --- Initialization Effect ---
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
        await loadRulesAndTags();
        if (!isMounted) return;
        console.log("LiteChat: Rules and Tags loaded.");
        await loadSidebarItems();
        if (!isMounted) return;
        console.log("LiteChat: Sidebar items loaded.");

        console.log("LiteChat: Registering core controls and tools...");
        // --- Call Registration Functions from Props ---
        controls.forEach((registerFn) => {
          // Use the 'controls' prop
          try {
            registerFn();
          } catch (regError) {
            console.error(
              `LiteChat: Error running registration function:`,
              regError,
            );
          }
        });
        // --- End Registration Call ---

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

        const initialProjectId =
          selectedItemType === "project"
            ? selectedItemId
            : selectedItemType === "conversation"
              ? (getConversationById(selectedItemId)?.projectId ?? null)
              : null;
        const initialEffectiveSettings =
          getEffectiveProjectSettings(initialProjectId);
        initializePromptState(initialEffectiveSettings);
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
  }, [controls]); // Depend on the 'controls' prop

  // --- Effect to update Prompt State on Context Change ---
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

    if (
      currentContext.itemId !== prevContextRef.current.itemId ||
      currentContext.itemType !== prevContextRef.current.itemType
    ) {
      const currentProjectId =
        selectedItemType === "project"
          ? selectedItemId
          : selectedItemType === "conversation"
            ? (getConversationById(selectedItemId)?.projectId ?? null)
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

      prevContextRef.current = currentContext;

      // Focus input if the new context is a conversation
      if (currentContext.itemType === "conversation") {
        focusInput();
      }
    }
  }, [
    selectedItemId,
    selectedItemType,
    getConversationById,
    getEffectiveProjectSettings,
    initializePromptState,
    isInitializing,
    focusInput,
  ]);

  // --- VFS Context Management Effect ---
  useEffect(() => {
    let targetVfsKey: string | null = null;
    if (isVfsModalOpen || selectedItemType === "project") {
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
        `[LiteChat Effect] VFS Context Required. Setting target key: ${targetVfsKey}`,
      );
    } else {
      targetVfsKey = null;
      console.log(
        "[LiteChat Effect] VFS Context Not Required. Setting target key: null",
      );
    }
    if (useVfsStore.getState().vfsKey !== targetVfsKey) {
      setVfsKey(targetVfsKey);
    }
  }, [isVfsModalOpen, selectedItemId, selectedItemType, setVfsKey]);

  // --- Prompt Submission Handler ---
  const handlePromptSubmit = useCallback(
    async (turnData: PromptTurnObject) => {
      const conversationState = useConversationStore.getState();
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
          // Focus is handled by the context change effect
        } catch (error) {
          console.error("LiteChat: Failed to create new conversation", error);
          toast.error("Failed to start new chat.");
          return;
        }
      }

      console.log("LiteChat: Submitting turn data to ConversationService...");
      try {
        const currentPromptState = usePromptStateStore.getState();
        const finalTurnData = {
          ...turnData,
          metadata: {
            ...turnData.metadata,
            modelId: currentPromptState.modelId,
          },
        };

        await ConversationService.submitPrompt(finalTurnData);
        console.log("LiteChat: ConversationService processing initiated.");
        focusInput(); // Focus after submitting
      } catch (error) {
        console.error("LiteChat: Error submitting prompt:", error);
        focusInput(); // Focus even on error
      }
    },
    [focusInput],
  );

  // --- Regeneration Handler ---
  const onRegenerateInteraction = useCallback(
    async (interactionId: string) => {
      console.log(`LiteChat: Regenerating interaction ${interactionId}`);
      try {
        await ConversationService.regenerateInteraction(interactionId);
        console.log(
          `LiteChat: ConversationService regeneration initiated for ${interactionId}.`,
        );
        focusInput(); // Focus after regenerating
      } catch (error) {
        console.error("LiteChat: Error regenerating interaction:", error);
        focusInput(); // Focus even on error
      }
    },
    [focusInput],
  );

  // --- Stop Interaction Handler ---
  const onStopInteraction = useCallback(
    (interactionId: string) => {
      console.log(`LiteChat: Stopping interaction ${interactionId}`);
      InteractionService.abortInteraction(interactionId);
      focusInput(); // Focus after stopping
    },
    [focusInput],
  );

  // --- Memoized Controls ---
  const sidebarControls = useMemo(
    () =>
      chatControls
        .filter(
          (c) =>
            (c.panel ?? "main") === "sidebar" && (c.show ? c.show() : true),
        )
        .map((c) => c),
    [chatControls],
  );
  const sidebarFooterControls = useMemo(
    () =>
      chatControls
        .filter(
          (c) => c.panel === "sidebar-footer" && (c.show ? c.show() : true),
        )
        .map((c) => c),
    [chatControls],
  );
  const headerControls = useMemo(
    () =>
      chatControls
        .filter((c) => c.panel === "header" && (c.show ? c.show() : true))
        .map((c) => c),
    [chatControls],
  );

  // --- Memoized Modal Renderers ---
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
  const vfsModalRenderer = useMemo(
    () => chatControls.find((c) => c.id === "core-vfs-modal-panel")?.renderer,
    [chatControls],
  );

  const currentConversationIdForCanvas =
    selectedItemType === "conversation" ? selectedItemId : null;

  // --- Render Logic ---
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
      {/* Main container */}
      <div className="flex h-full w-full border border-border rounded-lg overflow-hidden bg-background text-foreground">
        {/* Desktop Sidebar */}
        <div
          className={cn(
            "hidden md:flex flex-col border-r border-border bg-card",
            "transition-[width] duration-300 ease-in-out",
            "flex-shrink-0 overflow-hidden",
            isSidebarCollapsed ? "w-16" : "w-64",
          )}
        >
          <div className="flex-grow overflow-y-auto overflow-x-hidden">
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
              "flex-shrink-0 border-t border-border p-2",
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

        {/* Mobile Sidebar (Overlay) */}
        {isMobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop/overlay */}
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-fadeIn"
              onClick={toggleMobileSidebar}
            ></div>

            {/* Mobile sidebar content */}
            <div className="relative w-4/5 max-w-xs bg-card border-r border-border h-full flex flex-col animate-slideInFromLeft">
              {/* Close button */}
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h2 className="font-semibold">LiteChat Menu</h2>
                <button
                  onClick={toggleMobileSidebar}
                  className="p-1 rounded-md hover:bg-muted"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Sidebar content */}
              <div className="flex-grow overflow-y-auto overflow-x-hidden">
                <ChatControlWrapper
                  controls={sidebarControls}
                  panelId="sidebar"
                  renderMode="full"
                  className="h-full"
                />
              </div>

              {/* Footer controls */}
              <div className="flex-shrink-0 border-t border-border p-4">
                <ChatControlWrapper
                  controls={sidebarFooterControls}
                  panelId="sidebar-footer"
                  renderMode="full"
                  className="flex items-center justify-between"
                />
              </div>
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex flex-col flex-grow min-w-0">
          <div className="flex items-center justify-between p-2 border-b border-border bg-card flex-shrink-0">
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-md hover:bg-muted"
              onClick={toggleMobileSidebar}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Header controls (right-aligned) */}
            <ChatControlWrapper
              controls={headerControls}
              panelId="header"
              className="flex items-center justify-end gap-1 flex-grow" // Ensure it takes space
            />
          </div>

          <ChatCanvas
            conversationId={currentConversationIdForCanvas}
            interactions={interactions}
            onRegenerateInteraction={onRegenerateInteraction}
            onStopInteraction={onStopInteraction}
            status={interactionStatus}
            className="flex-grow overflow-y-hidden"
          />

          {globalError && (
            <div className="p-2 bg-destructive text-destructive-foreground text-sm text-center">
              Error: {globalError}
            </div>
          )}

          <PromptWrapper
            InputAreaRenderer={InputArea}
            onSubmit={handlePromptSubmit}
            className="border-t border-border bg-card flex-shrink-0"
            inputAreaRef={inputAreaRef}
          />
        </div>
      </div>

      {/* Render Modals Explicitly */}
      {isChatControlPanelOpen["settingsModal"] &&
        settingsModalRenderer &&
        settingsModalRenderer()}
      {isProjectSettingsModalOpen &&
        projectSettingsModalRenderer &&
        projectSettingsModalRenderer()}
      {isVfsModalOpen && vfsModalRenderer && vfsModalRenderer()}

      <Toaster richColors position="bottom-right" closeButton />
    </>
  );
};
