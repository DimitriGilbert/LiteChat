import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BaseStepConfigProps } from './BaseStepConfig';

export const PromptStepConfig: React.FC<BaseStepConfigProps> = ({
  step,
  onChange,
  promptTemplates,
}) => {
  return (
    <div className="space-y-1">
      <Label htmlFor={`step-template-${step.id}`}>Template</Label>
      <Select
        value={step.templateId || ''}
        onValueChange={(value) => onChange({ ...step, templateId: value })}
      >
        <SelectTrigger id={`step-template-${step.id}`}>
          <SelectValue placeholder="Select a template" />
        </SelectTrigger>
        <SelectContent>
          {promptTemplates.map(template => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};