// src/types/litechat/events/provider.events.ts
// FULL FILE
import type {
  DbProviderConfig,
  DbApiKey,
  ModelListItem,
} from "@/types/litechat/provider";

export const providerEvent = {
  // State Change Events
  initialDataLoaded: "provider.initial.data.loaded",
  configsChanged: "provider.configs.changed",
  apiKeysChanged: "provider.api.keys.changed",
  selectedModelChanged: "provider.selected.model.changed",
  globalModelSortOrderChanged: "provider.global.model.sort.order.changed",
  fetchStatusChanged: "provider.fetch.status.changed",
  globallyEnabledModelsUpdated: "provider.globally.enabled.models.updated",
  selectedModelForDetailsChanged: "provider.selected.model.for.details.changed",
  enableApiKeyManagementChanged: "provider.enable.api.key.management.changed",

  // Action Request Events
  loadInitialDataRequest: "provider.load.initial.data.request",
  selectModelRequest: "provider.select.model.request",
  addApiKeyRequest: "provider.add.api.key.request",
  updateApiKeyRequest: "provider.update.api.key.request",
  deleteApiKeyRequest: "provider.delete.api.key.request",
  addProviderConfigRequest: "provider.add.config.request",
  updateProviderConfigRequest: "provider.update.config.request",
  deleteProviderConfigRequest: "provider.delete.config.request",
  fetchModelsRequest: "provider.fetch.models.request",
  setGlobalModelSortOrderRequest:
    "provider.set.global.model.sort.order.request",
  setEnableApiKeyManagementRequest:
    "provider.set.enable.api.key.management.request",
  setSelectedModelForDetailsRequest:
    "provider.set.selected.model.for.details.request",
} as const;

export interface ProviderEventPayloads {
  [providerEvent.initialDataLoaded]: {
    configs: DbProviderConfig[];
    apiKeys: DbApiKey[];
    selectedModelId: string | null;
    globalSortOrder: string[];
  };
  [providerEvent.configsChanged]: { providerConfigs: DbProviderConfig[] };
  [providerEvent.apiKeysChanged]: { apiKeys: DbApiKey[] };
  [providerEvent.selectedModelChanged]: { modelId: string | null };
  [providerEvent.globalModelSortOrderChanged]: { ids: string[] };
  [providerEvent.fetchStatusChanged]: {
    providerId: string;
    status: "idle" | "fetching" | "error" | "success";
  };
  [providerEvent.globallyEnabledModelsUpdated]: { models: ModelListItem[] };
  [providerEvent.selectedModelForDetailsChanged]: { modelId: string | null };
  [providerEvent.enableApiKeyManagementChanged]: { enabled: boolean };
  [providerEvent.loadInitialDataRequest]: undefined;
  [providerEvent.selectModelRequest]: { modelId: string | null };
  [providerEvent.addApiKeyRequest]: {
    name: string;
    providerId: string;
    value: string;
  };
  [providerEvent.updateApiKeyRequest]: {
    id: string;
    name: string;
    providerId: string;
    value: string;
  };
  [providerEvent.deleteApiKeyRequest]: { id: string };
  [providerEvent.addProviderConfigRequest]: Omit<
    DbProviderConfig,
    "id" | "createdAt" | "updatedAt"
  >;
  [providerEvent.updateProviderConfigRequest]: {
    id: string;
    changes: Partial<DbProviderConfig>;
  };
  [providerEvent.deleteProviderConfigRequest]: { id: string };
  [providerEvent.fetchModelsRequest]: { providerConfigId: string };
  [providerEvent.setGlobalModelSortOrderRequest]: { ids: string[] };
  [providerEvent.setEnableApiKeyManagementRequest]: { enabled: boolean };
  [providerEvent.setSelectedModelForDetailsRequest]: { modelId: string | null };
}
