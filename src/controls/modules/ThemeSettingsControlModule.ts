// src/controls/modules/ThemeSettingsControlModule.ts
// NEW FILE
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { SettingsTheme } from "@/controls/components/theme-settings/SettingsTheme";

export class ThemeSettingsControlModule implements ControlModule {
  readonly id = "core-settings-theme";
  private unregisterCallback: (() => void) | null = null;

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    // console.log(`[${this.id}] Initialized.`);
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    this.unregisterCallback = modApi.registerSettingsTab({
      id: "theme",
      title: "Theme",
      component: SettingsTheme,
      order: 20,
    });
    // console.log(`[${this.id}] Settings tab registered.`);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
}
