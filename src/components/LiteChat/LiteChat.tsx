// src/components/LiteChat/LiteChat.tsx
// FULL FILE
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
import { Toaster } from "@/components/ui/sonner";
import { InputArea } from "@/components/LiteChat/prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Menu, X } from "lucide-react";
// import { useInputStore } from "@/store/input.store"; // No longer directly used here
// import { nanoid } from "nanoid"; // No longer directly used here
// import { runMiddleware } from "@/lib/litechat/ai-helpers"; // No longer directly used here
// import { PromptEvent, ModMiddlewareHook } from "@/types/litechat/modding"; // No longer directly used here
// import { emitter } from "@/lib/litechat/event-emitter"; // No longer directly used here
import { performFullInitialization } from "@/lib/litechat/initialization";
import { usePromptStateStore } from "@/store/prompt.store";
import type {
  ControlModule,
  ControlModuleConstructor,
} from "@/types/litechat/control";
import { createModApi } from "@/modding/api-factory";
import { useVfsStore } from "@/store/vfs.store"; // For VFS key logic

let initializedControlModules: ControlModule[] = [];
// Ensure appInitializationPromise and hasInitialized are module-scoped correctly
let appInitializationPromise: Promise<ControlModule[]> | null = null;
let hasInitializedSuccessfully = false;

interface LiteChatProps {
  controls?: ControlModuleConstructor[];
}

