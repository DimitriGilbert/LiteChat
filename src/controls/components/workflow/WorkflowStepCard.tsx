import React, { useState } from 'react';
import type { WorkflowStep } from '@/types/litechat/workflow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PromptTemplate } from '@/types/litechat/prompt-template';
import type { ModelListItem } from '@/types/litechat/provider';
import { ModelSelector } from '@/controls/components/global-model-selector/ModelSelector';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkflowStepCardProps {
    step: WorkflowStep;
    onChange: (updatedStep: WorkflowStep) => void;
    onDelete: () => void;
    promptTemplates: PromptTemplate[];
    agentTasks: (PromptTemplate & { prefixedName: string })[];
    models: ModelListItem[];
}

export const WorkflowStepCard: React.FC<WorkflowStepCardProps> = ({ 
    step, 
    onChange, 
    onDelete, 
    promptTemplates, 
    agentTasks,
    models,
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
                        ({step.type === 'agent-task' ? 'Agent Task' : step.type === 'human-in-the-loop' ? 'Human Review' : 'AI Prompt'})
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
                    <div className="space-y-1">
                        <Label>Model</Label>
                        <ModelSelector
                            value={step.modelId}
                            onChange={(value) => onChange({ ...step, modelId: value || undefined })}
                            models={models}
                            className="w-full"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`step-type-${step.id}`}>Step Type</Label>
                        <Select
                            value={step.type}
                            onValueChange={(value) => onChange({ ...step, type: value as WorkflowStep['type'], templateId: undefined, prompt: undefined, structuredOutput: undefined })}
                        >
                            <SelectTrigger id={`step-type-${step.id}`}>
                                <SelectValue placeholder="Select step type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="prompt">AI Prompt (from Template)</SelectItem>
                                <SelectItem value="agent-task">Agent Task (from Template)</SelectItem>
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
                </div>
            )}
        </div>
    );
}; 