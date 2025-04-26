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
  const {
    theme,
    setTheme,
    enableAdvancedSettings,
    setEnableAdvancedSettings,
    enableStreamingMarkdown, // Get new state
    setEnableStreamingMarkdown, // Get new action
  } = useSettingsStore(
    useShallow((state) => ({
      theme: state.theme,
      setTheme: state.setTheme,
      enableAdvancedSettings: state.enableAdvancedSettings,
      setEnableAdvancedSettings: state.setEnableAdvancedSettings,
      enableStreamingMarkdown: state.enableStreamingMarkdown, // Select new state
      setEnableStreamingMarkdown: state.setEnableStreamingMarkdown, // Select new action
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
        {/* New Setting: Streaming Markdown */}
        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
          <div>
            <Label htmlFor="streaming-markdown-switch" className="font-medium">
              Parse Markdown While Streaming
            </Label>
            <p className="text-xs text-muted-foreground">
              Render Markdown formatting as the response arrives (may impact
              performance slightly).
            </p>
          </div>
          <Switch
            id="streaming-markdown-switch"
            checked={enableStreamingMarkdown ?? true} // Default checked state
            onCheckedChange={setEnableStreamingMarkdown}
          />
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
            checked={enableAdvancedSettings ?? false}
            onCheckedChange={setEnableAdvancedSettings}
          />
        </div>
      </div>
    </div>
  );
};

export const SettingsGeneral = React.memo(SettingsGeneralComponent);
