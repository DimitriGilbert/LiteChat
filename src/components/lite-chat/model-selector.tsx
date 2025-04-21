// src/components/lite-chat/model-selector.tsx
import React, { useMemo } from "react";
// REMOVED store imports
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AiProviderConfig,
  DbProviderConfig,
  // AiModelConfig, // REMOVED
} from "@/lib/types";

// Define props based on what PromptSettings passes down
interface ModelSelectorProps {
  selectedProviderId: string | null;
  selectedModelId: string | null;
  setSelectedModelId: (id: string | null) => void;
  dbProviderConfigs: DbProviderConfig[]; // Needed to derive models for selected provider
}

// Wrap component logic in a named function for React.memo
const ModelSelectorComponent: React.FC<ModelSelectorProps> = ({
  selectedProviderId, // Use prop
  selectedModelId, // Use prop
  setSelectedModelId, // Use prop action
  dbProviderConfigs, // Use prop
}) => {
  // REMOVED store access

  // Derive selectedDbProviderConfig using props
  const selectedDbProviderConfig = useMemo(
    () => dbProviderConfigs.find((p) => p.id === selectedProviderId),
    [dbProviderConfigs, selectedProviderId],
  );

  // Derive selectedProvider (for model list) using props
  const selectedProvider = useMemo((): AiProviderConfig | undefined => {
    if (!selectedDbProviderConfig) return undefined;
    const allModels = selectedDbProviderConfig.fetchedModels || [];
    const enabledIds = new Set(selectedDbProviderConfig.enabledModels ?? []);
    let displayModels =
      enabledIds.size > 0
        ? allModels.filter((m) => enabledIds.has(m.id))
        : allModels;

    // Apply sorting based on modelSortOrder
    const sortOrder = selectedDbProviderConfig.modelSortOrder ?? [];
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
      const remaining = displayModels
        .filter((m) => !addedIds.has(m.id))
        .sort((a, b) => a.name.localeCompare(b.name));
      displayModels = [...orderedList, ...remaining];
    } else {
      displayModels.sort((a, b) => a.name.localeCompare(b.name));
    }

    return {
      id: selectedDbProviderConfig.id,
      name: selectedDbProviderConfig.name,
      type: selectedDbProviderConfig.type,
      models: displayModels.map((m) => ({
        id: m.id,
        name: m.name,
        instance: null, // Instance not needed here
      })),
      allAvailableModels: allModels,
    };
  }, [selectedDbProviderConfig]); // Depend on derived config

  // Derive model options using derived selectedProvider
  const modelOptions = useMemo(() => {
    if (!selectedProvider?.models) return [];
    return selectedProvider.models.map((model) => ({
      value: model.id,
      label: model.name,
    }));
  }, [selectedProvider?.models]);

  const allModelOptions = useMemo(() => {
    if (!selectedProvider?.allAvailableModels) return [];
    return selectedProvider.allAvailableModels.map((model) => ({
      value: model.id,
      label: model.name,
    }));
  }, [selectedProvider?.allAvailableModels]);

  // Use prop action
  const handleModelChange = (value: string | null) => {
    setSelectedModelId(value);
  };

  // Loading/disabled states based on derived data
  const isLoading = false; // Loading state might need to be passed if relevant

  if (isLoading) {
    return <Skeleton className="h-9" />;
  }

  if (!selectedProvider) {
    return (
      <Combobox
        options={[]}
        value={null}
        onChange={() => {}}
        placeholder="Select Provider First"
        disabled={true}
      />
    );
  }

  if (allModelOptions.length === 0) {
    return (
      <Combobox
        options={[]}
        value={null}
        onChange={() => {}}
        placeholder="No models available"
        searchPlaceholder="No models found..."
        emptyText="No models found for this provider."
        disabled={true}
      />
    );
  }

  if (modelOptions.length === 0) {
    return (
      <Combobox
        options={allModelOptions}
        value={selectedModelId} // Use prop
        onChange={handleModelChange}
        placeholder="No models enabled (Search all)"
        searchPlaceholder={`Search ${allModelOptions.length} models...`}
        emptyText="No matching models found."
        triggerClassName="text-xs h-9"
        contentClassName="text-xs"
      />
    );
  }

  return (
    <Combobox
      options={modelOptions}
      value={selectedModelId} // Use prop
      onChange={handleModelChange}
      placeholder="Select model..."
      searchPlaceholder={`Search ${modelOptions.length} enabled models...`}
      emptyText="No matching models found."
      triggerClassName="text-xs h-9"
      contentClassName="text-xs"
    />
  );
};

// Export the memoized component
export const ModelSelector = React.memo(ModelSelectorComponent);
