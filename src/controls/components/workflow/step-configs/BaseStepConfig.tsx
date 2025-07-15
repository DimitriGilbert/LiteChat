import React from 'react';
import type { WorkflowStep } from '@/types/litechat/workflow';
import type { PromptTemplate } from '@/types/litechat/prompt-template';
import type { ModelListItem } from '@/types/litechat/provider';

export interface BaseStepConfigProps {
  step: WorkflowStep;
  onChange: (updatedStep: WorkflowStep) => void;
  promptTemplates: PromptTemplate[];
  agentTasks: (PromptTemplate & { prefixedName: string })[];
  models: ModelListItem[];
  tools?: Array<{ name: string; description?: string }>;
  module?: any;
  workflow?: any;
  stepIndex?: number;
}

export interface StepConfigComponent {
  (props: BaseStepConfigProps): React.ReactElement;
}