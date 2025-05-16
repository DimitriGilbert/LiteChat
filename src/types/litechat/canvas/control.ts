// src/types/litechat/canvas/control.ts
// FULL FILE
import type React from "react";
import type { Interaction } from "../interaction";

export interface CanvasControlRenderContext {
  interaction?: Interaction;
  interactionId?: string;
  responseContent?: string;
  codeBlockLang?: string;
  codeBlockContent?: string;
  codeBlockId?: string;
  // This type should reflect the element the control is associated with
  canvasContextType?: "interaction" | "codeblock" | "global";
}

export interface CanvasControl {
  id: string;
  type: "interaction" | "codeblock" | "global";
  targetSlot: 
    | "actions" 
    | "menu" 
    | "content" 
    | "header-actions"
    | "codeblock-header-actions"
    | "codeblock-footer-actions";

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
