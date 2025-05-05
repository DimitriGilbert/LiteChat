// src/hooks/litechat/registerVfsControl.tsx

import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useUIStateStore } from "@/store/ui.store";
import { useVfsStore } from "@/store/vfs.store";
import { VfsTriggerButton } from "@/components/LiteChat/prompt/control/vfs/VfsTriggerButton";
import { VfsModalPanel } from "@/components/LiteChat/prompt/control/vfs/VfsModalPanel";

export function registerVfsControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;
  const registerChatControl =
    useControlRegistryStore.getState().registerChatControl;

  // Register the trigger button for the prompt area
  registerPromptControl({
    id: "core-vfs-prompt-trigger",
    show: () => useVfsStore.getState().enableVfs,
    triggerRenderer: () => React.createElement(VfsTriggerButton),
  });

  // Register the modal panel separately using ChatControl
  // This doesn't render in a specific panel, but needs registration
  // so LiteChat can find its renderer.
  registerChatControl({
    id: "core-vfs-modal-panel",
    panel: undefined,
    show: () => useUIStateStore.getState().isVfsModalOpen,
    renderer: () => React.createElement(VfsModalPanel),
    status: () => "ready",
  });

  console.log(
    "[Function] Registered Core VFS Control (Prompt Trigger & Modal)",
  );
}
