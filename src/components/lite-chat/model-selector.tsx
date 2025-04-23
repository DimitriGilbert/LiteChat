// src/components/lite-chat/model-selector.tsx
import React, { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useProviderStore } from "@/store/provider.store";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiProviderConfig, DbProviderConfig } from "@/lib/types";
import { useChatStorage } from "@/hooks/use-chat-storage"; // Import storage hook
import { DEFAULT_MODELS } from "@/lib/litechat"; // Import DEFAULT_MODELS

const ModelSelectorComponent: React.FC = () => {
  // --- Fetch state/actions from store ---
  const { selectedProviderId, selectedModelId, setSelectedModelId } =
    useProviderStore(
      useShallow((state) => ({
        selectedProviderId: state.selectedProviderId,
        selectedModelId: state.selectedModelId,
        setSelectedModelId: state.setSelectedModelId,
      })),
    );

  // Fetch providerConfigs from storage
  const { providerConfigs: dbProviderConfigs } = useChatStorage(); // Use storage hook

  // Derive selectedDbProviderConfig using store state and fetched data
  const selectedDbProviderConfig = useMemo(
    () =>
      (dbProviderConfigs || []).find(
        (p: DbProviderConfig) => p.id === selectedProviderId,
      ),
    [dbProviderConfigs, selectedProviderId],
  );

  // Derive selectedProvider (for model list) using derived config
  const selectedProvider = useMemo((): AiProviderConfig | undefined => {
    if (!selectedDbProviderConfig) return undefined;
    // Use helper function or inline logic to get default models
    const allModels =
      selectedDbProviderConfig.fetchedModels &&
      selectedDbProviderConfig.fetchedModels.length > 0
        ? selectedDbProviderConfig.fetchedModels
        : DEFAULT_MODELS[selectedDbProviderConfig.type] || []; // Use imported DEFAULT_MODELS

    const enabledIds = new Set(selectedDbProviderConfig.enabledModels ?? []);
    let displayModels =
      enabledIds.size > 0
        ? allModels.filter((m) => enabledIds.has(m.id))
        : allModels;

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
  }, [selectedDbProviderConfig]);

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

  // Use store action
  const handleModelChange = (value: string | null) => {
    setSelectedModelId(value);
  };

  // Loading/disabled states based on derived data
  const isLoading = !dbProviderConfigs; // Basic loading state

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
        triggerClassName="text-xs h-9"
        contentClassName="text-xs"
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
        triggerClassName="text-xs h-9"
        contentClassName="text-xs"
      />
    );
  }

  if (modelOptions.length === 0) {
    return (
      <Combobox
        options={allModelOptions} // Show all if none are enabled
        value={selectedModelId}
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
      value={selectedModelId}
      onChange={handleModelChange}
      placeholder="Select model..."
      searchPlaceholder={`Search ${modelOptions.length} enabled models...`}
      emptyText="No matching models found."
      triggerClassName="text-xs h-9"
      contentClassName="text-xs"
    />
  );
};

export const ModelSelector = React.memo(ModelSelectorComponent);
