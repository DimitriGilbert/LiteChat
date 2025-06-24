import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Plus, Copy, Play } from 'lucide-react';
import { ActionTooltipButton } from '@/components/LiteChat/common/ActionTooltipButton';
import type { WorkflowTemplate } from '@/types/litechat/workflow';
import type { WorkflowControlModule } from '@/controls/modules/WorkflowControlModule';
import { PersistenceService } from '@/services/persistence.service';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import { WorkflowShortcutToggle } from './WorkflowShortcutToggle';

interface WorkflowListProps {
    module: WorkflowControlModule;
    onEditWorkflow: (workflow: WorkflowTemplate) => void;
    onCreateNew: () => void;
    onWorkflowsChanged?: () => void;
    onWorkflowRun?: () => void;
}

export const WorkflowList: React.FC<WorkflowListProps> = ({ 
    module, 
    onEditWorkflow, 
    onCreateNew,
    onWorkflowsChanged,
    onWorkflowRun
}) => {
    const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadWorkflows();
    }, []);

    const loadWorkflows = async () => {
        try {
            setIsLoading(true);
            const savedWorkflows = await PersistenceService.loadWorkflows();
            setWorkflows(savedWorkflows);
        } catch (error) {
            console.error("Failed to load workflows:", error);
            toast.error("Failed to load workflows");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteWorkflow = async (workflowId: string, workflowName: string) => {
        if (!confirm(`Are you sure you want to delete the workflow "${workflowName}"?`)) {
            return;
        }

        try {
            await PersistenceService.deleteWorkflow(workflowId);
            setWorkflows(prev => prev.filter(w => w.id !== workflowId));
            await module.refreshWorkflows();
            onWorkflowsChanged?.();
            toast.success(`Deleted workflow "${workflowName}"`);
        } catch (error) {
            console.error("Failed to delete workflow:", error);
            toast.error("Failed to delete workflow");
        }
    };

    const handleDuplicateWorkflow = async (workflow: WorkflowTemplate) => {
        try {
            const duplicatedWorkflow: WorkflowTemplate = {
                ...workflow,
                id: nanoid(),
                name: `${workflow.name} (Copy)`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await PersistenceService.saveWorkflow(duplicatedWorkflow);
            setWorkflows(prev => [...prev, duplicatedWorkflow]);
            await module.refreshWorkflows();
            onWorkflowsChanged?.();
            toast.success(`Duplicated workflow "${workflow.name}"`);
        } catch (error) {
            console.error("Failed to duplicate workflow:", error);
            toast.error("Failed to duplicate workflow");
        }
    };

    const checkIfWorkflowNeedsInput = (workflow: WorkflowTemplate): boolean => {
        // Check if trigger needs input
        if (workflow.triggerType === 'custom' && !workflow.triggerPrompt) {
            return true; // Custom trigger without prompt
        }
        
        if (workflow.triggerType === 'template' && workflow.triggerRef) {
            // Check if template has variables that need values
            const template = module.getPromptTemplates().find(t => t.id === workflow.triggerRef);
            if (template && template.variables && template.variables.length > 0) {
                // Check if templateVariables has all required values
                const hasAllValues = template.variables.every(variable => {
                    const value = workflow.templateVariables?.[variable.name];
                    return value !== undefined && value !== null && value !== '';
                });
                if (!hasAllValues) return true;
            }
        }
        
        // Workflow is ready to run
        return false;
    };

    const handleRunWorkflow = (workflow: WorkflowTemplate) => {
        const needsInput = checkIfWorkflowNeedsInput(workflow);
        
        if (needsInput) {
            // Open builder for configuration
            onEditWorkflow(workflow);
            toast.info(`Workflow "${workflow.name}" needs configuration`, {
                description: "Opening workflow builder to set up required inputs.",
                duration: 3000,
            });
        } else {
            // Use workflow's trigger prompt or fallback to simple default
            const triggerPrompt = workflow.triggerPrompt || "Execute workflow";
            module.startWorkflow(workflow, triggerPrompt);
            onWorkflowRun?.(); // Close dialog after starting workflow
            toast.success(`Workflow "${workflow.name}" started!`);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-muted-foreground">Loading workflows...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">Saved Workflows</h3>
                    <p className="text-sm text-muted-foreground">
                        {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} saved
                    </p>
                </div>
                <Button onClick={onCreateNew} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create New Workflow
                </Button>
            </div>

            {workflows.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="text-center space-y-2">
                            <p className="text-muted-foreground">No workflows created yet</p>
                            <p className="text-sm text-muted-foreground">
                                Create your first workflow to automate sequences of AI interactions
                            </p>
                            <Button onClick={onCreateNew} className="mt-4">
                                <Plus className="h-4 w-4 mr-2" />
                                Create Your First Workflow
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {workflows.map((workflow) => (
                        <Card key={workflow.id} className="flex flex-col">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <CardTitle className="text-base truncate">
                                            {workflow.name}
                                        </CardTitle>
                                        <CardDescription className="text-xs line-clamp-2">
                                            {workflow.description}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0 flex-1 flex flex-col">
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-xs">
                                            {workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            Updated {new Date(workflow.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    
                                    {workflow.steps.length > 0 && (
                                        <div className="text-xs text-muted-foreground">
                                            Steps: {workflow.steps.map(s => s.name).join(', ')}
                                        </div>
                                    )}
                                    
                                    <div className="mt-2">
                                        <WorkflowShortcutToggle 
                                            workflow={workflow}
                                            onToggle={() => {
                                                // Refresh workflows to update UI
                                                loadWorkflows();
                                                onWorkflowsChanged?.();
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 mt-4 pt-2 border-t">
                                    <ActionTooltipButton
                                        tooltipText="Run Workflow"
                                        onClick={() => handleRunWorkflow(workflow)}
                                        icon={<Play />}
                                        className="h-8 w-8"
                                        variant="ghost"
                                    />
                                    <ActionTooltipButton
                                        tooltipText="Edit Workflow"
                                        onClick={() => onEditWorkflow(workflow)}
                                        icon={<Edit />}
                                        className="h-8 w-8"
                                        variant="ghost"
                                    />
                                    <ActionTooltipButton
                                        tooltipText="Duplicate Workflow"
                                        onClick={() => handleDuplicateWorkflow(workflow)}
                                        icon={<Copy />}
                                        className="h-8 w-8"
                                        variant="ghost"
                                    />
                                    <ActionTooltipButton
                                        tooltipText="Delete Workflow"
                                        onClick={() => handleDeleteWorkflow(workflow.id, workflow.name)}
                                        icon={<Trash2 />}
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        variant="ghost"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}; 