// src/components/LiteChat/prompt/control/GlobalModelSelector.tsx
import React, { useMemo } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";

export const GlobalModelSelector: React.FC = () => {
  // Select the underlying data and the selector function itself
  const {
    selectedModelId,
    selectModel,
    getGloballyEnabledAndOrderedModels, // Select the function
    dbProviderConfigs, // Select underlying data
    globalModelSortOrder, // Select underlying data
    isLoading,
  } = useProviderStore(
    useShallow((state) => ({
      selectedModelId: state.selectedModelId,
      selectModel: state.selectModel,
      getGloballyEnabledAndOrderedModels:
        state.getGloballyEnabledAndOrderedModels, // The selector function
      // Select the state the selector depends on for memoization
      dbProviderConfigs: state.dbProviderConfigs,
      globalModelSortOrder: state.globalModelSortOrder,
      isLoading: state.isLoading,
    })),
  );

  // Call the selector outside the hook and memoize its result
  const enabledAndOrderedModels = useMemo(() => {
    // Ensure the function exists before calling
    return getGloballyEnabledAndOrderedModels
      ? getGloballyEnabledAndOrderedModels()
      : [];
    // Dependency array includes the selector function AND the data it uses
    // eslint error is a mistake, if not included, infinite loop or not loading !
  }, [
    getGloballyEnabledAndOrderedModels,
    dbProviderConfigs,
    globalModelSortOrder,
  ]);

  const options = React.useMemo(
    () =>
      enabledAndOrderedModels.map((m) => ({
        value: m.id, // Combined ID: "providerId:modelId"
        label: `${m.name} (${m.providerName})`, // Display with provider name
      })),
    [enabledAndOrderedModels], // Depend on the memoized result
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
      // Disable if loading OR if there are no options after loading finishes
      disabled={isLoading || options.length === 0}
    />
  );
};
