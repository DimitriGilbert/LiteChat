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
// Import DbProviderConfig and AiProviderConfig types
import type {
  DbProviderConfig,
  AiProviderConfig,
} from "@/types/litechat/provider";
import { useControlRegistryStore } from "@/store/control.store";
import { Skeleton } from "@/components/ui/skeleton";

export const ModelProviderControlComponent: React.FC = () => {
  const {
    selectedProviderId,
    selectedModelId,
    selectProvider, // Use correct action name
    selectModel, // Use correct action name
    getActiveProviders, // Use correct action name
    dbProviderConfigs, // Use correct state name
    isLoading, // Use correct state name
  } = useProviderStore(
    useShallow((state) => ({
      selectedProviderId: state.selectedProviderId,
      selectedModelId: state.selectedModelId,
      selectProvider: state.selectProvider, // Correct action
      selectModel: state.selectModel, // Correct action
      getActiveProviders: state.getActiveProviders, // Correct action
      dbProviderConfigs: state.dbProviderConfigs, // Correct state
      isLoading: state.isLoading, // Correct state
    })),
  );

  // Ensure getActiveProviders is called correctly
  const activeProviders = getActiveProviders ? getActiveProviders() : [];

  const modelsForSelectedProvider = React.useMemo(() => {
    // Add type annotation for p
    const config = dbProviderConfigs.find(
      (p: DbProviderConfig) => p.id === selectedProviderId,
    );
    if (!config) return [];
    const all = config.fetchedModels ?? [];
    const enabled = config.enabledModels ?? [];
    // Add type annotation for m
    return enabled.length > 0
      ? all.filter((m: { id: string }) => enabled.includes(m.id))
      : all;
  }, [selectedProviderId, dbProviderConfigs]);

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
        onValueChange={(v) => selectProvider(v || null)} // Call correct action
        disabled={activeProviders.length === 0}
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
          {/* Add type annotation for p */}
          {activeProviders.map((p: AiProviderConfig) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={selectedModelId ?? ""}
        onValueChange={(v) => selectModel(v || null)} // Call correct action
        disabled={!selectedProviderId || modelsForSelectedProvider.length === 0}
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
          {/* Add type annotation for m */}
          {modelsForSelectedProvider.map((m: { id: string; name?: string }) => (
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
      isLoading: state.isLoading, // Use correct state name
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
      getMetadata: () => ({
        providerId: providerState.selectedProviderId,
        modelId: providerState.selectedModelId,
      }),
      order: 10,
    };
    const unregister = register(control);
    return unregister;
  }, [
    register,
    providerState.isLoading,
    providerState.selectedProviderId,
    providerState.selectedModelId,
  ]);

  return null;
};
