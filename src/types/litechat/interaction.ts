// src/types/litechat/interaction.ts
// FULL FILE
import type { PromptTurnObject } from "./prompt";
import type { Metadata } from "./common";

export type InteractionType =
  | "message.user_assistant"
  | "message.assistant_regen"
  | "message.assistant_explain"
  | "message.user_edit"
  | "message.workflow_step"
  | "conversation.title_generation"
  | "conversation.compact"
  | "prompt.enhance"
  | "tool.execution"
  | "system.info"
  | "system.error"
  | "workflow.run"
  | "rules.auto_selection"
  | "code.security_check"
  | "code_block.repair_enhance";

export type InteractionStatus =
  | "PENDING"
  | "STREAMING"
  | "COMPLETED"
  | "ERROR"
  | "WARNING"
  | "CANCELLED"
  | "PAUSED"
  | "AWAITING_INPUT";

// Represents one logical unit in the conversation flow
export interface Interaction {
  id: string;
  conversationId: string;
  type: InteractionType;
  index: number;
  parentId: string | null;
  prompt: Readonly<PromptTurnObject> | null;
  response: any | null;
  status: InteractionStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  // Add rating field
  rating?: number | null;
  metadata: Metadata & {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    modelId?: string;
    providerId?: string;
    error?: string;
    regeneratedFromId?: string;
    toolCalls?: string[];
    toolResults?: string[];
    attachedFiles?: {
      id: string;
      source: "direct" | "vfs";
      name: string;
      type: string;
      size: number;
      path?: string;
    }[];
    reasoning?: string;
    providerMetadata?: Record<string, any>;
    timeToFirstToken?: number;
    generationTime?: number;
    isTitleGeneration?: boolean;
    // Parallel execution metadata
    isParallelBranch?: boolean;
    parallelBranchIndex?: number;
    parallelParentStepId?: string;
    parallelArrayItem?: any;
    // Sub-workflow metadata
    isSubWorkflowMain?: boolean;
    subWorkflowTemplateId?: string;
    subWorkflowParentStepId?: string;
  };
}
