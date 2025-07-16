import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { VariableManager } from '@/controls/components/assistant-settings/common/VariableManager';
import type { BaseStepConfigProps } from './BaseStepConfig';

export const CustomPromptStepConfig: React.FC<BaseStepConfigProps> = ({
  step,
  onChange,
}) => {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`step-prompt-${step.id}`}>Prompt Content</Label>
        <Textarea
          id={`step-prompt-${step.id}`}
          value={step.promptContent || ''}
          onChange={(e) => onChange({ ...step, promptContent: e.target.value })}
          placeholder="Enter your custom prompt here..."
          rows={4}
        />
      </div>
      
      <div className="space-y-1">
        <Label>Input Variables</Label>
        <VariableManager
          variables={step.promptVariables || []}
          onVariablesChange={(variables) => onChange({ ...step, promptVariables: variables })}
          templateId={step.id}
        />
      </div>
    </div>
  );
};