// src/hooks/litechat/registerProjectSettingsControl.ts
// Entire file content provided as it's significantly changed
import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useUIStateStore } from "@/store/ui.store";
import { ProjectSettingsModal } from "@/components/LiteChat/project-settings/ProjectSettingsModal";

// Convert back to a plain function
export function registerProjectSettingsControl() {
  const registerChatControl =
    useControlRegistryStore.getState().registerChatControl;

  // Modal Renderer Component (Renders based on current state)
  const ProjectSettingsModalRenderer: React.FC = () => {
    // Read state inside the component instance
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

  // Register the control that renders the modal
  registerChatControl({
    id: "core-project-settings-trigger", // Keep the ID consistent
    renderer: undefined,
    iconRenderer: undefined,
    panel: undefined, // Not displayed directly in panels
    show: () => false, // Doesn't show up in standard wrappers
    // Define the settingsRenderer to render the modal
    settingsRenderer: () => React.createElement(ProjectSettingsModalRenderer),
    order: 1000, // Low priority for standard rendering
    status: () => "ready",
  });

  console.log("[Function] Registered Core Project Settings Control");
}
