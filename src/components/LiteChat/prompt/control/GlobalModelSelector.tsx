// src/components/LiteChat/prompt/control/GlobalModelSelector.tsx
// Entire file content provided
import React, { useMemo, useState, useCallback } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Skeleton } from "@/components/ui/skeleton";
import { combineModelId } from "@/lib/litechat/provider-helpers";

interface GlobalModelSelectorProps {
  /** The effective model ID for the current context */
  value: string | null
  /** Callback to update the GLOBAL default model selection */
  onChange: (value: string | null) => void;
  /** Optional flag to disable the selector */
  disabled?: boolean;
  /** Optional className for the trigger */
  className?: string;
}

export const GlobalModelSelector: React.FC<GlobalModelSelectorProps> =
  React.memo(({ value, onChange, disabled = false, className }) => {
    const [open, setOpen] = useState(false);
    const [filterText, setFilterText] = useState("")

    const { dbProviderConfigs, globalModelSortOrder, isLoading } =
      useProviderStore(
        useShallow((state) => ({
          dbProviderConfigs: state.dbProviderConfigs,
          globalModelSortOrder: state.globalModelSortOrder,
          isLoading: state.isLoading,
        })),
      );

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
    }, [dbProviderConfigs, globalModelSortOrder])

    const filteredModels = useMemo(() => {
      if (!filterText.trim()) {
        return orderedModels;
      }
      const lowerFilter = filterText.toLowerCase();
      return orderedModels.filter(
        (model) =>
          model.name.toLowerCase().includes(lowerFilter) ||
          model.providerName.toLowerCase().includes(lowerFilter) ||
          model.id.toLowerCase().includes(lowerFilter),
      );
    }, [orderedModels, filterText]);

    const selectedModelDetails = useMemo(() => {
      return orderedModels.find((m) => m.id === value);
    }, [orderedModels, value])

    const handleSelect = useCallback(
      (currentValue: string) => {
        const newValue = currentValue === value ? null : currentValue;
        onChange(newValue)
        setOpen(false)
        setFilterText("")
      },
      [onChange, value],
    );

    if (isLoading) {
      return <Skeleton className={cn("h-9 w-[250px]", className)} />;
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || orderedModels.length === 0}
            className={cn(
              "w-auto justify-between h-9 text-sm font-normal",
              className,
            )}
          >
            <span className="truncate max-w-[200px] sm:max-w-[300px]">
              {selectedModelDetails
                ? `${selectedModelDetails.name} (${selectedModelDetails.providerName})`
                : "Select Model..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
          <Command shouldFilter={false}>
            {" "}
            {/* Disable internal filtering */}
            <CommandInput
              placeholder="Search model..."
              value={filterText}
              onValueChange={setFilterText} // Update local filter state
            />
            <CommandList>
              <CommandEmpty>No model found.</CommandEmpty>
              <CommandGroup>
                {filteredModels.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id} // Use combined ID as value
                    onSelect={handleSelect}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === model.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">
                      {model.name} ({model.providerName})
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  });
GlobalModelSelector.displayName = "GlobalModelSelector";
