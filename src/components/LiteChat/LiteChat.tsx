// src/components/LiteChat/LiteChat.tsx
// FULL FILE
import React, {
  useEffect,
  useCallback,
  useState,
  useRef,
  useMemo,
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
import { Toaster } from "@/components/ui/sonner";
import { InputArea } from "@/components/LiteChat/prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Menu, X } from "lucide-react";
import { performFullInitialization } from "@/lib/litechat/initialization";
import { usePromptStateStore } from "@/store/prompt.store";
import type {
  ControlModule,
  ControlModuleConstructor,
} from "@/types/litechat/control";
import { createModApi } from "@/modding/api-factory";
import { useVfsStore } from "@/store/vfs.store";
import type { SidebarItemType } from "@/types/litechat/chat";
import { EventActionCoordinatorService } from "@/services/event-action-coordinator.service";
import { ModalManager } from "@/components/LiteChat/common/ModalManager";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import { vfsEvent } from "@/types/litechat/events/vfs.events";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { settingsEvent } from "@/types/litechat/events/settings.events";
import { projectEvent } from "@/types/litechat/events/project.events";
import type { LiteChatModApi } from "@/types/litechat/modding";
import { WorkflowService } from "@/services/workflow.service";
import { useTranslation } from "react-i18next";

let initializedControlModules: ControlModule[] = [];
let appInitializationPromise: Promise<ControlModule[]> | null = null;
let hasInitializedSuccessfully = false;

interface LiteChatProps {
  controls?: ControlModuleConstructor[];
}

export const LiteChat: React.FC<LiteChatProps> = ({ controls = [] }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const inputAreaRef = useRef<InputAreaRef>(null);
  const coreModApiRef = useRef<LiteChatModApi | null>(null);
  const { t } = useTranslation('common');

  const {
    selectedItemId,
    selectedItemType,
    getConversationById: getConversationByIdFromStore,
  } = useConversationStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      getConversationById: state.getConversationById,
    }))
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
  const { globalError, isSidebarCollapsed, isChatControlPanelOpen } =
    useUIStateStore(
      useShallow((state) => ({
        globalError: state.globalError,
        isSidebarCollapsed: state.isSidebarCollapsed,
        isChatControlPanelOpen: state.isChatControlPanelOpen,
      }))
    );

  const allChatControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.chatControls))
  );

  const sidebarControls = useMemo(
    () =>
      allChatControls.filter(
        (c) => (c.panel ?? "main") === "sidebar" && (c.show ? c.show() : true)
      ),
    [allChatControls]
  );
  const sidebarFooterControls = useMemo(
    () =>
      allChatControls.filter(
        (c) => c.panel === "sidebar-footer" && (c.show ? c.show() : true)
      ),
    [allChatControls]
  );
  const headerControls = useMemo(
    () =>
      allChatControls.filter(
        (c) => c.panel === "header" && (c.show ? c.show() : true)
      ),
    [allChatControls]
  );

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    // Close the mobile sidebar when a conversation or project is selected
    // Don't close for settings or other modal interactions
    if (isMobileSidebarOpen && selectedItemId && (selectedItemType === "conversation" || selectedItemType === "project")) {
      setIsMobileSidebarOpen(false);
    }
  }, [selectedItemId, selectedItemType]);

  useEffect(() => {
    if (!coreModApiRef.current) {
      coreModApiRef.current = createModApi({
        id: "core-litechat-app",
        name: "LiteChat App Core",
        sourceUrl: null,
        scriptContent: null,
        enabled: true,
        loadOrder: -1000,
        createdAt: new Date(),
      });
    }
    const modApiToUse = coreModApiRef.current;

    EventActionCoordinatorService.initialize();
    WorkflowService.initialize();

    const initializeApp = async () => {
      if (hasInitializedSuccessfully) {
        setIsInitializing(false);
        return;
      }

      setIsInitializing(true);
      try {
        initializedControlModules = await performFullInitialization(
          controls,
          modApiToUse
        );
        hasInitializedSuccessfully = true;
      } catch (error) {
        console.error("[LiteChat] App: Top-level initialization error:", error);
        hasInitializedSuccessfully = false;
      } finally {
        setIsInitializing(false);
      }
    };

    if (!appInitializationPromise) {
      appInitializationPromise = initializeApp().then(
        () => initializedControlModules
      );
    }
  }, [controls]);

  const prevContextRef = useRef<{
    itemId: string | null;
    itemType: SidebarItemType | null;
    effectiveSettingsString: string;
  }>({ itemId: null, itemType: null, effectiveSettingsString: "" });

  useEffect(() => {
    if (isInitializing || !hasInitializedSuccessfully || !coreModApiRef.current)
      return;
    const modApi = coreModApiRef.current;

    const currentContext = {
      itemId: selectedItemId,
      itemType: selectedItemType,
    };

    let currentProjectId: string | null = null;
    if (selectedItemType === "project") {
      currentProjectId = selectedItemId;
    } else if (selectedItemType === "conversation" && selectedItemId) {
      const conversation = getConversationByIdFromStore(selectedItemId);
      currentProjectId = conversation?.projectId ?? null;
    }

    const effectiveSettings = getEffectiveProjectSettings(currentProjectId);
    const effectiveSettingsString = JSON.stringify(effectiveSettings);

    if (
      currentContext.itemId !== prevContextRef.current.itemId ||
      currentContext.itemType !== prevContextRef.current.itemType ||
      effectiveSettingsString !== prevContextRef.current.effectiveSettingsString
    ) {
      modApi.emit(promptEvent.initializePromptStateRequest, {
        effectiveSettings,
      });
      modApi.emit(uiEvent.contextChanged, {
        selectedItemId,
        selectedItemType,
      });
      prevContextRef.current = { ...currentContext, effectiveSettingsString };
    }
  }, [
    selectedItemId,
    selectedItemType,
    getConversationByIdFromStore,
    getEffectiveProjectSettings,
    isInitializing,
    hasInitializedSuccessfully,
  ]);

  useEffect(() => {
    if (isInitializing || !hasInitializedSuccessfully || !coreModApiRef.current)
      return;
    const modApi = coreModApiRef.current;

    const updatePromptStateFromEffectiveSettings = () => {
      let currentProjectId: string | null = null;
      if (selectedItemType === "project") {
        currentProjectId = selectedItemId;
      } else if (selectedItemType === "conversation" && selectedItemId) {
        const conversation = getConversationByIdFromStore(selectedItemId);
        currentProjectId = conversation?.projectId ?? null;
      }
      const effectiveSettings = getEffectiveProjectSettings(currentProjectId);
      modApi.emit(promptEvent.initializePromptStateRequest, {
        effectiveSettings,
      });
    };

    const unsubSettings = modApi.on(
      settingsEvent.loaded,
      updatePromptStateFromEffectiveSettings
    );
    const unsubProjectUpdated = modApi.on(
      projectEvent.updated,
      updatePromptStateFromEffectiveSettings
    );
    const unsubGlobalSystemPrompt = modApi.on(
      settingsEvent.globalSystemPromptChanged,
      updatePromptStateFromEffectiveSettings
    );
    const unsubTemperature = modApi.on(
      settingsEvent.temperatureChanged,
      updatePromptStateFromEffectiveSettings
    );

    return () => {
      unsubSettings();
      unsubProjectUpdated();
      unsubGlobalSystemPrompt();
      unsubTemperature();
    };
  }, [
    selectedItemId,
    selectedItemType,
    getConversationByIdFromStore,
    getEffectiveProjectSettings,
    isInitializing,
    hasInitializedSuccessfully,
  ]);

  useEffect(() => {
    if (isInitializing || !hasInitializedSuccessfully || !coreModApiRef.current)
      return;
    const modApi = coreModApiRef.current;

    let calculatedKey: any = null; // Allow any type initially for calculation
    const isVfsModalOpen = isChatControlPanelOpen["core-vfs-modal-panel"];

    if (isVfsModalOpen || selectedItemType === "project") {
      if (selectedItemType === "project") {
        calculatedKey = selectedItemId;
      } else if (selectedItemType === "conversation") {
        const convo = getConversationByIdFromStore(selectedItemId);
        calculatedKey = convo?.projectId ?? "orphan";
      } else {
        calculatedKey = "orphan";
      }
    } else if (selectedItemType === "conversation") {
      const convo = getConversationByIdFromStore(selectedItemId);
      calculatedKey = convo?.projectId ?? "orphan";
    }
    // Ensure targetVfsKey is strictly string or null before emitting.
    let targetVfsKey: string | null = null;
    if (typeof calculatedKey === 'string') {
      targetVfsKey = calculatedKey;
    } else if (calculatedKey === null) {
      targetVfsKey = null;
    } else {
      // This case should ideally not happen if types are correct upstream.
      // Logging helps identify if projectId or selectedItemId is not a string/null.
      console.warn(
        `[LiteChatVFS] Calculated VFS key was not a string or null. Type: ${typeof calculatedKey}, Value:`,
        calculatedKey,
        `Defaulting to 'orphan'.`
      );
      targetVfsKey = "orphan";
    }

    if (useVfsStore.getState().vfsKey !== targetVfsKey) {
      modApi.emit(vfsEvent.setVfsKeyRequest, { key: targetVfsKey });
    }
  }, [
    selectedItemId,
    selectedItemType,
    getConversationByIdFromStore,
    isInitializing,
    hasInitializedSuccessfully,
    isChatControlPanelOpen,
  ]);

  const createAndSelectConversation = async (data: {
    title: string;
    projectId: string | null;
  }): Promise<string> => {
    const conversationState = useConversationStore.getState();
    const newId = await conversationState.addConversation(data);
    console.log("New conversation ID:", newId);
    await conversationState.selectItem(newId, "conversation");
    console.log("conv selected:", newId);
    return newId;
  };

  const handlePromptSubmit = useCallback(async (turnData: PromptTurnObject) => {
    if (!coreModApiRef.current) {
      toast.error(t('applicationCoreNotReady'));
      return;
    }

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
        currentConvId = await createAndSelectConversation({
          title: "New Chat",
          projectId: currentProjectId,
        });
        console.log("New conversation ID 2:", currentConvId);
      } catch (error) {
        console.error(
          "[LiteChat] App: Failed to create new conversation",
          error
        );
        toast.error(t('failedToStartNewChat'));
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
      toast.error(t('failedToSendMessage'));
    }
  }, [t]);

  const currentConversationIdForCanvas =
    selectedItemType === "conversation" ? selectedItemId : null;

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">
            {t('initializingLiteChat')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ModalManager />
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
          <div className="md:hidden fixed inset-0 z-[var(--z-sidebar)] flex">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
              onClick={toggleMobileSidebar}
            ></div>
            <div className="relative w-4/5 max-w-sm bg-card border-r border-border h-full flex flex-col animate-slideInFromLeft shadow-2xl">
              <div className="sticky top-0 z-[var(--z-sticky)] flex justify-between items-center p-4 border-b border-border bg-card">
                <h2 className="font-semibold text-card-foreground">{t('liteChatMenu')}</h2>
                <button
                  onClick={toggleMobileSidebar}
                  className="p-2 rounded-md hover:bg-muted text-card-foreground touch-manipulation"
                  aria-label={t('closeMenu')}
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-grow overflow-y-auto overflow-x-hidden bg-card">
                {sidebarControls.length > 0 ? (
                  <ChatControlWrapper
                    controls={sidebarControls}
                    panelId="sidebar"
                    renderMode="full"
                    className="h-full"
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    <p className="text-sm">{t('loadingMenu')}</p>
                    <p className="text-xs mt-2">
                      {t('pleaseWaitInitialization')}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 border-t border-border p-4 bg-card">
                {sidebarFooterControls.length > 0 ? (
                  <ChatControlWrapper
                    controls={sidebarFooterControls}
                    panelId="sidebar-footer"
                    renderMode="full"
                    className="flex items-center justify-between"
                  />
                ) : (
                  <div className="text-center text-muted-foreground text-xs">
                    {t('footerControlsLoading')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col flex-grow min-w-0">
          <div className="flex items-center justify-between p-2 border-b border-border bg-card flex-shrink-0">
            <button
              className={cn(
                "md:hidden p-3 rounded-md hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation",
                isMobileSidebarOpen && "bg-muted"
              )}
              onClick={toggleMobileSidebar}
              aria-label={t(isMobileSidebarOpen ? 'closeMenu' : 'openMenu')}
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              {isMobileSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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
      <Toaster richColors position="bottom-right" closeButton />
    </>
  );
};
