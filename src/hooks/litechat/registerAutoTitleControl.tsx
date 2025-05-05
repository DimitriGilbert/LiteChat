// src/hooks/litechat/registerAutoTitleControl.tsx
// FULL FILE - Updated Registration Logic
import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { AutoTitleControlTrigger } from "@/components/LiteChat/prompt/control/auto-title/AutoTitleControlTrigger";

// --- Local State Management within Registration Scope ---
// This state needs to persist across renders of the trigger component
let turnAutoTitleEnabled = false;
// --- End Local State Management ---

export function registerAutoTitleControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  // Reset transient state on registration (e.g., app load)
  turnAutoTitleEnabled = false;

  // Callback for the component to update the scoped state
  const handleToggle = (enabled: boolean) => {
    turnAutoTitleEnabled = enabled;
    // No need to force re-render here, component manages its own state
  };

  registerPromptControl({
    id: "core-auto-title",
    status: () => "ready",
    // Pass initial state and callback to the component
    triggerRenderer: () =>
      React.createElement(AutoTitleControlTrigger, {
        initialEnabled: turnAutoTitleEnabled,
        onToggle: handleToggle,
      }),
    // getMetadata reads directly from the transient scoped state
    getMetadata: () => {
      // Only add metadata if the turn-specific toggle is enabled
      return turnAutoTitleEnabled
        ? { autoTitleEnabledForTurn: true }
        : undefined;
    },
    // clearOnSubmit resets the transient scoped state
    clearOnSubmit: () => {
      turnAutoTitleEnabled = false;
      // We might need a way to signal the component to reset its internal state
      // if it's still mounted. An event or a ref could work, but let's see
      // if the component's own effect handles this sufficiently.
      // For now, just reset the scoped variable.
    },
    // Visibility is handled internally by the component
  });

  console.log("[Function] Registered Core Auto-Title Control");
}
