// src/hooks/litechat/registerGlobalModelSelector.tsx
import React from "react";
import { GlobalModelSelector } from "@/components/LiteChat/prompt/control/GlobalModelSelector";
import { useControlRegistryStore } from "@/store/control.store";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
// Import the prompt state store to get the effective model ID
import { usePromptStateStore } from "@/store/prompt.store";

export function registerGlobalModelSelector() {
  // Register as a PromptControl now
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  const GlobalModelSelectorTrigger: React.FC = () => {
    // Get the global action to update the *global* selection when the user interacts
    const { selectModel: selectGlobalModel } = useProviderStore.getState();
    // Get the interaction status
    const isStreaming = useInteractionStore.getState().status === "streaming";
    // Get the *effective* model ID for the current context from the prompt state store
    const { modelId: effectiveModelId } = usePromptStateStore.getState();

    return (
      <GlobalModelSelector
        // Pass the effective model ID as the controlled value
        value={effectiveModelId}
        // When the user changes the selection, update the global state
        onChange={selectGlobalModel}
        disabled={isStreaming}
      />
    );
  };

  registerPromptControl({
    id: "core-global-model-selector", // Keep the ID consistent
    order: 10, // Position in the prompt controls area
    // Status depends on provider loading state
    status: () => (useProviderStore.getState().isLoading ? "loading" : "ready"),
    // Render the selector component as the trigger
    triggerRenderer: () => React.createElement(GlobalModelSelectorTrigger),
    // No getParameters needed, model is handled via PromptStateStore -> AIService
    getParameters: undefined,
    // Metadata (modelId) is implicitly handled by the PromptStateStore
    // which is read during handlePromptSubmit in LiteChat.tsx
    getMetadata: undefined,
    show: () => true, // Always show the selector in the prompt area
  });

  console.log("[Function] Registered Core Global Model Selector (Prompt)");
  // No cleanup needed or returned
}
