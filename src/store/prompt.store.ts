// src/store/prompt.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { emitter } from "@/lib/litechat/event-emitter"; // Import emitter
import { ModEvent } from "@/types/litechat/modding"; // Import ModEvent

// State for the *next* prompt submission
export interface PromptState {
  modelId: string | null;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  topK: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
  // New transient states
  reasoningEnabled: boolean | null; // Use null for 'default/unset'
  webSearchEnabled: boolean | null; // Use null for 'default/unset'
  structuredOutputJson: string | null; // Store the JSON string
}

interface PromptActions {
  // Setters for individual parameters
  setModelId: (id: string | null) => void;
  setTemperature: (value: number | null) => void;
  setMaxTokens: (value: number | null) => void;
  setTopP: (value: number | null) => void;
  setTopK: (value: number | null) => void;
  setPresencePenalty: (value: number | null) => void;
  setFrequencyPenalty: (value: number | null) => void;
  // Setters for new parameters
  setReasoningEnabled: (enabled: boolean | null) => void;
  setWebSearchEnabled: (enabled: boolean | null) => void;
  setStructuredOutputJson: (json: string | null) => void;
  // Action to set all state based on effective settings
  initializePromptState: (effectiveSettings: {
    modelId: string | null;
    temperature: number | null;
    maxTokens: number | null;
    topP: number | null;
    topK: number | null;
    presencePenalty: number | null;
    frequencyPenalty: number | null;
  }) => void;
  // Action to reset only transient parameters, keeping modelId
  resetTransientParameters: () => void;
}

// Helper to emit parameter changes
const emitParamChange = (
  key: keyof PromptState,
  value: PromptState[keyof PromptState],
) => {
  emitter.emit(ModEvent.PROMPT_PARAMS_CHANGED, { params: { [key]: value } });
};

export const usePromptStateStore = create(
  immer<PromptState & PromptActions>((set, get) => ({
    // Initial State (all null, will be initialized by LiteChat)
    modelId: null,
    temperature: null,
    maxTokens: null,
    topP: null,
    topK: null,
    presencePenalty: null,
    frequencyPenalty: null,
    reasoningEnabled: null, // Initialize new state
    webSearchEnabled: null, // Initialize new state
    structuredOutputJson: null, // Initialize new state

    // Actions
    setModelId: (id) => {
      if (get().modelId !== id) {
        set({ modelId: id });
        emitParamChange("modelId", id);
        // Note: Model selection change is primarily handled by ProviderStore emitting MODEL_SELECTION_CHANGED
        // This ensures the prompt state reflects it, but the main event comes from the source.
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
    // Actions for new parameters
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

      // Compare and set only if changed
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
        // Emit a single event for initialization changes
        emitter.emit(ModEvent.PROMPT_PARAMS_CHANGED, { params: changes });
      }
    },

    resetTransientParameters: () => {
      console.log("[PromptStateStore] Resetting transient parameters.");
      const currentState = get();
      const changes: Partial<PromptState> = {};
      let changed = false;

      // Compare and set only if changed
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
        // Emit a single event for reset changes
        emitter.emit(ModEvent.PROMPT_PARAMS_CHANGED, { params: changes });
      }
    },
  })),
);
