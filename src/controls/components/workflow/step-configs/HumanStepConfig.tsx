import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { BaseStepConfigProps } from './BaseStepConfig';

export const HumanStepConfig: React.FC<BaseStepConfigProps> = ({
  step,
  onChange,
}) => {
  return (
    <div className="space-y-1">
      <Label htmlFor={`step-instructions-${step.id}`}>Instructions for Human</Label>
      <Textarea
        id={`step-instructions-${step.id}`}
        value={step.instructionsForHuman || ''}
        onChange={(e) => onChange({ ...step, instructionsForHuman: e.target.value })}
        placeholder="Provide instructions for the human reviewer..."
        rows={3}
      />
    </div>
  );
};