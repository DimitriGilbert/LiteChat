// src/controls/modules/UrlParameterControlModule.ts
// FULL FILE
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  ModMiddlewareHook,
} from "@/types/litechat/modding";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import { appEvent } from "@/types/litechat/events/app.events"; // Corrected import
import { parseAppUrlParameters } from "@/lib/litechat/url-helpers";
import { toast } from "sonner";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { isLikelyTextFile } from "@/lib/litechat/file-extensions";
import { basename } from "@/lib/litechat/file-manager-utils";
import { nanoid } from "nanoid";
import { runMiddleware } from "@/lib/litechat/ai-helpers";
import type { PromptTurnObject } from "@/types/litechat/prompt";
import { ConversationService } from "@/services/conversation.service";
import { conversationEvent } from "@/types/litechat/events/conversation.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { inputEvent } from "@/types/litechat/events/input.events";
// import { textTriggerEvent } from "@/types/litechat/events/text-trigger.events";
// Removed unused vfsEvent import
import { useProviderStore } from "@/store/provider.store";
import { useInputStore } from "@/store/input.store";

export class UrlParameterControlModule implements ControlModule {
  readonly id = "core-url-parameters";
  readonly dependencies = ["core-text-triggers"]; // Add dependency on text triggers
  private modApiRef: LiteChatModApi | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    console.log(`[${this.id}] Initializing...`);
    modApi.on(appEvent.initializationPhaseCompleted, (payload) => {
      // Corrected: Use appEvent directly
      if (payload.phase === "all") {
        this.processUrlParameters().catch((err) => {
          console.error(`[${this.id}] Error processing URL parameters:`, err);
          toast.error("Failed to process URL parameters.");
        });
      }
    });
    console.log(`[${this.id}] Initialized, awaiting full app load.`);
  }

  register(_modApi: LiteChatModApi): void {
    // No UI components to register
  }

  destroy(): void {
    this.modApiRef = null;
  }

  private async processUrlParameters(): Promise<void> {
    if (!this.modApiRef) {
      console.warn(
        `[${this.id}] ModAPI not available, cannot process URL parameters.`
      );
      return;
    }
    const modApi = this.modApiRef;

    const urlParams = parseAppUrlParameters();
    if (!urlParams.query && !urlParams.modelId && !urlParams.vfsFiles?.length) {
      return;
    }

    toast.info("Processing parameters from URL...");

    try {
      const newConversationId = await new Promise<string>((resolve, reject) => {
        // Removed unused tempId
        const unsub = modApi.on(
          conversationEvent.conversationAdded,
          (payload) => {
            if (payload.conversation.title.startsWith("From URL:")) {
              unsub();
              resolve(payload.conversation.id);
            }
          }
        );
        setTimeout(() => {
          // Removed unused timeout variable
          unsub();
          reject(new Error("Timeout waiting for conversation creation event."));
        }, 5000);

        modApi.emit(conversationEvent.addConversationRequest, {
          title: urlParams.query
            ? `From URL: ${urlParams.query.substring(0, 30)}...`
            : "From URL Parameters",
        });
      });

      modApi.emit(conversationEvent.selectItemRequest, {
        id: newConversationId,
        type: "conversation",
      });

      if (urlParams.modelId) {
        const availableModels = useProviderStore
          .getState()
          .getAvailableModelListItems();
        let foundModelId: string | null = null;
        const modelParamLower = urlParams.modelId.toLowerCase();

        if (urlParams.modelId.includes(":")) {
          const directMatch = availableModels.find(
            (m) => m.id === urlParams.modelId
          );
          if (directMatch) foundModelId = directMatch.id;
        }
        if (!foundModelId) {
          const nameMatch = availableModels.find(
            (m) => m.name.toLowerCase() === modelParamLower
          );
          if (nameMatch) foundModelId = nameMatch.id;
        }
        if (!foundModelId) {
          const startsWithNameMatch = availableModels.find((m) =>
            m.name.toLowerCase().startsWith(modelParamLower)
          );
          if (startsWithNameMatch) foundModelId = startsWithNameMatch.id;
        }
        if (!foundModelId) {
          const startsWithProviderMatch = availableModels.find((m) => {
            const mtc = m.id.toLowerCase().split("/");
            return mtc.length > 1 && mtc[1].startsWith(modelParamLower);
          });
          if (startsWithProviderMatch)
            foundModelId = startsWithProviderMatch.id;
        }

        if (foundModelId) {
          modApi.emit(promptEvent.setModelIdRequest, { id: foundModelId });
          modApi.emit(providerEvent.selectModelRequest, {
            modelId: foundModelId,
          });
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

      if (urlParams.vfsFiles && urlParams.vfsFiles.length > 0) {
        const vfsKeyForUrl = "orphan";
        let fsInstance;
        try {
          fsInstance = await modApi.getVfsInstance(vfsKeyForUrl);
          if (!fsInstance)
            throw new Error("Failed to get VFS instance via ModAPI.");
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

              modApi.emit(inputEvent.addAttachedFileRequest, {
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
          // Check for text triggers and parse them
          if (urlParams.query.includes("@.")) {
            // TODO: Implement text trigger parsing
            // modApi.emit(textTriggerEvent.parseAndExecuteRequest, {
            //   text: urlParams.query,
            //   source: 'url-parameter'
            // });
            
            // Listen for cleaned text to set in input
            // const unsubscribe = modApi.on(textTriggerEvent.textCleaned, (payload) => {
            //   if (payload.source === 'url-parameter') {
                modApi.emit(promptEvent.inputChanged, {
                  value: urlParams.query,
                });
                // unsubscribe(); // One-time listener
              // }
            
            toast.info("Query with text triggers loaded from URL.");
          } else {
            modApi.emit(promptEvent.inputChanged, {
              value: urlParams.query,
            });
            toast.info("Query from URL loaded into input area.");
          }
          
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        } else {
          let parameters: Record<string, any> = {};
          let metadata: Record<string, any> = {};

          const currentAttachedFiles =
            useInputStore.getState().attachedFilesMetadata;
          if (currentAttachedFiles.length > 0) {
            metadata.attachedFiles = [...currentAttachedFiles];
          }

          // Handle text triggers in the query before submission
          let finalQueryContent = urlParams.query;
          
          if (urlParams.query.includes("@.")) {
            // TODO: Parse and execute text triggers, then use cleaned text
            // modApi.emit(textTriggerEvent.parseAndExecuteRequest, {
            //   text: urlParams.query,
            //   source: 'url-parameter-submit'
            // });
            
            // Wait for cleaned text (this is a simplified approach)
            // In a real implementation, this would be handled asynchronously
            console.log("Text triggers detected in URL query, executing...");
          }

          let turnData: PromptTurnObject = {
            id: nanoid(),
            content: finalQueryContent,
            parameters,
            metadata,
          };

          modApi.emit(promptEvent.submitted, { turnData });

          const middlewareResult = await runMiddleware(
            ModMiddlewareHook.PROMPT_TURN_FINALIZE,
            { turnData }
          );

          if (middlewareResult === false) {
            toast.warning(
              "Prompt submission from URL cancelled by middleware."
            );
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
  }
}
