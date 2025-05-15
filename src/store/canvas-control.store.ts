import { create } from "zustand";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import type { CanvasControl } from "@/types/litechat/canvas/control";

interface CanvasControlStore {
  controls: CanvasControl[];
  register: (control: CanvasControl) => () => void;
  unregister: (controlId: string) => void;
  getControlsByType: (type: CanvasControl["type"]) => CanvasControl[];
  getControlById: (controlId: string) => CanvasControl | undefined;
}

export const useCanvasControlStore = create<CanvasControlStore>((set, get) => ({
  controls: [],

  register: (control) => {
    set((state) => ({
      controls: [...state.controls, control],
    }));

    // Return unregister function
    return () => get().unregister(control.id);
  },

  unregister: (controlId) => {
    set((state) => ({
      controls: state.controls.filter((c) => c.id !== controlId),
    }));
  },

  getControlsByType: (type) => {
    return get().controls.filter((c) => c.type === type);
  },

  getControlById: (controlId) => {
    return get().controls.find((c) => c.id === controlId);
  },
}));

// Setup event handlers for all registered controls
emitter.on(canvasEvent.interactionMounted, (payload) => {
  useCanvasControlStore.getState().controls.forEach((control) => {
    control.onInteractionMounted?.(payload);
  });
});

emitter.on(canvasEvent.interactionUnmounted, (payload) => {
  useCanvasControlStore.getState().controls.forEach((control) => {
    control.onInteractionUnmounted?.(payload);
  });
});

emitter.on(canvasEvent.interactionGrouped, (payload) => {
  useCanvasControlStore.getState().controls.forEach((control) => {
    control.onInteractionGrouped?.(payload);
  });
});

emitter.on(canvasEvent.interactionExpanded, (payload) => {
  useCanvasControlStore.getState().controls.forEach((control) => {
    control.onInteractionExpanded?.(payload);
  });
});

emitter.on(canvasEvent.interactionCollapsed, (payload) => {
  useCanvasControlStore.getState().controls.forEach((control) => {
    control.onInteractionCollapsed?.(payload);
  });
});

emitter.on(canvasEvent.interactionActionTriggered, (payload) => {
  useCanvasControlStore.getState().controls.forEach((control) => {
    control.onActionTriggered?.(payload);
  });
});

emitter.on(canvasEvent.interactionMenuRequested, (payload) => {
  useCanvasControlStore.getState().controls.forEach((control) => {
    control.onMenuRequested?.(payload);
  });
});
