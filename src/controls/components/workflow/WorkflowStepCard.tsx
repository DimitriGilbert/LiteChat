import React, { useState } from 'react';
import type { WorkflowStep } from '@/types/litechat/workflow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PromptTemplate } from '@/types/litechat/prompt-template';
import type { ModelListItem } from '@/types/litechat/provider';
import { ModelSelector } from '@/controls/components/global-model-selector/ModelSelector';
import { ChevronDown, ChevronRight, Trash2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkflowStepCardProps {
    step: WorkflowStep;
    onChange: (updatedStep: WorkflowStep) => void;
    onDelete: () => void;
    promptTemplates: PromptTemplate[];
    agentTasks: (PromptTemplate & { prefixedName: string })[];
    models: ModelListItem[];
    module?: any; // Add module for validation
    workflow?: any; // Add workflow context for validation
    stepIndex?: number; // Add step index for validation
}

export const WorkflowStepCard: React.FC<WorkflowStepCardProps> = ({ 
    step, 
    onChange, 
    onDelete, 
    promptTemplates, 
    agentTasks,
    models,
    module,
    workflow,
    stepIndex,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    
    const templatesToShow = step.type === 'prompt' 
        ? promptTemplates 
        : step.type === 'agent-task'
            ? agentTasks
            : [];

    const handleTemplateChange = (templateId: string) => {
        // Only store reference - NO data duplication
        onChange({
            ...step,
            templateId: templateId,
            // Remove duplicated fields - get from template at runtime
            prompt: undefined,
            structuredOutput: undefined,
        });
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        onChange({ ...step, name: newName });
    };

    // Transform mappings handlers
    const handleTransformMappingAdd = () => {
        const newMappings = { ...(step.transformMappings || {}), 'new_field': '$.previous_step' };
        onChange({ ...step, transformMappings: newMappings });
    };

    const handleTransformMappingRemove = (fieldName: string) => {
        const newMappings = { ...(step.transformMappings || {}) };
        delete newMappings[fieldName];
        onChange({ ...step, transformMappings: newMappings });
    };

    const handleTransformMappingChange = (oldFieldName: string, newFieldName: string, query: string) => {
        const newMappings = { ...(step.transformMappings || {}) };
        if (oldFieldName !== newFieldName) {
            delete newMappings[oldFieldName];
        }
        newMappings[newFieldName] = query;
        onChange({ ...step, transformMappings: newMappings });
    };

    // Validate JSON query
    const validateJsonQuery = (query: string): { isValid: boolean; error?: string; result?: any } => {
        if (module?.validateTransformQuery) {
            return module.validateTransformQuery(query, workflow, stepIndex);
        }
        
        // Fallback validation if module is not available
        if (!query.trim()) {
            return { isValid: false, error: 'Query cannot be empty' };
        }
        
        // Basic JSONPath validation
        if (!query.startsWith('$.')) {
            return { isValid: false, error: 'Query must start with "$."' };
        }
        
        // Check for invalid characters or patterns
        const invalidChars = /[^a-zA-Z0-9_.$\[\]]/;
        if (invalidChars.test(query.replace(/\[(\d+)\]/g, ''))) {
            return { isValid: false, error: 'Invalid characters in query' };
        }
        
        return { isValid: true };
    };

    const getStepTypeLabel = () => {
        switch (step.type) {
            case 'agent-task': return 'Agent Task';
            case 'human-in-the-loop': return 'Human Review';
            case 'transform': return 'Data Transform';
            default: return 'AI Prompt';
        }
    };
    
    return (
        <div className="border rounded-lg bg-muted/20">
            {/* Header - always visible */}
            <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-2 flex-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                    <div className="font-medium">{step.name}</div>
                    <div className="text-sm text-muted-foreground">
                        ({getStepTypeLabel()})
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {step.modelId && (
                        <div className="text-xs text-muted-foreground">
                            {step.modelId}
                        </div>
                    )}
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent expanding/collapsing
                            onDelete();
                        }}
                        title="Delete step"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Expandable content */}
            {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t">
                    <div className="space-y-1 pt-3">
                        <Label htmlFor={`step-name-${step.id}`}>Step Name</Label>
                        <Input
                            id={`step-name-${step.id}`}
                            value={step.name}
                            onChange={handleNameChange}
                        />
                    </div>
                    {step.type !== 'transform' && step.type !== 'human-in-the-loop' && (
                        <div className="space-y-1">
                            <Label>Model</Label>
                            <ModelSelector
                                value={step.modelId}
                                onChange={(value) => onChange({ ...step, modelId: value || undefined })}
                                models={models}
                                className="w-full"
                            />
                        </div>
                    )}
                    <div className="space-y-1">
                        <Label htmlFor={`step-type-${step.id}`}>Step Type</Label>
                        <Select
                            value={step.type}
                            onValueChange={(value) => onChange({ 
                                ...step, 
                                type: value as WorkflowStep['type'], 
                                templateId: undefined, 
                                prompt: undefined, 
                                structuredOutput: undefined,
                                transformMappings: value === 'transform' ? {} : undefined,
                                instructionsForHuman: value === 'human-in-the-loop' ? '' : undefined,
                            })}
                        >
                            <SelectTrigger id={`step-type-${step.id}`}>
                                <SelectValue placeholder="Select step type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="prompt">AI Prompt (from Template)</SelectItem>
                                <SelectItem value="agent-task">Agent Task (from Template)</SelectItem>
                                <SelectItem value="transform">Data Transform</SelectItem>
                                <SelectItem value="human-in-the-loop">Human in the Loop</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {(step.type === 'prompt' || step.type === 'agent-task') && (
                        <div className="space-y-1">
                            <Label htmlFor={`step-template-${step.id}`}>Template</Label>
                            <Select
                                value={step.templateId || ''}
                                onValueChange={handleTemplateChange}
                            >
                                <SelectTrigger id={`step-template-${step.id}`}>
                                    <SelectValue placeholder="Select a template" />
                                </SelectTrigger>
                                <SelectContent>
                                    {templatesToShow.map(template => (
                                        <SelectItem key={template.id} value={template.id}>
                                            {step.type === 'agent-task' ? (template as any).prefixedName : template.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {step.type === 'human-in-the-loop' && (
                        <div className="space-y-1">
                            <Label htmlFor={`step-instructions-${step.id}`}>Instructions for Human</Label>
                            <Input
                                id={`step-instructions-${step.id}`}
                                value={step.instructionsForHuman || ''}
                                onChange={(e) => onChange({ ...step, instructionsForHuman: e.target.value })}
                                placeholder="e.g., 'Review and approve the summary.'"
                            />
                        </div>
                    )}
                    {step.type === 'transform' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Data Transformations</Label>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm"
                                    onClick={handleTransformMappingAdd}
                                    className="h-8 px-2"
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Field
                                </Button>
                            </div>
                            
                            <div className="text-xs text-muted-foreground p-2 bg-blue-50 rounded">
                                <strong>Available Context:</strong>
                                <br />• <code>$.workflow</code> - Workflow template data
                                <br />• <code>$.trigger</code> - Initial trigger output
                                <br />• <code>$.step0</code>, <code>$.step1</code>, etc. - Previous step outputs
                                <br />• <code>$.currentStepId</code>, <code>$.previousStepId</code>, <code>$.nextStepId</code> - Step references
                            </div>

                            {Object.entries(step.transformMappings || {}).map(([fieldName, query]) => {
                                const validation = validateJsonQuery(query);
                                return (
                                    <div key={fieldName} className="border rounded-lg p-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <Label className="text-xs">Field Name</Label>
                                                <Input
                                                    value={fieldName}
                                                    onChange={(e) => handleTransformMappingChange(fieldName, e.target.value, query)}
                                                    placeholder="output_field_name"
                                                    className="h-8"
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleTransformMappingRemove(fieldName)}
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div>
                                            <Label className="text-xs">JSON Query</Label>
                                            <Input
                                                value={query}
                                                onChange={(e) => handleTransformMappingChange(fieldName, fieldName, e.target.value)}
                                                placeholder="$.previous_step.field_name"
                                                className={`h-8 ${!validation.isValid ? 'border-red-500' : validation.result !== undefined ? 'border-green-500' : ''}`}
                                            />
                                            {!validation.isValid && (
                                                <div className="text-xs text-red-500 mt-1">{validation.error}</div>
                                            )}
                                            {validation.isValid && validation.result !== undefined && (
                                                <div className="text-xs text-green-600 mt-1 p-2 bg-green-50 rounded">
                                                    <strong>Sample result:</strong> {JSON.stringify(validation.result)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {(!step.transformMappings || Object.keys(step.transformMappings).length === 0) && (
                                <div className="text-center text-muted-foreground py-4 border-2 border-dashed rounded-lg">
                                    No transformations configured. Add fields to transform data from previous steps.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}; 