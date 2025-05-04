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
import { Button } from "@/components/ui/button";
import { RotateCcwIcon } from "lucide-react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { Separator } from "@/components/ui/separator";

const SettingsGeneralComponent: React.FC = () => {
  const {
    theme,
    setTheme,
    enableStreamingMarkdown,
    setEnableStreamingMarkdown,
    enableStreamingCodeBlockParsing,
    setEnableStreamingCodeBlockParsing,
    foldStreamingCodeBlocks, // Get new setting state
    setFoldStreamingCodeBlocks, // Get new setting action
    streamingRenderFPS,
    setStreamingRenderFPS,
    prismThemeUrl,
    setPrismThemeUrl,
    resetGeneralSettings,
  } = useSettingsStore(
    useShallow((state) => ({
      theme: state.theme,
      setTheme: state.setTheme,
      enableStreamingMarkdown: state.enableStreamingMarkdown,
      setEnableStreamingMarkdown: state.setEnableStreamingMarkdown,
      enableStreamingCodeBlockParsing: state.enableStreamingCodeBlockParsing,
      setEnableStreamingCodeBlockParsing:
        state.setEnableStreamingCodeBlockParsing,
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks, // Get new state
      setFoldStreamingCodeBlocks: state.setFoldStreamingCodeBlocks, // Get new action
      streamingRenderFPS: state.streamingRenderFPS,
      setStreamingRenderFPS: state.setStreamingRenderFPS,
      prismThemeUrl: state.prismThemeUrl,
      setPrismThemeUrl: state.setPrismThemeUrl,
      resetGeneralSettings: state.resetGeneralSettings,
    })),
  );

  const [localFps, setLocalFps] = useState(streamingRenderFPS);

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
        value === "" ? 15 : parseInt(value.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(numValue)) {
        const clampedFps = Math.max(3, Math.min(60, numValue));
        setStreamingRenderFPS(clampedFps);
        setLocalFps(clampedFps);
      }
    },
    [setStreamingRenderFPS],
  );

  useEffect(() => {
    setLocalFps(streamingRenderFPS);
  }, [streamingRenderFPS]);

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
              <SelectItem value="TijuLight">Tiju Light</SelectItem>
              <SelectItem value="TijuDark">Tiju Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* PrismJS Theme URL */}
        <div className="rounded-lg border p-3 shadow-sm space-y-1.5">
          <Label htmlFor="prism-theme-url" className="font-medium">
            Code Block Theme URL (Optional)
          </Label>
          <p className="text-xs text-muted-foreground">
            Enter the URL of a PrismJS CSS theme file (e.g., from cdnjs). Leave
            blank to use the default themes.
          </p>
          <Input
            id="prism-theme-url"
            type="url"
            placeholder="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-okaidia.min.css"
            value={prismThemeUrl ?? ""}
            onChange={(e) => setPrismThemeUrl(e.target.value)}
          />
        </div>
      </div>

      <Separator />

      {/* Streaming Settings */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Streaming</h3>
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
        {/* Streaming Code Block Parsing Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
          <div>
            <Label htmlFor="streaming-codeblock-switch" className="font-medium">
              Use Full Code Blocks While Streaming
            </Label>
            <p className="text-xs text-muted-foreground">
              Use the syntax-highlighting component for code blocks during
              streaming. Disable for potentially smoother streaming on complex
              code, using a basic block instead.
            </p>
          </div>
          <Switch
            id="streaming-codeblock-switch"
            checked={enableStreamingCodeBlockParsing ?? false}
            onCheckedChange={setEnableStreamingCodeBlockParsing}
          />
        </div>
        {/* Fold Streaming Code Blocks Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
          <div>
            <Label htmlFor="fold-codeblock-switch" className="font-medium">
              Fold Code Blocks by Default During Streaming
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically collapse code blocks as they stream in. Useful for
              long code outputs.
            </p>
          </div>
          <Switch
            id="fold-codeblock-switch"
            checked={foldStreamingCodeBlocks ?? false}
            onCheckedChange={setFoldStreamingCodeBlocks} // Use new action
          />
        </div>
        {/* Combined Streaming FPS Setting */}
        <div className="rounded-lg border p-3 shadow-sm space-y-2">
          <div>
            <Label htmlFor="streaming-fps-slider" className="font-medium">
              Streaming Update Rate ({localFps} FPS)
            </Label>
            <p className="text-xs text-muted-foreground">
              Controls how frequently the UI updates during streaming (3-60
              FPS). Lower values may feel less smooth but reduce CPU usage.
              (Default: 15)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              id="streaming-fps-slider"
              min={3}
              max={60}
              step={1}
              value={[localFps]}
              onValueChange={handleFpsSliderVisualChange}
              onValueCommit={handleFpsSliderCommit}
              className="flex-grow"
            />
            <Input
              type="number"
              min={3}
              max={60}
              step={1}
              value={localFps}
              onChange={handleFpsInputChange}
              className="w-20 h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">FPS</span>
          </div>
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
