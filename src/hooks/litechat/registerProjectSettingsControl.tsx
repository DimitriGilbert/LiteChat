// src/hooks/litechat/registerProjectSettingsControl.tsx
import React, { useEffect } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useUIStateStore } from "@/store/ui.store";
import { ProjectSettingsModal } from "@/components/LiteChat/project-settings/ProjectSettingsModal";
import { useShallow } from "zustand/react/shallow";

// Convert to a component for useEffect registration
export const RegisterProjectSettingsControl: React.FC = () => {
  const registerChatControl = useControlRegistryStore(
    (state) => state.registerChatControl,
  );
  const {
    isProjectSettingsModalOpen,
    projectSettingsModalTargetId,
    closeProjectSettingsModal,
  } = useUIStateStore(
    useShallow((state) => ({
      isProjectSettingsModalOpen: state.isProjectSettingsModalOpen,
      projectSettingsModalTargetId: state.projectSettingsModalTargetId,
      closeProjectSettingsModal: state.closeProjectSettingsModal,
    })),
  );

  useEffect(() => {
    const unregister = registerChatControl({
      id: "core-project-settings-trigger", // Keep the ID consistent
      // No direct renderer or trigger needed, only settingsRenderer
      renderer: undefined,
      iconRenderer: undefined,
      panel: undefined, // Not displayed directly in panels
      show: () => false, // Doesn't show up in standard wrappers
      // Define the settingsRenderer to render the modal
      settingsRenderer: () => (
        <ProjectSettingsModal
          isOpen={isProjectSettingsModalOpen}
          onClose={closeProjectSettingsModal}
          projectId={projectSettingsModalTargetId}
        />
      ),
      order: 1000, // Low priority for standard rendering
      status: () => "ready",
    });

    // Cleanup function to unregister the control when the component unmounts
    return () => {
      unregister();
    };
    // Dependencies ensure registration updates if needed, though likely stable
  }, [
    registerChatControl,
    isProjectSettingsModalOpen,
    projectSettingsModalTargetId,
    closeProjectSettingsModal,
  ]);

  // This component doesn't render anything itself, it just registers the control
  return null;
};
