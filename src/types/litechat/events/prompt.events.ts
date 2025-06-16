// src/types/litechat/events/prompt.events.ts
// FULL FILE
import type { PromptState } from "@/store/prompt.store";
import type { PromptTurnObject } from "@/types/litechat/prompt";

export const promptEvent = {
  // State Change Events
  initialized: "prompt.state.initialized",
  parameterChanged: "prompt.state.parameter.changed",
  transientParametersReset: "prompt.state.transient.parameters.reset",
  inputTextStateChanged: "prompt.state.input.text.changed",
  submitted: "prompt.state.submitted",

  // Prompt Enhancement Events
  enhancementStarted: "prompt.enhancement.started",
  enhancementCompleted: "prompt.enhancement.completed",
  enhancementFailed: "prompt.enhancement.failed",

  // Action Request Events
  setModelIdRequest: "prompt.state.set.model.id.request",
  setTemperatureRequest: "prompt.state.set.temperature.request",
  setMaxTokensRequest: "prompt.state.set.max.tokens.request",
  setTopPRequest: "prompt.state.set.top.p.request",
  setTopKRequest: "prompt.state.set.top.k.request",
  setPresencePenaltyRequest: "prompt.state.set.presence.penalty.request",
  setFrequencyPenaltyRequest: "prompt.state.set.frequency.penalty.request",
  setReasoningEnabledRequest: "prompt.state.set.reasoning.enabled.request",
  setWebSearchEnabledRequest: "prompt.state.set.web.search.enabled.request",
  setImageGenerationEnabledRequest: "prompt.state.set.image.generation.enabled.request",
  setStructuredOutputJsonRequest:
    "prompt.state.set.structured.output.json.request",
  initializePromptStateRequest: "prompt.state.initialize.prompt.state.request",
  resetTransientParametersRequest:
    "prompt.state.reset.transient.parameters.request",
  
  // Input Area Action Events
  setInputTextRequest: "prompt.input.set.text.request",
  focusInputRequest: "prompt.input.focus.request",
  submitPromptRequest: "prompt.submit.request",

  // Prompt Enhancement Request Events
  enhancePromptRequest: "prompt.enhance.request",

  // Original events (can be re-emitted by PromptWrapper if needed by mods)
  inputChanged: "prompt.inputChanged",
} as const;

export interface PromptEventPayloads {
  [promptEvent.initialized]: { state: PromptState };
  [promptEvent.parameterChanged]: { params: Partial<PromptState> };
  [promptEvent.transientParametersReset]: undefined;
  [promptEvent.inputTextStateChanged]: { value: string };
  [promptEvent.submitted]: { turnData: PromptTurnObject };
  [promptEvent.inputChanged]: { value: string };
  
  // Prompt Enhancement Event Payloads
  [promptEvent.enhancementStarted]: { interactionId: string; originalPrompt: string };
  [promptEvent.enhancementCompleted]: { interactionId: string; enhancedPrompt: string };
  [promptEvent.enhancementFailed]: { interactionId: string; error: string };
  
  [promptEvent.setModelIdRequest]: { id: string | null };
  [promptEvent.setTemperatureRequest]: { value: number | null };
  [promptEvent.setMaxTokensRequest]: { value: number | null };
  [promptEvent.setTopPRequest]: { value: number | null };
  [promptEvent.setTopKRequest]: { value: number | null };
  [promptEvent.setPresencePenaltyRequest]: { value: number | null };
  [promptEvent.setFrequencyPenaltyRequest]: { value: number | null };
  [promptEvent.setReasoningEnabledRequest]: { enabled: boolean | null };
  [promptEvent.setWebSearchEnabledRequest]: { enabled: boolean | null };
  [promptEvent.setImageGenerationEnabledRequest]: { enabled: boolean | null };
  [promptEvent.setStructuredOutputJsonRequest]: { json: string | null };
  [promptEvent.initializePromptStateRequest]: {
    effectiveSettings: {
      modelId: string | null;
      temperature: number | null;
      maxTokens: number | null;
      topP: number | null;
      topK: number | null;
      presencePenalty: number | null;
      frequencyPenalty: number | null;
    };
  };
  [promptEvent.resetTransientParametersRequest]: undefined;
  [promptEvent.setInputTextRequest]: { text: string };
  [promptEvent.focusInputRequest]: undefined;
  [promptEvent.submitPromptRequest]: { turnData: PromptTurnObject };
  [promptEvent.enhancePromptRequest]: { prompt: string; modelId: string; systemPrompt?: string };
}
