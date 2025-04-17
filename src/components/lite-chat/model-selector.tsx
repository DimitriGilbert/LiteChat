// src/components/lite-chat/model-selector.tsx
import React from "react";
import { useProviderManagementContext } from "@/context/provider-management-context";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";

export function ModelSelector() {
  const {
    selectedProvider,
    selectedModelId,
    setSelectedModelId,
    activeProviders,
  } = useProviderManagementContext();

  const isLoading = !activeProviders || activeProviders.length === 0;

  // modelOptions uses the filtered/sorted list from the context for the dropdown
  const modelOptions = React.useMemo(() => {
    if (!selectedProvider?.models) {
      return [];
    }
    return selectedProvider.models.map((model) => ({
      value: model.id,
      label: model.name,
    }));
  }, [selectedProvider?.models]);

  // allModelOptions uses the complete list from the context for search/placeholders
  const allModelOptions = React.useMemo(() => {
    if (!selectedProvider?.allAvailableModels) {
      return [];
    }
    return selectedProvider.allAvailableModels.map((model) => ({
      value: model.id,
      label: model.name,
    }));
  }, [selectedProvider?.allAvailableModels]);

  const handleModelChange = (value: string | null) => {
    setSelectedModelId(value);
  };

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

  // Check if there are *any* models available at all for the provider
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

  // Check if there are models specifically *enabled* for the dropdown
  if (modelOptions.length === 0) {
    // If no models are explicitly enabled (but some exist), allow searching all.
    return (
      <Combobox
        // Provide ALL models to the combobox ONLY in this specific case
        // so search can find them.
        options={allModelOptions}
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

  // Default case: Show enabled models in dropdown, search within them.
  return (
    <Combobox
      options={modelOptions} // Use the filtered list for the dropdown
      value={selectedModelId}
      onChange={handleModelChange}
      placeholder="Select model..."
      // Search placeholder reflects the number of models in the dropdown list
      searchPlaceholder={`Search ${modelOptions.length} enabled models...`}
      emptyText="No matching models found."
      triggerClassName="text-xs h-9"
      contentClassName="text-xs"
    />
  );
}
