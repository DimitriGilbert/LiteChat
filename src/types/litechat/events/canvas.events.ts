// src/types/litechat/events/canvas.events.ts
// FULL FILE
import type { Interaction } from "@/types/litechat/interaction";

export const canvasEvent = {
  // Interaction Action Request Events
  copyInteractionResponseRequest:
    "canvas.interaction.copy.response.request",
  regenerateInteractionRequest: "canvas.interaction.regenerate.request",
  // rateInteractionRequest: "canvas.interaction.rate.request", // Removed
  // TODO: Add more interaction action requests as needed (e.g., edit, delete)

  // CodeBlock Action Request Events
  copyCodeBlockRequest: "canvas.codeblock.copy.request",
  // foldCodeBlockRequest: "canvas.codeblock.fold.request", // Keep folding local for now
  // TODO: Add more codeblock action requests (e.g., run, save to file)

  // General Canvas Events (if any specific ones are needed beyond control registration)
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
    content: string; // The code content (changed from contentToCopy for consistency)
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