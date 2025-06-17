import React from 'react';
import type { WorkflowStep } from '@/types/litechat/workflow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PromptTemplate } from '@/types/litechat/prompt-template';

interface WorkflowStepCardProps {
    step: WorkflowStep;
    onChange: (updatedStep: WorkflowStep) => void;
    promptTemplates: PromptTemplate[];
    agentTasks: PromptTemplate[];
}

export const WorkflowStepCard: React.FC<WorkflowStepCardProps> = ({ step, onChange, promptTemplates, agentTasks }) => {
    
    const templatesToShow = step.type === 'prompt' ? promptTemplates : agentTasks;

    return (
        <div className="p-4 border rounded-lg space-y-3 bg-muted/20">
            <div className="space-y-1">
                <Label htmlFor={`step-name-${step.id}`}>Step Name</Label>
                <Input
                    id={`step-name-${step.id}`}
                    value={step.name}
                    onChange={(e) => onChange({ ...step, name: e.target.value })}
                />
            </div>
            <div className="space-y-1">
                <Label htmlFor={`step-type-${step.id}`}>Step Type</Label>
                <Select
                    value={step.type}
                    onValueChange={(value) => onChange({ ...step, type: value as WorkflowStep['type'], templateId: undefined })}
                >
                    <SelectTrigger id={`step-type-${step.id}`}>
                        <SelectValue placeholder="Select step type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="prompt">AI Prompt</SelectItem>
                        <SelectItem value="agent-task">Agent Task</SelectItem>
                        <SelectItem value="human-in-the-loop">Human in the Loop</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {(step.type === 'prompt' || step.type === 'agent-task') && (
                <div className="space-y-1">
                    <Label htmlFor={`step-template-${step.id}`}>Template</Label>
                    <Select
                        value={step.templateId}
                        onValueChange={(value) => onChange({ ...step, templateId: value })}
                    >
                        <SelectTrigger id={`step-template-${step.id}`}>
                            <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                            {templatesToShow.map(template => (
                                <SelectItem key={template.id} value={template.id}>
                                    {template.name}
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
    );
}; 