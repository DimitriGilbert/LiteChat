// src/hooks/litechat/registerGlobalModelSelector.tsx
import React from "react";
import { GlobalModelSelector } from "@/components/LiteChat/prompt/control/GlobalModelSelector";
import { useControlRegistryStore } from "@/store/control.store";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useShallow } from "zustand/react/shallow";

export function registerGlobalModelSelector() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  const GlobalModelSelectorTrigger: React.FC = () => {
    const { modelId: effectiveModelId, setModelId: setPromptModelId } =
      usePromptStateStore(
        useShallow((state) => ({
          modelId: state.modelId,
          setModelId: state.setModelId,
        })),
      );
    const isStreaming = useInteractionStore(
      useShallow((state) => state.status === "streaming"),
    );

    return (
      <GlobalModelSelector
        value={effectiveModelId}
        onChange={setPromptModelId}
        disabled={isStreaming}
      />
    );
  };

  registerPromptControl({
    id: "core-global-model-selector",
    // order removed
    status: () => (useProviderStore.getState().isLoading ? "loading" : "ready"),
    triggerRenderer: () => React.createElement(GlobalModelSelectorTrigger),
    getParameters: undefined,
    getMetadata: undefined,
    show: () => true,
  });

  console.log("[Function] Registered Core Global Model Selector (Prompt)");
}
