// src/controls/modules/UrlParameterControlModule.ts
// FULL FILE
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import { appEvent } from "@/types/litechat/events/app.events"; // Corrected import
import { parseAppUrlParameters } from "@/lib/litechat/url-helpers";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { conversationEvent } from "@/types/litechat/events/conversation.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
// Removed unused vfsEvent import
import { useProviderStore } from "@/store/provider.store";

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
    // Remove redundant early return for urlParams.query
    if (!urlParams.query && !urlParams.modelId && !urlParams.vfsFiles?.length) {
      return;
    }
    // Model selection logic (preserve new logic)
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
        if (startsWithProviderMatch) foundModelId = startsWithProviderMatch.id;
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
    // Conversation creation logic with timeout-protected, one-time event handler
    let conversationId: string | null = null;
    if (urlParams.query) {
      try {
        conversationId = await new Promise<string>((resolve, reject) => {
          const expectedTitle = `From URL: ${urlParams.query.substring(0, 30)}...`;
          const unsub = modApi.on(conversationEvent.conversationAdded, (payload) => {
            if (payload.conversation.title.startsWith("From URL:")) {
              unsub();
              resolve(payload.conversation.id);
            }
          });
          setTimeout(() => {
            unsub();
            reject(new Error("Timeout waiting for conversation creation event."));
          }, 5000);
          modApi.emit(conversationEvent.addConversationRequest, {
            title: expectedTitle,
          });
        });
        modApi.emit(conversationEvent.selectItemRequest, {
          id: conversationId,
          type: "conversation",
        });
      } catch (err) {
        toast.error("Failed to create conversation from URL parameters.");
        return;
      }
    }
    // VFS file handling and other new features can be inserted here if needed
    // Set prompt input and submit if query is present
    if (typeof urlParams.query === "string" && urlParams.query && conversationId) {
      const safeQuery = urlParams.query;
      modApi.emit(promptEvent.inputChanged, { value: safeQuery });
      // Submit the prompt automatically (preserve new logic)
      const turnData = {
        id: nanoid(),
        content: safeQuery,
        parameters: {},
        metadata: {},
      };
      modApi.emit(promptEvent.submitted, { turnData });
      toast.info("Loaded and submitted prompt from URL.");
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }
  }
}
