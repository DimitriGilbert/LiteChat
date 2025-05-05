// src/components/LiteChat/settings/SettingsAssistant.tsx
// FULL FILE
import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";
import { ParameterControlComponent } from "@/components/LiteChat/prompt/control/ParameterControlComponent";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { GlobalModelSelector } from "@/components/LiteChat/prompt/control/GlobalModelSelector";
import { Button } from "@/components/ui/button";
import { RotateCcwIcon } from "lucide-react";

const SettingsAssistantComponent: React.FC = () => {
  // --- Fetch state/actions from store ---
  const {
    globalSystemPrompt,
    setGlobalSystemPrompt,
    toolMaxSteps,
    setToolMaxSteps,
    temperature,
    setTemperature,
    topP,
    setTopP,
    maxTokens,
    setMaxTokens,
    topK,
    setTopK,
    presencePenalty,
    setPresencePenalty,
    frequencyPenalty,
    setFrequencyPenalty,
    // Get new auto-title state and setters
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
    // Get reset action
    resetAssistantSettings,
  } = useSettingsStore(
    useShallow((state) => ({
      globalSystemPrompt: state.globalSystemPrompt,
      setGlobalSystemPrompt: state.setGlobalSystemPrompt,
      toolMaxSteps: state.toolMaxSteps,
      setToolMaxSteps: state.setToolMaxSteps,
      temperature: state.temperature,
      setTemperature: state.setTemperature,
      topP: state.topP,
      setTopP: state.setTopP,
      maxTokens: state.maxTokens,
      setMaxTokens: state.setMaxTokens,
      topK: state.topK,
      setTopK: state.setTopK,
      presencePenalty: state.presencePenalty,
      setPresencePenalty: state.setPresencePenalty,
      frequencyPenalty: state.frequencyPenalty,
      setFrequencyPenalty: state.setFrequencyPenalty,
      // Get new state/actions
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
      // Get reset action
      resetAssistantSettings: state.resetAssistantSettings,
    })),
  );

  const handleMaxStepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numValue = value === "" ? 5 : parseInt(value, 10);
    if (!isNaN(numValue)) {
      setToolMaxSteps(numValue);
    }
  };

  const handleAutoTitleMaxLengthChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    const numValue = value === "" ? 768 : parseInt(value, 10);
    if (!isNaN(numValue)) {
      setAutoTitlePromptMaxLength(numValue);
    }
  };

  // Wrap setters to satisfy the (value: number | null) => void type
  const wrappedSetTemperature = (value: number | null) => {
    if (value !== null) setTemperature(value);
  };
  const wrappedSetTopP = (value: number | null) => {
    if (value !== null) setTopP(value);
  };
  const wrappedSetPresencePenalty = (value: number | null) => {
    if (value !== null) setPresencePenalty(value);
  };
  const wrappedSetFrequencyPenalty = (value: number | null) => {
    if (value !== null) setFrequencyPenalty(value);
  };

  const handleResetClick = () => {
    if (
      window.confirm(
        "Are you sure you want to reset all Assistant settings (Prompt, Parameters, Tools, Auto-Title) to their defaults?",
      )
    ) {
      resetAssistantSettings();
    }
  };

  return (
    <div className="space-y-6 p-1">
      {/* Prompt Configuration */}
      <div>
        <h3 className="text-lg font-medium mb-2">Prompt Configuration</h3>
        <Label
          htmlFor="assistant-global-system-prompt"
          className="text-sm mb-1 block"
        >
          Global System Prompt
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Default instructions for the assistant. Can be overridden per-project.
        </p>
        <Textarea
          id="assistant-global-system-prompt"
          placeholder="Enter default system instructions for the assistant..."
          value={globalSystemPrompt ?? ""}
          onChange={(e) => setGlobalSystemPrompt(e.target.value)}
          rows={4}
        />
      </div>

      <Separator />

      {/* Default Parameters */}
      <div>
        <h3 className="text-lg font-medium mb-2">Default Parameters</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Set the default global values for AI parameters. These can be
          overridden per-project or per-prompt turn.
        </p>
        <ParameterControlComponent
          temperature={temperature}
          setTemperature={wrappedSetTemperature}
          topP={topP}
          setTopP={wrappedSetTopP}
          maxTokens={maxTokens}
          setMaxTokens={setMaxTokens}
          topK={topK}
          setTopK={setTopK}
          presencePenalty={presencePenalty}
          setPresencePenalty={wrappedSetPresencePenalty}
          frequencyPenalty={frequencyPenalty}
          setFrequencyPenalty={wrappedSetFrequencyPenalty}
          reasoningEnabled={null}
          setReasoningEnabled={() => {}}
          webSearchEnabled={null}
          setWebSearchEnabled={() => {}}
          className="p-0 w-full"
        />
      </div>

      <Separator />

      {/* Tool Settings Section */}
      <div>
        <h3 className="text-lg font-medium mb-2">Tool Usage</h3>
        <Label htmlFor="tool-max-steps" className="text-sm mb-1 block">
          Maximum Tool Steps per Turn
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Limits the number of sequential tool calls the AI can make before
          generating a final response (1-20). Higher values allow more complex
          tasks but increase latency and cost. (Default: 5)
        </p>
        <Input
          id="tool-max-steps"
          type="number"
          min="1"
          max="20"
          step="1"
          value={toolMaxSteps}
          onChange={handleMaxStepsChange}
          className="w-24"
        />
      </div>

      <Separator />

      {/* Auto-Title Settings Section */}
      <div>
        <h3 className="text-lg font-medium mb-2">Automatic Title Generation</h3>
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
              <Label htmlFor="auto-title-model">
                Model for Title Generation
              </Label>
              <GlobalModelSelector
                value={autoTitleModelId}
                onChange={setAutoTitleModelId}
                className="w-full"
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

      {/* Reset Button Section */}
      <Separator />
      <div className="flex justify-end pt-4">
        <Button variant="outline" size="sm" onClick={handleResetClick}>
          <RotateCcwIcon className="mr-2 h-4 w-4" />
          Reset Assistant Settings
        </Button>
      </div>
    </div>
  );
};

export const SettingsAssistant = React.memo(SettingsAssistantComponent);
