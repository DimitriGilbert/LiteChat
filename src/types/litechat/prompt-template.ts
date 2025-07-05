export interface PromptVariable {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "array";
  required: boolean;
  default?: any;
  instructions?: string;
}

export type PromptTemplateType = "prompt" | "task" | "agent";

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  variables: PromptVariable[];
  prompt: string;
  tags: string[];
  tools?: string[]; // Tool names to auto-select
  rules?: string[]; // Rule names to auto-select
  type?: PromptTemplateType; // Optional field: prompt | task | agent (defaults to "prompt")
  parentId?: string | null; // New field: for tasks, references the agent ID
  structuredOutput?: { // For requesting structured output
    schema: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;
    jsonSchema: object;
  };
  followUps?: string[]; // New field: references to other prompt IDs
  isShortcut?: boolean; // New field: for shortcut functionality (defaults to false)
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbPromptTemplate extends Omit<PromptTemplate, 'createdAt' | 'updatedAt'> {
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CompiledPrompt {
  content: string;
  selectedTools?: string[];
  selectedRules?: string[];
}

export interface PromptFormData {
  [key: string]: any;
} 