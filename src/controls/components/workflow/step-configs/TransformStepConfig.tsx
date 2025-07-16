import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { BaseStepConfigProps } from './BaseStepConfig';

export const TransformStepConfig: React.FC<BaseStepConfigProps> = ({
  step,
  onChange,
  promptTemplates,
  agentTasks,
  workflow,
  stepIndex,
}) => {
  // JSON query validation helper
  const validateJsonQuery = (query: string) => {
    if (!query) return { isValid: true, result: undefined };
    
    try {
      // Simple validation for JSONPath-like queries
      if (query.startsWith('$.')) {
        return { isValid: true, result: 'JSONPath query' };
      }
      return { isValid: false, error: 'Query must start with $.' };
    } catch (error) {
      return { isValid: false, error: 'Invalid query format' };
    }
  };

  // Get the next step to determine required fields
  const nextStepIndex = (stepIndex ?? 0) + 1;
  const nextStep = workflow?.steps?.[nextStepIndex];
  let requiredFields: Array<{name: string; type: string; description?: string; required?: boolean}> = [];
  
  if (nextStep?.templateId) {
    if (nextStep.type === 'prompt') {
      const template = promptTemplates.find(t => t.id === nextStep.templateId);
      requiredFields = template?.variables || [];
    } else if (nextStep.type === 'agent-task') {
      const task = agentTasks.find(t => t.id === nextStep.templateId);
      requiredFields = task?.variables || [];
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Data Transformations</Label>
      </div>
      
      <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded border">
        <strong>Available Context:</strong>
        <br />• <code>$.workflow</code> - Original workflow template (name, steps, etc.)
        <br />• <code>$.initial_step</code> - Initial user input/prompt output
        <br />• <code>$.outputs[0]</code> - Initial step output (same as $.initial_step)
        <br />• <code>$.outputs[1]</code>, <code>$.outputs[2]</code>, etc. - Previous step outputs by index
        <br />• <strong>Static values:</strong> Use <code>"literal text"</code> or <code>123</code> for static data
      </div>

      {requiredFields.length === 0 ? (
        <div className="text-center text-muted-foreground py-4 border-2 border-dashed border-border rounded-lg">
          {nextStep ? 
            `Next step "${nextStep.name}" has no template variables to configure.` :
            'No next step found. Transform steps need a following step with template variables.'
          }
        </div>
      ) : (
        requiredFields.map((field) => {
          const currentQuery = step.transformMappings?.[field.name] || '';
          const validation = validateJsonQuery(currentQuery);
          const isStaticValue = currentQuery && (
            (currentQuery.startsWith('"') && currentQuery.endsWith('"')) ||
            !isNaN(Number(currentQuery)) ||
            currentQuery === 'true' ||
            currentQuery === 'false'
          );
          
          return (
            <div key={field.name} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-sm font-medium">{field.name}</Label>
                  {field.required && <span className="text-destructive ml-1">*</span>}
                  {field.description && (
                    <div className="text-xs text-muted-foreground mt-1">{field.description}</div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  {field.type}
                </div>
              </div>
              <div>
                <Label className="text-xs">JSON Query or Static Value</Label>
                <Input
                  value={currentQuery}
                  onChange={(e) => {
                    const newMappings = { ...(step.transformMappings || {}) };
                    newMappings[field.name] = e.target.value;
                    onChange({ ...step, transformMappings: newMappings });
                  }}
                  placeholder={`$.initial_step.${field.name} or "static text" or 123`}
                  className={`h-8 ${
                    !validation.isValid && !isStaticValue ? 'border-destructive' : 
                    (validation.result !== undefined || isStaticValue) ? 'border-primary' : ''
                  }`}
                />
                {!validation.isValid && !isStaticValue && (
                  <div className="text-xs text-destructive mt-1">{validation.error}</div>
                )}
                {isStaticValue && (
                  <div className="text-xs text-primary mt-1 p-2 bg-primary/10 border border-primary/20 rounded">
                    <strong>Static value:</strong> {currentQuery}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};