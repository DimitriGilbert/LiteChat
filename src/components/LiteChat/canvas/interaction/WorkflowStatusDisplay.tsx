import React from 'react';
import type { Interaction } from '@/types/litechat/interaction';
import { useWorkflowStore } from '@/store/workflow.store';
import { Loader2, CircleCheck, CircleX, UserCheck } from 'lucide-react';
import { HumanInTheLoopControl } from '@/components/LiteChat/canvas/interaction/HumanInTheLoopControl';
import { DataCorrectionControl } from './DataCorrectionControl';

interface WorkflowStatusDisplayProps {
    interaction: Interaction;
}

export const WorkflowStatusDisplay: React.FC<WorkflowStatusDisplayProps> = ({ interaction }) => {
    const { activeRun, pausePayload } = useWorkflowStore(state => ({ 
        activeRun: state.activeRun, 
        pausePayload: state.pausePayload 
    }));

    if (!activeRun || activeRun.mainInteractionId !== interaction.id) {
        return null;
    }

    const workflowName = activeRun.template.name || 'Workflow';
    const status = activeRun.status;
    const currentStep = activeRun.currentStepIndex;
    const totalSteps = activeRun.template.steps.length;

    let Icon = Loader2;
    let text = `${workflowName}: Initializing...`;
    let color = "text-muted-foreground";

    switch (status) {
        case "running":
        case "streaming":
            Icon = Loader2;
            text = `${workflowName}: Running step ${currentStep + 1} of ${totalSteps}...`;
            color = "text-blue-500";
            break;
        case "paused":
            if (pausePayload?.pauseReason === 'data-correction') {
                Icon = UserCheck;
                text = `${workflowName}: Paused - Awaiting data correction`;
                color = "text-yellow-500";
            } else {
                Icon = UserCheck;
                text = `${workflowName}: Paused - Awaiting your input`;
                color = "text-yellow-500";
            }
            break;
        case "completed":
            Icon = CircleCheck;
            text = `${workflowName}: Completed successfully.`;
            color = "text-green-500";
            break;
        case "error":
        case "failed":
            Icon = CircleX;
            text = `${workflowName}: Failed.`;
            color = "text-red-500";
            break;
        case "cancelled":
            Icon = CircleX;
            text = `${workflowName}: Cancelled.`;
            color = "text-muted-foreground";
            break;
    }

    const renderPauseControl = () => {
        if (status !== 'paused' || !pausePayload) return null;

        if (pausePayload.pauseReason === 'data-correction') {
            return <DataCorrectionControl 
                        runId={pausePayload.runId} 
                        step={pausePayload.step}
                        rawAssistantResponse={pausePayload.rawAssistantResponse} 
                    />;
        }

        if (pausePayload.pauseReason === 'human-in-the-loop') {
            return <HumanInTheLoopControl run={activeRun} />;
        }

        return null;
    };

    return (
        <div className="p-4 space-y-4">
            <div className={`flex items-center gap-3 font-semibold text-lg ${color}`}>
                <Icon className={`h-6 w-6 ${status === 'running' || status === 'streaming' ? 'animate-spin' : ''}`} />
                <h2>{text}</h2>
            </div>
            {renderPauseControl()}
            {(status === 'error' || status === 'failed') && activeRun?.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                    <strong>Error:</strong> {activeRun.error}
                </div>
            )}
        </div>
    );
};