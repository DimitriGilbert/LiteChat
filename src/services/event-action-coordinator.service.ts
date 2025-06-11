// src/services/event-action-coordinator.service.ts
// FULL FILE
import { emitter } from "@/lib/litechat/event-emitter";
import type { RegisteredActionHandler } from "@/types/litechat/control";

// Import ALL store hooks
import { useSettingsStore } from "@/store/settings.store";
import { useProviderStore } from "@/store/provider.store";
import { useRulesStore } from "@/store/rules.store";
import { useConversationStore } from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useInputStore } from "@/store/input.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useModStore } from "@/store/mod.store";
import { useUIStateStore } from "@/store/ui.store";
import { useVfsStore } from "@/store/vfs.store";
import { useControlRegistryStore } from "@/store/control.store";
import { usePromptTemplateStore } from "@/store/prompt-template.store";

// Array of all store hooks that have the getRegisteredActionHandlers method
const storesWithActionHandlers = [
  useSettingsStore,
  useProviderStore,
  useRulesStore,
  useConversationStore,
  useProjectStore,
  useInteractionStore,
  useInputStore,
  usePromptStateStore,
  useModStore,
  useUIStateStore,
  useVfsStore,
  useControlRegistryStore,
  usePromptTemplateStore,
];

export class EventActionCoordinatorService {
  private static isInitialized = false;

  public static initialize(): void {
    if (this.isInitialized) {
      console.warn(
        "[Coordinator] Already initialized. Skipping re-initialization."
      );
      return;
    }
    console.log(
      "[Coordinator] Initializing dynamic event listeners for action requests..."
    );

    const allActionHandlers: RegisteredActionHandler<any>[] = [];

    storesWithActionHandlers.forEach((storeHook) => {
      const storeState = storeHook.getState() as any;
      if (
        storeState &&
        typeof storeState.getRegisteredActionHandlers === "function"
      ) {
        try {
          const handlers = storeState.getRegisteredActionHandlers();
          if (Array.isArray(handlers)) {
            allActionHandlers.push(...handlers);
          } else {
            console.warn(
              `[Coordinator] getRegisteredActionHandlers for store did not return an array. Store ID: ${
                storeState.id || "Unknown"
              }`
            );
          }
        } catch (error) {
          console.error(
            `[Coordinator] Error calling getRegisteredActionHandlers for a store:`,
            error
          );
        }
      }
    });

    if (allActionHandlers.length === 0) {
      console.warn(
        "[Coordinator] No action handlers were registered by any store."
      );
    } else {
      allActionHandlers.forEach((registeredHandler) => {
        if (
          registeredHandler &&
          registeredHandler.eventName &&
          typeof registeredHandler.handler === "function"
        ) {
          emitter.on(registeredHandler.eventName, registeredHandler.handler);
        } else {
          console.error(
            "[Coordinator] Invalid action handler structure encountered:",
            registeredHandler
          );
        }
      });
    }

    this.isInitialized = true;
    console.log(
      `[Coordinator] Dynamic event listeners initialized. Total handlers: ${allActionHandlers.length}.`
    );
  }
}
