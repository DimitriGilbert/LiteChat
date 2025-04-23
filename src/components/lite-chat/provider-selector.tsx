// src/components/lite-chat/provider-selector.tsx
import React, { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useShallow } from "zustand/react/shallow";
import { useProviderStore } from "@/store/provider.store";
import { cn } from "@/lib/utils";
import type { AiProviderConfig, DbProviderConfig } from "@/lib/types";
import { useChatStorage } from "@/hooks/use-chat-storage"; // Import storage hook

// Keep this helper, but it's less critical now
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

const ProviderSelectorComponent: React.FC<{ className?: string }> = ({
  className,
}) => {
  // --- Fetch state/actions from store ---
  const { selectedProviderId, setSelectedProviderId, setSelectedModelId } =
    useProviderStore(
      useShallow((state) => ({
        selectedProviderId: state.selectedProviderId,
        setSelectedProviderId: state.setSelectedProviderId,
        setSelectedModelId: state.setSelectedModelId,
      })),
    );

  // Fetch providerConfigs from storage
  const { providerConfigs: dbProviderConfigs } = useChatStorage(); // Use storage hook

  // Derive activeProviders using store state and fetched data
  const activeProviders = useMemo((): AiProviderConfig[] => {
    return (dbProviderConfigs || [])
      .filter((c: DbProviderConfig) => c.isEnabled)
      .map((c: DbProviderConfig) => deriveAiProviderConfig(c)) // Use helper
      .filter((p: any): p is AiProviderConfig => !!p);
  }, [dbProviderConfigs]);

  // Use store actions
  const handleValueChange = (value: string) => {
    // Pass current configs from storage to the action
    setSelectedProviderId(value, dbProviderConfigs || []);
    setSelectedModelId(null); // Reset model
  };

  const isDisabled = activeProviders.length <= 1;

  return (
    <Select
      value={selectedProviderId ?? ""}
      onValueChange={handleValueChange}
      disabled={isDisabled}
    >
      <SelectTrigger
        className={cn(
          "w-[180px] h-9 text-sm bg-background border-border text-foreground",
          className,
        )}
        aria-label="Select AI provider"
      >
        <SelectValue placeholder="Select Provider" />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border text-popover-foreground">
        {activeProviders.map((provider: AiProviderConfig) => (
          <SelectItem key={provider.id} value={provider.id}>
            {provider.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export const ProviderSelector = React.memo(ProviderSelectorComponent);
