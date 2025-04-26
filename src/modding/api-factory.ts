// src/modding/api-factory.ts
import type {
  DbMod,
  LiteChatModApi,
  ReadonlyChatContextSnapshot,
  CustomSettingTab,
  Tool,
  ToolImplementation,
} from "@/types/litechat/modding";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useConversationStore } from "@/store/conversation.store";
import { useSettingsStore } from "@/store/settings.store";
import { useProviderStore } from "@/store/provider.store";
import { useModStore } from "@/store/mod.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { toast } from "sonner";
import type { z } from "zod";

export function createModApi(mod: DbMod): LiteChatModApi {
  const modId = mod.id;
  const modName = mod.name;
  const controlStoreActions = useControlRegistryStore.getState();
  const modStoreActions = useModStore.getState();
  const unsubscribers: (() => void)[] = [];

  // TODO: Implement a proper cleanup mechanism that calls all unsubscribers
  // when the mod is unloaded or the application closes.

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
      toolName: string,
      definition: Tool<P>,
      implementation?: ToolImplementation<P>,
    ) => {
      console.log(`[${modName}] Registering tool: ${toolName}`);
      // Call the store action to register the tool
      const u = controlStoreActions.registerTool(
        modId, // Pass modId for tracking
        toolName,
        definition,
        implementation,
      );
      unsubscribers.push(u);
      return u;
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
      // Create a frozen snapshot of relevant state parts
      return Object.freeze({
        selectedConversationId: cS.selectedConversationId,
        // Deep freeze interactions array and its objects
        interactions: Object.freeze(
          iS.currentConversationId === cS.selectedConversationId
            ? iS.interactions.map((i) => Object.freeze({ ...i }))
            : [],
        ),
        isStreaming: iS.status === "streaming",
        selectedProviderId: pS.selectedProviderId,
        selectedModelId: pS.selectedModelId,
        activeSystemPrompt: sS.globalSystemPrompt,
        temperature: sS.temperature,
        maxTokens: sS.maxTokens,
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

  return api;
}
