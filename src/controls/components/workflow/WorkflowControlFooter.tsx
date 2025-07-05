import React, { useState } from 'react';
import { useWorkflowStore } from '@/store/workflow.store';
import { useShallow } from 'zustand/react/shallow';
import type { WorkflowDisplayModule } from '@/controls/modules/WorkflowDisplayModule';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { AlertCircle, Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface WorkflowControlFooterProps {
    module: WorkflowDisplayModule;
}

export const WorkflowControlFooter: React.FC<WorkflowControlFooterProps> = ({ module }) => {
    const { t } = useTranslation('controls');
    const { activeRun, pausePayload } = useWorkflowStore(
        useShallow(state => ({
            activeRun: state.activeRun,
            pausePayload: state.pausePayload,
        }))
    );
    
    const [resumeData, setResumeData] = useState<string>('');

    // Only render if there's an active paused workflow
    if (!activeRun || activeRun.status !== 'paused' || !pausePayload) {
        return null;
    }
    
    const { step, pauseReason, rawAssistantResponse } = pausePayload;

    const handleResume = () => {
        let finalResumeData: any = resumeData;
        if (pauseReason === 'data-correction') {
            try {
                finalResumeData = JSON.parse(resumeData);
            } catch (e) {
                toast.error(t('workflowFooter.invalidJson'));
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
                    {t('workflowFooter.workflowPaused')}
                </CardTitle>
                <CardDescription className="text-xs">
                    {t('workflowFooter.stepRequiresInput', { stepName: step?.name || t('workflowFooter.unknownStep') })}
                </CardDescription>
            </CardHeader>
            <CardContent className="py-2">
                {pauseReason === 'data-correction' && (
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                            {t('workflowFooter.dataCorrection.reviewInstruction')}
                        </p>
                        <Textarea
                            value={resumeData || defaultCorrectionData}
                            onChange={(e) => setResumeData(e.target.value)}
                            className="text-xs font-mono"
                            rows={6}
                            placeholder={t('workflowFooter.dataCorrection.placeholder')}
                        />
                    </div>
                )}
                {pauseReason === 'human-in-the-loop' && (
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                            {t('workflowFooter.humanInLoop.provideInput')}
                        </p>
                        <Textarea
                            value={resumeData}
                            onChange={(e) => setResumeData(e.target.value)}
                            className="text-xs"
                            rows={3}
                            placeholder={t('workflowFooter.humanInLoop.placeholder')}
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
                    {t('workflowFooter.resume')}
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    className="flex-1"
                >
                    <X className="h-3 w-3 mr-1" />
                    {t('workflowFooter.cancel')}
                </Button>
            </CardFooter>
        </Card>
    );
}; 