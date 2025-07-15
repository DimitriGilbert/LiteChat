import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { BaseStepConfigProps } from './BaseStepConfig';

export const ToolCallStepConfig: React.FC<BaseStepConfigProps> = ({
  step,
  onChange,
  tools = [],
}) => {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`step-tool-${step.id}`}>Tool</Label>
        <Select
          value={step.toolName || ''}
          onValueChange={(value) => onChange({ ...step, toolName: value })}
        >
          <SelectTrigger id={`step-tool-${step.id}`}>
            <SelectValue placeholder="Select a tool" />
          </SelectTrigger>
          <SelectContent>
            {tools.map(tool => (
              <SelectItem key={tool.name} value={tool.name}>
                {tool.name} {tool.description && `- ${tool.description}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-1">
        <Label htmlFor={`step-tool-args-${step.id}`}>Static Arguments (JSON)</Label>
        <Textarea
          id={`step-tool-args-${step.id}`}
          value={step.toolArgs ? JSON.stringify(step.toolArgs, null, 2) : '{}'}
          onChange={(e) => {
            try {
              const args = JSON.parse(e.target.value);
              onChange({ ...step, toolArgs: args });
            } catch {
              // Invalid JSON, don't update
            }
          }}
          placeholder='{"key": "value"}'
          rows={3}
        />
      </div>
    </div>
  );
};