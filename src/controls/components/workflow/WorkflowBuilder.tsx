import React, { useState } from 'react';
import type { WorkflowControlModule } from '@/controls/modules/WorkflowControlModule';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Plus, User } from 'lucide-react';
import { ActionTooltipButton } from '@/components/LiteChat/common/ActionTooltipButton';
import type { WorkflowStep, WorkflowTemplate } from '@/types/litechat/workflow';
import { WorkflowStepCard } from './WorkflowStepCard';

interface WorkflowBuilderProps {
    module: WorkflowControlModule;
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
    const [initialPrompt, setInitialPrompt] = useState('');

    const promptTemplates = module.getPromptTemplates();
    const agentTasks = module.getAgentTasks();

    const handleAddStep = () => {
        const newStep: WorkflowStep = {
            id: `step_${workflow.steps.length + 1}`,
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

    const handleRunWorkflow = () => {
        module.startWorkflow(workflow, initialPrompt);
        setOpen(false);
    };

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
                            Create a sequence of steps to automate tasks. The output of one step can be used as input for the next.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow overflow-hidden">
                        {/* Left Side: Workflow Configuration */}
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
                            <div className="space-y-2 flex-grow flex flex-col">
                                <Label>Initial Prompt (Your Message)</Label>
                                <Textarea
                                    value={initialPrompt}
                                    onChange={e => setInitialPrompt(e.target.value)}
                                    placeholder="Enter the first message to start the workflow..."
                                    className="flex-grow"
                                />
                            </div>
                        </div>

                        {/* Right Side: Steps */}
                        <div className="flex flex-col gap-4 overflow-hidden">
                            <Label>Workflow Steps ({workflow.steps.length})</Label>
                            <ScrollArea className="border rounded-md p-3 flex-grow">
                                <div className="space-y-4">
                                    {workflow.steps.map((step, index) => (
                                        <WorkflowStepCard
                                            key={step.id}
                                            step={step}
                                            onChange={handleStepChange}
                                            promptTemplates={promptTemplates}
                                            agentTasks={agentTasks}
                                        />
                                    ))}
                                    {workflow.steps.length === 0 && (
                                        <div className="text-center text-muted-foreground py-8">
                                            No steps yet. Add one to get started.
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
                        <Button onClick={handleRunWorkflow} disabled={!initialPrompt || workflow.steps.length === 0}>
                            Run Workflow
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}; 