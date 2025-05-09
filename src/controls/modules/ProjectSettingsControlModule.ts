// src/controls/modules/ProjectSettingsControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { ProjectSettingsModal } from "@/controls/components/project-settings/ProjectSettingsModal";
import { useUIStateStore } from "@/store/ui.store";

export class ProjectSettingsControlModule implements ControlModule {
  readonly id = "core-project-settings-trigger";
  private unregisterCallback: (() => void) | null = null;

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    // modApi parameter is available here if needed for initialization logic
    console.log(`[${this.id}] Initialized.`);
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const ProjectSettingsModalRenderer: React.FC = () => {
      const {
        isProjectSettingsModalOpen,
        projectSettingsModalTargetId,
        closeProjectSettingsModal,
      } = useUIStateStore.getState();

      return React.createElement(ProjectSettingsModal, {
        isOpen: isProjectSettingsModalOpen,
        onClose: closeProjectSettingsModal,
        projectId: projectSettingsModalTargetId,
      });
    };

    this.unregisterCallback = modApi.registerChatControl({
      id: this.id,
      renderer: undefined,
      iconRenderer: undefined,
      panel: undefined,
      show: () => false,
      settingsRenderer: () => React.createElement(ProjectSettingsModalRenderer),
      status: () => "ready",
    });
    console.log(`[${this.id}] Registered.`);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
}
