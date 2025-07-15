import React, { useState } from 'react';
import type { WorkflowStep } from '@/types/litechat/workflow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PromptTemplate } from '@/types/litechat/prompt-template';
import type { ModelListItem } from '@/types/litechat/provider';
import { ModelSelector } from '@/controls/components/global-model-selector/ModelSelector';
import { ChevronDown, ChevronRight, Trash2, GripVertical, ArrowUp, ArrowDown, ChevronsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionTooltipButton } from '@/components/LiteChat/common/ActionTooltipButton';
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Badge } from '@/components/ui/badge';

// Import all step configuration components
import {
  PromptStepConfig,
  AgentTaskStepConfig,
  CustomPromptStepConfig,
  ToolCallStepConfig,
  FunctionStepConfig,
  HumanStepConfig,
  TransformStepConfig,
  ParallelStepConfig,
  SubWorkflowStepConfig,
  type BaseStepConfigProps
} from './step-configs';

interface WorkflowStepCardProps {
    step: WorkflowStep;
    onChange: (updatedStep: WorkflowStep) => void;
    onDelete: () => void;
    onMoveToTop?: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    promptTemplates: PromptTemplate[];
    agentTasks: (PromptTemplate & { prefixedName: string })[];
    models: ModelListItem[];
    tools?: Array<{ name: string; description?: string }>;
    module?: any;
    workflow?: any;
    stepIndex?: number;
    isFirst?: boolean;
    isLast?: boolean;
    isDragDisabled?: boolean;
}

