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
import { useInteractionStore } from '@/store/interaction.store';
import { TabbedLayout } from '@/components/LiteChat/common/TabbedLayout';
import { PersistenceService } from '@/services/persistence.service';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import { useForm } from '@tanstack/react-form';

interface WorkflowBuilderProps {
    module: WorkflowControlModule;
}

type TriggerType = 'custom' | 'template' | 'task';
type ActiveTab = 'list' | 'builder';

interface WorkflowFormData {
    name: string;
    description: string;
    triggerType: TriggerType;
    customPrompt: string;
    selectedTemplateId: string;
    templateVariables: Record<string, any>;
    steps: WorkflowStep[];
}

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
    const [activeStepsTab, setActiveStepsTab] = useState<string>("builder");
    const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowTemplate>(createEmptyWorkflow());
    const [isEditingExisting, setIsEditingExisting] = useState(false);
    
    // Use ref for preview DOM element - direct manipulation for live typing
    const previewElementRef = useRef<HTMLDivElement | null>(null);
    
    // State for compiled content - updated only on blur/tab switch for visualizer
    const [compiledPreviewContent, setCompiledPreviewContent] = useState<string>('');
    // Force re-render trigger for visualizer when compiled content changes
    const [visualizerUpdateKey, setVisualizerUpdateKey] = useState(0);
    
    // Check streaming status from store
    const isStreaming = useInteractionStore(state => state.streamingInteractionIds.length > 0);

    // Get data from module
    const promptTemplates = module.getPromptTemplates();
    const agentTasks = module.getAgentTasks();
    const allTemplates = module.getAllTemplates();
    const models = module.getModels();

    // TANSTACK FORM - Single source of truth for all workflow form state
    const workflowForm = useForm({
        defaultValues: {
            name: currentWorkflow.name,
            description: currentWorkflow.description,
            triggerType: (currentWorkflow.triggerType as TriggerType) || 'custom',
            customPrompt: currentWorkflow.triggerPrompt || '',
            selectedTemplateId: currentWorkflow.triggerRef || '',
            templateVariables: {} as Record<string, any>,
            steps: currentWorkflow.steps || [],
        },
        onSubmit: async ({ value }) => {
            await handleSaveWorkflow(value);
        },
    });

    // Get current form values for reactive updates
    const formValues = workflowForm.state.values;
    
    // Get selected template for variable form
    const selectedTemplate = formValues.triggerType === 'template' && formValues.selectedTemplateId ? 
        promptTemplates.find(t => t.id === formValues.selectedTemplateId) : null;
    
    // Calculate compiled trigger prompt from template variables
    const compiledTriggerPrompt = useMemo(() => {
        if (formValues.triggerType === 'custom') {
            return formValues.customPrompt;
        } else if (formValues.triggerType === 'template' && selectedTemplate) {
            // Use the compiled content from state (updated by form blur)
            return compiledPreviewContent || selectedTemplate.prompt;
        }
        return undefined;
    }, [formValues.triggerType, formValues.customPrompt, selectedTemplate, compiledPreviewContent]);

    // Build live workflow from form state (for visualizer and other components)
    const liveWorkflow: WorkflowTemplate = useMemo(() => ({
        ...currentWorkflow,
        name: formValues.name,
        description: formValues.description,
        triggerType: formValues.triggerType,
        triggerPrompt: compiledTriggerPrompt,
        triggerRef: formValues.triggerType !== 'custom' ? formValues.selectedTemplateId : undefined,
        templateVariables: formValues.templateVariables, // Include template variables in workflow
        steps: formValues.steps,
    }), [currentWorkflow, formValues, compiledTriggerPrompt]);
    
    // Get selected task
    const selectedTask = formValues.triggerType === 'task' && formValues.selectedTemplateId ? 
        agentTasks.find(t => t.id === formValues.selectedTemplateId) : null;

    // Process initial step data for visualizer (BUILDER DOES THE PROCESSING)
    const initialStepData = useMemo(() => {
        console.log('Calculating initialStepData...');
        console.log('formValues.triggerType:', formValues.triggerType);
        console.log('formValues.selectedTemplateId:', formValues.selectedTemplateId);
        console.log('selectedTemplate:', selectedTemplate?.name);
        
        if (formValues.triggerType === 'custom' && formValues.customPrompt) {
            const preview = formValues.customPrompt.length > 100 ? 
                           formValues.customPrompt.slice(0, 100) + '...' : 
                           formValues.customPrompt;
            console.log('Using custom prompt preview:', preview);
            return {
                stepName: 'Custom Prompt',
                templateName: preview,
                type: 'initial',
                previewContent: preview,
            };
        } else if (formValues.triggerType === 'template' && formValues.selectedTemplateId && selectedTemplate) {
            // Use compiled state content for visualizer (updated on blur/tab switch)
            const contentToShow = compiledPreviewContent || selectedTemplate.prompt;
            console.log('Final content to show:', contentToShow);
            const preview = contentToShow.length > 100 ? 
                           contentToShow.slice(0, 100) + '...' : 
                           contentToShow;
            console.log('Template preview for visualizer:', preview);
            return {
                stepName: selectedTemplate.name,
                templateName: preview,
                type: 'initial',
                previewContent: preview,
            };
        } else if (formValues.triggerType === 'task' && formValues.selectedTemplateId && selectedTask) {
            // For tasks, use raw content since we don't have task compilation in preview yet
            const preview = selectedTask.prompt.length > 100 ? 
                           selectedTask.prompt.slice(0, 100) + '...' : 
                           selectedTask.prompt;
            console.log('Using task preview:', preview);
            return {
                stepName: selectedTask.name,
                templateName: preview,
                type: 'initial',
                previewContent: preview,
            };
        }
        console.log('Using default initial step data');
        return {
            stepName: 'Initial Step',
            templateName: undefined,
            type: 'initial',
            previewContent: undefined,
        };
    }, [formValues.triggerType, formValues.customPrompt, formValues.selectedTemplateId, selectedTemplate, selectedTask]);

    // Process step display data for visualizer (BUILDER DOES THE PROCESSING)
    const stepDisplayData = useMemo(() => {
        return formValues.steps.map(step => {
            // Get clean model name from models list
            const getCleanModelName = () => {
                if (!step.modelId) return undefined;
                const model = models.find(m => m.id === step.modelId);
                return model ? model.name : step.modelId; // Fallback to ID if not found
            };

            // Get template name
            const getTemplateName = () => {
                if (step.templateId) {
                    if (step.type === 'prompt') {
                        const template = promptTemplates.find(t => t.id === step.templateId);
                        return template?.name;
                    } else if (step.type === 'agent-task') {
                        const task = agentTasks.find(t => t.id === step.templateId);
                        return task?.name;
                    }
                }
                return undefined;
            };

            return {
                stepName: step.name || 'Unnamed Step',
                templateName: getTemplateName(),
                modelName: getCleanModelName(),
                type: step.type,
            };
        });
    }, [formValues.steps, models, promptTemplates, agentTasks]);

    // Template variable form (only when template is selected)
    const templateFields = useMemo(() => {
        if (!selectedTemplate) return [];
        return selectedTemplate.variables.map(v => ({
            name: v.name,
            type: v.type || 'text',
            label: v.name,
            placeholder: v.description,
            description: v.instructions,
            required: v.required,
        }));
    }, [selectedTemplate]);

    // Use ref to store current selectedTemplate for onChange closure
    const selectedTemplateRef = useRef<typeof selectedTemplate>(null);
    selectedTemplateRef.current = selectedTemplate;

    const { Form: TemplateVariableForm } = useFormedible({
        fields: templateFields,
        formOptions: {
            defaultValues: formValues.templateVariables,
            onChange: async ({ value }) => {
                console.log('🔥 TemplateVariableForm onChange:', value);
                // Update DOM immediately for live preview - NO RE-RENDERS (like PromptLibraryControl)
                if (!selectedTemplateRef.current || !previewElementRef.current) return;
                
                try {
                    const compiled = await module.compileTemplate(selectedTemplateRef.current.id, value);
                    previewElementRef.current.textContent = compiled.content;
                } catch (error) {
                    const errorMessage = `Error: ${error instanceof Error ? error.message : 'Compilation failed'}`;
                    previewElementRef.current.textContent = errorMessage;
                }
            },
            onBlur: async ({ value }) => {
                console.log('🔥 TemplateVariableForm onBlur:', value);
                console.log('🔥 Current formValues.templateVariables:', formValues.templateVariables);
                
                // Update main workflow form with template variables
                workflowForm.setFieldValue('templateVariables', value);
                console.log('🔥 Updated main form templateVariables to:', value);
                
                if (!selectedTemplateRef.current) return;
                
                try {
                    const compiled = await module.compileTemplate(selectedTemplateRef.current.id, value);
                    console.log('🔥 Compiled content in onBlur:', compiled.content);
                    setCompiledPreviewContent(compiled.content);
                    setVisualizerUpdateKey(prev => prev + 1); // Force visualizer update
                } catch (error) {
                    const errorMessage = `Error: ${error instanceof Error ? error.message : 'Compilation failed'}`;
                    setCompiledPreviewContent(errorMessage);
                    setVisualizerUpdateKey(prev => prev + 1); // Force visualizer update
                }
            }
        },
        showSubmitButton: false,
        formClassName: 'space-y-4 mt-4 border-t pt-4',
    });

    // No automatic onChange re-rendering - workflow builder updates only on blur/manual actions

    // Update preview directly in DOM - NO REACT RE-RENDERS (like PromptLibraryControl)
    const updatePreview = async (formData: Record<string, any>) => {
        console.log('WorkflowBuilder updatePreview called with:', formData);
        console.log('selectedTemplate:', selectedTemplate?.name);
        console.log('previewElementRef.current:', previewElementRef.current);
        
        if (!selectedTemplate || !previewElementRef.current) {
            console.log('Early return - missing template or ref');
            return;
        }
        
        try {
            console.log('Calling compileTemplate...');
            const compiled = await module.compileTemplate(selectedTemplate.id, formData);
            console.log('Compiled result:', compiled.content);
            previewElementRef.current.textContent = compiled.content;
            console.log('Updated DOM preview element');
        } catch (error) {
            console.error('Preview compilation error:', error);
            const errorMessage = `Error: ${error instanceof Error ? error.message : 'Compilation failed'}`;
            previewElementRef.current.textContent = errorMessage;
        }
    };

        // Initialize preview when template is selected
    useEffect(() => {
        if (selectedTemplate && previewElementRef.current) {
            previewElementRef.current.textContent = selectedTemplate.prompt;
            setCompiledPreviewContent(selectedTemplate.prompt);
            workflowForm.setFieldValue('templateVariables', {});
            setVisualizerUpdateKey(prev => prev + 1);
        } else if (!selectedTemplate) {
            setCompiledPreviewContent('');
            workflowForm.setFieldValue('templateVariables', {});
        }
    }, [selectedTemplate]); // Remove workflowForm dependency to prevent re-renders!

    // Compilation happens in the template variable form onBlur handler

    const resetWorkflow = () => {
        const emptyWorkflow = createEmptyWorkflow();
        setCurrentWorkflow(emptyWorkflow);
        workflowForm.reset();
        workflowForm.setFieldValue('name', emptyWorkflow.name);
        workflowForm.setFieldValue('description', emptyWorkflow.description);
        workflowForm.setFieldValue('triggerType', 'custom');
        workflowForm.setFieldValue('customPrompt', '');
        workflowForm.setFieldValue('selectedTemplateId', '');
        workflowForm.setFieldValue('steps', []);
        setIsEditingExisting(false);
    };

    const handleCreateNew = () => {
        resetWorkflow();
        setActiveTab('builder');
    };

    const handleEditWorkflow = (existingWorkflow: WorkflowTemplate) => {
        setCurrentWorkflow(existingWorkflow);
        workflowForm.setFieldValue('name', existingWorkflow.name);
        workflowForm.setFieldValue('description', existingWorkflow.description);
        workflowForm.setFieldValue('triggerType', (existingWorkflow.triggerType as TriggerType) || 'custom');
        workflowForm.setFieldValue('customPrompt', existingWorkflow.triggerPrompt || '');
        workflowForm.setFieldValue('selectedTemplateId', existingWorkflow.triggerRef || '');
        workflowForm.setFieldValue('steps', existingWorkflow.steps || []);
        setIsEditingExisting(true);
        setActiveTab('builder');
    };

    const handleSaveWorkflow = async (formData: WorkflowFormData) => {
        if (!formData.name.trim()) {
            toast.error("Workflow name cannot be empty.");
            return;
        }

        try {
            const now = new Date().toISOString();
            const workflowToSave: WorkflowTemplate = {
                ...currentWorkflow,
                id: currentWorkflow.id || nanoid(),
                name: formData.name,
                description: formData.description,
                triggerType: formData.triggerType,
                triggerRef: formData.triggerType !== 'custom' ? formData.selectedTemplateId : undefined,
                triggerPrompt: compiledTriggerPrompt, // Use compiled content
                templateVariables: formData.templateVariables,
                steps: formData.steps,
                createdAt: currentWorkflow.createdAt || now,
                updatedAt: now,
            };

            await PersistenceService.saveWorkflow(workflowToSave);
            setCurrentWorkflow(workflowToSave);
            setIsEditingExisting(true);
            await module.refreshWorkflows();
            toast.success(`Saved workflow "${workflowToSave.name}"`);
        } catch (error) {
            console.error("Failed to save workflow:", error);
            toast.error("Failed to save workflow");
        }
    };

    const handleForkWorkflow = async () => {
        const formData = workflowForm.state.values;
        if (!formData.name.trim()) {
            toast.error("Workflow name cannot be empty.");
            return;
        }

        try {
            const now = new Date().toISOString();
            const forkedWorkflow: WorkflowTemplate = {
                ...currentWorkflow,
                id: nanoid(),
                name: `${formData.name} (Fork)`,
                description: formData.description,
                triggerType: formData.triggerType,
                triggerRef: formData.triggerType !== 'custom' ? formData.selectedTemplateId : undefined,
                triggerPrompt: compiledTriggerPrompt, // Use compiled content
                templateVariables: formData.templateVariables,
                steps: formData.steps,
                createdAt: now,
                updatedAt: now,
            };

            await PersistenceService.saveWorkflow(forkedWorkflow);
            setCurrentWorkflow(forkedWorkflow);
            setIsEditingExisting(true);
            await module.refreshWorkflows();
            toast.success(`Forked workflow as "${forkedWorkflow.name}"`);
        } catch (error) {
            console.error("Failed to fork workflow:", error);
            toast.error("Failed to fork workflow");
        }
    };

    const handleRunWorkflow = async () => {
        const formData = workflowForm.state.values;
        
        if (formData.triggerType === 'custom') {
            if (!formData.customPrompt) {
                toast.error("Custom prompt cannot be empty.");
                return;
            }
        } else {
            if (!formData.selectedTemplateId) {
                toast.error("Please select a template or task.");
                return;
            }
        }

        if (formData.steps.length === 0) {
            toast.error("Workflow must have at least one step.");
            return;
        }

        try {
            const workflowToRun: WorkflowTemplate = {
                ...currentWorkflow,
                name: formData.name,
                description: formData.description,
                triggerType: formData.triggerType,
                triggerRef: formData.triggerType !== 'custom' ? formData.selectedTemplateId : undefined,
                triggerPrompt: compiledTriggerPrompt, // Use compiled content
                templateVariables: formData.templateVariables,
                steps: formData.steps,
            };

            await module.startWorkflow(workflowToRun, workflowToRun.triggerPrompt || '');
            setOpen(false);
            toast.success("Workflow started!");
        } catch (error) {
            console.error("Failed to run workflow:", error);
            toast.error("Failed to start workflow");
        }
    };

    const handleAddStep = useCallback(() => {
        const currentSteps = workflowForm.state.values.steps;
        const newStep: WorkflowStep = {
            id: nanoid(),
            name: `Step ${currentSteps.length + 1}`,
            type: 'prompt',
            modelId: '',
            templateId: undefined,
        };
        workflowForm.setFieldValue('steps', [...currentSteps, newStep]);
    }, [workflowForm]);

    const isRunDisabled = (formValues.triggerType === 'custom' && !formValues.customPrompt) ||
                          (formValues.triggerType !== 'custom' && !formValues.selectedTemplateId) ||
                          formValues.steps.length === 0;

    const templatesForTrigger = formValues.triggerType === 'template' ? promptTemplates : agentTasks;

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
                        {/* Workflow Name - Tanstack Form Field */}
                        <workflowForm.Field name="name">
                            {(field) => (
                                <div className="space-y-2">
                                    <Label htmlFor="wf-name">Workflow Name</Label>
                                    <Input
                                        id="wf-name"
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                    />
                                    {field.state.meta.errors && (
                                        <div className="text-sm text-red-500">
                                            {field.state.meta.errors}
                                        </div>
                                    )}
                                </div>
                            )}
                        </workflowForm.Field>

                        {/* Workflow Description - Tanstack Form Field */}
                        <workflowForm.Field name="description">
                            {(field) => (
                                <div className="space-y-2">
                                    <Label htmlFor="wf-desc">Description</Label>
                                    <Textarea
                                        id="wf-desc"
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        rows={3}
                                    />
                                    {field.state.meta.errors && (
                                        <div className="text-sm text-red-500">
                                            {field.state.meta.errors}
                                        </div>
                                    )}
                                </div>
                            )}
                        </workflowForm.Field>
                        
                        <div className="border rounded-md p-3 flex-grow flex flex-col space-y-4">
                            <Label className="font-semibold">Trigger / Initial Message</Label>
                            
                            {/* Trigger Type Selection - Tanstack Form Field - IMMEDIATE onChange */}
                            <workflowForm.Field name="triggerType">
                                {(field) => (
                                    <RadioGroup 
                                        value={field.state.value} 
                                        onValueChange={(value) => {
                                            field.handleChange(value as TriggerType);
                                            workflowForm.setFieldValue('selectedTemplateId', '');
                                            // Immediate update for radio buttons - no debounce
                                            setCurrentWorkflow(prev => ({ ...prev }));
                                        }}
                                    >
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
                                )}
                            </workflowForm.Field>

                            {/* Custom Prompt Field - Tanstack Form Field - DEBOUNCED onChange */}
                            {formValues.triggerType === 'custom' && (
                                <workflowForm.Field name="customPrompt">
                                    {(field) => (
                                        <Textarea
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                            placeholder="Enter the first message to start the workflow..."
                                            className="flex-grow min-h-[100px]"
                                        />
                                    )}
                                </workflowForm.Field>
                            )}

                            {/* Template/Task Selection - Tanstack Form Field - IMMEDIATE onChange */}
                            {(formValues.triggerType === 'template' || formValues.triggerType === 'task') && (
                                <div className="space-y-2">
                                    <workflowForm.Field name="selectedTemplateId">
                                        {(field) => (
                                            <Select 
                                                value={field.state.value} 
                                                onValueChange={(value) => {
                                                    field.handleChange(value);
                                                    // Immediate update for selects - no debounce
                                                    setCurrentWorkflow(prev => ({ ...prev }));
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={`Select a ${formValues.triggerType}...`} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {templatesForTrigger.map(t => (
                                                        <SelectItem key={t.id} value={t.id}>
                                                            {formValues.triggerType === 'task' ? (t as any).prefixedName : t.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </workflowForm.Field>
                                    
                                    {/* Template Variable Form (if template has variables) */}
                                    {selectedTemplate && selectedTemplate.variables.length > 0 && <TemplateVariableForm />}
                                    
                                    {/* Live Preview Panel (like PromptLibraryControl) */}
                                    {selectedTemplate && (
                                        <div className="mt-4 border rounded-lg p-3">
                                            <Label className="text-sm font-medium">Live Preview</Label>
                                            <div 
                                                ref={previewElementRef}
                                                className="mt-2 p-3 bg-muted rounded text-sm font-mono whitespace-pre-wrap max-h-32 overflow-y-auto"
                                            >
                                                {selectedTemplate.prompt}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side: Steps with Tabbed Layout - 3/4 in XL, 2/3 in LG */}
                    <div className="xl:col-span-3 lg:col-span-2 flex flex-col h-full">
                        <Label className="mb-2">Workflow Steps ({formValues.steps.length})</Label>
                        <div className="flex-1 min-h-0">
                            <TabbedLayout
                                onValueChange={(value) => {
                                    // Just switch tabs, don't do any form operations here
                                    setActiveStepsTab(value);
                                }}
                                tabs={[
                                    {
                                        value: 'builder',
                                        label: 'Builder',
                                        content: (
                                            <div className="h-full flex flex-col">
                                                <ScrollArea className="flex-1 border rounded-md p-3">
                                                    <div className="space-y-4">
                                                        {formValues.steps.map((step, index) => (
                                                            <WorkflowStepCard
                                                                key={step.id}
                                                                step={step}
                                                                onChange={(updatedStep) => {
                                                                    const updatedSteps = [...formValues.steps];
                                                                    updatedSteps[index] = updatedStep;
                                                                    workflowForm.setFieldValue('steps', updatedSteps);
                                                                }}
                                                                onDelete={() => {
                                                                    const updatedSteps = formValues.steps.filter((_, i) => i !== index);
                                                                    workflowForm.setFieldValue('steps', updatedSteps);
                                                                }}
                                                                promptTemplates={promptTemplates}
                                                                agentTasks={agentTasks}
                                                                models={models}
                                                            />
                                                        ))}
                                                        {formValues.steps.length === 0 && (
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
                                                    key={visualizerUpdateKey}
                                                    workflow={liveWorkflow}
                                                    initialStepData={initialStepData}
                                                    stepDisplayData={stepDisplayData}
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
                                                    workflow={liveWorkflow}
                                                    onChange={(updatedWorkflow) => {
                                                        // Update form values from raw editor
                                                        workflowForm.setFieldValue('name', updatedWorkflow.name);
                                                        workflowForm.setFieldValue('description', updatedWorkflow.description);
                                                        workflowForm.setFieldValue('triggerType', (updatedWorkflow.triggerType as TriggerType) || 'custom');
                                                        workflowForm.setFieldValue('customPrompt', updatedWorkflow.triggerPrompt || '');
                                                        workflowForm.setFieldValue('selectedTemplateId', updatedWorkflow.triggerRef || '');
                                                        workflowForm.setFieldValue('steps', updatedWorkflow.steps);
                                                    }}
                                                    onSave={async (updatedWorkflow) => {
                                                        const now = new Date().toISOString();
                                                        const workflowToSave: WorkflowTemplate = {
                                                            ...updatedWorkflow,
                                                            id: updatedWorkflow.id || nanoid(),
                                                            createdAt: updatedWorkflow.createdAt || now,
                                                            updatedAt: now,
                                                        };
                                                        await PersistenceService.saveWorkflow(workflowToSave);
                                                        setCurrentWorkflow(workflowToSave);
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
                                initialValue={activeStepsTab}
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
                                    onClick={() => workflowForm.handleSubmit()}
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