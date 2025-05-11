// src/modding/api-factory.ts
// FULL FILE
import type {
  DbMod,
  LiteChatModApi,
  ReadonlyChatContextSnapshot,
  CustomSettingTab,
  ToolImplementation,
  ModMiddlewareHookName,
  ModEventPayloadMap,
  ModPromptControl,
  ModChatControl,
  ModalProvider,
} from "@/types/litechat/modding";
import type { ChatControl as CoreChatControlFromTypes } from "@/types/litechat/chat";
import type { PromptControl as CorePromptControlFromTypes } from "@/types/litechat/prompt";

import { Tool } from "ai";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useConversationStore } from "@/store/conversation.store";
import { useSettingsStore } from "@/store/settings.store";
import { useProviderStore } from "@/store/provider.store";
import { useModStore } from "@/store/mod.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { toast } from "sonner";
import type { z } from "zod";
import { splitModelId } from "@/lib/litechat/provider-helpers";
import { useVfsStore } from "@/store/vfs.store";
import type { fs } from "@zenfs/core";

export function createModApi(mod: DbMod): LiteChatModApi {
  const modId = mod.id;
  const modName = mod.name;
  const controlStoreActions = useControlRegistryStore.getState();
  const modStoreActions = useModStore.getState();
  const unsubscribers: (() => void)[] = [];

  const api: LiteChatModApi = {
    modId,
    modName,
    registerPromptControl: (control: ModPromptControl) => {
      const u = controlStoreActions.registerPromptControl(
        control as CorePromptControlFromTypes
      );
      unsubscribers.push(u);
      return u;
    },
    registerChatControl: (control: ModChatControl) => {
      const controlWithDefaults: CoreChatControlFromTypes = {
        ...control,
        status: control.status ?? (() => "ready"),
      };
      const u = controlStoreActions.registerChatControl(controlWithDefaults);
      unsubscribers.push(u);
      return u;
    },
    registerTool: <P extends z.ZodSchema<any>>(
      toolName: string,
      definition: Tool<P>,
      implementation?: ToolImplementation<P>
    ) => {
      console.log(`[${modName}] Registering tool: ${toolName}`);
      const u = controlStoreActions.registerTool(
        modId,
        toolName,
        definition,
        implementation
      );
      unsubscribers.push(u);
      return u;
    },
    on: <K extends keyof ModEventPayloadMap>(
      eventName: K,
      callback: (payload: ModEventPayloadMap[K]) => void
    ) => {
      emitter.on(eventName, callback);
      const u = () => emitter.off(eventName, callback);
      unsubscribers.push(u);
      return u;
    },
    emit: <K extends keyof ModEventPayloadMap>(
      eventName: K,
      payload: ModEventPayloadMap[K]
    ) => {
      emitter.emit(eventName, payload);
    },
    addMiddleware: <H extends ModMiddlewareHookName>(
      hN: H,
      cb: (
        payload: any
      ) =>
        | import("@/types/litechat/modding").ModMiddlewareReturnMap[H]
        | Promise<import("@/types/litechat/modding").ModMiddlewareReturnMap[H]>
    ) => {
      const u = controlStoreActions.registerMiddleware(hN, modId, cb);
      unsubscribers.push(u);
      return u;
    },
    registerSettingsTab: (tab: CustomSettingTab) => {
      modStoreActions._addSettingsTab(tab);
      const u = () => modStoreActions._removeSettingsTab(tab.id);
      unsubscribers.push(u);
      return u;
    },
    getContextSnapshot: (): ReadonlyChatContextSnapshot => {
      const iS = useInteractionStore.getState();
      const cS = useConversationStore.getState();
      const sS = useSettingsStore.getState();
      const pS = useProviderStore.getState();
      const { providerId } = splitModelId(pS.selectedModelId);

      const selectedConversationId =
        cS.selectedItemType === "conversation" ? cS.selectedItemId : null;

      return Object.freeze({
        selectedConversationId: selectedConversationId,
        interactions: Object.freeze(
          iS.currentConversationId === selectedConversationId
            ? iS.interactions.map((i) => Object.freeze({ ...i }))
            : []
        ),
        isStreaming: iS.status === "streaming",
        selectedProviderId: providerId,
        selectedModelId: pS.selectedModelId,
        activeSystemPrompt: sS.globalSystemPrompt,
        temperature: sS.temperature,
        maxTokens: sS.maxTokens,
        theme: sS.theme,
        gitUserName: sS.gitUserName,
        gitUserEmail: sS.gitUserEmail,
      });
    },
    showToast: (t, m) => {
      toast[t](`[${modName}] ${m}`);
    },
    log: (l, ...a) => {
      console[l](`[Mod: ${modName}]`, ...a);
    },
    registerModalProvider: (modalId: string, provider: ModalProvider) => {
      const u = controlStoreActions.registerModalProvider(modalId, provider);
      unsubscribers.push(u);
      return u;
    },
    getVfsInstance: async (vfsKey: string): Promise<typeof fs | null> => {
      return useVfsStore.getState().initializeVFS(vfsKey, { force: true });
    },
  };

  return api;
}
