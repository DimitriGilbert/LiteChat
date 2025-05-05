// src/hooks/litechat/registerWebSearchControl.tsx

import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { WebSearchControlTrigger } from "@/components/LiteChat/prompt/control/web-search/WebSearchControlTrigger";

export function registerWebSearchControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;
  const promptStateActions = usePromptStateStore.getState();

  // Callback for the component to update the store state
  const handleToggle = (enabled: boolean | null) => {
    promptStateActions.setWebSearchEnabled(enabled);
  };

  registerPromptControl({
    id: "core-web-search",
    status: () => "ready",
    // Pass initial state from store and callback to the component
    triggerRenderer: () =>
      React.createElement(WebSearchControlTrigger, {
        initialEnabled: promptStateActions.webSearchEnabled,
        onToggle: handleToggle,
      }),
    // getParameters reads directly from store at submission time
    getParameters: () => {
      const { webSearchEnabled } = usePromptStateStore.getState();
      return webSearchEnabled === true ? { web_search: true } : undefined;
    },
    // clearOnSubmit calls store action which emits event
    clearOnSubmit: () => {
      promptStateActions.setWebSearchEnabled(null);
    },
    // Visibility handled by component
  });

  console.log("[Function] Registered Core Web Search Control");
}
