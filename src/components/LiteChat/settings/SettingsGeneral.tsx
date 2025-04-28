// src/components/LiteChat/settings/SettingsGeneral.tsx
import React, { useCallback, useState, useEffect } from "react";
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
import { Button } from "@/components/ui/button"; // Import Button
import { RotateCcwIcon } from "lucide-react"; // Import reset icon
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { Separator } from "@/components/ui/separator";

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
    streamingCodeRenderFPS,
    setStreamingCodeRenderFPS,
    resetGeneralSettings, // Import reset action
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
      streamingCodeRenderFPS: state.streamingCodeRenderFPS,
      setStreamingCodeRenderFPS: state.setStreamingCodeRenderFPS,
      resetGeneralSettings: state.resetGeneralSettings, // Get reset action
    })),
  );

  // Local state for sliders
  const [localFps, setLocalFps] = useState(streamingRenderFPS);
  const [localCodeFps, setLocalCodeFps] = useState(streamingCodeRenderFPS);

  // General FPS Handlers
  const handleFpsSliderVisualChange = useCallback((value: number[]) => {
    setLocalFps(value[0]);
  }, []);
  const handleFpsSliderCommit = useCallback(
    (value: number[]) => {
      setStreamingRenderFPS(value[0]);
    },
    [setStreamingRenderFPS],
  );
  const handleFpsInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const numValue =
        value === "" ? 30 : parseInt(value.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(numValue)) {
        const clampedFps = Math.max(1, Math.min(60, numValue));
        setStreamingRenderFPS(clampedFps);
        setLocalFps(clampedFps);
      }
    },
    [setStreamingRenderFPS],
  );

  // Code FPS Handlers
  const handleCodeFpsSliderVisualChange = useCallback((value: number[]) => {
    setLocalCodeFps(value[0]);
  }, []);
  const handleCodeFpsSliderCommit = useCallback(
    (value: number[]) => {
      setStreamingCodeRenderFPS(value[0]);
    },
    [setStreamingCodeRenderFPS],
  );
  const handleCodeFpsInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const numValue =
        value === "" ? 10 : parseInt(value.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(numValue)) {
        const clampedFps = Math.max(1, Math.min(60, numValue));
        setStreamingCodeRenderFPS(clampedFps);
        setLocalCodeFps(clampedFps);
      }
    },
    [setStreamingCodeRenderFPS],
  );

  // Sync local states if store changes from elsewhere
  useEffect(() => {
    setLocalFps(streamingRenderFPS);
  }, [streamingRenderFPS]);
  useEffect(() => {
    setLocalCodeFps(streamingCodeRenderFPS);
  }, [streamingCodeRenderFPS]);

  // Handler for the reset button
  const handleResetClick = () => {
    if (
      window.confirm(
        "Are you sure you want to reset Appearance and Streaming settings to their defaults?",
      )
    ) {
      resetGeneralSettings();
    }
  };

  return (
    <div className="space-y-6 p-1">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Appearance</h3>
        {/* Theme */}
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
        {/* Streaming Markdown Toggle */}
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
        {/* General Streaming FPS Setting */}
        <div className="rounded-lg border p-3 shadow-sm space-y-2">
          <div>
            <Label htmlFor="streaming-fps-slider" className="font-medium">
              General Streaming Update Rate ({localFps} FPS)
            </Label>
            <p className="text-xs text-muted-foreground">
              Controls how smoothly streaming text appears. (Default: 30)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              id="streaming-fps-slider"
              min={1}
              max={60}
              step={1}
              value={[localFps]}
              onValueChange={handleFpsSliderVisualChange}
              onValueCommit={handleFpsSliderCommit}
              className="flex-grow"
            />
            <Input
              type="number"
              min={1}
              max={60}
              step={1}
              value={localFps}
              onChange={handleFpsInputChange}
              className="w-20 h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">FPS</span>
          </div>
        </div>
        {/* Code Block Streaming FPS Setting */}
        <div className="rounded-lg border p-3 shadow-sm space-y-2">
          <div>
            <Label htmlFor="streaming-code-fps-slider" className="font-medium">
              Code Block Streaming Update Rate ({localCodeFps} FPS)
            </Label>
            <p className="text-xs text-muted-foreground">
              Specific update rate when code blocks are streaming (lower values
              reduce lag). (Default: 10)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              id="streaming-code-fps-slider"
              min={1}
              max={60}
              step={1}
              value={[localCodeFps]}
              onValueChange={handleCodeFpsSliderVisualChange}
              onValueCommit={handleCodeFpsSliderCommit}
              className="flex-grow"
            />
            <Input
              type="number"
              min={1}
              max={60}
              step={1}
              value={localCodeFps}
              onChange={handleCodeFpsInputChange}
              className="w-20 h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">FPS</span>
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      <Separator />
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

      {/* Reset Button Section */}
      <Separator />
      <div className="flex justify-end pt-4">
        <Button variant="outline" size="sm" onClick={handleResetClick}>
          <RotateCcwIcon className="mr-2 h-4 w-4" />
          Reset General Settings
        </Button>
      </div>
    </div>
  );
};

export const SettingsGeneral = React.memo(SettingsGeneralComponent);
