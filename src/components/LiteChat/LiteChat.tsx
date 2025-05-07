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
import type {
  PromptTurnObject,
  InputAreaRef,
} from "@/types/litechat/prompt";
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
import { parseAppUrlParameters } from "@/lib/litechat/url-helpers";
import { useInputStore } from "@/store/input.store";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { isLikelyTextFile } from "@/lib/litechat/file-extensions";
import { nanoid } from "nanoid";
import { runMiddleware } from "@/lib/litechat/ai-helpers";
import { ModEvent, ModMiddlewareHook } from "@/types/litechat/modding";
import { emitter } from "@/lib/litechat/event-emitter";
import { basename } from "@/lib/litechat/file-manager-utils";

// Define the type for the registration functions prop
export type RegistrationFunction = () => void;

interface LiteChatProps {
  controls?: RegistrationFunction[];
}

export const LiteChat: React.FC<LiteChatProps> = ({ controls = [] }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const inputAreaRef = useRef<InputAreaRef>(null);

  // --- Store Hooks ---
  const selectedItemId = useConversationStore((state) => state.selectedItemId);
  const selectedItemType = useConversationStore(
    (state) => state.selectedItemType
  );
  const loadSidebarItems = useConversationStore(
    (state) => state.loadSidebarItems
  );
  const getConversationById = useConversationStore(
    (state) => state.getConversationById
  );
  const { getEffectiveProjectSettings } = useProjectStore(
    useShallow((state) => ({
      projects: state.projects,
      getProjectById: state.getProjectById,
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
  const { loadDbMods, setLoadedMods } = useModStore(
    useShallow((state) => ({
      loadDbMods: state.loadDbMods,
      setLoadedMods: state.setLoadedMods,
    }))
  );
  const { loadInitialData: loadProviderData } = useProviderStore(
    useShallow((state) => ({
      loadInitialData: state.loadInitialData,
    }))
  );
  const { loadSettings } = useSettingsStore(
    useShallow((state) => ({
      loadSettings: state.loadSettings,
    }))
  );
  const { setVfsKey } = useVfsStore(
    useShallow((state) => ({
      setVfsKey: state.setVfsKey,
    }))
  );
  const { initializePromptState } = usePromptStateStore(
    useShallow((state) => ({
      initializePromptState: state.initializePromptState,
    }))
  );
  const { loadRulesAndTags } = useRulesStore(
    useShallow((state) => ({
      loadRulesAndTags: state.loadRulesAndTags,
    }))
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

  // --- Process URL Parameters ---
  const processUrlParameters = useCallback(async () => {
    const urlParams = parseAppUrlParameters();
    if (!urlParams.query && !urlParams.modelId && !urlParams.vfsFiles?.length) {
      return; // No relevant parameters
    }

    toast.info("Processing parameters from URL...");

    const {
      addConversation,
      selectItem,
      getConversationById: getConvoById,
    } = useConversationStore.getState();
    const { setModelId: setPromptModelId } = usePromptStateStore.getState();
    const { addAttachedFile } = useInputStore.getState();
    const { getAvailableModelListItems } = useProviderStore.getState();
    const { initializeVFS: initVfs, findNodeByPath: findVfsNodeByPath } =
      useVfsStore.getState();

    try {
      // 1. Create and select a new conversation
      const newConversationId = await addConversation({
        title: urlParams.query
          ? `From URL: ${urlParams.query.substring(0, 30)}...`
          : "From URL Parameters",
      });
      await selectItem(newConversationId, "conversation");
      // This selection will trigger context changes and prompt state initialization.

      // 2. Set Model if specified
      if (urlParams.modelId) {
        const availableModels = getAvailableModelListItems();
        const modelExists = availableModels.some(
          (m) => m.id === urlParams.modelId
        );
        if (modelExists) {
          setPromptModelId(urlParams.modelId);
          toast.success(`Model set to: ${urlParams.modelId}`);
        } else {
          toast.warning(
            `Model ID "${urlParams.modelId}" from URL not found or not enabled. Using default.`
          );
        }
      }

      // 3. Attach VFS Files if specified
      if (urlParams.vfsFiles && urlParams.vfsFiles.length > 0) {
        // The new conversation has no project, so its VFS key is 'orphan'
        const vfsKeyForUrl = "orphan"; // Or derive if a default project logic exists
        let fsInstance;
        try {
          fsInstance = await initVfs(vfsKeyForUrl, { force: true });
        } catch (vfsError) {
          toast.error(
            `Failed to initialize VFS for URL files: ${
              vfsError instanceof Error ? vfsError.message : String(vfsError)
            }`
          );
          // Continue without VFS files if VFS init fails
        }

        if (fsInstance) {
          for (const filePath of urlParams.vfsFiles) {
            try {
              // Attempt to read the file directly
              const contentBytes = await VfsOps.readFileOp(filePath, {
                fsInstance,
              });
              const nodeStat = await fsInstance.promises.stat(filePath); // Get basic stats
              const fileName = basename(filePath);
              const mimeType = "application/octet-stream"; // Basic mime, refine if possible

              const isText = isLikelyTextFile(fileName, mimeType);
              let fileData: {
                contentText?: string;
                contentBase64?: string;
              } = {};

              if (isText) {
                fileData.contentText = new TextDecoder().decode(contentBytes);
              } else {
                // For non-text, convert to base64
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

      // 4. Submit Prompt or Set Input Area
      if (urlParams.query) {
        // Gather parameters and metadata for the prompt turn
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
        // Clear URL params after successful submission
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      } else if (urlParams.modelId || urlParams.vfsFiles?.length) {
        // If only model/VFS files, but no query, we don't auto-submit.
        // The files are attached, model is set. User can type and send.
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
        controls.forEach((registerFn) => {
          try {
            registerFn();
          } catch (regError) {
            console.error(
              `LiteChat: Error running registration function:`,
              regError
            );
          }
        });
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

        const initialSelItemId = useConversationStore.getState().selectedItemId;
        const initialSelItemType =
          useConversationStore.getState().selectedItemType;
        const initialProjectId =
          initialSelItemType === "project"
            ? initialSelItemId
            : initialSelItemType === "conversation"
            ? getConversationById(initialSelItemId)?.projectId ?? null
            : null;
        const initialEffectiveSettings =
          getEffectiveProjectSettings(initialProjectId);
        initializePromptState(initialEffectiveSettings);
        console.log(
          "LiteChat: Initial prompt state initialized.",
          initialEffectiveSettings
        );

        // Process URL parameters after core initialization
        await processUrlParameters();
      } catch (error) {
        console.error("LiteChat: Initialization failed:", error);
        toast.error(
          `Initialization failed: ${
            error instanceof Error ? error.message : String(error)
          }`
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
  }, [
    controls,
    loadSettings,
    loadProviderData,
    loadRulesAndTags,
    loadSidebarItems,
    loadDbMods,
    setLoadedMods,
    getConversationById,
    getEffectiveProjectSettings,
    initializePromptState,
    processUrlParameters,
  ]); // Added processUrlParameters to dependency array

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

      console.log(
        `[LiteChat Effect] Context changed (Item: ${selectedItemId}, Type: ${selectedItemType}). Calculating effective settings for Project ID: ${currentProjectId}`
      );
      const effectiveSettings = getEffectiveProjectSettings(currentProjectId);
      initializePromptState(effectiveSettings);
      console.log(
        "[LiteChat Effect] Prompt state updated based on context change.",
        effectiveSettings
      );

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
      console.log(
        `[LiteChat Effect] VFS Context Required. Setting target key: ${targetVfsKey}`
      );
    } else {
      targetVfsKey = null;
      console.log(
        "[LiteChat Effect] VFS Context Not Required. Setting target key: null"
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
          ? conversationState.getConversationById(
              conversationState.selectedItemId
            )?.projectId ?? null
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
              "LiteChat: Mismatch between created ID and selected ID after selection!"
            );
          }
          console.log(
            `LiteChat: New conversation created (${currentConvId}), selected.`
          );
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
        focusInput();
      } catch (error) {
        console.error("LiteChat: Error submitting prompt:", error);
        focusInput();
      }
    },
    [focusInput]
  );

  // --- Regeneration Handler ---
  const onRegenerateInteraction = useCallback(
    async (interactionId: string) => {
      console.log(`LiteChat: Regenerating interaction ${interactionId}`);
      try {
        await ConversationService.regenerateInteraction(interactionId);
        console.log(
          `LiteChat: ConversationService regeneration initiated for ${interactionId}.`
        );
        focusInput();
      } catch (error) {
        console.error("LiteChat: Error regenerating interaction:", error);
        focusInput();
      }
    },
    [focusInput]
  );

  // --- Stop Interaction Handler ---
  const onStopInteraction = useCallback(
    (interactionId: string) => {
      console.log(`LiteChat: Stopping interaction ${interactionId}`);
      InteractionService.abortInteraction(interactionId);
      focusInput();
    },
    [focusInput]
  );

  // --- Memoized Controls ---
  const sidebarControls = useMemo(
    () =>
      chatControls
        .filter(
          (c) => (c.panel ?? "main") === "sidebar" && (c.show ? c.show() : true)
        )
        .map((c) => c),
    [chatControls]
  );
  const sidebarFooterControls = useMemo(
    () =>
      chatControls
        .filter(
          (c) => c.panel === "sidebar-footer" && (c.show ? c.show() : true)
        )
        .map((c) => c),
    [chatControls]
  );
  const headerControls = useMemo(
    () =>
      chatControls
        .filter((c) => c.panel === "header" && (c.show ? c.show() : true))
        .map((c) => c),
    [chatControls]
  );

  // --- Memoized Modal Renderers ---
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
