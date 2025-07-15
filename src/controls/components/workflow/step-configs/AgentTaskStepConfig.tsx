import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BaseStepConfigProps } from './BaseStepConfig';

export const AgentTaskStepConfig: React.FC<BaseStepConfigProps> = ({
  step,
  onChange,
  agentTasks,
}) => {
  return (
    <div className="space-y-1">
      <Label htmlFor={`step-template-${step.id}`}>Agent Task</Label>
      <Select
        value={step.templateId || ''}
        onValueChange={(value) => onChange({ ...step, templateId: value })}
      >
        <SelectTrigger id={`step-template-${step.id}`}>
          <SelectValue placeholder="Select an agent task" />
        </SelectTrigger>
        <SelectContent>
          {agentTasks.map(task => (
            <SelectItem key={task.id} value={task.id}>
              {task.prefixedName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};