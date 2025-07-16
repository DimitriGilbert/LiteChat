import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CodeEditor } from '@/components/LiteChat/common/CodeEditor';
import { VariableManager } from '@/controls/components/assistant-settings/common/VariableManager';
import type { BaseStepConfigProps } from './BaseStepConfig';

export const FunctionStepConfig: React.FC<BaseStepConfigProps> = ({
  step,
  onChange,
}) => {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Language</Label>
        <RadioGroup
          value={step.functionLanguage || 'js'}
          onValueChange={(value: 'js' | 'py') => onChange({ ...step, functionLanguage: value })}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="js" id={`${step.id}-js`} />
            <Label htmlFor={`${step.id}-js`}>JavaScript</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="py" id={`${step.id}-py`} />
            <Label htmlFor={`${step.id}-py`}>Python</Label>
          </div>
        </RadioGroup>
      </div>
      
      <div className="space-y-1">
        <Label>Function Code</Label>
        <CodeEditor
          value={step.functionCode || ''}
          onChange={(value) => onChange({ ...step, functionCode: value })}
          language={step.functionLanguage === 'py' ? 'python' : 'javascript'}
          placeholder={`Enter your ${step.functionLanguage === 'py' ? 'Python' : 'JavaScript'} function code here...`}
          minHeight="300px"
        />
      </div>
      
      <div className="space-y-1">
        <Label>Input Variables</Label>
        <VariableManager
          variables={step.functionVariables || []}
          onVariablesChange={(variables) => onChange({ ...step, functionVariables: variables })}
          templateId={step.id}
        />
      </div>
    </div>
  );
};