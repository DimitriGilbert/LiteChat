// src/hooks/litechat/useGlobalModelSelectorRegistration.tsx
import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useProviderStore } from "@/store/provider.store";
import type { PromptControl } from "@/types/litechat/prompt";
import { useShallow } from "zustand/react/shallow";
import { GlobalModelSelector } from "@/components/LiteChat/prompt/control/GlobalModelSelector";

const splitModelId = (
  combinedId: string | null,
): { providerId: string | null; modelId: string | null } => {
  if (!combinedId || !combinedId.includes(":")) {
    return { providerId: null, modelId: null };
  }
  const parts = combinedId.split(":");
  const providerId = parts[0];
  const modelId = parts.slice(1).join(":");
  return { providerId, modelId };
};

export const useGlobalModelSelectorRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );
  const providerState = useProviderStore(
    useShallow((state) => ({
      isLoading: state.isLoading,
      selectedModelId: state.selectedModelId,
    })),
  );

  React.useEffect(() => {
    const control: PromptControl = {
      id: "core-global-model-selector",
      triggerRenderer: () => <GlobalModelSelector />,
      show: () => true,
      getMetadata: () => {
        const combinedId = providerState.selectedModelId;
        const { providerId, modelId } = splitModelId(combinedId);
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
