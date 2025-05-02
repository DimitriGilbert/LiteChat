// src/hooks/litechat/registerGlobalModelSelector.tsx
// FULL FILE
import React, { useState, useEffect } from "react";
import { GlobalModelSelector } from "@/components/LiteChat/prompt/control/GlobalModelSelector";
import { useControlRegistryStore } from "@/store/control.store";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
// PromptStateStore removed as we read effective model from ProviderStore now
// import { usePromptStateStore } from "@/store/prompt.store";
import { useShallow } from "zustand/react/shallow";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";

// --- Trigger Component ---
const GlobalModelSelectorTrigger: React.FC = () => {
  // Get the global selection and the action to change it from ProviderStore
  const { selectedModelId, selectModel } = useProviderStore(
    useShallow((state) => ({
      selectedModelId: state.selectedModelId,
      selectModel: state.selectModel, // Get the correct action
    })),
  );

  // Local state managed by events
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );
  const [currentSelectedModelId, setCurrentSelectedModelId] =
    useState(selectedModelId);

  // Subscribe to events
  useEffect(() => {
    const handleStatusChange = (payload: {
      status: "idle" | "loading" | "streaming" | "error";
    }) => {
      setIsStreaming(payload.status === "streaming");
    };
    // Listen for changes triggered by the store itself (e.g., on load, reorder)
    const handleModelChange = (payload: { modelId: string | null }) => {
      setCurrentSelectedModelId(payload.modelId);
    };

    // Initial state sync
    setCurrentSelectedModelId(useProviderStore.getState().selectedModelId);

    // Subscriptions
    emitter.on(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
    emitter.on(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);

    // Cleanup
    return () => {
      emitter.off(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
      emitter.off(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);
    };
  }, []);

  // The onChange handler now calls the ProviderStore action
  const handleSelectionChange = (newModelId: string | null) => {
    selectModel(newModelId); // This will update the store AND emit the event
  };

  return (
    <GlobalModelSelector
      // Pass the current local state reflecting the global selection
      value={currentSelectedModelId}
      // Pass the handler that calls the ProviderStore action
      onChange={handleSelectionChange}
      disabled={isStreaming}
    />
  );
};

// --- Registration Function ---
export function registerGlobalModelSelector() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  registerPromptControl({
    id: "core-global-model-selector",
    // order removed
    // Status depends on ProviderStore loading state
    status: () => (useProviderStore.getState().isLoading ? "loading" : "ready"),
    triggerRenderer: () => React.createElement(GlobalModelSelectorTrigger),
    // getParameters/getMetadata are not needed here, model is read from PromptStateStore
    // during submission build in ConversationService/LiteChat component
    getParameters: undefined,
    getMetadata: undefined,
    // show function removed - component always renders trigger (unless loading)
    // show: () => true,
  });

  console.log("[Function] Registered Core Global Model Selector (Prompt)");
}
