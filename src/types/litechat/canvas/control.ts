import type { CanvasEventPayloads } from "../events/canvas.events";

/**
 * Base interface for canvas controls
 */
export interface CanvasControl {
  id: string;
  type: "interaction" | "codeblock" | "toolcall" | "group" | "global";

  // Renderers
  actionRenderer?: () => React.ReactNode; // For action buttons
  menuRenderer?: () => React.ReactNode; // For context menu items
  contentRenderer?: () => React.ReactNode; // For additional content

  // Event Handlers
  onInteractionMounted?: (
    payload: CanvasEventPayloads["canvas.interaction.mounted"]
  ) => void;
  onInteractionUnmounted?: (
    payload: CanvasEventPayloads["canvas.interaction.unmounted"]
  ) => void;
  onInteractionGrouped?: (
    payload: CanvasEventPayloads["canvas.interaction.grouped"]
  ) => void;
  onInteractionExpanded?: (
    payload: CanvasEventPayloads["canvas.interaction.expanded"]
  ) => void;
  onInteractionCollapsed?: (
    payload: CanvasEventPayloads["canvas.interaction.collapsed"]
  ) => void;
  onActionTriggered?: (
    payload: CanvasEventPayloads["canvas.interaction.action.triggered"]
  ) => void;
  onMenuRequested?: (
    payload: CanvasEventPayloads["canvas.interaction.menu.requested"]
  ) => void;

  // State Management
  getViewState?: () => Record<string, any>;
  restoreViewState?: (state: Record<string, any>) => void;
}
