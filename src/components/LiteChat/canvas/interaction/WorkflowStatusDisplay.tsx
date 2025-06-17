import React from 'react';
import type { Interaction } from '@/types/litechat/interaction';
import { useWorkflowStore } from '@/store/workflow.store';
import { Loader2, CircleCheck, CircleX, Hourglass, UserCheck } from 'lucide-react';
import { HumanInTheLoopControl } from './HumanInTheLoopControl';

interface WorkflowStatusDisplayProps {
    interaction: Interaction;
}

export const WorkflowStatusDisplay: React.FC<WorkflowStatusDisplayProps> = ({ interaction }) => {
    const activeRun = useWorkflowStore(state => state.activeRun);

    const workflowName = interaction.metadata?.workflowName || 'Workflow';
    const status = activeRun?.mainInteractionId === interaction.id ? activeRun.status : interaction.status;
    const currentStep = activeRun?.mainInteractionId === interaction.id ? activeRun.currentStepIndex : 0;
    const totalSteps = activeRun?.mainInteractionId === interaction.id ? activeRun.template.steps.length : 0;

    let Icon = Loader2;
    let text = `${workflowName}: Initializing...`;
    let color = "text-muted-foreground";

    switch (status) {
        case "RUNNING":
        case "STREAMING":
            Icon = Loader2;
            text = `${workflowName}: Running step ${currentStep + 1} of ${totalSteps}...`;
            color = "text-blue-500";
            break;
        case "PAUSED":
            Icon = UserCheck;
            text = `${workflowName}: Paused - Awaiting your input`;
            color = "text-yellow-500";
            break;
        case "COMPLETED":
            Icon = CircleCheck;
            text = `${workflowName}: Completed successfully.`;
            color = "text-green-500";
            break;
        case "ERROR":
            Icon = CircleX;
            text = `${workflowName}: Failed.`;
            color = "text-red-500";
            break;
        case "CANCELLED":
            Icon = CircleX;
            text = `${workflowName}: Cancelled.`;
            color = "text-muted-foreground";
            break;
    }

    return (
        <div className="p-4 space-y-4">
            <div className={`flex items-center gap-3 font-semibold text-lg ${color}`}>
                <Icon className={`h-6 w-6 ${status === 'RUNNING' || status === 'STREAMING' ? 'animate-spin' : ''}`} />
                <h2>{text}</h2>
            </div>
            {status === 'PAUSED' && <HumanInTheLoopControl run={activeRun} />}
            {status === 'ERROR' && activeRun?.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                    <strong>Error:</strong> {activeRun.error}
                </div>
            )}
        </div>
    );
}; 