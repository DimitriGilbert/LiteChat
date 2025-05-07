// src/components/LiteChat/settings/SettingsGeneral.tsx
// FULL FILE
import React, { useCallback, useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RotateCcwIcon } from "lucide-react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { Separator } from "@/components/ui/separator";

const SettingsGeneralComponent: React.FC = () => {
  const {
    enableStreamingMarkdown,
    setEnableStreamingMarkdown,
    enableStreamingCodeBlockParsing,
    setEnableStreamingCodeBlockParsing,
    foldStreamingCodeBlocks,
    setFoldStreamingCodeBlocks,
    foldUserMessagesOnCompletion,
    setFoldUserMessagesOnCompletion,
    streamingRenderFPS,
    setStreamingRenderFPS,
    autoScrollInterval,
    setAutoScrollInterval,
    resetGeneralSettings,
  } = useSettingsStore(
    useShallow((state) => ({
      enableStreamingMarkdown: state.enableStreamingMarkdown,
      setEnableStreamingMarkdown: state.setEnableStreamingMarkdown,
      enableStreamingCodeBlockParsing: state.enableStreamingCodeBlockParsing,
      setEnableStreamingCodeBlockParsing:
        state.setEnableStreamingCodeBlockParsing,
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks,
      setFoldStreamingCodeBlocks: state.setFoldStreamingCodeBlocks,
      foldUserMessagesOnCompletion: state.foldUserMessagesOnCompletion,
      setFoldUserMessagesOnCompletion: state.setFoldUserMessagesOnCompletion,
      streamingRenderFPS: state.streamingRenderFPS,
      setStreamingRenderFPS: state.setStreamingRenderFPS,
      autoScrollInterval: state.autoScrollInterval,
      setAutoScrollInterval: state.setAutoScrollInterval,
      resetGeneralSettings: state.resetGeneralSettings,
    })),
  );

  const [localFps, setLocalFps] = useState(streamingRenderFPS);
  const [localScrollInterval, setLocalScrollInterval] =
    useState(autoScrollInterval);

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

  const handleScrollIntervalSliderVisualChange = useCallback(
    (value: number[]) => {
      setLocalScrollInterval(value[0]);
    },
    [],
  );

  const handleScrollIntervalSliderCommit = useCallback(
    (value: number[]) => {
      setAutoScrollInterval(value[0]);
    },
    [setAutoScrollInterval],
  );

  const handleScrollIntervalInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const numValue =
        value === "" ? 1000 : parseInt(value.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(numValue)) {
        const clampedInterval = Math.max(50, numValue);
        setAutoScrollInterval(clampedInterval);
        setLocalScrollInterval(clampedInterval);
      }
    },
    [setAutoScrollInterval],
  );

  useEffect(() => {
    setLocalFps(streamingRenderFPS);
  }, [streamingRenderFPS]);

  useEffect(() => {
    setLocalScrollInterval(autoScrollInterval);
  }, [autoScrollInterval]);

  const handleResetClick = () => {
    if (
      window.confirm(
        "Are you sure you want to reset Streaming & Display settings to their defaults?",
      )
    ) {
      resetGeneralSettings();
    }
  };

  return (
    <div className="space-y-6 p-1">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Streaming & Display</h3>
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
            onCheckedChange={setFoldStreamingCodeBlocks}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
          <div>
            <Label htmlFor="fold-user-message-switch" className="font-medium">
              Fold User Messages After Response
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically collapse the user's prompt message once the
              assistant finishes responding.
            </p>
          </div>
          <Switch
            id="fold-user-message-switch"
            checked={foldUserMessagesOnCompletion ?? false}
            onCheckedChange={setFoldUserMessagesOnCompletion}
          />
        </div>
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
        <div className="rounded-lg border p-3 shadow-sm space-y-2">
          <div>
            <Label
              htmlFor="auto-scroll-interval-slider"
              className="font-medium"
            >
              Auto-Scroll Interval ({localScrollInterval} ms)
            </Label>
            <p className="text-xs text-muted-foreground">
              How often to scroll to the bottom during streaming (50-5000 ms).
              (Default: 1000ms)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              id="auto-scroll-interval-slider"
              min={50}
              max={5000}
              step={50}
              value={[localScrollInterval]}
              onValueChange={handleScrollIntervalSliderVisualChange}
              onValueCommit={handleScrollIntervalSliderCommit}
              className="flex-grow"
            />
            <Input
              type="number"
              min={50}
              max={5000}
              step={50}
              value={localScrollInterval}
              onChange={handleScrollIntervalInputChange}
              className="w-20 h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">ms</span>
          </div>
        </div>
      </div>

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
