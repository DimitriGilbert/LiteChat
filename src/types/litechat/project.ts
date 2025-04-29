// src/types/litechat/project.ts
import type { DbBase } from "./common";

export interface Project extends DbBase {
  name: string;
  path: string; // Unique, path-like identifier (e.g., /projectA/subB)
  parentId: string | null; // For nesting projects
  // Settings specific to this project (can override global)
  systemPrompt?: string | null;
  modelId?: string | null; // Combined ID (provider:model)
  temperature?: number | null;
  maxTokens?: number | null; // Added
  topP?: number | null; // Added
  topK?: number | null; // Added
  presencePenalty?: number | null; // Added
  frequencyPenalty?: number | null; // Added
  // Add other relevant settings overrides (maxTokens, topP, etc.)
  metadata?: Record<string, any>;
  // VFS key is implicitly derived from the top-level project ID
}
