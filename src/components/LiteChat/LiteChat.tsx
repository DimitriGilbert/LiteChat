// src/components/LiteChat/LiteChat.tsx

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
// ModStore, ProviderStore, SettingsStore, RulesStore, PromptStateStore, VfsStore imports are used by initialization helpers
import { Toaster } from "@/components/ui/sonner";
import { InputArea } from "@/components/LiteChat/prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Menu, X } from "lucide-react";
import { parseAppUrlParameters } from "@/lib/litechat/url-helpers";
import { useInputStore } from "@/store/input.store";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { isLikelyTextFile } from "@/lib/litechat/file-extensions";
import { nanoid } from "nanoid";
import { runMiddleware } from "@/lib/litechat/ai-helpers";
import { ModEvent, ModMiddlewareHook } from "@/types/litechat/modding";
import { emitter } from "@/lib/litechat/event-emitter";
import { basename } from "@/lib/litechat/file-manager-utils";
import { performFullInitialization } from "@/lib/litechat/initialization"; // Import new helper
import { useProviderStore } from "@/store/provider.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useVfsStore } from "@/store/vfs.store";

// Define the type for the registration functions prop
export type RegistrationFunction = () => void;

interface LiteChatProps {
  controls?: RegistrationFunction[];
}

export const LiteChat: React.FC<LiteChatProps> = ({ controls = [] }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const inputAreaRef = useRef<InputAreaRef>(null);

  // --- Store Hooks (for component rendering and direct interactions) ---
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

  // --- Mobile Sidebar Toggle Handler ---
  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isMobileSidebarOpen) {
      setIsMobileSidebarOpen(false);
    }
  }, [selectedItemId, selectedItemType, isMobileSidebarOpen]);

  // --- Focus Input Helper ---
  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputAreaRef.current?.focus();
    });
  }, []);

  // --- Process URL Parameters ---
  const processUrlParameters = useCallback(async () => {
    const urlParams = parseAppUrlParameters();
    if (!urlParams.query && !urlParams.modelId && !urlParams.vfsFiles?.length) {
      return;
    }

    toast.info("Processing parameters from URL...");

    const { addConversation, selectItem } = useConversationStore.getState();
    const { setModelId: setPromptModelId } = usePromptStateStore.getState();
    const { addAttachedFile } = useInputStore.getState();
    const { getAvailableModelListItems } = useProviderStore.getState();
    const { initializeVFS: initVfs } = useVfsStore.getState();

    try {
      const newConversationId = await addConversation({
        title: urlParams.query
          ? `From URL: ${urlParams.query.substring(0, 30)}...`
          : "From URL Parameters",
      });
      await selectItem(newConversationId, "conversation");

      // --- Improved Model Selection Logic ---
      if (urlParams.modelId) {
        const availableModels = getAvailableModelListItems();
        let foundModelId: string | null = null;
        const modelParamLower = urlParams.modelId.toLowerCase();

        // 1. Try exact combined ID match
        if (urlParams.modelId.includes(":")) {
          const directMatch = availableModels.find(
            (m) => m.id === urlParams.modelId
          );
          if (directMatch) {
            foundModelId = directMatch.id;
          }
        }

        // 2. Try exact name match (case-insensitive)
        if (!foundModelId) {
          const nameMatch = availableModels.find(
            (m) => m.name.toLowerCase() === modelParamLower
          );
          if (nameMatch) {
            foundModelId = nameMatch.id;
          }
        }

        // 3. Try starts-with name match (case-insensitive)
        if (!foundModelId) {
          const startsWithNameMatch = availableModels.find((m) =>
            m.name.toLowerCase().startsWith(modelParamLower)
          );
          if (startsWithNameMatch) {
            foundModelId = startsWithNameMatch.id;
          }
        }

        // 4. remove before /, Try starts-with provider name match (case-insensitive)
        if (!foundModelId) {
          const startsWithProviderMatch = availableModels.find((m) =>
            {
              const mtc = m.id.toLowerCase().split('/')
              console.log(mtc)
              if (mtc.length > 1) {
                return mtc[1].startsWith(modelParamLower)
              }
            }
          );
          if (startsWithProviderMatch) {
            foundModelId = startsWithProviderMatch.id;
          }
        }

        // Apply if found
        if (foundModelId) {
          setPromptModelId(foundModelId);
          const foundModelDetails = availableModels.find(
            (m) => m.id === foundModelId
          );
          toast.success(
            `Model set to: ${foundModelDetails?.name} (${foundModelDetails?.providerName})`
          );
        } else {
          toast.warning(
            `Model matching "${urlParams.modelId}" not found or not enabled. Using default.`
          );
        }
      }
      // --- End Improved Model Selection Logic ---

      if (urlParams.vfsFiles && urlParams.vfsFiles.length > 0) {
        const vfsKeyForUrl = "orphan";
        let fsInstance;
        try {
          fsInstance = await initVfs(vfsKeyForUrl, { force: true });
        } catch (vfsError) {
          toast.error(
            `Failed to initialize VFS for URL files: ${
              vfsError instanceof Error ? vfsError.message : String(vfsError)
            }`
          );
        }

        if (fsInstance) {
          for (const filePath of urlParams.vfsFiles) {
            try {
              const contentBytes = await VfsOps.readFileOp(filePath, {
                fsInstance,
              });
              const nodeStat = await fsInstance.promises.stat(filePath);
              const fileName = basename(filePath);
              const mimeType = "application/octet-stream";
              const isText = isLikelyTextFile(fileName, mimeType);
              let fileData: {
                contentText?: string;
                contentBase64?: string;
              } = {};
              if (isText) {
                fileData.contentText = new TextDecoder().decode(contentBytes);
              } else {
                let binary = "";
                const len = contentBytes.byteLength;
                for (let i = 0; i < len; i++) {
                  binary += String.fromCharCode(contentBytes[i]);
                }
                fileData.contentBase64 = window.btoa(binary);
              }
              addAttachedFile({
                source: "vfs",
                name: fileName,
                type: mimeType,
                size: nodeStat.size,
                path: filePath,
                ...fileData,
              });
              toast.success(`Attached VFS file: ${fileName}`);
            } catch (fileError: any) {
              if (fileError.code === "ENOENT") {
                toast.warning(`VFS file not found: ${filePath}`);
              } else {
                toast.warning(
                  `Failed to attach VFS file "${filePath}": ${fileError.message}`
                );
              }
              console.error(
                `Error processing VFS file ${filePath}:`,
                fileError
              );
            }
          }
        }
      }

      if (urlParams.query) {
        if (urlParams.submit === "0") {
          // Set value in input area and focus
          inputAreaRef.current?.setValue(urlParams.query);
          focusInput();
          toast.info("Query from URL loaded into input area.");
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        } else {
          // Submit the prompt (existing logic)
          let parameters: Record<string, any> = {};
          let metadata: Record<string, any> = {};
          const currentPromptControls = Object.values(
            useControlRegistryStore.getState().promptControls
          ).filter((c) => (c.show ? c.show() : true));

          for (const control of currentPromptControls) {
            if (control.getParameters) {
              const params = await control.getParameters();
              if (params) parameters = { ...parameters, ...params };
            }
            if (control.getMetadata) {
              const meta = await control.getMetadata();
              if (meta) metadata = { ...metadata, ...meta };
            }
          }
          const currentAttachedFiles =
            useInputStore.getState().attachedFilesMetadata;
          if (currentAttachedFiles.length > 0) {
            metadata.attachedFiles = [...currentAttachedFiles];
          }

          let turnData: PromptTurnObject = {
            id: nanoid(),
            content: urlParams.query,
            parameters,
            metadata,
          };

          emitter.emit(ModEvent.PROMPT_SUBMITTED, { turnData });
          const middlewareResult = await runMiddleware(
            ModMiddlewareHook.PROMPT_TURN_FINALIZE,
            { turnData }
          );
          if (middlewareResult === false) {
            toast.warning("Prompt submission from URL cancelled by middleware.");
            return;
          }
          const finalTurnData =
            middlewareResult && typeof middlewareResult === "object"
              ? (middlewareResult as { turnData: PromptTurnObject }).turnData
              : turnData;

          await ConversationService.submitPrompt(finalTurnData);
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        }
      } else if (urlParams.modelId || urlParams.vfsFiles?.length) {
        toast.info(
          "Model and/or VFS files from URL applied. Type your message."
        );
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }
    } catch (error) {
      toast.error(
        `Failed to process URL parameters: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      console.error("Error processing URL parameters:", error);
    }
  }, [focusInput]);

  // --- Initialization Effect ---
  useEffect(() => {
    let isMounted = true;
    const initializeApp = async () => {
      console.log("LiteChat: Starting initialization...");
      setIsInitializing(true);
      try {
        // Use the modularized initialization function
        await performFullInitialization(controls);
        // Process URL parameters after core initialization is complete
        await processUrlParameters();
      } catch (error) {
        // Error handling is done within performFullInitialization or processUrlParameters
        // and will set globalError via UIStateStore if necessary.
        console.error("LiteChat: Top-level initialization error:", error);
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
    // processUrlParameters is now included in the dependency array
  }, [controls, processUrlParameters]);

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
          ? getConversationById(selectedItemId)?.projectId ?? null
          : null;

      const effectiveSettings = getEffectiveProjectSettings(currentProjectId);
      initializePromptState(effectiveSettings);
      prevContextRef.current = currentContext;
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
          console.error("LiteChat: Failed to create new conversation", error);
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
        focusInput();
      } catch (error) {
        console.error("LiteChat: Error submitting prompt:", error);
        focusInput();
      }
    },
    [focusInput]
  );

  const onRegenerateInteraction = useCallback(
    async (interactionId: string) => {
      try {
        await ConversationService.regenerateInteraction(interactionId);
        focusInput();
      } catch (error) {
        console.error("LiteChat: Error regenerating interaction:", error);
        focusInput();
      }
    },
    [focusInput]
  );

  const onStopInteraction = useCallback(
    (interactionId: string) => {
      InteractionService.abortInteraction(interactionId);
      focusInput();
    },
    [focusInput]
  );

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
