// src/components/lite-chat/provider-selector.tsx
import React, { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// REMOVED store imports
import { cn } from "@/lib/utils";
import type {
  AiProviderConfig,
  DbProviderConfig,
  // DbProviderType, // REMOVED
} from "@/lib/types";

// Define props based on what PromptSettings passes down
interface ProviderSelectorProps {
  className?: string;
  selectedProviderId: string | null;
  setSelectedProviderId: (id: string | null) => void;
  setSelectedModelId: (id: string | null) => void; // Needed to reset model on provider change
  dbProviderConfigs: DbProviderConfig[]; // Needed to derive active providers
}

// Helper function (can be moved to utils)
const deriveAiProviderConfig = (
  config: DbProviderConfig | undefined,
): AiProviderConfig | undefined => {
  if (!config) return undefined;
  return {
    id: config.id,
    name: config.name,
    type: config.type,
    models: [], // Placeholder
    allAvailableModels: config.fetchedModels || [],
  };
};

// Wrap component logic in a named function for React.memo
const ProviderSelectorComponent: React.FC<ProviderSelectorProps> = ({
  className,
  selectedProviderId, // Use prop
  setSelectedProviderId, // Use prop action
  setSelectedModelId, // Use prop action
  dbProviderConfigs, // Use prop
}) => {
  // REMOVED store access

  // Derive activeProviders using props
  const activeProviders = useMemo((): AiProviderConfig[] => {
    return dbProviderConfigs
      .filter((c) => c.isEnabled)
      .map((c) => deriveAiProviderConfig(c))
      .filter((p): p is AiProviderConfig => !!p);
  }, [dbProviderConfigs]); // Depend on prop

  // Use prop actions
  const handleValueChange = (value: string) => {
    setSelectedProviderId(value);
    setSelectedModelId(null); // Reset model
  };

  const isDisabled = activeProviders.length <= 1;

  return (
    <Select
      value={selectedProviderId ?? ""} // Use prop
      onValueChange={handleValueChange}
      disabled={isDisabled}
    >
      <SelectTrigger
        className={cn(
          "w-[180px] h-9 text-sm bg-gray-700 border-gray-600 text-gray-200",
          className,
        )}
        aria-label="Select AI provider"
      >
        <SelectValue placeholder="Select Provider" />
      </SelectTrigger>
      <SelectContent className="bg-gray-700 border-gray-600 text-gray-200">
        {activeProviders.map((provider: AiProviderConfig) => (
          <SelectItem key={provider.id} value={provider.id}>
            {provider.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// Export the memoized component
export const ProviderSelector = React.memo(ProviderSelectorComponent);
