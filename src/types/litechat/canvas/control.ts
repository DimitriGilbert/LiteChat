// src/types/litechat/canvas/control.ts
// FULL FILE
import type React from "react";
import type { Interaction } from "../interaction";
import type { ToolCallPart, ToolResultPart } from "ai";

export interface CanvasControlRenderContext {
  interaction?: Interaction;
  interactionId?: string;
  responseContent?: string;
  codeBlockLang?: string;
  codeBlockContent?: string;
  codeBlockEditedContent?: string;
  codeBlockId?: string;
  codeBlockFilepath?: string;
  blockId?: string; // Unique block ID from UniversalBlockRenderer
  isFolded?: boolean;
  toggleFold?: () => void;
  onEditModeChange?: (isEditing: boolean) => void;
  toolCall?: ToolCallPart;
  toolResult?: ToolResultPart;
  // This type should reflect the element the control is associated with
  canvasContextType?: "interaction" | "codeblock" | "global" | "tool-call-step";
  // Scroll viewport for ToC and other controls that need to scroll
  scrollViewport?: HTMLElement | null;
}

export interface CanvasControl {
  id: string;
  type: "interaction" | "codeblock" | "global" | "tool-call-step";
  targetSlot: 
    | "actions" 
    | "menu" 
    | "content" 
    | "header-actions"
    | "codeblock-header-actions"
    | "codeblock-footer-actions"
    | "tool-call-content";

  renderer?: (context: CanvasControlRenderContext) => React.ReactNode;

  // Optional event handlers for specific controls
  onMounted?: (
    payload: {
      elementId: string;
      element: HTMLElement;
    } & CanvasControlRenderContext
  ) => void;
  onActionTriggered?: (
    payload: { actionId: string; metadata?: any } & CanvasControlRenderContext
  ) => void;
  onInteractionMounted?: (payload: {
    interactionId: string;
    element: HTMLElement;
  }) => void;
  onInteractionUnmounted?: (payload: { interactionId: string }) => void;
  onInteractionGrouped?: (payload: {
    groupId: string;
    interactionIds: string[];
    groupType: "folder" | "custom";
    metadata?: Record<string, any>;
  }) => void;
  onInteractionExpanded?: (payload: { interactionId: string }) => void;
  onInteractionCollapsed?: (payload: { interactionId: string }) => void;
  onMenuRequested?: (payload: {
    interactionId: string;
    menuType: "context" | "action";
    metadata?: Record<string, any>;
  }) => void;

  getViewState?: () => Record<string, any>;
  restoreViewState?: (state: Record<string, any>) => void;
}

export interface SelectionControlContext {
  selectedText: string;
  selectionBounds: DOMRect;
  interactionId?: string;
  responseContent?: string;
}

export interface SelectionControl {
  id: string;
  renderer: (context: SelectionControlContext) => React.ReactNode;
  showCondition?: (context: SelectionControlContext) => boolean;
}
