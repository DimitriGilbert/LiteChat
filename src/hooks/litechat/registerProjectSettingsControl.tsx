// src/hooks/litechat/registerProjectSettingsControl.tsx
import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useUIStateStore } from "@/store/ui.store";
import { ProjectSettingsModal } from "@/components/LiteChat/project-settings/ProjectSettingsModal";

export function registerProjectSettingsControl() {
  const registerChatControl =
    useControlRegistryStore.getState().registerChatControl;

  const ProjectSettingsModalRenderer: React.FC = () => {
    const {
      isProjectSettingsModalOpen,
      projectSettingsModalTargetId,
      closeProjectSettingsModal,
    } = useUIStateStore.getState();

    return (
      <ProjectSettingsModal
        isOpen={isProjectSettingsModalOpen}
        onClose={closeProjectSettingsModal}
        projectId={projectSettingsModalTargetId}
      />
    );
  };

  registerChatControl({
    id: "core-project-settings-trigger",
    renderer: undefined,
    iconRenderer: undefined,
    panel: undefined,
    show: () => false,
    settingsRenderer: () => React.createElement(ProjectSettingsModalRenderer),
    // order removed
    status: () => "ready",
  });

  console.log("[Function] Registered Core Project Settings Control");
}
