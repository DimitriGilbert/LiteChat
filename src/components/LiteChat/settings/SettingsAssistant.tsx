// src/components/LiteChat/settings/SettingsAssistant.tsx

import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";
// Import the reusable component
import { ParameterControlComponent } from "@/components/LiteChat/prompt/control/ParameterControlComponent";
import { Separator } from "@/components/ui/separator";

const SettingsAssistantComponent: React.FC = () => {
  // --- Fetch state/actions from store ---
  const {
    globalSystemPrompt,
    setGlobalSystemPrompt,
    toolMaxSteps,
    setToolMaxSteps,
    // Get global parameter state and setters
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
  } = useSettingsStore(
    useShallow((state) => ({
      globalSystemPrompt: state.globalSystemPrompt,
      setGlobalSystemPrompt: state.setGlobalSystemPrompt,
      toolMaxSteps: state.toolMaxSteps,
      setToolMaxSteps: state.setToolMaxSteps,
      // Get global parameters
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
    })),
  );

  const handleMaxStepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numValue = value === "" ? 5 : parseInt(value, 10);
    if (!isNaN(numValue)) {
      setToolMaxSteps(numValue);
    }
  };

  // Wrap setters to satisfy the (value: number | null) => void type
  // In this context, null will never actually be passed, but this fixes the type error.
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
        {/* Use the reusable component, passing global state/setters */}
        <ParameterControlComponent
          temperature={temperature}
          setTemperature={wrappedSetTemperature} // Use wrapped setter
          topP={topP}
          setTopP={wrappedSetTopP} // Use wrapped setter
          maxTokens={maxTokens}
          setMaxTokens={setMaxTokens} // This setter already accepts null
          topK={topK}
          setTopK={setTopK} // This setter already accepts null
          presencePenalty={presencePenalty}
          setPresencePenalty={wrappedSetPresencePenalty} // Use wrapped setter
          frequencyPenalty={frequencyPenalty}
          setFrequencyPenalty={wrappedSetFrequencyPenalty} // Use wrapped setter
          // Pass null for transient props as they don't apply to global defaults
          reasoningEnabled={null}
          setReasoningEnabled={() => {}}
          webSearchEnabled={null}
          setWebSearchEnabled={() => {}}
          className="p-0 w-full" // Adjust styling as needed
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
          className="w-24" // Make input smaller
        />
      </div>
    </div>
  );
};

export const SettingsAssistant = React.memo(SettingsAssistantComponent);
