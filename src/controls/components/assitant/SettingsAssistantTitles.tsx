// src/controls/components/assitant/SettingsAssistantTitles.tsx
// FULL FILE
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
// Restored: Use GlobalModelSelector
import { GlobalModelSelector } from "@/controls/components/global-model-selector/GlobalModelSelector";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";

export const SettingsAssistantTitles: React.FC = () => {
  const {
    autoTitleEnabled,
    setAutoTitleEnabled,
    autoTitleModelId,
    setAutoTitleModelId,
    autoTitlePromptMaxLength,
    setAutoTitlePromptMaxLength,
    autoTitleIncludeFiles,
    setAutoTitleIncludeFiles,
    autoTitleIncludeRules,
    setAutoTitleIncludeRules,
  } = useSettingsStore(
    useShallow((state) => ({
      autoTitleEnabled: state.autoTitleEnabled,
      setAutoTitleEnabled: state.setAutoTitleEnabled,
      autoTitleModelId: state.autoTitleModelId,
      setAutoTitleModelId: state.setAutoTitleModelId,
      autoTitlePromptMaxLength: state.autoTitlePromptMaxLength,
      setAutoTitlePromptMaxLength: state.setAutoTitlePromptMaxLength,
      autoTitleIncludeFiles: state.autoTitleIncludeFiles,
      setAutoTitleIncludeFiles: state.setAutoTitleIncludeFiles,
      autoTitleIncludeRules: state.autoTitleIncludeRules,
      setAutoTitleIncludeRules: state.setAutoTitleIncludeRules,
    }))
  );

  const handleAutoTitleMaxLengthChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    const numValue = value === "" ? 768 : parseInt(value, 10);
    if (!isNaN(numValue)) {
      setAutoTitlePromptMaxLength(numValue);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-3">
        <Switch
          id="auto-title-enabled"
          checked={autoTitleEnabled}
          onCheckedChange={setAutoTitleEnabled}
          aria-labelledby="auto-title-enabled-label"
        />
        <Label id="auto-title-enabled-label" htmlFor="auto-title-enabled">
          Enable Auto-Title for New Chats
        </Label>
      </div>
      {autoTitleEnabled && (
        <div className="space-y-4 pl-6 border-l-2 border-muted ml-2">
          <div className="space-y-1.5">
            <Label htmlFor="auto-title-model-selector">
              Model for Title Generation
            </Label>
            {/* Restored: Use GlobalModelSelector with direct props */}
            <GlobalModelSelector
              value={autoTitleModelId}
              onChange={setAutoTitleModelId}
              className="w-full"
              // No module prop needed here, it will use direct value/onChange
            />
            <p className="text-xs text-muted-foreground">
              Select a fast and capable model for generating concise titles.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auto-title-max-length">
              Max Prompt Length for Title Generation (Chars)
            </Label>
            <Input
              id="auto-title-max-length"
              type="number"
              min="100"
              max="4000"
              step="10"
              value={autoTitlePromptMaxLength}
              onChange={handleAutoTitleMaxLengthChange}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              Limits the initial prompt length sent for title generation
              (100-4000).
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-title-include-files"
              checked={autoTitleIncludeFiles}
              onCheckedChange={setAutoTitleIncludeFiles}
              aria-labelledby="auto-title-include-files-label"
            />
            <Label
              id="auto-title-include-files-label"
              htmlFor="auto-title-include-files"
            >
              Include file names/types in title prompt
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-title-include-rules"
              checked={autoTitleIncludeRules}
              onCheckedChange={setAutoTitleIncludeRules}
              aria-labelledby="auto-title-include-rules-label"
            />
            <Label
              id="auto-title-include-rules-label"
              htmlFor="auto-title-include-rules"
            >
              Include active rules in title prompt
            </Label>
          </div>
        </div>
      )}
    </div>
  );
};
