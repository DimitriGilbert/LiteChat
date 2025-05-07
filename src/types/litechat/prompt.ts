// src/types/litechat/prompt.ts
// FULL FILE
import type React from "react";
import type { CoreMessage, Tool } from "ai";
import { ChatControlStatus } from "./chat";

export interface PromptTurnObject {
  id: string;
  content: string;
  parameters: Record<string, any>;
  metadata: Record<string, any> & {
    attachedFiles?: {
      id: string;
      source: "direct" | "vfs";
      name: string;
      type: string;
      size: number;
      path?: string;
      contentText?: string;
      contentBase64?: string;
    }[];
    enabledTools?: string[];
    // Add metadata from transient controls
    turnSystemPrompt?: string;
    activeTagIds?: string[];
    activeRuleIds?: string[];
    autoTitleEnabledForTurn?: boolean;
    maxSteps?: number; // From tool selector
  };
}

export interface PromptObject {
  system?: string;
  messages: CoreMessage[];
  tools?: Tool[];
  toolChoice?:
    | "auto"
    | "none"
    | "required"
    | { type: "tool"; toolName: string };
  parameters: Record<string, any>;
  metadata: Record<string, any> & {
    enabledTools?: string[];
    attachedFiles?: {
      id: string;
      source: "direct" | "vfs";
      name: string;
      type: string;
      size: number;
      path?: string;
    }[];
    // Add other relevant metadata for AI service
    modelId?: string;
    regeneratedFromId?: string;
    isTitleGeneration?: boolean;
  };
}

export interface InputAreaRendererProps {
  initialValue?: string;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  onValueChange?: (value: string) => void;
  [key: string]: any;
}

export type InputAreaRenderer = React.ComponentType<InputAreaRendererProps>;

export interface PromptControl {
  id: string;
  show?: () => boolean;
  status?: () => ChatControlStatus;
  renderer?: () => React.ReactNode;
  triggerRenderer?: () => React.ReactNode;
  getParameters?: () =>
    | Record<string, any>
    | Promise<Record<string, any> | undefined>
    | undefined;
  getMetadata?: () =>
    | Record<string, any>
    | Promise<Record<string, any> | undefined>
    | undefined;
  clearOnSubmit?: () => void;
  onRegister?: () => void;
  onUnregister?: () => void;
}

export type PromptControlArea = "panel" | "trigger";

export interface InputAreaRef {
  getValue: () => string;
  setValue: (value: string) => void; // Add setValue method
  focus: () => void;
  clearValue: () => void;
}
