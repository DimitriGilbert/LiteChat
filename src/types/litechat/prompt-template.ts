export interface PromptVariable {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "array";
  required: boolean;
  default?: string;
  instructions?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  variables: PromptVariable[];
  prompt: string;
  tags: string[];
  tools?: string[]; // Tool names to auto-select
  rules?: string[]; // Rule names to auto-select
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