// src/components/LiteChat/prompt/control/GlobalModelSelector.tsx
import React, { useMemo } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiModelConfig } from "@/types/litechat/provider";
import {
  combineModelId,
  DEFAULT_MODELS,
} from "@/lib/litechat/provider-helpers"; // Import necessary helpers

// Define props for the controlled component
interface GlobalModelSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export const GlobalModelSelector: React.FC<GlobalModelSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  // Select the raw data needed to derive the ordered list
  const { dbProviderConfigs, globalModelSortOrder, isLoading } =
    useProviderStore(
      useShallow((state) => ({
        // Removed getGloballyEnabledAndOrderedModels selector
        dbProviderConfigs: state.dbProviderConfigs,
        globalModelSortOrder: state.globalModelSortOrder,
        isLoading: state.isLoading,
      })),
    );

  // --- Re-implement the logic to get enabled and ordered models ---
  const enabledAndOrderedModels: Omit<AiModelConfig, "instance">[] =
    useMemo(() => {
      const globallyEnabledModelsMap = new Map<
        string,
        Omit<AiModelConfig, "instance">
      >();
      const enabledCombinedIds = new Set<string>();

      dbProviderConfigs.forEach((config) => {
        if (!config.isEnabled || !config.enabledModels) return;

        const providerTypeKey = config.type as keyof typeof DEFAULT_MODELS;
        const allProviderModels =
          config.fetchedModels ?? DEFAULT_MODELS[providerTypeKey] ?? [];
        const providerModelsMap = new Map(
          allProviderModels.map((m) => [m.id, m]),
        );

        config.enabledModels.forEach((modelId) => {
          const combinedId = combineModelId(config.id, modelId);
          const modelDef = providerModelsMap.get(modelId);
          if (modelDef) {
            enabledCombinedIds.add(combinedId);
            globallyEnabledModelsMap.set(combinedId, {
              id: combinedId,
              name: modelDef.name || modelId,
              providerId: config.id,
              providerName: config.name,
              metadata: modelDef.metadata,
            });
          }
        });
      });

      const sortedModels: Omit<AiModelConfig, "instance">[] = [];
      const addedIds = new Set<string>();

      globalModelSortOrder.forEach((combinedId) => {
        if (enabledCombinedIds.has(combinedId)) {
          const details = globallyEnabledModelsMap.get(combinedId);
          if (details && !addedIds.has(combinedId)) {
            sortedModels.push(details);
            addedIds.add(combinedId);
          }
        }
      });

      const remainingEnabled = Array.from(enabledCombinedIds)
        .filter((combinedId) => !addedIds.has(combinedId))
        .map((combinedId) => globallyEnabledModelsMap.get(combinedId))
        .filter((details): details is Omit<AiModelConfig, "instance"> =>
          Boolean(details),
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      return [...sortedModels, ...remainingEnabled];
    }, [dbProviderConfigs, globalModelSortOrder]); // Depend on the raw data
  // --- End derived logic ---

  const options = React.useMemo(
    () =>
      enabledAndOrderedModels.map((m) => ({
        value: m.id,
        label: `${m.name} (${m.providerName})`,
      })),
    [enabledAndOrderedModels],
  );

  if (isLoading && options.length === 0) {
    return <Skeleton className="h-10 w-[250px]" />;
  }

  return (
    <Combobox
      options={options}
      value={value ?? ""}
      onChange={onChange}
      placeholder="Select Model..."
      searchPlaceholder="Search models..."
      emptyText={isLoading ? "Loading models..." : "No models enabled/found."}
      triggerClassName="h-10 w-full min-w-[200px] max-w-[300px] text-xs"
      contentClassName="w-[--radix-popover-trigger-width]"
      disabled={
        disabled || (isLoading && options.length === 0) || options.length === 0
      }
    />
  );
};
