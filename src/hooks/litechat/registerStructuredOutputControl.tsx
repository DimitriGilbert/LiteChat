// src/hooks/litechat/registerStructuredOutputControl.ts
// FULL FILE
import React, { useState, useEffect } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useProviderStore } from "@/store/provider.store";
import { StructuredOutputControl } from "@/components/LiteChat/prompt/control/StructuredOutputControl";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";

// --- Wrapper Component to Handle Visibility ---
const VisibleStructuredOutputControl: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true); // Assume visible initially

  useEffect(() => {
    console.log(
      "[VisibleStructuredOutputControl] useEffect setup running.", // Log setup
    );
    const handleModelChange = (payload: { modelId: string | null }) => {
      console.log(
        "[VisibleStructuredOutputControl] handleModelChange triggered:", // Log trigger
        payload,
      );
      if (!payload.modelId) {
        setIsVisible(false);
        return;
      }
      // Get state directly inside the handler
      const { getSelectedModel } = useProviderStore.getState();
      const selectedModel = getSelectedModel();
      // Robust check for supported parameters
      const supportedParams = selectedModel?.metadata?.supported_parameters;
      const isSupported =
        Array.isArray(supportedParams) &&
        supportedParams.includes("structured_output"); // Check if it's an array first

      console.log(
        `[VisibleStructuredOutputControl] Model ${payload.modelId} supports structured_output: ${isSupported}`,
      ); // Log check result
      setIsVisible(isSupported);
    };

    // Initial check
    handleModelChange({ modelId: useProviderStore.getState().selectedModelId });

    // Subscription
    console.log(
      `[VisibleStructuredOutputControl] Subscribing to ${ModEvent.MODEL_SELECTION_CHANGED}`,
    ); // Log subscription
    emitter.on(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);

    // Cleanup
    return () => {
      console.log(
        "[VisibleStructuredOutputControl] useEffect cleanup running.", // Log cleanup
      );
      emitter.off(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);
    };
  }, []); // Empty dependency array ensures it runs once on mount

  if (!isVisible) {
    return null;
  }

  // This should be line 46 or near it now
  return <StructuredOutputControl />;
};

// --- Registration Function ---
export function registerStructuredOutputControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  registerPromptControl({
    id: "core-structured-output",
    // order removed
    status: () => "ready",
    // Render the wrapper component which handles visibility
    triggerRenderer: () => React.createElement(VisibleStructuredOutputControl),
    // getParameters reads directly from store at submission time
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
    // clearOnSubmit calls store action which emits event
    clearOnSubmit: () => {
      usePromptStateStore.getState().setStructuredOutputJson(null);
    },
    // show function removed - component handles visibility
    // show: () => { ... }
  });

  console.log("[Function] Registered Core Structured Output Control");
}
