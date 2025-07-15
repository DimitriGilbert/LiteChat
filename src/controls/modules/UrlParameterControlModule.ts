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
import { TextTriggerControlModule } from "./TextTriggerControlModule";
import { textTriggerRegistry } from "@/services/text-trigger-registry.service";
import { TextTriggerParserService } from "@/services/text-trigger-parser.service";

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
    if (urlParams.modelId) {
      const availableModels = useProviderStore.getState().getAvailableModelListItems();
      let foundModelId: string | null = null;
      const modelParamLower = urlParams.modelId.toLowerCase();
      if (urlParams.modelId.includes(":")) {
        const directMatch = availableModels.find((m) => m.id === urlParams.modelId);
        if (directMatch) foundModelId = directMatch.id;
      }
      if (!foundModelId) {
        const nameMatch = availableModels.find((m) => m.name.toLowerCase() === modelParamLower);
        if (nameMatch) foundModelId = nameMatch.id;
      }
      if (!foundModelId) {
        const startsWithNameMatch = availableModels.find((m) => m.name.toLowerCase().startsWith(modelParamLower));
        if (startsWithNameMatch) foundModelId = startsWithNameMatch.id;
      }
      if (!foundModelId) {
        const startsWithProviderMatch = availableModels.find((m) => {
          const mtc = m.id.toLowerCase().split("/");
          return mtc.length > 1 && mtc[1].startsWith(modelParamLower);
        });
        if (startsWithProviderMatch) foundModelId = startsWithProviderMatch.id;
      }
      if (foundModelId) {
        modApi.emit(promptEvent.setModelIdRequest, { id: foundModelId });
        modApi.emit(providerEvent.selectModelRequest, { modelId: foundModelId });
        const foundModelDetails = availableModels.find((m) => m.id === foundModelId);
        toast.success(`Model set to: ${foundModelDetails?.name} (${foundModelDetails?.providerName})`);
      } else {
        toast.warning(`Model matching "${urlParams.modelId}" not found or not enabled. Using default.`);
      }
    }
    if (!urlParams.query) return;
    // Create a new conversation for the loaded prompt
    const safeQuery = urlParams.query || '';
    const conversationTitle = `From URL: ${safeQuery.substring(0, 30)}...`;
    modApi.emit(conversationEvent.addConversationRequest, { title: conversationTitle });
    // Wait for the conversation to be added and select it
    const unsub = modApi.on(conversationEvent.conversationAdded, (payload) => {
      if (payload.conversation.title === conversationTitle) {
        modApi.emit(conversationEvent.selectItemRequest, {
          id: payload.conversation.id,
          type: "conversation",
        });
        unsub();
        // Set the prompt input
        modApi.emit(promptEvent.inputChanged, { value: safeQuery });
        // Submit the prompt automatically
        const turnData = {
          id: nanoid(),
          content: safeQuery,
          parameters: {},
          metadata: {},
        };
        modApi.emit(promptEvent.submitted, { turnData });
        toast.info("Loaded and submitted prompt from URL.");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });
  }
}