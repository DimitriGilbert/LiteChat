// src/types/litechat/events/stores/prompt.events.ts
// NEW FILE
export const promptStoreEvent = {
  // State Change Events
  initialized: "stores.prompt.state.initialized", // When initial state is set based on context
  parameterChanged: "stores.prompt.state.parameter.changed", // Generic event for any parameter change
  transientParametersReset: "stores.prompt.state.transient.parameters.reset",
  inputTextStateChanged: "stores.prompt.state.input.text.changed", // If input text were part of this store
  submitted: "stores.prompt.state.submitted", // When a prompt is fully formed and submitted

  // Action Request Events
  setModelIdRequest: "stores.prompt.state.set.model.id.request",
  setTemperatureRequest: "stores.prompt.state.set.temperature.request",
  setMaxTokensRequest: "stores.prompt.state.set.max.tokens.request",
  setTopPRequest: "stores.prompt.state.set.top.p.request",
  setTopKRequest: "stores.prompt.state.set.top.k.request",
  setPresencePenaltyRequest: "stores.prompt.state.set.presence.penalty.request",
  setFrequencyPenaltyRequest:
    "stores.prompt.state.set.frequency.penalty.request",
  setReasoningEnabledRequest:
    "stores.prompt.state.set.reasoning.enabled.request",
  setWebSearchEnabledRequest:
    "stores.prompt.state.set.web.search.enabled.request",
  setStructuredOutputJsonRequest:
    "stores.prompt.state.set.structured.output.json.request",
  initializePromptStateRequest:
    "stores.prompt.state.initialize.prompt.state.request",
  resetTransientParametersRequest:
    "stores.prompt.state.reset.transient.parameters.request",

  // Original events (can be re-emitted by PromptWrapper if needed by mods)
  inputChanged: "prompt.inputChanged", // For raw input text changes, if not in this store
} as const;
