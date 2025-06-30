// src/controls/modules/ThemeSettingsControlModule.ts
// NEW FILE
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { SettingsTheme } from "@/controls/components/theme-settings/SettingsTheme";
import i18next from 'i18next';
import type { ControlModuleConstructor } from '@/types/litechat/control';

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
      title: i18next.t("controls:settings.tabs.theme"),
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

(ThemeSettingsControlModule as ControlModuleConstructor).translations = {
  en: {
    controls: {
      "settings.tabs.theme": "Theme"
    }
  },
  fr: {
    controls: {
      "settings.tabs.theme": "Thème"
    }
  }
};
