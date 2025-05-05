// src/hooks/litechat/registerReasoningControl.tsx

import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { ReasoningControlTrigger } from "@/components/LiteChat/prompt/control/reasoning/ReasoningControlTrigger";

export function registerReasoningControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;
  const promptStateActions = usePromptStateStore.getState();

  // Callback for the component to update the store state
  const handleToggle = (enabled: boolean | null) => {
    promptStateActions.setReasoningEnabled(enabled);
  };

  registerPromptControl({
    id: "core-reasoning",
    status: () => "ready",
    // Pass initial state from store and callback to the component
    triggerRenderer: () =>
      React.createElement(ReasoningControlTrigger, {
        initialEnabled: promptStateActions.reasoningEnabled,
        onToggle: handleToggle,
      }),
    // getParameters reads directly from store at submission time
    getParameters: () => {
      const { reasoningEnabled } = usePromptStateStore.getState();
      return reasoningEnabled === true ? { reasoning: true } : undefined;
    },
    // clearOnSubmit calls store action which emits event
    clearOnSubmit: () => {
      promptStateActions.setReasoningEnabled(null);
    },
    // Visibility handled by component
  });

  console.log("[Function] Registered Core Reasoning Control");
}
