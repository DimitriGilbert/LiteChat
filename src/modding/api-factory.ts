import type {
  DbMod,
  LiteChatModApi,
  ModEventName,
  ModEventPayloadMap,
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  Tool,
  ToolImplementation,
  ReadonlyChatContextSnapshot,
} from "@/types/litechat/modding";
import type { PromptControl } from "@/types/litechat/prompt";
import type { ChatControl } from "@/types/litechat/chat";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useConversationStore } from "@/store/conversation.store";
import { useSettingsStore } from "@/store/settings.store";
import { useProviderStore } from "@/store/provider.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { toast } from "sonner";
import { z } from "zod";

export function createModApi(mod: DbMod): LiteChatModApi {
  const modId = mod.id;
  const modName = mod.name;
  const controlStoreActions = useControlRegistryStore.getState();
  const unsubscribers: (() => void)[] = [];

  const api: LiteChatModApi = {
    modId,
    modName,
    registerPromptControl: (c) => {
      const u = controlStoreActions.registerPromptControl(c);
      unsubscribers.push(u);
      return u;
    },
    registerChatControl: (c) => {
      const u = controlStoreActions.registerChatControl(c);
      unsubscribers.push(u);
      return u;
    },
    registerTool: <P extends z.ZodSchema<any>>(
      tN: string,
      d: Tool<P>,
      i?: ToolImplementation<P>,
    ) => {
      console.warn("registerTool not implemented");
      return () => {};
    },
    on: (eN, cb) => {
      emitter.on(eN, cb as any);
      const u = () => emitter.off(eN, cb as any);
      unsubscribers.push(u);
      return u;
    },
    addMiddleware: (hN, cb) => {
      const u = controlStoreActions.registerMiddleware(hN, modId, cb);
      unsubscribers.push(u);
      return u;
    },
    getContextSnapshot: (): ReadonlyChatContextSnapshot => {
      const iS = useInteractionStore.getState();
      const cS = useConversationStore.getState();
      const sS = useSettingsStore.getState();
      const pS = useProviderStore.getState();
      return Object.freeze({
        selectedConversationId: cS.selectedConversationId,
        interactions:
          iS.currentConversationId === cS.selectedConversationId
            ? iS.interactions.map((i) => Object.freeze({ ...i }))
            : [],
        isStreaming: iS.status === "streaming",
        selectedProviderId: pS.selectedProviderId,
        selectedModelId: pS.selectedModelId,
        activeSystemPrompt: null, // TODO: Implement system prompt logic
        temperature: sS.defaultTemperature,
        maxTokens: sS.defaultMaxTokens,
        theme: sS.theme,
      });
    },
    showToast: (t, m) => {
      toast[t](`[${modName}] ${m}`);
    },
    log: (l, ...a) => {
      console[l](`[Mod: ${modName}]`, ...a);
    },
  };
  // TODO: Add cleanup mechanism for unsubscribers
  return api;
}
