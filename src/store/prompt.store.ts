// src/store/prompt.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { emitter } from "@/lib/litechat/event-emitter";
import { promptEvent } from "@/types/litechat/events/prompt.events";

// State for the *next* prompt submission
export interface PromptState {
  modelId: string | null;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  topK: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
  reasoningEnabled: boolean | null;
  webSearchEnabled: boolean | null;
  structuredOutputJson: string | null;
}

interface PromptActions {
  setModelId: (id: string | null) => void;
  setTemperature: (value: number | null) => void;
  setMaxTokens: (value: number | null) => void;
  setTopP: (value: number | null) => void;
  setTopK: (value: number | null) => void;
  setPresencePenalty: (value: number | null) => void;
  setFrequencyPenalty: (value: number | null) => void;
  setReasoningEnabled: (enabled: boolean | null) => void;
  setWebSearchEnabled: (enabled: boolean | null) => void;
  setStructuredOutputJson: (json: string | null) => void;
  initializePromptState: (effectiveSettings: {
    modelId: string | null;
    temperature: number | null;
    maxTokens: number | null;
    topP: number | null;
    topK: number | null;
    presencePenalty: number | null;
    frequencyPenalty: number | null;
  }) => void;
  resetTransientParameters: () => void;
}

const emitParamChange = (
  key: keyof PromptState,
  value: PromptState[keyof PromptState]
) => {
  emitter.emit(promptEvent.parameterChanged, { params: { [key]: value } });
};

export const usePromptStateStore = create(
  immer<PromptState & PromptActions>((set, get) => ({
    // Initial State
    modelId: null,
    temperature: null,
    maxTokens: null,
    topP: null,
    topK: null,
    presencePenalty: null,
    frequencyPenalty: null,
    reasoningEnabled: null,
    webSearchEnabled: null,
    structuredOutputJson: null,

    // Actions
    setModelId: (id) => {
      if (get().modelId !== id) {
        set({ modelId: id });
        emitParamChange("modelId", id);
      }
    },
    setTemperature: (value) => {
      if (get().temperature !== value) {
        set({ temperature: value });
        emitParamChange("temperature", value);
      }
    },
    setMaxTokens: (value) => {
      if (get().maxTokens !== value) {
        set({ maxTokens: value });
        emitParamChange("maxTokens", value);
      }
    },
    setTopP: (value) => {
      if (get().topP !== value) {
        set({ topP: value });
        emitParamChange("topP", value);
      }
    },
    setTopK: (value) => {
      if (get().topK !== value) {
        set({ topK: value });
        emitParamChange("topK", value);
      }
    },
    setPresencePenalty: (value) => {
      if (get().presencePenalty !== value) {
        set({ presencePenalty: value });
        emitParamChange("presencePenalty", value);
      }
    },
    setFrequencyPenalty: (value) => {
      if (get().frequencyPenalty !== value) {
        set({ frequencyPenalty: value });
        emitParamChange("frequencyPenalty", value);
      }
    },
    setReasoningEnabled: (enabled) => {
      if (get().reasoningEnabled !== enabled) {
        set({ reasoningEnabled: enabled });
        emitParamChange("reasoningEnabled", enabled);
      }
    },
    setWebSearchEnabled: (enabled) => {
      if (get().webSearchEnabled !== enabled) {
        set({ webSearchEnabled: enabled });
        emitParamChange("webSearchEnabled", enabled);
      }
    },
    setStructuredOutputJson: (json) => {
      if (get().structuredOutputJson !== json) {
        set({ structuredOutputJson: json });
        emitParamChange("structuredOutputJson", json);
      }
    },

    initializePromptState: (settings) => {
      console.log("[PromptStateStore] Initializing with:", settings);
      const currentState = get();
      const changes: Partial<PromptState> = {};
      let changed = false;

      if (currentState.modelId !== settings.modelId) {
        changes.modelId = settings.modelId;
        changed = true;
      }
      if (currentState.temperature !== settings.temperature) {
        changes.temperature = settings.temperature;
        changed = true;
      }
      if (currentState.maxTokens !== settings.maxTokens) {
        changes.maxTokens = settings.maxTokens;
        changed = true;
      }
      if (currentState.topP !== settings.topP) {
        changes.topP = settings.topP;
        changed = true;
      }
      if (currentState.topK !== settings.topK) {
        changes.topK = settings.topK;
        changed = true;
      }
      if (currentState.presencePenalty !== settings.presencePenalty) {
        changes.presencePenalty = settings.presencePenalty;
        changed = true;
      }
      if (currentState.frequencyPenalty !== settings.frequencyPenalty) {
        changes.frequencyPenalty = settings.frequencyPenalty;
        changed = true;
      }

      if (changed) {
        set(changes);
        emitter.emit(promptEvent.parameterChanged, { params: changes });
      }
      emitter.emit(promptEvent.initialized, { state: { ...get() } });
    },

    resetTransientParameters: () => {
      console.log("[PromptStateStore] Resetting transient parameters.");
      const currentState = get();
      const changes: Partial<PromptState> = {};
      let changed = false;

      if (currentState.temperature !== null) {
        changes.temperature = null;
        changed = true;
      }
      if (currentState.maxTokens !== null) {
        changes.maxTokens = null;
        changed = true;
      }
      if (currentState.topP !== null) {
        changes.topP = null;
        changed = true;
      }
      if (currentState.topK !== null) {
        changes.topK = null;
        changed = true;
      }
      if (currentState.presencePenalty !== null) {
        changes.presencePenalty = null;
        changed = true;
      }
      if (currentState.frequencyPenalty !== null) {
        changes.frequencyPenalty = null;
        changed = true;
      }
      if (currentState.reasoningEnabled !== null) {
        changes.reasoningEnabled = null;
        changed = true;
      }
      if (currentState.webSearchEnabled !== null) {
        changes.webSearchEnabled = null;
        changed = true;
      }
      if (currentState.structuredOutputJson !== null) {
        changes.structuredOutputJson = null;
        changed = true;
      }

      if (changed) {
        set(changes);
        emitter.emit(promptEvent.parameterChanged, { params: changes });
      }
      emitter.emit(promptEvent.transientParametersReset, undefined);
    },
  }))
);
