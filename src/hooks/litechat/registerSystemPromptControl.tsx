// src/hooks/litechat/registerSystemPromptControl.tsx
// FULL FILE - Updated Registration Logic
import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { SystemPromptControlTrigger } from "@/components/LiteChat/prompt/control/system-prompt/SystemPromptControlTrigger";

// --- Local State Management within Registration Scope ---
let turnSystemPromptValue = "";
// --- End Local State Management ---

export function registerSystemPromptControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  // Reset transient state on registration
  turnSystemPromptValue = "";

  // Callback for the component to update the scoped state
  const handlePromptChange = (prompt: string) => {
    turnSystemPromptValue = prompt;
    // No need to force re-render here
  };

  registerPromptControl({
    id: "core-system-prompt",
    status: () => "ready",
    // Pass initial state and callback to the component
    triggerRenderer: () =>
      React.createElement(SystemPromptControlTrigger, {
        initialPromptValue: turnSystemPromptValue,
        onPromptChange: handlePromptChange,
      }),
    // getMetadata reads directly from the transient scoped state
    getMetadata: () => {
      const prompt = turnSystemPromptValue.trim();
      return prompt ? { turnSystemPrompt: prompt } : undefined;
    },
    // clearOnSubmit resets the transient scoped state
    clearOnSubmit: () => {
      turnSystemPromptValue = "";
      // Need a way to signal the component to reset its internal state if mounted
      // For now, just reset the scoped variable. The component's effect on open
      // should re-sync it.
    },
    // Visibility handled by component
  });

  console.log("[Function] Registered Core System Prompt Control");
}
