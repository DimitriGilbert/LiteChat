// src/components/LiteChat/prompt/control/GlobalModelSelector.tsx
// Entire file content provided
import React, { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { combineModelId } from "@/lib/litechat/provider-helpers";

interface GlobalModelSelectorProps {
  /** The effective model ID for the current context */
  value: string | null; // Changed from optional - it should always receive the effective value
  /** Callback to update the GLOBAL default model selection */
  onChange: (value: string | null) => void;
  /** Optional flag to disable the selector */
  disabled?: boolean;
  /** Optional className for the trigger */
  className?: string;
}

export const GlobalModelSelector: React.FC<GlobalModelSelectorProps> =
  React.memo(({ value, onChange, disabled = false, className }) => {
    // Select necessary state using useShallow
    const { dbProviderConfigs, globalModelSortOrder, isLoading } =
      useProviderStore(
        useShallow((state) => ({
          dbProviderConfigs: state.dbProviderConfigs,
          globalModelSortOrder: state.globalModelSortOrder,
          isLoading: state.isLoading,
        })),
      );

    // Memoize the calculation of ordered models
    const orderedModels = useMemo(() => {
      const enabledModelsMap = new Map<
        string,
        { name: string; providerName: string }
      >();
      const enabledIds = new Set<string>();

      dbProviderConfigs.forEach((config) => {
        if (!config.isEnabled || !config.enabledModels) return;
        // Use fetchedModels or default models associated with the provider type
        const allProviderModels =
          config.fetchedModels ??
          (config.type
            ? useProviderStore
                .getState()
                .getAllAvailableModelDefsForProvider(config.id)
            : []);
        const providerModelsMap = new Map(
          allProviderModels.map((m) => [m.id, m]),
        );
        config.enabledModels.forEach((modelId) => {
          const combinedId = combineModelId(config.id, modelId);
          const modelDef = providerModelsMap.get(modelId);
          if (modelDef) {
            enabledIds.add(combinedId);
            enabledModelsMap.set(combinedId, {
              name: modelDef.name || modelId,
              providerName: config.name,
            });
          }
        });
      });

      const sorted: { id: string; name: string; providerName: string }[] = [];
      const added = new Set<string>();

      globalModelSortOrder.forEach((id) => {
        if (enabledIds.has(id)) {
          const details = enabledModelsMap.get(id);
          if (details && !added.has(id)) {
            sorted.push({ id, ...details });
            added.add(id);
          }
        }
      });

      enabledIds.forEach((id) => {
        if (!added.has(id)) {
          const details = enabledModelsMap.get(id);
          if (details) {
            sorted.push({ id, ...details });
          }
        }
      });

      return sorted;
    }, [dbProviderConfigs, globalModelSortOrder]); // Dependencies are stable references or primitives

    // Memoize the details of the currently selected model based on the 'value' prop
    const selectedModelDetails = useMemo(() => {
      return orderedModels.find((m) => m.id === value);
    }, [orderedModels, value]); // Depend on the calculated models and the effective value prop

    if (isLoading) {
      return <Skeleton className={cn("h-9 w-[200px]", className)} />;
    }

    return (
      <Select
        value={value ?? "none"} // Use the effective value prop
        onValueChange={(val) => onChange(val === "none" ? null : val)} // Call the global setter on change
        disabled={disabled || orderedModels.length === 0}
      >
        <SelectTrigger
          className={cn("w-auto h-9 text-sm", className)}
          aria-label="Select AI Model"
        >
          <SelectValue placeholder="Select Model...">
            {selectedModelDetails ? (
              <span className="truncate">
                {selectedModelDetails.name} ({selectedModelDetails.providerName}
                )
              </span>
            ) : (
              <span className="text-muted-foreground">Select Model...</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {orderedModels.length === 0 ? (
            <SelectItem value="none" disabled>
              No models enabled
            </SelectItem>
          ) : (
            orderedModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name} ({model.providerName})
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    );
  });
GlobalModelSelector.displayName = "GlobalModelSelector";
