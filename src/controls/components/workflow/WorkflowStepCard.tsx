import React, { useState } from 'react';
import type { WorkflowStep } from '@/types/litechat/workflow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PromptTemplate } from '@/types/litechat/prompt-template';
import type { ModelListItem } from '@/types/litechat/provider';
import { ModelSelector } from '@/controls/components/global-model-selector/ModelSelector';
import { ChevronDown, ChevronRight, Trash2, GripVertical, ArrowUp, ArrowDown, ChevronsUp, Pen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionTooltipButton } from '@/components/LiteChat/common/ActionTooltipButton';
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CodeEditor } from '@/components/LiteChat/common/CodeEditor';
import { VariableManager } from '@/controls/components/assistant-settings/common/VariableManager';

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
    tools?: Array<{ name: string; description?: string }>; // Available tools for tool-call steps
    module?: any; // Add module for validation
    workflow?: any; // Add workflow context for validation
    stepIndex?: number; // Add step index for validation
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
    const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
    const [editingVariable, setEditingVariable] = React.useState<any>(null);
    
    // Drag and drop functionality
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ 
        id: step.id, 
        disabled: isDragDisabled 
    });

    // console.log('🐛 [WorkflowStepCard] Render:', {
    //     stepId: step.id,
    //     stepName: step.name,
    //     isDragDisabled,
    //     isDragging,
    //     hasListeners: !!listeners,
    //     hasAttributes: !!attributes,
    //     transform: transform ? `${transform.x}, ${transform.y}` : 'none'
    // });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 9999 : undefined,
        position: isDragging ? ('relative' as const) : undefined,
    };
    
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
            case 'custom-prompt': return 'Custom Prompt';
            case 'tool-call': return 'Tool Call';
            case 'function': return 'Function';
            case 'human-in-the-loop': return 'Human Review';
            case 'transform': return 'Data Transform';
            default: return 'AI Prompt';
        }
    };
    
    return (
        <div 
            ref={setNodeRef}
            style={style}
            className={cn(
                "border rounded-lg bg-muted/20",
                isDragging && "shadow-2xl border-primary bg-card opacity-75 transform scale-105",
                !isDragDisabled && "cursor-grab active:cursor-grabbing",
                isDragDisabled && "cursor-default"
            )}
            aria-label={`Drag to reorder step ${step.name}`}
            onMouseDown={(e) => {
                // Only prevent default if not clicking on buttons or inputs
                const target = e.target as HTMLElement;
                if (!target.closest('button, input, select, textarea')) {
                    e.preventDefault();
                }
            }}
        >
            {/* Single Header with ALL data */}
            <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-2 flex-1">
                    {/* Drag Handle */}
                    <button
                        {...attributes}
                        {...listeners}
                        type="button"
                        data-drag-handle="true"
                        className={cn(
                            "p-1 flex-shrink-0 hover:text-foreground touch-none drag-handle",
                            isDragDisabled && "opacity-50 cursor-not-allowed"
                        )}
                        aria-hidden="true"
                        tabIndex={-1}
                        disabled={isDragDisabled}
                        style={{ 
                            pointerEvents: isDragDisabled ? 'none' : 'auto',
                            touchAction: 'none'
                        }}
                        onClick={(e) => {
                            e.stopPropagation(); // Don't expand when clicking drag handle
                            // console.log('🐛 [WorkflowStepCard] Drag handle CLICK:', {
                            //     stepId: step.id,
                            //     disabled: isDragDisabled,
                            //     target: e.target
                            // });
                        }}
                        onMouseDown={(e) => {
                            e.stopPropagation(); // Don't expand when clicking drag handle
                            // console.log('🐛 [WorkflowStepCard] Drag handle mousedown:', {
                            //     stepId: step.id,
                            //     disabled: isDragDisabled,
                            //     button: e.button,
                            //     target: e.target
                            // });
                        }}
                        // onMouseUp={(e) => {
                        //     console.log('🐛 [WorkflowStepCard] Drag handle mouseup:', {
                        //         stepId: step.id,
                        //         target: e.target
                        //     });
                        // }}
                        // onMouseEnter={(e) => {
                        //     console.log('🐛 [WorkflowStepCard] Drag handle mouseenter:', {
                        //         stepId: step.id,
                        //         target: e.target
                        //     });
                        // }}
                        onPointerDown={(e) => {
                            e.stopPropagation(); // Don't expand when clicking drag handle
                            // console.log('🐛 [WorkflowStepCard] Drag handle pointerdown:', {
                            //     stepId: step.id,
                            //     disabled: isDragDisabled,
                            //     pointerType: e.pointerType,
                            //     target: e.target
                            // });
                        }}
                    >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                    
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                    
                    <div className="font-medium">
                        Step {(stepIndex || 0) + 1}: {step.name}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                        ({getStepTypeLabel()})
                    </div>
                    
                    {step.modelId && (
                        <div className="text-sm text-muted-foreground">
                            • {models.find(m => m.id === step.modelId)?.name || step.modelId}
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-1">
                    {/* Move Buttons */}
                    {onMoveToTop && (
                        <ActionTooltipButton
                            tooltipText="Move to Top"
                            onClick={(e) => {
                                e.stopPropagation();
                                onMoveToTop();
                            }}
                            disabled={isFirst}
                            icon={<ChevronsUp />}
                            className="h-6 w-6"
                            variant="ghost"
                        />
                    )}
                    {onMoveUp && (
                        <ActionTooltipButton
                            tooltipText="Move Up"
                            onClick={(e) => {
                                e.stopPropagation();
                                onMoveUp();
                            }}
                            disabled={isFirst}
                            icon={<ArrowUp />}
                            className="h-6 w-6"
                            variant="ghost"
                        />
                    )}
                    {onMoveDown && (
                        <ActionTooltipButton
                            tooltipText="Move Down"
                            onClick={(e) => {
                                e.stopPropagation();
                                onMoveDown();
                            }}
                            disabled={isLast}
                            icon={<ArrowDown />}
                            className="h-6 w-6"
                            variant="ghost"
                        />
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
                    {(step.type === 'prompt' || step.type === 'agent-task' || step.type === 'custom-prompt') && (
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
                                <SelectItem value="custom-prompt">Custom Prompt</SelectItem>
                                <SelectItem value="tool-call">Tool Call</SelectItem>
                                <SelectItem value="function">Function</SelectItem>
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
                    {step.type === 'custom-prompt' && (
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label htmlFor={`step-prompt-content-${step.id}`}>Prompt Content</Label>
                                <Textarea
                                    id={`step-prompt-content-${step.id}`}
                                    value={step.promptContent || ''}
                                    onChange={(e) => onChange({ ...step, promptContent: e.target.value })}
                                    placeholder="Enter your custom prompt here..."
                                    rows={4}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Input Variables</Label>
                                <div className="text-xs text-muted-foreground mb-2">
                                    Define variables that this step requires from previous steps
                                </div>
                                <VariableManager
                                    variables={step.promptVariables || []}
                                    onVariablesChange={(vars) => onChange({ ...step, promptVariables: vars })}
                                    templateId={step.id}
                                />
                            </div>
                        </div>
                    )}
                    {step.type === 'tool-call' && (
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
                            {step.toolName && (
                                <div className="space-y-1">
                                    <Label>Static Arguments</Label>
                                    <div className="text-xs text-muted-foreground mb-2">
                                        Define static arguments for the tool (dynamic data comes from previous steps)
                                    </div>
                                    <div className="text-sm text-muted-foreground p-2 bg-muted/30 rounded border">
                                        Args: {Object.keys(step.toolArgs || {}).join(', ') || 'None defined'}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {step.type === 'function' && (
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label>Language</Label>
                                <RadioGroup
                                    value={step.functionLanguage || 'js'}
                                    onValueChange={(value: 'js' | 'py') => onChange({ ...step, functionLanguage: value })}
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="js" id={`lang-js-${step.id}`} />
                                        <Label htmlFor={`lang-js-${step.id}`}>JavaScript</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="py" id={`lang-py-${step.id}`} />
                                        <Label htmlFor={`lang-py-${step.id}`}>Python</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                            <div className="space-y-1">
                                <Label>Input Variables</Label>
                                <div className="text-xs text-muted-foreground mb-2">
                                    Define variables that this function expects from previous steps
                                </div>
                                <div className="text-sm text-muted-foreground p-2 bg-muted/30 rounded border">
                                    Variables: {step.functionVariables?.map(v => v.name).join(', ') || 'None defined'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor={`step-function-code-${step.id}`}>Function Code</Label>
                                <div className="text-xs text-muted-foreground mb-2">
                                    Available context: workflow, initial_step, outputs[], and your defined variables. Use return statement to provide output.
                                </div>
                                <div className="border rounded-md">
                                    <CodeEditor
                                        value={step.functionCode || ''}
                                        language={step.functionLanguage === 'py' ? 'python' : 'javascript'}
                                        onChange={(value) => onChange({ ...step, functionCode: value })}
                                        placeholder={step.functionLanguage === 'py' ? 
                                            '# Example:\n# result = initial_step["data"] * 2\n# return {"processed": result}' :
                                            '// Example:\n// const result = initial_step.data * 2;\n// return { processed: result };'
                                        }
                                        minHeight="200px"
                                    />
                                </div>
                            </div>
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
                            </div>
                            
                            <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded border">
                                <strong>Available Context:</strong>
                                <br />• <code>$.workflow</code> - Original workflow template (name, steps, etc.)
                                <br />• <code>$.initial_step</code> - Initial user input/prompt output
                                <br />• <code>$.outputs[0]</code> - Initial step output (same as $.initial_step)
                                <br />• <code>$.outputs[1]</code>, <code>$.outputs[2]</code>, etc. - Previous step outputs by index
                                <br />• <strong>Static values:</strong> Use <code>"literal text"</code> or <code>123</code> for static data
                            </div>

                            {(() => {
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

                                if (requiredFields.length === 0) {
                                    return (
                                        <div className="text-center text-muted-foreground py-4 border-2 border-dashed border-border rounded-lg">
                                            {nextStep ? 
                                                `Next step "${nextStep.name}" has no template variables to configure.` :
                                                'No next step found. Transform steps need a following step with template variables.'
                                            }
                                        </div>
                                    );
                                }

                                return requiredFields.map((field) => {
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
                                                {validation.isValid && validation.result !== undefined && !isStaticValue && (
                                                    <div className="text-xs text-primary mt-1 p-2 bg-primary/10 border border-primary/20 rounded">
                                                        <strong>Sample result:</strong> {JSON.stringify(validation.result)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}; 