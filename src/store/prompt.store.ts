// src/store/prompt.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { emitter } from "@/lib/litechat/event-emitter";
import {
  promptEvent,
  PromptEventPayloads,
} from "@/types/litechat/events/prompt.events";
import type { RegisteredActionHandler } from "@/types/litechat/control";

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
  imageGenerationEnabled: boolean | null;
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
  setImageGenerationEnabled: (enabled: boolean | null) => void;
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
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
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
    imageGenerationEnabled: null,
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
    setImageGenerationEnabled: (enabled) => {
      if (get().imageGenerationEnabled !== enabled) {
        set({ imageGenerationEnabled: enabled });
        emitParamChange("imageGenerationEnabled", enabled);
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
      if (currentState.imageGenerationEnabled !== null) {
        changes.imageGenerationEnabled = null;
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
    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const storeId = "promptStateStore";
      const actions = get();
      return [
        {
          eventName: promptEvent.setModelIdRequest,
          handler: (
            p: PromptEventPayloads[typeof promptEvent.setModelIdRequest]
          ) => actions.setModelId(p.id),
          storeId,
        },
        {
          eventName: promptEvent.setTemperatureRequest,
          handler: (
            p: PromptEventPayloads[typeof promptEvent.setTemperatureRequest]
          ) => actions.setTemperature(p.value),
          storeId,
        },
        {
          eventName: promptEvent.setMaxTokensRequest,
          handler: (
            p: PromptEventPayloads[typeof promptEvent.setMaxTokensRequest]
          ) => actions.setMaxTokens(p.value),
          storeId,
        },
        {
          eventName: promptEvent.setTopPRequest,
          handler: (
            p: PromptEventPayloads[typeof promptEvent.setTopPRequest]
          ) => actions.setTopP(p.value),
          storeId,
        },
        {
          eventName: promptEvent.setTopKRequest,
          handler: (
            p: PromptEventPayloads[typeof promptEvent.setTopKRequest]
          ) => actions.setTopK(p.value),
          storeId,
        },
        {
          eventName: promptEvent.setPresencePenaltyRequest,
          handler: (
            p: PromptEventPayloads[typeof promptEvent.setPresencePenaltyRequest]
          ) => actions.setPresencePenalty(p.value),
          storeId,
        },
        {
          eventName: promptEvent.setFrequencyPenaltyRequest,
          handler: (
            p: PromptEventPayloads[typeof promptEvent.setFrequencyPenaltyRequest]
          ) => actions.setFrequencyPenalty(p.value),
          storeId,
        },
        {
          eventName: promptEvent.setReasoningEnabledRequest,
          handler: (
            p: PromptEventPayloads[typeof promptEvent.setReasoningEnabledRequest]
          ) => actions.setReasoningEnabled(p.enabled),
          storeId,
        },
        {
          eventName: promptEvent.setWebSearchEnabledRequest,
          handler: (
            p: PromptEventPayloads[typeof promptEvent.setWebSearchEnabledRequest]
          ) => actions.setWebSearchEnabled(p.enabled),
          storeId,
        },
        {
          eventName: promptEvent.setImageGenerationEnabledRequest,
          handler: (
            p: PromptEventPayloads[typeof promptEvent.setImageGenerationEnabledRequest]
          ) => actions.setImageGenerationEnabled(p.enabled),
          storeId,
        },
        {
          eventName: promptEvent.setStructuredOutputJsonRequest,
          handler: (
            p: PromptEventPayloads[typeof promptEvent.setStructuredOutputJsonRequest]
          ) => actions.setStructuredOutputJson(p.json),
          storeId,
        },
        {
          eventName: promptEvent.initializePromptStateRequest,
          handler: (
            p: PromptEventPayloads[typeof promptEvent.initializePromptStateRequest]
          ) => actions.initializePromptState(p.effectiveSettings),
          storeId,
        },
        {
          eventName: promptEvent.resetTransientParametersRequest,
          handler: () => actions.resetTransientParameters(),
          storeId,
        },
      ];
    },
  }))
);
