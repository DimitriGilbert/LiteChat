// src/types/litechat/project.ts
// FULL FILE
import type { DbBase } from "./common";

export interface Project extends DbBase {
  name: string;
  path: string;
  parentId: string | null;
  // Settings specific to this project (can override global)
  systemPrompt?: string | null;
  modelId?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  topP?: number | null;
  topK?: number | null;
  presencePenalty?: number | null;
  frequencyPenalty?: number | null;
  // Add default tags and rules
  defaultTagIds?: string[] | null;
  defaultRuleIds?: string[] | null;
  metadata?: Record<string, any>;
  // VFS key is implicitly derived from the top-level project ID
}
