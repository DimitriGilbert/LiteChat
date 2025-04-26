// src/types/litechat/prompt.ts
import type React from "react";
import type { CoreMessage, Tool } from "ai";

/**
 * Represents the data captured from the user's input turn via the PromptWrapper.
 * This includes the text content, parameters derived from controls, and metadata.
 */
export interface PromptTurnObject {
  /** Unique ID for this specific turn attempt */
  id: string;
  /** The main text content entered by the user */
  content: string;
  /** Parameters collected from active PromptControls (e.g., model settings, temperature) */
  parameters: Record<string, any>;
  /** Metadata collected from active PromptControls (e.g., selected model ID, file references) */
  metadata: Record<string, any> & {
    attachedFiles?: {
      id?: string; // <-- Made 'id' optional here
      name: string;
      type: string;
      size: number;
    }[];
    selectedVfsFiles?: {
      id: string;
      name: string;
      path: string;
      type: string;
    }[];
  };
}

/**
 * Represents the complete object prepared for submission to the AIService.
 * This is constructed from the PromptTurnObject and conversation history/context.
 */
export interface PromptObject {
  /** The system prompt string, if any */
  system?: string;
  /** The history of messages in the conversation */
  messages: CoreMessage[];
  /** Tools available for the AI model */
  tools?: Tool[];
  /** How the model should use tools */
  toolChoice?:
    | "auto"
    | "none"
    | "required"
    | { type: "tool"; toolName: string };
  /** Final combined parameters for the AI call */
  parameters: Record<string, any>;
  /** Final combined metadata for the AI call */
  metadata: Record<string, any>;
  // Add any other fields required by the specific AI SDK or service
}

/**
 * Defines the props expected by a custom Input Area renderer component.
 */
export interface InputAreaRendererProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  // Allow any other props to be passed down
  [key: string]: any;
}

/**
 * Defines the type for a custom Input Area renderer component.
 */
export type InputAreaRenderer = React.ComponentType<InputAreaRendererProps>;

/**
 * Defines the interface for a Prompt Control.
 * These controls manage specific input-related features (model selection, file handling, parameters).
 */
export interface PromptControl {
  /** Unique identifier for the control */
  id: string;
  /** Display order preference (lower numbers appear first/higher priority) */
  order?: number;
  /** Optional function to determine if the control should be shown */
  show?: () => boolean;
  /**
   * Optional function to render the control's main UI (e.g., file previews, parameter sliders).
   * Rendered in the 'panel' area above the text input.
   */
  renderer?: () => React.ReactNode;
  /**
   * Optional function to render a trigger UI element (e.g., an icon button).
   * Rendered in the 'trigger' area (location depends on PromptWrapper layout).
   */
  triggerRenderer?: () => React.ReactNode;
  /**
   * Optional function to get parameters to add to the PromptTurnObject.
   * Called just before finalizing the turn data.
   */
  getParameters?: () =>
    | Record<string, any>
    | Promise<Record<string, any> | undefined>
    | undefined;
  /**
   * Optional function to get metadata to add to the PromptTurnObject.
   * Called just before finalizing the turn data.
   */
  getMetadata?: () =>
    | Record<string, any>
    | Promise<Record<string, any> | undefined>
    | undefined;
  /**
   * Optional function to clear the control's state on prompt submission.
   */
  clearOnSubmit?: () => void;
  /**
   * Optional function called when the control is initialized or registered.
   */
  onRegister?: () => void;
  /**
   * Optional function called when the control is unregistered or removed.
   */
  onUnregister?: () => void;
}

/**
 * Defines the area where a PromptControl can render its UI.
 */
export type PromptControlArea = "panel" | "trigger";
