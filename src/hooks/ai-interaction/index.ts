// src/hooks/ai-interaction/index.ts
export * from "./types";
export * from "./error-handler";
export * from "./stream-handler";
export * from "./message-mapper";
export * from "./tool-handler";
export * from "./image-generator";
export * from "./use-ai-interaction";

// Re-export the main hook
export { useAiInteraction } from "./use-ai-interaction";
