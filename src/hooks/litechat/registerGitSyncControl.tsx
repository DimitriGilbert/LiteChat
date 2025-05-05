// src/hooks/litechat/registerGitSyncControl.tsx

import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { GitSyncControlTrigger } from "@/components/LiteChat/prompt/control/git-sync/GitSyncControlTrigger";

export function registerGitSyncControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  registerPromptControl({
    id: "core-git-sync",
    triggerRenderer: () => React.createElement(GitSyncControlTrigger),
    // Visibility handled by component
  });

  console.log("[Function] Registered Core Git Sync Control");
}
