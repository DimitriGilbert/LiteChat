// src/types/litechat/events/stores/provider.events.ts
// FULL FILE
export const providerStoreEvent = {
  // State Change Events
  initialDataLoaded: "stores.provider.initial.data.loaded",
  configsChanged: "stores.provider.configs.changed",
  apiKeysChanged: "stores.provider.api.keys.changed",
  selectedModelChanged: "stores.provider.selected.model.changed",
  globalModelSortOrderChanged:
    "stores.provider.global.model.sort.order.changed",
  fetchStatusChanged: "stores.provider.fetch.status.changed",
  globallyEnabledModelsUpdated:
    "stores.provider.globally.enabled.models.updated",
  selectedModelForDetailsChanged:
    "stores.provider.selected.model.for.details.changed",
  // Added this event
  enableApiKeyManagementChanged:
    "stores.provider.enable.api.key.management.changed",

  // Action Request Events
  loadInitialDataRequest: "stores.provider.load.initial.data.request",
  selectModelRequest: "stores.provider.select.model.request",
  addApiKeyRequest: "stores.provider.add.api.key.request",
  deleteApiKeyRequest: "stores.provider.delete.api.key.request",
  addProviderConfigRequest: "stores.provider.add.config.request",
  updateProviderConfigRequest: "stores.provider.update.config.request",
  deleteProviderConfigRequest: "stores.provider.delete.config.request",
  fetchModelsRequest: "stores.provider.fetch.models.request",
  setGlobalModelSortOrderRequest:
    "stores.provider.set.global.model.sort.order.request",
  // Added this request
  setEnableApiKeyManagementRequest:
    "stores.provider.set.enable.api.key.management.request",
  setSelectedModelForDetailsRequest:
    "stores.provider.set.selected.model.for.details.request",
} as const;
