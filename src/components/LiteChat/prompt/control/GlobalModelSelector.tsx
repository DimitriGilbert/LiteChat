// src/components/LiteChat/prompt/control/GlobalModelSelector.tsx
import React from "react";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";

export const GlobalModelSelector: React.FC = () => {
  const {
    selectedModelId, // Combined ID
    selectModel,
    getGloballyEnabledAndOrderedModels, // Use the correct selector
    isLoading,
  } = useProviderStore(
    useShallow((state) => ({
      selectedModelId: state.selectedModelId,
      selectModel: state.selectModel,
      getGloballyEnabledAndOrderedModels:
        state.getGloballyEnabledAndOrderedModels, // Use correct selector
      isLoading: state.isLoading,
    })),
  );

  // Get the globally enabled and ordered models
  const enabledModels = getGloballyEnabledAndOrderedModels
    ? getGloballyEnabledAndOrderedModels()
    : [];

  const options = React.useMemo(
    () =>
      enabledModels.map((m) => ({
        value: m.id, // Combined ID: "providerId:modelId"
        label: `${m.name} (${m.providerName})`, // Display with provider name
      })),
    [enabledModels],
  );

  if (isLoading) {
    return <Skeleton className="h-10 w-[250px]" />;
  }

  return (
    <Combobox
      options={options}
      value={selectedModelId ?? ""} // Use combined ID
      onChange={(value) => selectModel(value || null)} // Pass combined ID
      placeholder="Select Model..."
      searchPlaceholder="Search models..."
      emptyText="No models enabled."
      triggerClassName="h-10 w-full min-w-[200px] max-w-[300px] text-xs"
      contentClassName="w-[--radix-popover-trigger-width]"
      disabled={options.length === 0}
    />
  );
};
