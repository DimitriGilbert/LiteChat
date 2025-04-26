// src/components/LiteChat/settings/SettingsGeneral.tsx
import React, { useCallback, useState } from "react"; // Added useState
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";

const SettingsGeneralComponent: React.FC = () => {
  const {
    theme,
    setTheme,
    enableAdvancedSettings,
    setEnableAdvancedSettings,
    enableStreamingMarkdown,
    setEnableStreamingMarkdown,
    streamingRenderFPS,
    setStreamingRenderFPS,
  } = useSettingsStore(
    useShallow((state) => ({
      theme: state.theme,
      setTheme: state.setTheme,
      enableAdvancedSettings: state.enableAdvancedSettings,
      setEnableAdvancedSettings: state.setEnableAdvancedSettings,
      enableStreamingMarkdown: state.enableStreamingMarkdown,
      setEnableStreamingMarkdown: state.setEnableStreamingMarkdown,
      streamingRenderFPS: state.streamingRenderFPS,
      setStreamingRenderFPS: state.setStreamingRenderFPS,
    })),
  );

  // Local state for slider visual feedback while dragging
  const [localFps, setLocalFps] = useState(streamingRenderFPS);

  // Update local state immediately on slider change
  const handleFpsSliderVisualChange = useCallback((value: number[]) => {
    setLocalFps(value[0]);
  }, []);

  // Update store only when slider interaction ends (commit)
  const handleFpsSliderCommit = useCallback(
    (value: number[]) => {
      setStreamingRenderFPS(value[0]);
    },
    [setStreamingRenderFPS],
  );

  // Handler for FPS input change (updates store immediately)
  const handleFpsInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const numValue =
        value === "" ? 30 : parseInt(value.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(numValue)) {
        const clampedFps = Math.max(1, Math.min(60, numValue));
        setStreamingRenderFPS(clampedFps);
        setLocalFps(clampedFps); // Sync local state if input changes
      }
    },
    [setStreamingRenderFPS],
  );

  // Sync local state if store changes from elsewhere
  React.useEffect(() => {
    setLocalFps(streamingRenderFPS);
  }, [streamingRenderFPS]);

  return (
    <div className="space-y-6 p-1">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Appearance</h3>
        {/* Theme and Markdown settings remain the same */}
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
            checked={enableStreamingMarkdown ?? true}
            onCheckedChange={setEnableStreamingMarkdown}
          />
        </div>
        {/* Streaming FPS Setting */}
        <div className="rounded-lg border p-3 shadow-sm space-y-2">
          <div>
            <Label htmlFor="streaming-fps-slider" className="font-medium">
              Streaming Update Rate ({localFps} FPS)
            </Label>
            <p className="text-xs text-muted-foreground">
              Controls how smoothly streaming text appears. Higher FPS uses more
              resources. (Default: 30)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              id="streaming-fps-slider"
              min={1}
              max={60}
              step={1}
              value={[localFps]} // Use local state for visual value
              onValueChange={handleFpsSliderVisualChange} // Update local state visually
              onValueCommit={handleFpsSliderCommit} // Update store on commit
              className="flex-grow"
            />
            <Input
              type="number"
              min={1}
              max={60}
              step={1}
              value={localFps} // Bind input to local state as well
              onChange={handleFpsInputChange} // Input updates store directly
              className="w-20 h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">FPS</span>
          </div>
        </div>
      </div>

      {/* Advanced Settings remain the same */}
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
