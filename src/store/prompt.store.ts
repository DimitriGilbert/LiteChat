// src/store/prompt.store.ts
// Entire file content provided
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
  // Add other transient prompt states if needed
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
  // Action to reset state (e.g., after submission) - DEPRECATED
  // resetPromptState: () => void;
  // NEW Action to reset only transient parameters, keeping modelId
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

    // Actions
    setModelId: (id) => set({ modelId: id }),
    setTemperature: (value) => set({ temperature: value }),
    setMaxTokens: (value) => set({ maxTokens: value }),
    setTopP: (value) => set({ topP: value }),
    setTopK: (value) => set({ topK: value }),
    setPresencePenalty: (value) => set({ presencePenalty: value }),
    setFrequencyPenalty: (value) => set({ frequencyPenalty: value }),

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
      });
    },

    // resetPromptState: () => {
    //   // Resetting clears the state. LiteChat will re-initialize it
    //   // based on the current context when needed (e.g., after submit, on context change).
    //   console.log("[PromptStateStore] Resetting state.");
    //   set({
    //     modelId: null,
    //     temperature: null,
    //     maxTokens: null,
    //     topP: null,
    //     topK: null,
    //     presencePenalty: null,
    //     frequencyPenalty: null,
    //   });
    // },

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
      });
    },
  })),
);
