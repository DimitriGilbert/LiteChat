import React, { useState, useMemo } from 'react';
import type { WorkflowControlModule } from '@/controls/modules/WorkflowControlModule';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Plus } from 'lucide-react';
import { ActionTooltipButton } from '@/components/LiteChat/common/ActionTooltipButton';
import type { WorkflowStep, WorkflowTemplate } from '@/types/litechat/workflow';
import { WorkflowStepCard } from './WorkflowStepCard';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFormedible } from '@/hooks/use-formedible';
import type { PromptTemplate } from '@/types/litechat/prompt-template';
import { compilePromptTemplate } from '@/lib/litechat/prompt-util';
import * as z from 'zod';

interface WorkflowBuilderProps {
    module: WorkflowControlModule;
}

type TriggerType = 'custom' | 'template' | 'task';

const TriggerForm: React.FC<{
    template: PromptTemplate;
    onValuesChange: (values: Record<string, any>) => void;
    initialValues: Record<string, any>;
}> = ({ template, onValuesChange, initialValues }) => {

    const fields = useMemo(() => template.variables.map(v => ({
        name: v.name,
        type: v.type, // Assumes mapping between variable types and formedible field types
        label: v.name,
        placeholder: v.description,
        description: v.instructions,
        required: v.required,
    })), [template]);
    
    const zodSchema = useMemo(() => z.object(
        template.variables.reduce((acc, v) => {
            let validator: z.ZodTypeAny = z.any();
            switch(v.type) {
                case 'string': validator = z.string(); break;
                case 'number': validator = z.number(); break;
                case 'boolean': validator = z.boolean(); break;
            }
            if(v.required) {
                // A non-empty check for strings, basic check for others
                if (validator instanceof z.ZodString) {
                     validator = validator.min(1, `${v.name} is required.`);
                }
            }
            acc[v.name] = validator;
            return acc;
        }, {} as Record<string, z.ZodTypeAny>)
    ), [template]);

    const { Form } = useFormedible({
        fields,
        schema: zodSchema,
        formOptions: {
            defaultValues: initialValues,
            onChange: ({ value }) => onValuesChange(value),
        },
        formClassName: 'mt-4 border-t pt-4',
        submitLabel: 'N/A - Values captured on change'
    });

    return <Form />;
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ module }) => {
    const [open, setOpen] = useState(false);
    const [workflow, setWorkflow] = useState<WorkflowTemplate>({
        id: '',
        name: 'My New Workflow',
        description: 'A workflow for processing things.',
        steps: [],
        createdAt: '',
        updatedAt: '',
    });
    
    const [triggerType, setTriggerType] = useState<TriggerType>('custom');
    const [customPrompt, setCustomPrompt] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [formValues, setFormValues] = useState<Record<string, any>>({});
    
    const promptTemplates = module.getPromptTemplates();
    const agentTasks = module.getAgentTasks();
    const allTemplates = module.getAllTemplates();
    const models = module.getModels();

    const selectedTemplate = useMemo(() => {
        if (!selectedTemplateId) return null;
        return allTemplates.find(t => t.id === selectedTemplateId);
    }, [selectedTemplateId, allTemplates]);

    const handleAddStep = () => {
        const newStep: WorkflowStep = {
            id: `step_${Date.now()}_${workflow.steps.length}`,
            name: `Step ${workflow.steps.length + 1}`,
            type: 'prompt',
        };
        setWorkflow(prev => ({ ...prev, steps: [...prev.steps, newStep] }));
    };

    const handleStepChange = (updatedStep: WorkflowStep) => {
        setWorkflow(prev => ({
            ...prev,
            steps: prev.steps.map(s => s.id === updatedStep.id ? updatedStep : s)
        }));
    };

    const handleRunWorkflow = async () => {
        let finalInitialPrompt = '';
        if (triggerType === 'custom') {
            finalInitialPrompt = customPrompt;
        } else if (selectedTemplate) {
            const result = await compilePromptTemplate(selectedTemplate, formValues);
            finalInitialPrompt = result.content;
        }

        if (!finalInitialPrompt) {
            console.error("Cannot run workflow with an empty initial prompt.");
            return;
        }
        
        module.startWorkflow(workflow, finalInitialPrompt);
        setOpen(false);
    };

    const isRunDisabled = (triggerType === 'custom' && !customPrompt) ||
                          (triggerType !== 'custom' && !selectedTemplateId) ||
                          workflow.steps.length === 0;

    const templatesForTrigger = triggerType === 'template' ? promptTemplates : agentTasks;

    return (
        <>
            <ActionTooltipButton
                tooltipText="Open Workflow Builder"
                onClick={() => setOpen(true)}
                aria-label="Open Workflow Builder"
                disabled={module.getIsStreaming()}
                icon={<Bot />}
                className="h-5 w-5 md:h-6 md:w-6"
            />
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="min-w-[85vw] min-h-[75vh] flex flex-col p-4">
                    <DialogHeader>
                        <DialogTitle>Workflow Builder</DialogTitle>
                        <DialogDescription>
                            Configure a trigger and a sequence of automated steps.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow overflow-hidden">
                        {/* Left Side: Trigger & Workflow Config */}
                        <div className="flex flex-col gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="wf-name">Workflow Name</Label>
                                <Input
                                    id="wf-name"
                                    value={workflow.name}
                                    onChange={e => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="wf-desc">Description</Label>
                                <Textarea
                                    id="wf-desc"
                                    value={workflow.description}
                                    onChange={e => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                />
                            </div>
                            
                            <div className="border rounded-md p-3 flex-grow flex flex-col space-y-4">
                                <Label className="font-semibold">Trigger / Initial Message</Label>
                                <RadioGroup value={triggerType} onValueChange={(v) => {setTriggerType(v as TriggerType); setSelectedTemplateId(null); setFormValues({})}}>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="custom" id="r-custom" />
                                        <Label htmlFor="r-custom">Custom Prompt</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="template" id="r-template" />
                                        <Label htmlFor="r-template">Prompt from Template</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="task" id="r-task" />
                                        <Label htmlFor="r-task">Agent Task</Label>
                                    </div>
                                </RadioGroup>

                                {triggerType === 'custom' && (
                                    <Textarea
                                        value={customPrompt}
                                        onChange={e => setCustomPrompt(e.target.value)}
                                        placeholder="Enter the first message to start the workflow..."
                                        className="flex-grow"
                                    />
                                )}

                                {(triggerType === 'template' || triggerType === 'task') && (
                                    <div className="space-y-2">
                                        <Select value={selectedTemplateId || ''} onValueChange={setSelectedTemplateId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder={`Select a ${triggerType}...`} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {templatesForTrigger.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>
                                                        {triggerType === 'task' ? (t as any).prefixedName : t.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {selectedTemplate && (
                                            <TriggerForm 
                                                template={selectedTemplate} 
                                                onValuesChange={setFormValues}
                                                initialValues={formValues}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Side: Subsequent Steps */}
                        <div className="flex flex-col gap-4 overflow-hidden">
                            <Label>Subsequent Steps ({workflow.steps.length})</Label>
                            <ScrollArea className="border rounded-md p-3 flex-grow">
                                <div className="space-y-4">
                                    {workflow.steps.map((step) => (
                                        <WorkflowStepCard
                                            key={step.id}
                                            step={step}
                                            onChange={handleStepChange}
                                            promptTemplates={promptTemplates}
                                            agentTasks={agentTasks}
                                            allTemplates={allTemplates}
                                            models={models}
                                        />
                                    ))}
                                    {workflow.steps.length === 0 && (
                                        <div className="text-center text-muted-foreground py-8">
                                            No subsequent steps. Add one to create a sequence.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                            <Button variant="outline" onClick={handleAddStep}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Step
                            </Button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={handleRunWorkflow} disabled={isRunDisabled}>
                            Run Workflow
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}; 