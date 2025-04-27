// src/types/litechat/project.ts
import type { DbBase } from "./common";

export interface Project extends DbBase {
  name: string;
  parentId: string | null; // For nesting projects
  // Settings specific to this project (can override global)
  systemPrompt?: string | null;
  modelId?: string | null; // Combined ID (provider:model)
  temperature?: number | null;
  // Add other relevant settings overrides (maxTokens, topP, etc.)
  metadata?: Record<string, any>;
  // VFS key is implicitly derived from the top-level project ID
}
