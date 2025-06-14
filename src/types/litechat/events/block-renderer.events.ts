import type { BlockRenderer } from "../canvas/block-renderer";

export const blockRendererEvent = {
  // State Change Events
  blockRenderersChanged: "block.renderer.renderers.changed",

  // Action Request Events
  registerBlockRendererRequest: "block.renderer.register.request",
  unregisterBlockRendererRequest: "block.renderer.unregister.request",
} as const;

export interface BlockRendererEventPayloads {
  [blockRendererEvent.blockRenderersChanged]: {
    renderers: Record<string, BlockRenderer>;
  };
  [blockRendererEvent.registerBlockRendererRequest]: {
    renderer: BlockRenderer;
  };
  [blockRendererEvent.unregisterBlockRendererRequest]: {
    id: string;
  };
} 