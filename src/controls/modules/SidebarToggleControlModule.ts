// src/controls/modules/SidebarToggleControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { SidebarToggleControlComponent } from "@/controls/components/sidebar-toggle/SidebarToggleControlComponent";
import { useUIStateStore } from "@/store/ui.store";
import { uiEvent } from "@/types/litechat/events/ui.events";

export class SidebarToggleControlModule implements ControlModule {
  readonly id = "core-sidebar-toggle";
  private unregisterCallback: (() => void) | null = null;
  private notifyComponentUpdate: (() => void) | null = null;
  private modApiRef: LiteChatModApi | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
  }

  public getIsSidebarCollapsed = (): boolean => {
    return useUIStateStore.getState().isSidebarCollapsed;
  };

  public toggleSidebar = (isCollapsed?: boolean) => {
    const current = useUIStateStore.getState().isSidebarCollapsed;
    const newState = isCollapsed ?? !current;
    if (current !== newState) {
      this.modApiRef?.emit(uiEvent.toggleSidebarRequest, {
        isCollapsed: newState,
      });
      this.notifyComponentUpdate?.();
    }
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    const renderer = () =>
      React.createElement(SidebarToggleControlComponent, { module: this });

    this.unregisterCallback = modApi.registerChatControl({
      id: this.id,
      panel: "sidebar-footer",
      status: () => "ready",
      renderer: renderer,
      iconRenderer: renderer,
      show: () => true,
    });
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    this.notifyComponentUpdate = null;
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
