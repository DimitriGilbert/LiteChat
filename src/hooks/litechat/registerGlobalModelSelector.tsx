// src/hooks/litechat/registerGlobalModelSelector.tsx
// Entire file content provided
import React from "react";
import { GlobalModelSelector } from "@/components/LiteChat/prompt/control/GlobalModelSelector";
import { useControlRegistryStore } from "@/store/control.store";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
// Import the prompt state store hook and actions
import { usePromptStateStore } from "@/store/prompt.store";
import { useShallow } from "zustand/react/shallow";

export function registerGlobalModelSelector() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  const GlobalModelSelectorTrigger: React.FC = () => {
    // Use the hook selector to get state and actions
    const { modelId: effectiveModelId, setModelId: setPromptModelId } =
      usePromptStateStore(
        useShallow((state) => ({
          modelId: state.modelId,
          setModelId: state.setModelId,
        })),
      );
    // Get the interaction status using the hook selector
    const isStreaming = useInteractionStore(
      useShallow((state) => state.status === "streaming"),
    );

    return (
      <GlobalModelSelector
        // Pass the effective model ID read from the store hook
        value={effectiveModelId}
        // Pass the setter action obtained from the store hook
        onChange={setPromptModelId}
        disabled={isStreaming}
      />
    );
  };

  registerPromptControl({
    id: "core-global-model-selector",
    order: 10,
    status: () => (useProviderStore.getState().isLoading ? "loading" : "ready"),
    triggerRenderer: () => React.createElement(GlobalModelSelectorTrigger),
    getParameters: undefined,
    getMetadata: undefined,
    show: () => true,
  });

  console.log("[Function] Registered Core Global Model Selector (Prompt)");
}
