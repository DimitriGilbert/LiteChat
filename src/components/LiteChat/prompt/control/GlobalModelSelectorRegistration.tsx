// src/components/LiteChat/prompt/control/GlobalModelSelectorRegistration.tsx
import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useProviderStore } from "@/store/provider.store";
import type { PromptControl } from "@/types/litechat/prompt";
import { useShallow } from "zustand/react/shallow";
import { GlobalModelSelector } from "./GlobalModelSelector"; // Import the new component

// Helper to split combined ID
const splitModelId = (
  combinedId: string | null,
): { providerId: string | null; modelId: string | null } => {
  if (!combinedId || !combinedId.includes(":")) {
    return { providerId: null, modelId: null };
  }
  const parts = combinedId.split(":");
  const providerId = parts[0];
  const modelId = parts.slice(1).join(":"); // Handle model IDs with ':'
  return { providerId, modelId };
};

export const useGlobalModelSelectorRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );
  const providerState = useProviderStore(
    useShallow((state) => ({
      isLoading: state.isLoading,
      selectedModelId: state.selectedModelId, // Combined ID
    })),
  );

  React.useEffect(() => {
    const control: PromptControl = {
      id: "core-global-model-selector", // Use new ID
      triggerRenderer: () => <GlobalModelSelector />, // Use new component
      show: () => true,
      getMetadata: () => {
        const combinedId = providerState.selectedModelId;
        const { providerId, modelId } = splitModelId(combinedId);
        // Return simple IDs in metadata
        return {
          providerId: providerId,
          modelId: modelId,
        };
      },
      order: 10,
    };
    const unregister = register(control);
    return unregister;
  }, [register, providerState.isLoading, providerState.selectedModelId]);

  return null;
};
