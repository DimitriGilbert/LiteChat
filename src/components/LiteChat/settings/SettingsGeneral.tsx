// src/components/LiteChat/settings/SettingsGeneral.tsx
import React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";

const SettingsGeneralComponent: React.FC = () => {
  const { theme, setTheme, enableAdvancedSettings, setEnableAdvancedSettings } =
    useSettingsStore(
      useShallow((state) => ({
        theme: state.theme,
        setTheme: state.setTheme,
        enableAdvancedSettings: state.enableAdvancedSettings,
        setEnableAdvancedSettings: state.setEnableAdvancedSettings,
      })),
    );

  return (
    <div className="space-y-6 p-1">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Appearance</h3>
        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
          <Label htmlFor="theme-select" className="font-medium">
            Theme
          </Label>
          <Select
            // Ensure value is controlled and never undefined
            value={theme ?? "system"}
            onValueChange={(value) => setTheme(value as typeof theme)}
          >
            <SelectTrigger id="theme-select" className="w-[180px]">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">Advanced Settings</h3>
        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
          <div>
            <Label htmlFor="advanced-settings-switch" className="font-medium">
              Enable Advanced Controls
            </Label>
            <p className="text-xs text-muted-foreground">
              Show controls for AI parameters (temperature, etc.) and Assistant
              settings tab.
            </p>
          </div>
          <Switch
            id="advanced-settings-switch"
            // Ensure checked is always boolean
            checked={enableAdvancedSettings ?? false}
            onCheckedChange={setEnableAdvancedSettings}
          />
        </div>
      </div>
      {/* Add other general settings here */}
    </div>
  );
};

export const SettingsGeneral = React.memo(SettingsGeneralComponent);
