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
import type {
  DbProviderConfig,
  AiProviderConfig,
} from "@/types/litechat/provider";
import { useControlRegistryStore } from "@/store/control.store";
import { Skeleton } from "@/components/ui/skeleton";
// Import the missing constant
import { DEFAULT_MODELS } from "@/lib/litechat/provider-helpers";

export const ModelProviderControlComponent: React.FC = () => {
  const {
    selectedProviderId,
    selectedModelId,
    selectProvider,
    selectModel,
    getActiveProviders,
    dbProviderConfigs,
    isLoading,
  } = useProviderStore(
    useShallow((state) => ({
      selectedProviderId: state.selectedProviderId,
      selectedModelId: state.selectedModelId,
      selectProvider: state.selectProvider,
      selectModel: state.selectModel,
      getActiveProviders: state.getActiveProviders,
      dbProviderConfigs: state.dbProviderConfigs,
      isLoading: state.isLoading,
    })),
  );

  const activeProviders = getActiveProviders ? getActiveProviders() : [];

  const modelsForSelectedProvider = React.useMemo(() => {
    const config = dbProviderConfigs.find(
      (p: DbProviderConfig) => p.id === selectedProviderId,
    );
    if (!config) return [];

    // Use the logic from getActiveProviders/getSelectedProvider for consistency
    // Combine fetched models and defaults, then deduplicate
    const allAvailable = [
      ...(config.fetchedModels ?? []), // Prioritize fetched models
      ...(DEFAULT_MODELS[config.type as keyof typeof DEFAULT_MODELS] || []), // Add defaults if needed
    ].reduce(
      (acc, model) => {
        // Deduplicate based on ID
        if (!acc.some((m) => m.id === model.id)) {
          acc.push(model);
        }
        return acc;
      },
      [] as { id: string; name: string }[],
    );

    const enabledIds = new Set(config.enabledModels ?? []);
    let displayModels =
      enabledIds.size > 0
        ? allAvailable.filter((m) => enabledIds.has(m.id))
        : [...allAvailable]; // Use copy

    const sortOrder = config.modelSortOrder ?? [];
    if (sortOrder.length > 0 && displayModels.length > 0) {
      const orderedList: { id: string; name: string }[] = [];
      const addedIds = new Set<string>();
      const displayModelMap = new Map(displayModels.map((m) => [m.id, m]));
      for (const modelId of sortOrder) {
        const model = displayModelMap.get(modelId);
        if (model && !addedIds.has(modelId)) {
          orderedList.push(model);
          addedIds.add(modelId);
        }
      }
      const remaining = [...displayModels] // Create copy
        .filter((m) => !addedIds.has(m.id))
        .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
      displayModels = [...orderedList, ...remaining];
    } else {
      displayModels.sort(
        (
          a,
          b, // Sort copy
        ) => (a.name || a.id).localeCompare(b.name || b.id),
      );
    }
    return displayModels;
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
        onValueChange={(v) => selectProvider(v || null)}
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
          {activeProviders.map((p: AiProviderConfig) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={selectedModelId ?? ""}
        onValueChange={(v) => selectModel(v || null)}
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
      isLoading: state.isLoading,
      selectedProviderId: state.selectedProviderId,
      selectedModelId: state.selectedModelId,
    })),
  );

  React.useEffect(() => {
    const control: PromptControl = {
      id: "core-model-provider",
      // Removed status property
      triggerRenderer: () => <ModelProviderControlComponent />,
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