export const WorkflowStepCard: React.FC<WorkflowStepCardProps> = ({ 
    step, 
    onChange, 
    onDelete, 
    onMoveToTop,
    onMoveUp,
    onMoveDown,
    promptTemplates, 
    agentTasks,
    models,
    tools = [],
    module,
    workflow,
    stepIndex,
    isFirst = false,
    isLast = false,
    isDragDisabled = false,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ 
        id: step.id,
        disabled: isDragDisabled,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    // Step type display names
    const getStepTypeDisplayName = (type: string) => {
        const typeMap: Record<string, string> = {
            'prompt': 'AI Prompt',
            'agent-task': 'Agent Task',
            'custom-prompt': 'Custom Prompt',
            'tool-call': 'Tool Call',
            'function': 'Function',
            'transform': 'Data Transform',
            'human-in-the-loop': 'Human Review',
            'parallel': 'Parallel Execution',
            'sub-workflow': 'Sub-Workflow',
        };
        return typeMap[type] || type;
    };

    // Get step type color
    const getStepTypeColor = (type: string) => {
        const colorMap: Record<string, string> = {
            'prompt': 'bg-blue-100 text-blue-800 border-blue-200',
            'agent-task': 'bg-purple-100 text-purple-800 border-purple-200',
            'custom-prompt': 'bg-green-100 text-green-800 border-green-200',
            'tool-call': 'bg-orange-100 text-orange-800 border-orange-200',
            'function': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'transform': 'bg-cyan-100 text-cyan-800 border-cyan-200',
            'human-in-the-loop': 'bg-pink-100 text-pink-800 border-pink-200',
            'parallel': 'bg-indigo-100 text-indigo-800 border-indigo-200',
            'sub-workflow': 'bg-violet-100 text-violet-800 border-violet-200',
        };
        return colorMap[type] || 'bg-gray-100 text-gray-800 border-gray-200';
    };

    // Render step-specific configuration
    const renderStepConfig = () => {
        const baseProps: BaseStepConfigProps = {
            step,
            onChange,
            promptTemplates,
            agentTasks,
            models,
            tools,
            module,
            workflow,
            stepIndex,
        };

        switch (step.type) {
            case 'prompt':
                return <PromptStepConfig {...baseProps} />;
            case 'agent-task':
                return <AgentTaskStepConfig {...baseProps} />;
            case 'custom-prompt':
                return <CustomPromptStepConfig {...baseProps} />;
            case 'tool-call':
                return <ToolCallStepConfig {...baseProps} />;
            case 'function':
                return <FunctionStepConfig {...baseProps} />;
            case 'human-in-the-loop':
                return <HumanStepConfig {...baseProps} />;
            case 'transform':
                return <TransformStepConfig {...baseProps} />;
            case 'parallel':
                return <ParallelStepConfig {...baseProps} />;
            case 'sub-workflow':
                return <SubWorkflowStepConfig {...baseProps} />;
            default:
                return (
                    <div className="text-center text-muted-foreground py-4">
                        Unknown step type: {step.type}
                    </div>
                );
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "border border-border rounded-lg bg-card shadow-sm",
                isDragging && "opacity-50 shadow-lg"
            )}
        >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border">
                {/* Drag Handle */}
                {!isDragDisabled && (
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                    >
                        <GripVertical className="h-4 w-4" />
                    </div>
                )}

                {/* Step Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn("text-xs font-medium", getStepTypeColor(step.type))}>
                            {getStepTypeDisplayName(step.type)}
                        </Badge>
                        {step.modelId && (
                            <Badge variant="outline" className="text-xs">
                                {models.find(m => m.id === step.modelId)?.name || step.modelId}
                            </Badge>
                        )}
                    </div>
                    <h3 className="font-medium text-sm truncate">{step.name}</h3>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    {/* Move buttons */}
                    {onMoveToTop && !isFirst && (
                        <ActionTooltipButton
                            tooltipText="Move to Top"
                            onClick={onMoveToTop}
                            icon={<ChevronsUp />}
                            className="h-7 w-7"
                            variant="ghost"
                        />
                    )}
                    {onMoveUp && !isFirst && (
                        <ActionTooltipButton
                            tooltipText="Move Up"
                            onClick={onMoveUp}
                            icon={<ArrowUp />}
                            className="h-7 w-7"
                            variant="ghost"
                        />
                    )}
                    {onMoveDown && !isLast && (
                        <ActionTooltipButton
                            tooltipText="Move Down"
                            onClick={onMoveDown}
                            icon={<ArrowDown />}
                            className="h-7 w-7"
                            variant="ghost"
                        />
                    )}

                    {/* Expand/Collapse */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="h-7 w-7 p-0"
                    >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>

                    {/* Delete */}
                    <ActionTooltipButton
                        tooltipText="Delete Step"
                        onClick={onDelete}
                        icon={<Trash2 />}
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        variant="ghost"
                    />
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="p-4 space-y-4">
                    {/* Basic Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Step Name */}
                        <div className="space-y-1">
                            <Label htmlFor={`step-name-${step.id}`}>Step Name</Label>
                            <Input
                                id={`step-name-${step.id}`}
                                value={step.name}
                                onChange={(e) => onChange({ ...step, name: e.target.value })}
                                placeholder="Enter step name"
                            />
                        </div>

                        {/* Step Type */}
                        <div className="space-y-1">
                            <Label htmlFor={`step-type-${step.id}`}>Step Type</Label>
                            <Select
                                value={step.type}
                                onValueChange={(value: any) => onChange({ ...step, type: value })}
                            >
                                <SelectTrigger id={`step-type-${step.id}`}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="prompt">AI Prompt (from Template)</SelectItem>
                                    <SelectItem value="agent-task">Agent Task (from Template)</SelectItem>
                                    <SelectItem value="custom-prompt">Custom Prompt</SelectItem>
                                    <SelectItem value="tool-call">Tool Call</SelectItem>
                                    <SelectItem value="function">Function</SelectItem>
                                    <SelectItem value="transform">Data Transform</SelectItem>
                                    <SelectItem value="human-in-the-loop">Human in the Loop</SelectItem>
                                    <SelectItem value="parallel">Parallel Execution</SelectItem>
                                    <SelectItem value="sub-workflow">Sub-Workflow</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Model Selection (for AI steps) */}
                    {(step.type === 'prompt' || step.type === 'agent-task' || step.type === 'custom-prompt') && (
                        <div className="space-y-1">
                            <Label>Model</Label>
                            <ModelSelector
                                value={step.modelId}
                                onChange={(modelId) => onChange({ ...step, modelId: modelId || undefined })}
                                models={models}
                            />
                        </div>
                    )}

                    {/* Step-Specific Configuration */}
                    {renderStepConfig()}
                </div>
            )}
        </div>
    );
};