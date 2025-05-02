// src/hooks/litechat/registerUsageDisplayControl.tsx

import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { UsageDisplayControl } from "@/components/LiteChat/prompt/control/UsageDisplayControl";

export function registerUsageDisplayControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  registerPromptControl({
    id: "core-usage-display",
    order: 5, // Render high up in the trigger area
    status: () => "ready",
    // Register as a trigger renderer
    triggerRenderer: () => React.createElement(UsageDisplayControl),
    // No panel renderer needed
    renderer: undefined,
    show: () => true, // Always show the trigger if registered
  });

  console.log("[Function] Registered Core Usage Display Control (Trigger)");
}
