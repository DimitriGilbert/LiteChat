// src/types/litechat/prompt.ts
// Entire file content provided as it's significantly changed
import type React from "react";
import type { CoreMessage, Tool } from "ai";
import { ChatControlStatus } from "./chat";

/**
 * Represents the data captured from the user's input turn via the PromptWrapper.
 * This includes the text content, parameters derived from controls, and metadata.
 * File content (text or base64) is stored directly here for persistence.
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
    // Unified attachedFiles metadata structure including content
    attachedFiles?: {
      id: string
      source: "direct" | "vfs";
      name: string;
      type: string
      size: number;
      path?: string
      // Content is stored here for persistence
      contentText?: string;
      contentBase64?: string;
    }[];
    enabledTools?: string[]
  };
}

/**
 * Represents the complete object prepared for submission to the AIService.
 * This is constructed from the PromptTurnObject and conversation history/context.
 * File content is processed into the messages array, not stored in metadata here.
 */
export interface PromptObject {
  /** The system prompt string, if any */
  system?: string;
  /** The history of messages in the conversation */
  messages: CoreMessage[];
  /** Tools available for the AI model */
  tools?: Tool[];
  /**
   * How the model should use tools.
   * Use string literals directly as the generic ToolChoice type is hard to apply here.
   */
  toolChoice?:
    | "auto"
    | "none"
    | "required"
    | { type: "tool"; toolName: string };
  /** Final combined parameters for the AI call */
  parameters: Record<string, any>;
  /** Final combined metadata for the AI call (file content is NOT included here) */
  metadata: Record<string, any> & {
    enabledTools?: string[]
    // Only basic file info needed here, content is processed into messages
    attachedFiles?: {
      id: string;
      source: "direct" | "vfs";
      name: string;
      type: string;
      size: number;
      path?: string;
    }[];
  };
  // Add any other fields required by the specific AI SDK or service
}

/**
 * Defines the props expected by a custom Input Area renderer component.
 * Reflects the change where InputArea manages its own state.
 */
export interface InputAreaRendererProps {
  // value and onChange removed
  initialValue?: string
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
  status?: () => ChatControlStatus;
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

// --- Ref Type for InputArea ---
// Moved from InputArea.tsx to be centrally defined
export interface InputAreaRef {
  getValue: () => string;
  // setValue removed as InputArea clears itself internally on submit
  focus: () => void;
}
