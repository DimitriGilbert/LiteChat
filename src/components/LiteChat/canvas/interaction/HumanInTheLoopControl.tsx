import React, { useState } from 'react';
import type { WorkflowRun } from '@/types/litechat/workflow';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { workflowEvent } from '@/types/litechat/events/workflow.events';
import { emitter } from '@/lib/litechat/event-emitter';

interface HumanInTheLoopControlProps {
    run: WorkflowRun | null;
}

export const HumanInTheLoopControl: React.FC<HumanInTheLoopControlProps> = ({ run }) => {
    const [resumeData, setResumeData] = useState(() => {
        if (!run) return '';
        try {
            return JSON.stringify(run.stepOutputs, null, 2);
        } catch {
            return '';
        }
    });

    if (!run) {
        return null;
    }

    const currentStep = run.template.steps[run.currentStepIndex];

    const handleResume = () => {
        let parsedData = resumeData;
        try {
            // Try to parse if it's JSON, otherwise use as string
            parsedData = JSON.parse(resumeData);
        } catch (e) {
            // Not JSON, treat as raw string
        }
        emitter.emit(workflowEvent.resumeRequest, { runId: run.runId, resumeData: parsedData });
    };

    return (
        <div className="p-4 border-t space-y-3">
            <h3 className="font-semibold text-base">Action Required</h3>
            <p className="text-sm text-muted-foreground">
                {currentStep.instructionsForHuman || "Please review the data below and click Continue."}
            </p>
            <div className="space-y-1">
                <Label htmlFor={`hitl-data-${run.runId}`}>Data (edit if needed)</Label>
                <Textarea
                    id={`hitl-data-${run.runId}`}
                    value={resumeData}
                    onChange={(e) => setResumeData(e.target.value)}
                    rows={8}
                    className="font-mono text-xs"
                />
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => emitter.emit(workflowEvent.cancelRequest, { runId: run.runId })}>
                    Cancel Workflow
                </Button>
                <Button onClick={handleResume}>
                    Continue
                </Button>
            </div>
        </div>
    );
}; 