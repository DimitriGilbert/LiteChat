export const canvasEvent = {
  // Interaction Lifecycle Events
  interactionMounted: "canvas.interaction.mounted",
  interactionUnmounted: "canvas.interaction.unmounted",
  interactionGrouped: "canvas.interaction.grouped",
  interactionUngrouped: "canvas.interaction.ungrouped",

  // UI Events
  interactionExpanded: "canvas.interaction.expanded",
  interactionCollapsed: "canvas.interaction.collapsed",
  interactionFocused: "canvas.interaction.focused",

  // Action Events
  interactionActionTriggered: "canvas.interaction.action.triggered",
  interactionMenuRequested: "canvas.interaction.menu.requested",

  // View State Events
  viewStateChanged: "canvas.view.state.changed",
  scrollPositionChanged: "canvas.scroll.position.changed",
} as const;

// Event Payloads
export interface CanvasEventPayloads {
  [canvasEvent.interactionMounted]: {
    interactionId: string;
    element: HTMLElement;
  };
  [canvasEvent.interactionUnmounted]: {
    interactionId: string;
  };
  [canvasEvent.interactionGrouped]: {
    groupId: string;
    interactionIds: string[];
    groupType: "folder" | "custom";
    metadata?: Record<string, any>;
  };
  [canvasEvent.interactionUngrouped]: {
    groupId: string;
    interactionIds: string[];
  };
  [canvasEvent.interactionExpanded]: {
    interactionId: string;
  };
  [canvasEvent.interactionCollapsed]: {
    interactionId: string;
  };
  [canvasEvent.interactionFocused]: {
    interactionId: string;
  };
  [canvasEvent.interactionActionTriggered]: {
    interactionId: string;
    actionId: string;
    metadata?: Record<string, any>;
  };
  [canvasEvent.interactionMenuRequested]: {
    interactionId: string;
    menuType: "context" | "action";
    metadata?: Record<string, any>;
  };
  [canvasEvent.viewStateChanged]: {
    type: "layout" | "scroll" | "custom";
    state: Record<string, any>;
  };
  [canvasEvent.scrollPositionChanged]: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
  };
}
