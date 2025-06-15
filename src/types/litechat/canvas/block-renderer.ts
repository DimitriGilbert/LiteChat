// src/types/litechat/canvas/block-renderer.ts
import type React from "react";

export interface BlockRendererContext {
  lang: string | undefined;
  code: string;
  filepath?: string;
  isStreaming?: boolean;
  blockId?: string;
  interactionId?: string;
}

export interface BlockRenderer {
  id: string;
  // Languages this renderer handles (e.g., ["mermaid"], ["typescript", "javascript"], etc.)
  // Empty array or undefined means it handles all languages (fallback renderer)
  supportedLanguages?: string[];
  // Priority for renderer selection (higher = more priority)
  priority?: number;
  // The actual renderer component
  renderer: (context: BlockRendererContext) => React.ReactNode;
  // Optional lifecycle hooks
  onMounted?: (context: BlockRendererContext & { element: HTMLElement }) => void;
  onUnmounted?: (context: BlockRendererContext) => void;
} 