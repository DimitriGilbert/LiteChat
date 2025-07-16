import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { PersistenceService } from '@/services/persistence.service';
import type { BaseStepConfigProps } from './BaseStepConfig';
import type { WorkflowTemplate } from '@/types/litechat/workflow';

export const SubWorkflowStepConfig: React.FC<BaseStepConfigProps> = ({
  step,
  onChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [availableWorkflows, setAvailableWorkflows] = useState<WorkflowTemplate[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTemplate | null>(null);

  // Load available workflows
  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const workflows = await PersistenceService.loadWorkflows();
        setAvailableWorkflows(workflows);
        
        // Find selected workflow if one is set
        if (step.subWorkflowTemplateId) {
          const workflow = workflows.find(w => w.id === step.subWorkflowTemplateId);
          setSelectedWorkflow(workflow || null);
        }
      } catch (error) {
        console.error('Failed to load workflows:', error);
      }
    };
    
    loadWorkflows();
  }, [step.subWorkflowTemplateId]);

  const handleWorkflowChange = (workflowId: string) => {
    const workflow = availableWorkflows.find(w => w.id === workflowId);
    setSelectedWorkflow(workflow || null);
    onChange({ ...step, subWorkflowTemplateId: workflowId });
  };

  const addInputMapping = () => {
    const newMappings = { ...(step.subWorkflowInputMapping || {}) };
    newMappings[`variable_${Object.keys(newMappings).length + 1}`] = '';
    onChange({ ...step, subWorkflowInputMapping: newMappings });
  };

  const updateInputMapping = (oldKey: string, newKey: string, value: string) => {
    const newMappings = { ...(step.subWorkflowInputMapping || {}) };
    if (oldKey !== newKey) {
      delete newMappings[oldKey];
    }
    newMappings[newKey] = value;
    onChange({ ...step, subWorkflowInputMapping: newMappings });
  };

  const removeInputMapping = (key: string) => {
    const newMappings = { ...(step.subWorkflowInputMapping || {}) };
    delete newMappings[key];
    onChange({ ...step, subWorkflowInputMapping: newMappings });
  };

  return (
    <div className="space-y-4">
      {/* Sub-Workflow Selection */}
      <div className="space-y-2">
        <Label htmlFor={`step-subworkflow-${step.id}`}>Sub-Workflow</Label>
        <Select
          value={step.subWorkflowTemplateId || ''}
          onValueChange={handleWorkflowChange}
        >
          <SelectTrigger id={`step-subworkflow-${step.id}`}>
            <SelectValue placeholder="Select a workflow to run as sub-workflow" />
          </SelectTrigger>
          <SelectContent>
            {availableWorkflows.map(workflow => (
              <SelectItem key={workflow.id} value={workflow.id}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {workflow.steps.length} steps
                  </Badge>
                  {workflow.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedWorkflow && (
          <div className="text-xs text-muted-foreground">
            {selectedWorkflow.description}
          </div>
        )}
      </div>

      {/* Input Variable Mapping */}
      {selectedWorkflow && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Input Variable Mapping</CardTitle>
                <CardDescription className="text-xs">
                  Map data from parent workflow to sub-workflow variables
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
              {/* Existing mappings */}
              {Object.entries(step.subWorkflowInputMapping || {}).map(([varName, query]) => (
                <div key={varName} className="flex items-center gap-2 p-2 border border-border rounded">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Sub-workflow Variable</Label>
                    <Input
                      value={varName}
                      onChange={(e) => updateInputMapping(varName, e.target.value, query)}
                      placeholder="variable_name"
                      className="h-8 font-mono text-sm"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Source (JSONPath or Static)</Label>
                    <Input
                      value={query}
                      onChange={(e) => updateInputMapping(varName, varName, e.target.value)}
                      placeholder='$.outputs[0].result or "static value"'
                      className="h-8 font-mono text-sm"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeInputMapping(varName)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {/* Add new mapping button */}
              <Button
                variant="outline"
                size="sm"
                onClick={addInputMapping}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Input Mapping
              </Button>

              {/* Help text */}
              <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded border">
                <strong>Available Sources:</strong>
                <br />• <code>$.initial_step</code> - Initial user input/prompt output
                <br />• <code>$.outputs[0]</code>, <code>$.outputs[1]</code>, etc. - Previous step outputs
                <br />• <code>"static text"</code> - Static string values
                <br />• <code>123</code> - Static numeric values
                <br />• <code>true</code>/<code>false</code> - Static boolean values
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Sub-workflow Info */}
      {selectedWorkflow && (
        <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded border">
          <strong>Sub-workflow "{selectedWorkflow.name}" will:</strong>
          <br />• Run as an isolated workflow with {selectedWorkflow.steps.length} steps
          <br />• Receive mapped variables as input
          <br />• Return the final step's output to the parent workflow
          <br />• Appear as a child interaction in the conversation
        </div>
      )}
    </div>
  );
};