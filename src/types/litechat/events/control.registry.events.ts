// src/types/litechat/events/stores/control.registry.events.ts
// NEW FILE
export const controlRegistryStoreEvent = {
  // State Change Events
  promptControlsChanged: "stores.control.registry.prompt.controls.changed",
  chatControlsChanged: "stores.control.registry.chat.controls.changed",
  middlewareChanged: "stores.control.registry.middleware.changed",
  toolsChanged: "stores.control.registry.tools.changed",
  modalProvidersChanged: "stores.control.registry.modal.providers.changed", // For Phase 4

  // Action Request Events
  registerPromptControlRequest:
    "stores.control.registry.register.prompt.control.request",
  unregisterPromptControlRequest:
    "stores.control.registry.unregister.prompt.control.request",
  registerChatControlRequest:
    "stores.control.registry.register.chat.control.request",
  unregisterChatControlRequest:
    "stores.control.registry.unregister.chat.control.request",
  registerMiddlewareRequest:
    "stores.control.registry.register.middleware.request",
  unregisterMiddlewareRequest:
    "stores.control.registry.unregister.middleware.request",
  registerToolRequest: "stores.control.registry.register.tool.request",
  unregisterToolRequest: "stores.control.registry.unregister.tool.request",
  registerModalProviderRequest:
    "stores.control.registry.register.modal.provider.request", // For Phase 4
  unregisterModalProviderRequest:
    "stores.control.registry.unregister.modal.provider.request", // For Phase 4
} as const;
