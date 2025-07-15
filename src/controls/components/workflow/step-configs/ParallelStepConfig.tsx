import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { nanoid } from 'nanoid';
import type { BaseStepConfigProps } from './BaseStepConfig';
import type { WorkflowStep } from '@/types/litechat/workflow';

export const ParallelStepConfig: React.FC<BaseStepConfigProps> = ({
  step,
  onChange,
  promptTemplates,
  agentTasks,
  models,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const createDefaultParallelStep = (): WorkflowStep => ({
    id: nanoid(),
    name: 'Parallel Task',
    type: 'prompt',
    templateId: '',
  });

  const updateParallelStep = (updatedParallelStep: WorkflowStep) => {
    onChange({ ...step, parallelStep: updatedParallelStep });
  };

  const parallelStep = step.parallelStep || createDefaultParallelStep();

  return (
    <div className="space-y-4">
      {/* Array Variable Configuration */}
      <div className="space-y-2">
        <Label htmlFor={`step-parallel-on-${step.id}`}>Array Variable</Label>
        <Input
          id={`step-parallel-on-${step.id}`}
          value={step.parallelOn || ''}
          onChange={(e) => onChange({ ...step, parallelOn: e.target.value })}
          placeholder="$.outputs[0].items or $.initial_step.data_array"
          className="font-mono text-sm"
        />
        <div className="text-xs text-muted-foreground">
          JSONPath to an array in previous step outputs. Each array item will be processed in parallel.
        </div>
      </div>

      {/* Model Variable Configuration (Optional) */}
      <div className="space-y-2">
        <Label htmlFor={`step-parallel-model-var-${step.id}`}>Model Variable (Optional)</Label>
        <Input
          id={`step-parallel-model-var-${step.id}`}
          value={step.parallelModelVar || ''}
          onChange={(e) => onChange({ ...step, parallelModelVar: e.target.value })}
          placeholder="Leave empty or specify variable name"
          className="font-mono text-sm"
        />
        <div className="text-xs text-muted-foreground">
          If set, each array item will be used as the model ID for that parallel branch (race behavior).
        </div>
      </div>

      {/* Parallel Step Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Parallel Step Configuration</CardTitle>
              <CardDescription className="text-xs">
                This step will be executed for each item in the array
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        
        {isExpanded && (
          <CardContent className="pt-0 space-y-3">
            {/* Step Name */}
            <div className="space-y-1">
              <Label htmlFor={`parallel-step-name-${step.id}`}>Step Name</Label>
              <Input
                id={`parallel-step-name-${step.id}`}
                value={parallelStep.name}
                onChange={(e) => updateParallelStep({ ...parallelStep, name: e.target.value })}
                placeholder="Enter step name"
              />
            </div>

            {/* Step Type */}
            <div className="space-y-1">
              <Label htmlFor={`parallel-step-type-${step.id}`}>Step Type</Label>
              <Select
                value={parallelStep.type}
                onValueChange={(value: any) => updateParallelStep({ ...parallelStep, type: value })}
              >
                <SelectTrigger id={`parallel-step-type-${step.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prompt">AI Prompt (from Template)</SelectItem>
                  <SelectItem value="agent-task">Agent Task (from Template)</SelectItem>
                  <SelectItem value="custom-prompt">Custom Prompt</SelectItem>
                  <SelectItem value="tool-call">Tool Call</SelectItem>
                  <SelectItem value="function">Function</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model Selection */}
            <div className="space-y-1">
              <Label htmlFor={`parallel-step-model-${step.id}`}>Model (Optional)</Label>
              <Select
                value={parallelStep.modelId || ''}
                onValueChange={(value) => updateParallelStep({ ...parallelStep, modelId: value || undefined })}
              >
                <SelectTrigger id={`parallel-step-model-${step.id}`}>
                  <SelectValue placeholder="Use default model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Use default model</SelectItem>
                  {models.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {model.providerId}
                        </Badge>
                        {model.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template Selection for prompt/agent-task types */}
            {(parallelStep.type === 'prompt' || parallelStep.type === 'agent-task') && (
              <div className="space-y-1">
                <Label htmlFor={`parallel-step-template-${step.id}`}>Template</Label>
                <Select
                  value={parallelStep.templateId || ''}
                  onValueChange={(value) => updateParallelStep({ ...parallelStep, templateId: value })}
                >
                  <SelectTrigger id={`parallel-step-template-${step.id}`}>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {(parallelStep.type === 'prompt' ? promptTemplates : agentTasks).map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {parallelStep.type === 'agent-task' ? (template as any).prefixedName : template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Custom Prompt Content for custom-prompt type */}
            {parallelStep.type === 'custom-prompt' && (
              <div className="space-y-1">
                <Label htmlFor={`parallel-step-content-${step.id}`}>Prompt Content</Label>
                <textarea
                  id={`parallel-step-content-${step.id}`}
                  value={parallelStep.promptContent || ''}
                  onChange={(e) => updateParallelStep({ ...parallelStep, promptContent: e.target.value })}
                  placeholder="Enter your custom prompt here..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Context Information */}
      <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded border">
        <strong>Available in Parallel Step:</strong>
        <br />• Each array item will be available as a template variable
        <br />• <code>branchIndex</code> - Index of current parallel branch (0, 1, 2, ...)
        <br />• <code>totalBranches</code> - Total number of parallel branches
        <br />• All previous workflow step outputs are also available
      </div>
    </div>
  );
};