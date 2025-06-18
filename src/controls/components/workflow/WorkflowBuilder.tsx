import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { WorkflowControlModule } from '@/controls/modules/WorkflowControlModule';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Workflow, Plus, Save, GitFork } from 'lucide-react';
import { ActionTooltipButton } from '@/components/LiteChat/common/ActionTooltipButton';
import type { WorkflowStep, WorkflowTemplate } from '@/types/litechat/workflow';
import { WorkflowStepCard } from './WorkflowStepCard';
import { WorkflowList } from './WorkflowList';
import { WorkflowVisualizer } from './WorkflowVisualizer';
import { WorkflowRawEditor } from './WorkflowRawEditor';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFormedible } from '@/hooks/use-formedible';
import { compilePromptTemplate } from '@/lib/litechat/prompt-util';
import { useInteractionStore } from '@/store/interaction.store';
import { TabbedLayout } from '@/components/LiteChat/common/TabbedLayout';
import { PersistenceService } from '@/services/persistence.service';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';

interface WorkflowBuilderProps {
    module: WorkflowControlModule;
}

type TriggerType = 'custom' | 'template' | 'task';
type ActiveTab = 'list' | 'builder';

const createEmptyWorkflow = (): WorkflowTemplate => ({
    id: '',
    name: 'My New Workflow',
    description: 'A workflow for processing things.',
    steps: [],
    createdAt: '',
    updatedAt: '',
});

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ module }) => {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>("list");
    const [workflow, setWorkflow] = useState<WorkflowTemplate>(createEmptyWorkflow());
    const [isEditingExisting, setIsEditingExisting] = useState(false);
    const [triggerType, setTriggerType] = useState<TriggerType>('custom');
    const [customPrompt, setCustomPrompt] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    
    const customPromptRef = useRef<HTMLTextAreaElement>(null);

    // Force update hook to trigger re-renders when needed
    const [forceUpdate, setForceUpdate] = useState(0);
    
    // Check streaming status from store
    const isStreaming = useInteractionStore(state => state.streamingInteractionIds.length > 0);

    // Get data from module (following RacePromptControl pattern)
    const promptTemplates = module.getPromptTemplates();
    const agentTasks = module.getAgentTasks();
    const allTemplates = module.getAllTemplates();
    const models = module.getModels();

    const selectedTemplate = useMemo(() => {
        if (!selectedTemplateId) return null;
        return allTemplates.find(t => t.id === selectedTemplateId);
    }, [selectedTemplateId, allTemplates]);
    
    const fields = useMemo(() => {
        if (!selectedTemplate) return [];
        return selectedTemplate.variables.map(v => ({
            name: v.name,
            type: v.type || 'text',
            label: v.name,
            placeholder: v.description,
            description: v.instructions,
            required: v.required,
        }))
    }, [selectedTemplate]);

    const { form: triggerForm, Form: TriggerFormFields } = useFormedible({
        fields,
        formOptions: {
            defaultValues: {},
        },
        showSubmitButton: false,
        formClassName: 'space-y-4 mt-4 border-t pt-4',
    });

    // Create enhanced templates for visualizer (no store dependencies)
    const enhancedTemplates = useMemo(() => {
        const enhanced = [
            ...promptTemplates.map(t => ({ id: t.id, name: t.name, type: 'prompt' as const })),
            ...agentTasks.map(t => ({ id: t.id, name: t.name, type: 'task' as const }))
        ];
        return enhanced;
    }, [promptTemplates, agentTasks]);

    // Sync trigger changes to workflow state for visualizer
    useEffect(() => {
        setWorkflow(prev => ({
            ...prev,
            triggerType: triggerType,
            triggerRef: selectedTemplateId || undefined,
            triggerPrompt: triggerType === 'custom' ? customPrompt : undefined,
        }));
    }, [triggerType, selectedTemplateId, customPrompt]);

    const resetWorkflow = () => {
        setWorkflow({
            id: '',
            name: 'My New Workflow',
            description: 'A workflow for processing things.',
            steps: [],
            createdAt: '',
            updatedAt: '',
        });
        setTriggerType('custom');
        setCustomPrompt('');
        setSelectedTemplateId(null);
        setIsEditingExisting(false);
    };

    const handleCreateNew = () => {
        resetWorkflow();
        setActiveTab('builder');
    };

    const handleEditWorkflow = (existingWorkflow: WorkflowTemplate) => {
        setWorkflow(existingWorkflow);
        setIsEditingExisting(true);
        setActiveTab('builder');
        // Load trigger settings from existing workflow
        setTriggerType(existingWorkflow.triggerType || 'custom');
        setCustomPrompt(existingWorkflow.triggerPrompt || '');
        setSelectedTemplateId(existingWorkflow.triggerRef || null);
    };

    const handleSaveWorkflow = async () => {
        if (!workflow.name.trim()) {
            toast.error("Workflow name cannot be empty.");
            return;
        }

        try {
            const now = new Date().toISOString();
            const workflowToSave: WorkflowTemplate = {
                ...workflow,
                id: workflow.id || nanoid(),
                triggerType: triggerType,
                triggerRef: selectedTemplateId || undefined,
                triggerPrompt: triggerType === 'custom' ? customPrompt : undefined,
                createdAt: workflow.createdAt || now,
                updatedAt: now,
            };

            await PersistenceService.saveWorkflow(workflowToSave);
            setWorkflow(workflowToSave);
            setIsEditingExisting(true);
            await module.refreshWorkflows();
            toast.success(`Saved workflow "${workflowToSave.name}"`);
        } catch (error) {
            console.error("Failed to save workflow:", error);
            toast.error("Failed to save workflow");
        }
    };

    const handleForkWorkflow = async () => {
        if (!workflow.name.trim()) {
            toast.error("Workflow name cannot be empty.");
            return;
        }

        try {
            const now = new Date().toISOString();
            const forkedWorkflow: WorkflowTemplate = {
                ...workflow,
                id: nanoid(),
                name: `${workflow.name} (Fork)`,
                createdAt: now,
                updatedAt: now,
            };

            await PersistenceService.saveWorkflow(forkedWorkflow);
            setWorkflow(forkedWorkflow);
            setIsEditingExisting(true);
            await module.refreshWorkflows();
            toast.success(`Forked workflow as "${forkedWorkflow.name}"`);
        } catch (error) {
            console.error("Failed to fork workflow:", error);
            toast.error("Failed to fork workflow");
        }
    };

    const handleRunWorkflow = async () => {
        if (triggerType === 'custom') {
            if (!customPrompt) {
                toast.error("Custom prompt cannot be empty.");
                return;
            }
            module.startWorkflow(workflow, customPrompt);
            setOpen(false);
        } else if (selectedTemplate) {
            try {
                const formData = triggerForm.state.values as Record<string, any>;
                const finalInitialPrompt = await compilePromptTemplate(selectedTemplate, formData);
                module.startWorkflow(workflow, finalInitialPrompt.content);
                setOpen(false);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Invalid input";
                toast.error(`Trigger error: ${errorMessage}`);
            }
        }
    };

    const handleAddStep = () => {
        const newStep: WorkflowStep = {
            id: `step_${Date.now()}_${workflow.steps.length}`,
            name: `Step ${workflow.steps.length + 1}`,
            type: 'prompt',
        };
        setWorkflow(prev => ({ ...prev, steps: [...prev.steps, newStep] }));
    };

    const handleStepChange = (stepId: string, updatedStep: WorkflowStep) => {
        setWorkflow(prev => ({
            ...prev,
            steps: prev.steps.map(step => 
                step.id === stepId ? updatedStep : step
            )
        }));
    };

    const isRunDisabled = (triggerType === 'custom' && !customPrompt) ||
                          (triggerType !== 'custom' && !selectedTemplateId) ||
                          workflow.steps.length === 0;

    const templatesForTrigger = triggerType === 'template' ? promptTemplates : agentTasks;

    const tabs = [
        {
            value: 'list',
            label: 'Workflows',
            content: (
                <WorkflowList 
                    module={module}
                    onEditWorkflow={handleEditWorkflow}
                    onCreateNew={handleCreateNew}
                    onWorkflowsChanged={() => module.refreshWorkflows()}
                    onWorkflowRun={() => setOpen(false)}
                />
            ),
        },
        {
            value: 'builder',
            label: isEditingExisting ? 'Edit Workflow' : 'New Workflow',
            content: (
                <div className="grid grid-cols-1 xl:grid-cols-4 lg:grid-cols-3 gap-6 h-full overflow-hidden p-2">
                    {/* Left Side: Trigger & Workflow Config - 1/4 in XL, 1/3 in LG */}
                    <div className="xl:col-span-1 lg:col-span-1 flex flex-col gap-4 overflow-y-auto max-h-full">
                        <div className="space-y-2">
                            <Label htmlFor="wf-name">Workflow Name</Label>
                            <Input
                                id="wf-name"
                                value={workflow.name}
                                onChange={(e) => {
                                    setWorkflow(prev => ({ ...prev, name: e.target.value }));
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="wf-desc">Description</Label>
                            <Textarea
                                id="wf-desc"
                                value={workflow.description}
                                onChange={(e) => {
                                    setWorkflow(prev => ({ ...prev, description: e.target.value }));
                                }}
                                rows={3}
                            />
                        </div>
                        
                        <div className="border rounded-md p-3 flex-grow flex flex-col space-y-4">
                            <Label className="font-semibold">Trigger / Initial Message</Label>
                            <RadioGroup value={triggerType} onValueChange={(v) => {setTriggerType(v as TriggerType); setSelectedTemplateId(null);}}>
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
                                    ref={customPromptRef}
                                    defaultValue={customPrompt}
                                    onBlur={(e) => {
                                        setCustomPrompt(e.target.value);
                                    }}
                                    placeholder="Enter the first message to start the workflow..."
                                    className="flex-grow min-h-[100px]"
                                />
                            )}

                            {(triggerType === 'template' || triggerType === 'task') && (
                                <div className="space-y-2">
                                    <Select 
                                        key={`trigger-select-${open}`}
                                        value={selectedTemplateId || ''} 
                                        onValueChange={setSelectedTemplateId}
                                    >
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
                                    {selectedTemplate && <TriggerFormFields />}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side: Steps with Tabbed Layout - 3/4 in XL, 2/3 in LG */}
                    <div className="xl:col-span-3 lg:col-span-2 flex flex-col h-full">
                        <Label className="mb-2">Workflow Steps ({workflow.steps.length})</Label>
                        <div className="flex-1 min-h-0">
                            <TabbedLayout
                                tabs={[
                                    {
                                        value: 'builder',
                                        label: 'Builder',
                                        content: (
                                            <div className="h-full flex flex-col">
                                                <ScrollArea className="flex-1 border rounded-md p-3">
                                                    <div className="space-y-4">
                                                        {workflow.steps.map((step) => (
                                                            <WorkflowStepCard
                                                                key={`${step.id}-${open}`}
                                                                step={step}
                                                                onChange={(updatedStep) => handleStepChange(step.id, updatedStep)}
                                                                promptTemplates={promptTemplates}
                                                                agentTasks={agentTasks}
                                                                models={models}
                                                            />
                                                        ))}
                                                        {workflow.steps.length === 0 && (
                                                            <div className="text-center text-muted-foreground py-8">
                                                                No subsequent steps. Add one to create a sequence.
                                                            </div>
                                                        )}
                                                        <Button size="sm" onClick={handleAddStep} className="w-full mt-4">
                                                            <Plus className="h-4 w-4 mr-2" /> Add Step
                                                        </Button>
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        ),
                                    },
                                    {
                                        value: 'visualizer',
                                        label: 'Visualizer',
                                        content: (
                                            <div className="h-full w-full border rounded-md">
                                                <WorkflowVisualizer 
                                                    workflow={workflow}
                                                    enhancedTemplates={enhancedTemplates}
                                                />
                                            </div>
                                        ),
                                    },
                                    {
                                        value: 'raw',
                                        label: 'Raw Editor',
                                        content: (
                                            <div className="h-full border rounded-md">
                                                <WorkflowRawEditor
                                                    workflow={workflow}
                                                    onChange={setWorkflow}
                                                    onSave={async (updatedWorkflow) => {
                                                        const now = new Date().toISOString();
                                                        const workflowToSave: WorkflowTemplate = {
                                                            ...updatedWorkflow,
                                                            id: updatedWorkflow.id || nanoid(),
                                                            createdAt: updatedWorkflow.createdAt || now,
                                                            updatedAt: now,
                                                        };
                                                        await PersistenceService.saveWorkflow(workflowToSave);
                                                        setWorkflow(workflowToSave);
                                                        setIsEditingExisting(true);
                                                        await module.refreshWorkflows();
                                                    }}
                                                    className="h-full p-3"
                                                />
                                            </div>
                                        ),
                                    },
                                ]}
                                scrollable={false}
                                className="h-full"
                            />
                        </div>
                    </div>
                </div>
            ),
        },
    ];

    return (
        <>
            <ActionTooltipButton
                tooltipText="Open Workflow Builder"
                onClick={() => setOpen(true)}
                aria-label="Open Workflow Builder"
                disabled={isStreaming}
                icon={<Workflow />}
                className="h-5 w-5 md:h-6 md:w-6"
            />
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="!w-[95vw] !h-[85vh] !max-w-none flex flex-col p-0">
                    <DialogHeader className="px-6 pt-6 pb-2">
                        <DialogTitle>Workflow Builder</DialogTitle>
                        <DialogDescription>
                            Create and manage automated sequences of AI interactions.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-grow overflow-hidden">
                        <TabbedLayout
                            tabs={tabs}
                            initialValue={activeTab}
                            onValueChange={(value) => {
                                setActiveTab(value as ActiveTab);
                                // Refresh workflows when switching to list tab
                                if (value === 'list') {
                                    module.refreshWorkflows();
                                }
                            }}
                            scrollable={true}
                        />
                    </div>

                    {activeTab === 'builder' && (
                        <DialogFooter className="px-6 pb-6">
                            <div className="flex gap-2 flex-wrap">
                                <Button variant="outline" onClick={() => setOpen(false)}>
                                    Cancel
                                </Button>
                                
                                {isEditingExisting && (
                                    <Button 
                                        variant="outline" 
                                        onClick={handleForkWorkflow}
                                        className="flex items-center gap-2"
                                    >
                                        <GitFork className="h-4 w-4" />
                                        Fork
                                    </Button>
                                )}
                                
                                <Button 
                                    variant="outline" 
                                    onClick={handleSaveWorkflow}
                                    className="flex items-center gap-2"
                                >
                                    <Save className="h-4 w-4" />
                                    Save
                                </Button>
                                
                                <Button 
                                    onClick={handleRunWorkflow}
                                    disabled={isRunDisabled}
                                    className="flex items-center gap-2"
                                >
                                    <Workflow className="h-4 w-4" />
                                    Run Workflow
                                </Button>
                            </div>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}; 