export const LiteChat: React.FC<LiteChatProps> = ({ controls = [] }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const inputAreaRef = useRef<InputAreaRef>(null);

  const selectedItemId = useConversationStore((state) => state.selectedItemId);
  const selectedItemType = useConversationStore(
    (state) => state.selectedItemType
  );
  const getConversationById = useConversationStore(
    (state) => state.getConversationById
  );
  const { getEffectiveProjectSettings } = useProjectStore(
    useShallow((state) => ({
      getEffectiveProjectSettings: state.getEffectiveProjectSettings,
    }))
  );
  const { interactions, status: interactionStatus } = useInteractionStore(
    useShallow((state) => ({
      interactions: state.interactions,
      status: state.status,
    }))
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
    }))
  );
  const chatControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.chatControls))
  );
  const { initializePromptState } = usePromptStateStore(
    useShallow((state) => ({
      initializePromptState: state.initializePromptState,
    }))
  );
  const { setVfsKey } = useVfsStore(
    useShallow((state) => ({
      setVfsKey: state.setVfsKey,
    }))
  );

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isMobileSidebarOpen) {
      setIsMobileSidebarOpen(false);
    }
  }, [selectedItemId, selectedItemType, isMobileSidebarOpen]);

  useEffect(() => {
    const coreModApi = createModApi({
      id: "core-litechat-app",
      name: "LiteChat App Core",
      sourceUrl: null,
      scriptContent: null,
      enabled: true,
      loadOrder: -1000,
      createdAt: new Date(),
    });

    const initializeApp = async () => {
      if (hasInitializedSuccessfully) {
        console.log(
          "[LiteChat] App: Skipping re-initialization (already run successfully)."
        );
        setIsInitializing(false);
        return;
      }

      console.log("[LiteChat] App: Starting initialization...");
      setIsInitializing(true);
      try {
        initializedControlModules = await performFullInitialization(
          controls,
          coreModApi
        );
        hasInitializedSuccessfully = true; // Set flag on successful completion
      } catch (error) {
        console.error("[LiteChat] App: Top-level initialization error:", error);
        hasInitializedSuccessfully = false; // Ensure it's false on error
      } finally {
        console.log("[LiteChat] App: Initialization attempt complete.");
        setIsInitializing(false);
      }
    };

    if (!appInitializationPromise) {
      appInitializationPromise = initializeApp().then(
        () => initializedControlModules
      );
    }

    return () => {
      console.log("[LiteChat] App: StrictMode unmount or component unmount.");
      // Cleanup only if this is a "true" unmount, not just StrictMode.
      // For StrictMode, we want modules to persist for the remount.
      // If we had a way to detect true unmount vs. StrictMode unmount,
      // we could be more precise. For now, the `hasInitializedSuccessfully` flag
      // prevents re-running the full init.
      // The `destroy` logic for modules should ideally be tied to application shutdown.
    };
  }, [controls]);

  const prevContextRef = useRef<{
    itemId: string | null;
    itemType: string | null;
  }>({ itemId: null, itemType: null });

  useEffect(() => {
    if (isInitializing || !hasInitializedSuccessfully) return;

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
          ? getConversationById(selectedItemId)?.projectId ?? null
          : null;

      const effectiveSettings = getEffectiveProjectSettings(currentProjectId);
      initializePromptState(effectiveSettings);
      prevContextRef.current = currentContext;
    }
  }, [
    selectedItemId,
    selectedItemType,
    getConversationById,
    getEffectiveProjectSettings,
    initializePromptState,
    isInitializing,
  ]);

  // VFS Key Management Effect (from VfsControlModule logic)
  useEffect(() => {
    if (isInitializing || !hasInitializedSuccessfully) return;

    let targetVfsKey: string | null = null;
    if (isVfsModalOpen || selectedItemType === "project") {
      if (selectedItemType === "project") {
        targetVfsKey = selectedItemId;
      } else if (selectedItemType === "conversation") {
        const convo = getConversationById(selectedItemId);
        targetVfsKey = convo?.projectId ?? "orphan";
      } else {
        targetVfsKey = "orphan";
      }
    } else if (selectedItemType === "conversation") {
      const convo = getConversationById(selectedItemId);
      targetVfsKey = convo?.projectId ?? "orphan";
    }

    if (useVfsStore.getState().vfsKey !== targetVfsKey) {
      setVfsKey(targetVfsKey);
    }
  }, [
    isVfsModalOpen,
    selectedItemId,
    selectedItemType,
    setVfsKey,
    getConversationById,
    isInitializing,
  ]);

  const handlePromptSubmit = useCallback(async (turnData: PromptTurnObject) => {
    const conversationState = useConversationStore.getState();
    let currentConvId =
      conversationState.selectedItemType === "conversation"
        ? conversationState.selectedItemId
        : null;
    const currentProjectId =
      conversationState.selectedItemType === "project"
        ? conversationState.selectedItemId
        : conversationState.selectedItemType === "conversation"
        ? conversationState.getConversationById(
            conversationState.selectedItemId
          )?.projectId ?? null
        : null;

    if (!currentConvId) {
      try {
        const newId = await conversationState.addConversation({
          title: "New Chat",
          projectId: currentProjectId,
        });
        await conversationState.selectItem(newId, "conversation");
        currentConvId = useConversationStore.getState().selectedItemId;
      } catch (error) {
        console.error(
          "[LiteChat] App: Failed to create new conversation",
          error
        );
        toast.error("Failed to start new chat.");
        return;
      }
    }

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
    } catch (error) {
      console.error("[LiteChat] App: Error submitting prompt:", error);
    }
  }, []);

  const onRegenerateInteraction = useCallback(async (interactionId: string) => {
    try {
      await ConversationService.regenerateInteraction(interactionId);
    } catch (error) {
      console.error("[LiteChat] App: Error regenerating interaction:", error);
    }
  }, []);

  const onStopInteraction = useCallback((interactionId: string) => {
    InteractionService.abortInteraction(interactionId);
  }, []);

  const sidebarControls = useMemo(
    () =>
      chatControls.filter(
        (c) => (c.panel ?? "main") === "sidebar" && (c.show ? c.show() : true)
      ),
    [chatControls]
  );
  const sidebarFooterControls = useMemo(
    () =>
      chatControls.filter(
        (c) => c.panel === "sidebar-footer" && (c.show ? c.show() : true)
      ),
    [chatControls]
  );
  const headerControls = useMemo(
    () =>
      chatControls.filter(
        (c) => c.panel === "header" && (c.show ? c.show() : true)
      ),
    [chatControls]
  );

  const settingsModalRenderer = useMemo(
    () =>
      chatControls.find((c) => c.id === "core-settings-trigger")
        ?.settingsRenderer,
    [chatControls]
  );
  const projectSettingsModalRenderer = useMemo(
    () =>
      chatControls.find((c) => c.id === "core-project-settings-trigger")
        ?.settingsRenderer,
    [chatControls]
  );
  const vfsModalRenderer = useMemo(
    () => chatControls.find((c) => c.id === "core-vfs-modal-panel")?.renderer,
    [chatControls]
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
      <div className="flex h-full w-full border border-border rounded-lg overflow-hidden bg-background text-foreground">
        <div
          className={cn(
            "hidden md:flex flex-col border-r border-border bg-card",
            "transition-[width] duration-300 ease-in-out",
            "flex-shrink-0 overflow-hidden",
            isSidebarCollapsed ? "w-16" : "w-64"
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
                : "flex items-center justify-center"
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
                  : "items-center gap-1 justify-center"
              )}
            />
          </div>
        </div>

        {isMobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-fadeIn"
              onClick={toggleMobileSidebar}
            ></div>
            <div className="relative w-4/5 max-w-xs bg-card border-r border-border h-full flex flex-col animate-slideInFromLeft">
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
              <div className="flex-grow overflow-y-auto overflow-x-hidden">
                <ChatControlWrapper
                  controls={sidebarControls}
                  panelId="sidebar"
                  renderMode="full"
                  className="h-full"
                />
              </div>
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

        <div className="flex flex-col flex-grow min-w-0">
          <div className="flex items-center justify-between p-2 border-b border-border bg-card flex-shrink-0">
            <button
              className="md:hidden p-2 rounded-md hover:bg-muted"
              onClick={toggleMobileSidebar}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <ChatControlWrapper
              controls={headerControls}
              panelId="header"
              className="flex items-center justify-end gap-1 flex-grow"
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
            selectedItemId={selectedItemId}
            selectedItemType={selectedItemType}
          />
        </div>
      </div>

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
