// src/hooks/litechat/registerStructuredOutputControl.ts
import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useProviderStore } from "@/store/provider.store";
import { StructuredOutputControl } from "@/components/LiteChat/prompt/control/StructuredOutputControl";

export function registerStructuredOutputControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  registerPromptControl({
    id: "core-structured-output",
    // order removed
    status: () => "ready",
    triggerRenderer: () => React.createElement(StructuredOutputControl),
    getParameters: () => {
      const { structuredOutputJson } = usePromptStateStore.getState();
      if (structuredOutputJson) {
        try {
          const parsed = JSON.parse(structuredOutputJson);
          return { structured_output: parsed };
        } catch (e) {
          console.error("Invalid JSON in structured output state:", e);
          return undefined;
        }
      }
      return undefined;
    },
    clearOnSubmit: () => {
      usePromptStateStore.getState().setStructuredOutputJson(null);
    },
    show: () => {
      // Show only if the selected model supports it
      const selectedModel = useProviderStore.getState().getSelectedModel();
      // Check for 'structured_outputs' or a similar parameter name
      // Adjust the parameter name based on actual provider metadata
      return (
        selectedModel?.metadata?.supported_parameters?.includes(
          "structured_output", // Common parameter name, adjust if needed
        ) ?? false
      );
    },
  });

  console.log("[Function] Registered Core Structured Output Control");
}
