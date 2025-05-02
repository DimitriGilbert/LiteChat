// src/hooks/litechat/registerStructuredOutputControl.ts

import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useProviderStore } from "@/store/provider.store"; // To check model support
import { StructuredOutputControl } from "@/components/LiteChat/prompt/control/StructuredOutputControl";

export function registerStructuredOutputControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  registerPromptControl({
    id: "core-structured-output",
    order: 35, // Place it near parameters
    status: () => "ready",
    triggerRenderer: () => React.createElement(StructuredOutputControl),
    getParameters: () => {
      const { structuredOutputJson } = usePromptStateStore.getState();
      if (structuredOutputJson) {
        try {
          // Pass the parsed JSON object if valid
          const parsed = JSON.parse(structuredOutputJson);
          return { structured_output: parsed };
        } catch (e) {
          console.error("Invalid JSON in structured output state:", e);
          return undefined; // Don't send invalid JSON
        }
      }
      return undefined;
    },
    clearOnSubmit: () => {
      // Reset the structured output state after submission
      usePromptStateStore.getState().setStructuredOutputJson(null);
    },
    show: () => {
      // Show only if the selected model supports it
      const selectedModel = useProviderStore.getState().getSelectedModel();
      return (
        selectedModel?.metadata?.supported_parameters?.includes(
          "structured_outputs",
        ) ?? false
      );
    },
  });

  console.log("[Function] Registered Core Structured Output Control");
}
