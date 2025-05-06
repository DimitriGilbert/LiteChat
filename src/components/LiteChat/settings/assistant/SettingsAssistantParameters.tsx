// src/components/LiteChat/settings/assistant/SettingsAssistantParameters.tsx
// FULL FILE
import React from "react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { ParameterControlComponent } from "@/components/LiteChat/prompt/control/ParameterControlComponent";

export const SettingsAssistantParameters: React.FC = () => {
  const {
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

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground mb-3">
        Set the default global values for AI parameters. These can be overridden
        per-project or per-prompt turn.
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
  );
};
