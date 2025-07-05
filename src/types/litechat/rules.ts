// src/types/litechat/rules.ts
import type { DbBase } from "./common";

export type RuleType = "system" | "before" | "after" | "control";

export interface DbRule extends DbBase {
  name: string;
  content: string;
  type: RuleType;
  alwaysOn?: boolean;
  // Add projectId if rules should be project-specific, or keep global
  // projectId: string | null;
}

export interface DbTag extends DbBase {
  name: string;
  description?: string | null;
  // Add projectId if tags should be project-specific, or keep global
  // projectId: string | null;
}

// Many-to-many link table
export interface DbTagRuleLink {
  id: string;
  tagId: string;
  ruleId: string;
}
