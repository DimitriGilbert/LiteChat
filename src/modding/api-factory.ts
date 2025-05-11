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
// Removed unused useControlRegistryStore
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
import { controlRegistryEvent } from "@/types/litechat/events/control.registry.events";
// Removed unused modEvent

export function createModApi(mod: DbMod): LiteChatModApi {
  const modId = mod.id;
  const modName = mod.name;
  const unsubscribers: (() => void)[] = [];

  const api: LiteChatModApi = {
    modId,
    modName,
    registerPromptControl: (control: ModPromptControl) => {
      emitter.emit(controlRegistryEvent.registerPromptControlRequest, {
        control: control as CorePromptControlFromTypes,
      });
      const u = () =>
        emitter.emit(controlRegistryEvent.unregisterPromptControlRequest, {
          id: control.id,
        });
      unsubscribers.push(u);
      return u;
    },
    registerChatControl: (control: ModChatControl) => {
      const controlWithDefaults: CoreChatControlFromTypes = {
        ...control,
        status: control.status ?? (() => "ready"),
      };
      emitter.emit(controlRegistryEvent.registerChatControlRequest, {
        control: controlWithDefaults,
      });
      const u = () =>
        emitter.emit(controlRegistryEvent.unregisterChatControlRequest, {
          id: control.id,
        });
      unsubscribers.push(u);
      return u;
    },
    registerTool: <P extends z.ZodSchema<any>>(
      toolName: string,
      definition: Tool<P>,
      implementation?: ToolImplementation<P>
    ) => {
      console.log(`[${modName}] Registering tool: ${toolName}`);
      emitter.emit(controlRegistryEvent.registerToolRequest, {
        modId,
        toolName,
        definition,
        implementation,
      });
      const u = () =>
        emitter.emit(controlRegistryEvent.unregisterToolRequest, { toolName });
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
      hookName: H,
      callback: (
        payload: any
      ) =>
        | import("@/types/litechat/modding").ModMiddlewareReturnMap[H]
        | Promise<import("@/types/litechat/modding").ModMiddlewareReturnMap[H]>
    ) => {
      emitter.emit(controlRegistryEvent.registerMiddlewareRequest, {
        hookName,
        modId,
        callback,
      });
      const u = () =>
        emitter.emit(controlRegistryEvent.unregisterMiddlewareRequest, {
          hookName,
          modId,
          callback,
        });
      unsubscribers.push(u);
      return u;
    },
    registerSettingsTab: (tab: CustomSettingTab) => {
      useModStore.getState()._addSettingsTab(tab);
      const u = () => useModStore.getState()._removeSettingsTab(tab.id);
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
      toast[t](`[Mod: ${modName}] ${m}`);
    },
    log: (l, ...a) => {
      console[l](`[Mod: ${modName}]`, ...a);
    },
    registerModalProvider: (modalId: string, provider: ModalProvider) => {
      emitter.emit(controlRegistryEvent.registerModalProviderRequest, {
        modalId,
        provider,
      });
      const u = () =>
        emitter.emit(controlRegistryEvent.unregisterModalProviderRequest, {
          modalId,
        });
      unsubscribers.push(u);
      return u;
    },
    getVfsInstance: async (vfsKey: string): Promise<typeof fs | null> => {
      return useVfsStore.getState().initializeVFS(vfsKey, { force: true });
    },
  };

  return api;
}
