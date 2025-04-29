// src/hooks/litechat/useGlobalModelSelectorRegistration.tsx
import { useEffect } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useProviderStore } from "@/store/provider.store";
import { GlobalModelSelector } from "@/components/LiteChat/prompt/control/GlobalModelSelector";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";

export function useGlobalModelSelectorRegistration() {
  const registerPromptControl = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );

  useEffect(() => {
    const unregister = registerPromptControl({
      id: "core-global-model-selector",
      order: 10, // High priority
      show: () => true, // Always show for now
      // Renderer for the trigger area (the actual selector)
      triggerRenderer: () => {
        // Fetch state and actions needed by the component
        const { selectedModelId, selectModel, isLoading } = useProviderStore(
          useShallow((state) => ({
            selectedModelId: state.selectedModelId,
            selectModel: state.selectModel,
            isLoading: state.isLoading,
          })),
        );

        // Render the controlled component
        return (
          <GlobalModelSelector
            value={selectedModelId}
            onChange={selectModel}
            disabled={isLoading}
          />
        );
      },
      // No panel renderer needed for this control
      renderer: undefined,
      // Get metadata during submission
      getMetadata: () => {
        const currentModelId = useProviderStore.getState().selectedModelId;
        if (!currentModelId) {
          // This should ideally not happen if a model is always selected when available
          console.warn(
            "[GlobalModelSelector] getMetadata: No model selected in store.",
          );
          toast.error("No model selected. Please choose a model.");
          return undefined; // Or throw an error? Returning undefined might be safer.
        }
        return { modelId: currentModelId };
      },
      // No parameters needed from this control
      getParameters: undefined,
      // No specific clear action needed, state is managed by ProviderStore
      clearOnSubmit: undefined,
    });

    return unregister; // Cleanup on unmount
  }, [registerPromptControl]); // Re-register if the registration function changes
}
