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

export const ModelProviderControlComponent: React.FC = () => {
  const {
    selectedProviderId,
    selectedModelId,
    selectProvider,
    selectModel,
    getActiveProviders,
    dbProviderConfigs, // Need configs to get models
  } = useProviderStore(
    useShallow((state) => ({
      selectedProviderId: state.selectedProviderId,
      selectedModelId: state.selectedModelId,
      selectProvider: state.selectProvider,
      selectModel: state.selectModel,
      getActiveProviders: state.getActiveProviders,
      dbProviderConfigs: state.dbProviderConfigs,
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

  return (
    <div className="flex items-center gap-1">
      <Select
        value={selectedProviderId ?? ""}
        onValueChange={(v) => selectProvider(v || null)}
      >
        <SelectTrigger className="h-8 text-xs w-[120px]">
          <SelectValue placeholder="Provider" />
        </SelectTrigger>
        <SelectContent>
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
        disabled={!selectedProviderId}
      >
        <SelectTrigger className="h-8 text-xs w-[150px]">
          <SelectValue placeholder="Model" />
        </SelectTrigger>
        <SelectContent>
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
      status: () => (providerState.isLoading ? "loading" : "ready"),
      trigger: () => <ModelProviderControlComponent />,
      show: () => true,
      // Provide selected IDs as metadata for the PromptTurnObject
      getMetadata: () => ({
        providerId: providerState.selectedProviderId,
        modelId: providerState.selectedModelId,
      }),
      order: 10,
    };
    const unregister = register(control);
    return unregister;
    // Ensure re-registration if relevant state changes
  }, [
    register,
    providerState.isLoading,
    providerState.selectedProviderId,
    providerState.selectedModelId,
  ]);
};
