// src/hooks/litechat/registerProjectSettingsControl.tsx
import React, { useEffect } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useUIStateStore } from "@/store/ui.store";
import { ProjectSettingsModal } from "@/components/LiteChat/settings/ProjectSettingsModal"; // Import the modal component
import { useShallow } from "zustand/react/shallow"; // Import useShallow

/**
 * This component handles the registration and rendering of the Project Settings modal.
 * It registers a ChatControl that doesn't render anything directly in the main UI,
 * but provides the modal component via the `settingsRenderer`.
 */
export const RegisterProjectSettingsControl: React.FC = () => {
  // Hooks are now called within a React component body
  const registerChatControl = useControlRegistryStore(
    (state) => state.registerChatControl,
  );
  // Use useShallow for the selector
  const {
    isProjectSettingsModalOpen,
    closeProjectSettingsModal,
    projectSettingsModalTargetId,
  } = useUIStateStore(
    useShallow((state) => ({
      isProjectSettingsModalOpen: state.isProjectSettingsModalOpen,
      closeProjectSettingsModal: state.closeProjectSettingsModal,
      projectSettingsModalTargetId: state.projectSettingsModalTargetId,
    })),
  );

  useEffect(() => {
    console.log("[Function] Registering Core Project Settings Control");
    const unregister = registerChatControl({
      id: "core-project-settings-trigger",
      // No direct renderer or trigger needed in the main UI
      renderer: () => null,
      iconRenderer: () => null,
      // Provide the modal component via settingsRenderer
      // This function closes over the state variables and will use the latest values when called
      settingsRenderer: () => (
        <ProjectSettingsModal
          isOpen={isProjectSettingsModalOpen}
          onClose={closeProjectSettingsModal}
          projectId={projectSettingsModalTargetId}
        />
      ),
      // Define how the control should appear in a settings list (if applicable)
      settingsConfig: {
        tabId: "projectSettingsModal", // Unique ID for this settings "area"
        title: "Project Settings",
      },
      // Status can be simple as it just provides the modal
      status: () => "ready",
      // Order can be high as it doesn't render directly
      order: 9999,
    });

    // Cleanup function to unregister the control when the component unmounts
    return () => {
      console.log("[Function] Unregistering Core Project Settings Control");
      unregister();
    };
    // Remove state variables from dependencies - registration only needs to happen once.
    // The settingsRenderer function will access the latest state when invoked.
  }, [registerChatControl]);

  // This component doesn't render anything itself, it just manages registration
  return null;
};
