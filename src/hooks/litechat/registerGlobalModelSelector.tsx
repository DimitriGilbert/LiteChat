// src/hooks/litechat/registerGlobalModelSelector.ts
import React from "react";
import { GlobalModelSelector } from "@/components/LiteChat/prompt/control/GlobalModelSelector";
import { useControlRegistryStore } from "@/store/control.store";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";

export function registerGlobalModelSelector() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  const GlobalModelSelectorTrigger: React.FC = () => {
    // Get state and actions directly inside the component instance
    const { selectedModelId, selectModel } = useProviderStore.getState();
    const isStreaming = useInteractionStore.getState().status === "streaming";

    return (
      <GlobalModelSelector
        value={selectedModelId}
        onChange={selectModel}
        disabled={isStreaming}
      />
    );
  };

  registerPromptControl({
    id: "core-global-model-selector",
    order: 10,
    // status: () => (useProviderStore.getState().isLoading ? "loading" : "ready"), // Removed status
    triggerRenderer: () => React.createElement(GlobalModelSelectorTrigger),
    // Metadata is implicitly handled by the selectedModelId in ProviderStore
    // getMetadata: () => ({ modelId: useProviderStore.getState().selectedModelId }),
    show: () => true,
  });

  console.log("[Function] Registered Core Global Model Selector Control");
  // No cleanup needed or returned
}
