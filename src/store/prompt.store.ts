// src/store/prompt.store.ts

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// State for the *next* prompt submission
interface PromptState {
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

export const usePromptStateStore = create(
  immer<PromptState & PromptActions>((set) => ({
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
    setModelId: (id) => set({ modelId: id }),
    setTemperature: (value) => set({ temperature: value }),
    setMaxTokens: (value) => set({ maxTokens: value }),
    setTopP: (value) => set({ topP: value }),
    setTopK: (value) => set({ topK: value }),
    setPresencePenalty: (value) => set({ presencePenalty: value }),
    setFrequencyPenalty: (value) => set({ frequencyPenalty: value }),
    // Actions for new parameters
    setReasoningEnabled: (enabled) => set({ reasoningEnabled: enabled }),
    setWebSearchEnabled: (enabled) => set({ webSearchEnabled: enabled }),
    setStructuredOutputJson: (json) => set({ structuredOutputJson: json }),

    initializePromptState: (settings) => {
      console.log("[PromptStateStore] Initializing with:", settings);
      set({
        modelId: settings.modelId,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        topP: settings.topP,
        topK: settings.topK,
        presencePenalty: settings.presencePenalty,
        frequencyPenalty: settings.frequencyPenalty,
        // Do NOT reset transient params here, they persist until cleared
        // reasoningEnabled: null,
        // webSearchEnabled: null,
        // structuredOutputJson: null,
      });
    },

    resetTransientParameters: () => {
      console.log("[PromptStateStore] Resetting transient parameters.");
      set({
        // modelId is NOT reset here
        temperature: null,
        maxTokens: null,
        topP: null,
        topK: null,
        presencePenalty: null,
        frequencyPenalty: null,
        reasoningEnabled: null, // Reset new state
        webSearchEnabled: null, // Reset new state
        structuredOutputJson: null, // Reset new state
      });
    },
  })),
);
