// src/controls/modules/UrlParameterControlModule.ts
// FULL FILE
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  ModMiddlewareHook,
} from "@/types/litechat/modding";
import { promptStoreEvent } from "@/types/litechat/events/prompt.events";
import { parseAppUrlParameters } from "@/lib/litechat/url-helpers";
import { useConversationStore } from "@/store/conversation.store";
import { useProviderStore } from "@/store/provider.store";
import { useInputStore } from "@/store/input.store";
import { useVfsStore } from "@/store/vfs.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { toast } from "sonner";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { isLikelyTextFile } from "@/lib/litechat/file-extensions";
import { basename } from "@/lib/litechat/file-manager-utils";
import { nanoid } from "nanoid";
import { emitter } from "@/lib/litechat/event-emitter";
import { runMiddleware } from "@/lib/litechat/ai-helpers";
import type { PromptTurnObject } from "@/types/litechat/prompt";
import { ConversationService } from "@/services/conversation.service";

export class UrlParameterControlModule implements ControlModule {
  readonly id = "core-url-parameters";

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    console.log(`[${this.id}] Initializing...`);
    await this.processUrlParameters();
    console.log(`[${this.id}] Initialized.`);
  }

  register(_modApi: LiteChatModApi): void {
    // No UI components to register
  }

  destroy(): void {
    // No resources to clean up
  }

  private async processUrlParameters(): Promise<void> {
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

      if (urlParams.modelId) {
        const availableModels = getAvailableModelListItems();
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
          emitter.emit(promptStoreEvent.inputChanged, {
            value: urlParams.query,
          });
          toast.info("Query from URL loaded into input area.");
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

          let turnData: PromptTurnObject = {
            id: nanoid(),
            content: urlParams.query,
            parameters,
            metadata,
          };

          emitter.emit(promptStoreEvent.submitted, { turnData });

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
