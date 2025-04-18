// src/hooks/use-ai-interaction.ts
// This file is kept for backward compatibility
// All actual implementation has been moved to src/hooks/ai-interaction/*

// Re-export everything from the new location
export { useAiInteraction } from "./ai-interaction";
export type { UseAiInteractionProps, PerformAiStreamParams, UseAiInteractionReturn } from "./ai-interaction";