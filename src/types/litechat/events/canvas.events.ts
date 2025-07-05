// src/types/litechat/events/canvas.events.ts
// FULL FILE

export const canvasEvent = {
  // Interaction Action Request Events
  copyInteractionResponseRequest: "canvas.interaction.copy.response.request",
  regenerateInteractionRequest: "canvas.interaction.regenerate.request",
  regenerateInteractionWithModelRequest: "canvas.interaction.regenerate.with.model.request",
  forkConversationRequest: "canvas.interaction.fork.conversation.request",
  forkConversationWithModelRequest: "canvas.interaction.fork.conversation.with.model.request",
  forkConversationCompactRequest: "canvas.interaction.fork.conversation.compact.request",
  raceInteractionRequest: "canvas.interaction.race.request",
  editResponseRequest: "canvas.interaction.edit.response.request",
  // rateInteractionRequest: "canvas.interaction.rate.request", // Removed
  // TODO: Add more interaction action requests as needed (e.g., edit, delete)

  // CodeBlock Action Request Events
  copyCodeBlockRequest: "canvas.codeblock.copy.request",
  editCodeBlockRequest: "canvas.codeblock.edit.request",
  repairEnhanceCodeBlockRequest: "canvas.codeblock.repair.enhance.request",
  // foldCodeBlockRequest: "canvas.codeblock.fold.request", // Keep folding local for now
  // TODO: Add more codeblock action requests (e.g., run, save to file)

  // General Canvas Events (if any specific to canvas emerge)
  // e.g., canvas.view.changed, canvas.element.focused

  // Action Outcome Events (optional, could also be handled by generic UI notifications)
  interactionResponseCopied: "canvas.interaction.response.copied",
  codeBlockCopied: "canvas.codeblock.copied",
} as const;

export interface CanvasEventPayloads {
  // Interaction Payloads
  [canvasEvent.copyInteractionResponseRequest]: {
    interactionId: string;
    // If specific parts of response can be copied, add more fields here
    // For now, assume it copies the primary response content.
  };
  [canvasEvent.regenerateInteractionRequest]: {
    interactionId: string;
  };
  [canvasEvent.regenerateInteractionWithModelRequest]: {
    interactionId: string;
    modelId: string;
  };
  [canvasEvent.forkConversationRequest]: {
    interactionId: string;
  };
  [canvasEvent.forkConversationWithModelRequest]: {
    interactionId: string;
    modelId: string;
  };
  [canvasEvent.forkConversationCompactRequest]: {
    interactionId: string;
    modelId: string;
  };
  [canvasEvent.editResponseRequest]: {
    interactionId: string;
    newContent: string;
  };
  // [canvasEvent.rateInteractionRequest]: { // Removed
  //   interactionId: string;
  //   rating: number | null;
  // };
  [canvasEvent.interactionResponseCopied]: {
    interactionId: string;
    contentCopied: string;
  };

  // CodeBlock Payloads
  [canvasEvent.copyCodeBlockRequest]: {
    interactionId?: string; // ID of the interaction containing this code block
    codeBlockId?: string; // A unique ID for the code block within the interaction, if available
    language?: string; // Language of the code block
    content: string; // Content to copy
  };
  [canvasEvent.editCodeBlockRequest]: {
    interactionId: string; // ID of the interaction containing this code block
    codeBlockId: string; // A unique ID for the code block within the interaction
    language?: string; // Language of the code block
    filepath?: string; // Filepath if available
    originalContent: string; // Original code content
    newContent: string; // New code content
  };
  [canvasEvent.repairEnhanceCodeBlockRequest]: {
    interactionId: string; // ID of the interaction containing this code block
    codeBlockId: string; // A unique ID for the code block within the interaction
    language?: string; // Language of the code block
    filepath?: string; // Filepath if available
    originalContent: string; // Original code content
    mode: "repair" | "enhance" | "complete-message" | "complete-conversation" | "other-blocks-message" | "other-blocks-conversation";
    errorMessage?: string; // Error message if repairing
  };
  // [canvasEvent.codeBlockCopied]: { // Removing this for now, will add back if needed for feedback
  //   interactionId?: string;
  //   codeBlockId?: string;
  //   content: string;
  // };

  // Add other payloads as new events are defined
}

// Helper type for emitter
export interface CanvasEvents extends CanvasEventPayloads {
  // This allows using canvasEvent.eventName directly with typed payloads
  // Example: emitter.emit(canvasEvent.copyInteractionResponseRequest, payload);
}
