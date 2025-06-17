import React, { useState } from 'react';
import { useWorkflowStore } from '@/store/workflow.store';
import { useShallow } from 'zustand/react/shallow';
import type { WorkflowDisplayModule } from '@/controls/modules/WorkflowDisplayModule';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { AlertCircle, Play, X } from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowControlFooterProps {
    module: WorkflowDisplayModule;
}

export const WorkflowControlFooter: React.FC<WorkflowControlFooterProps> = ({ module }) => {
    const { activeRun, pausePayload } = useWorkflowStore(
        useShallow(state => ({
            activeRun: state.activeRun,
            pausePayload: state.pausePayload,
        }))
    );
    
    const [resumeData, setResumeData] = useState<string>('');

    // Only render if there's an active paused workflow
    if (!activeRun || activeRun.status !== 'PAUSED' || !pausePayload) {
        return null;
    }
    
    const { step, pauseReason, rawAssistantResponse } = pausePayload;

    const handleResume = () => {
        let finalResumeData: any = resumeData;
        if (pauseReason === 'data-correction') {
            try {
                finalResumeData = JSON.parse(resumeData);
            } catch (e) {
                toast.error('Invalid JSON. Please correct the data before resuming.');
                return;
            }
        }
        module.resumeWorkflow(activeRun.runId, finalResumeData);
    };

    const handleCancel = () => {
        module.cancelWorkflow(activeRun.runId);
    };

    const defaultCorrectionData = rawAssistantResponse ? 
        (() => {
            try {
                return JSON.stringify(JSON.parse(rawAssistantResponse), null, 2);
            } catch {
                return rawAssistantResponse;
            }
        })() : 
        '';

    return (
        <Card className="m-4">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    Workflow Paused
                </CardTitle>
                <CardDescription className="text-xs">
                    Step "{step?.name || 'Unknown'}" requires your input to continue.
                </CardDescription>
            </CardHeader>
            <CardContent className="py-2">
                {pauseReason === 'data-correction' && (
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                            Review and correct the data before continuing:
                        </p>
                        <Textarea
                            value={resumeData || defaultCorrectionData}
                            onChange={(e) => setResumeData(e.target.value)}
                            className="text-xs font-mono"
                            rows={6}
                            placeholder="Enter corrected data..."
                        />
                    </div>
                )}
                {pauseReason === 'human-in-the-loop' && (
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                            Provide input to continue the workflow:
                        </p>
                        <Textarea
                            value={resumeData}
                            onChange={(e) => setResumeData(e.target.value)}
                            className="text-xs"
                            rows={3}
                            placeholder="Enter your input..."
                        />
                    </div>
                )}
            </CardContent>
            <CardFooter className="pt-2 gap-2">
                <Button
                    size="sm"
                    onClick={handleResume}
                    className="flex-1"
                    disabled={pauseReason === 'human-in-the-loop' && !resumeData.trim()}
                >
                    <Play className="h-3 w-3 mr-1" />
                    Resume
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    className="flex-1"
                >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                </Button>
            </CardFooter>
        </Card>
    );
}; 