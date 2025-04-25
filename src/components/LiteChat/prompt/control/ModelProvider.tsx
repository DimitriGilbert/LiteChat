// src/components/LiteChat/prompt/control/ModelProvider.tsx
import React from "react";
import { useProviderStore } from "@/store/provider.store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useShallow } from "zustand/react/shallow";
import type { PromptControl } from "@/types/litechat/prompt";
import { useControlRegistryStore } from "@/store/control.store";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

export const ModelProviderControlComponent: React.FC = () => {
  const {
    selectedProviderId,
    selectedModelId,
    selectProvider,
    selectModel,
    getActiveProviders,
    dbProviderConfigs, // Need configs to get models
    isLoading, // Add isLoading state
  } = useProviderStore(
    useShallow((state) => ({
      selectedProviderId: state.selectedProviderId,
      selectedModelId: state.selectedModelId,
      selectProvider: state.selectProvider,
      selectModel: state.selectModel,
      getActiveProviders: state.getActiveProviders,
      dbProviderConfigs: state.dbProviderConfigs,
      isLoading: state.isLoading, // Get isLoading
    })),
  );

  const activeProviders = getActiveProviders();
  const modelsForSelectedProvider = React.useMemo(() => {
    const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
    if (!config) return [];
    const all = config.fetchedModels ?? []; // Use fetched or default logic if needed
    const enabled = config.enabledModels ?? [];
    return enabled.length > 0 ? all.filter((m) => enabled.includes(m.id)) : all;
  }, [selectedProviderId, dbProviderConfigs]);

  // Show skeleton loaders if data is loading
  if (isLoading) {
    return (
      <div className="flex items-center gap-1">
        <Skeleton className="h-8 w-[120px]" />
        <Skeleton className="h-8 w-[150px]" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Select
        value={selectedProviderId ?? ""}
        onValueChange={(v) => selectProvider(v || null)}
        disabled={activeProviders.length === 0} // Disable if no providers
      >
        <SelectTrigger className="h-8 text-xs w-[120px]">
          <SelectValue placeholder="Provider" />
        </SelectTrigger>
        <SelectContent>
          {activeProviders.length === 0 && (
            <SelectItem value="none" disabled>
              No providers enabled
            </SelectItem>
          )}
          {activeProviders.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={selectedModelId ?? ""}
        onValueChange={(v) => selectModel(v || null)}
        disabled={!selectedProviderId || modelsForSelectedProvider.length === 0} // Disable if no provider or models
      >
        <SelectTrigger className="h-8 text-xs w-[150px]">
          <SelectValue placeholder="Model" />
        </SelectTrigger>
        <SelectContent>
          {modelsForSelectedProvider.length === 0 && (
            <SelectItem value="none" disabled>
              {selectedProviderId ? "No models available" : "Select provider"}
            </SelectItem>
          )}
          {modelsForSelectedProvider.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name || m.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

// Registration Hook/Component
export const useModelProviderControlRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );
  // Use a single selector for provider state
  const providerState = useProviderStore(
    useShallow((state) => ({
      isLoading: state.isLoading,
      selectedProviderId: state.selectedProviderId,
      selectedModelId: state.selectedModelId,
    })),
  );

  React.useEffect(() => {
    const control: PromptControl = {
      id: "core-model-provider",
      // Status depends only on isLoading
      status: () => (providerState.isLoading ? "loading" : "ready"),
      trigger: () => <ModelProviderControlComponent />,
      show: () => true,
      // Provide selected IDs as metadata for the PromptTurnObject
      getMetadata: () => ({
        providerId: providerState.selectedProviderId,
        modelId: providerState.selectedModelId,
      }),
      order: 10, // Define an order
    };
    const unregister = register(control);
    return unregister;
    // Ensure re-registration if relevant state changes that affect metadata or status
  }, [
    register,
    providerState.isLoading,
    providerState.selectedProviderId,
    providerState.selectedModelId,
  ]);

  // This hook doesn't render anything itself
  return null;
};
