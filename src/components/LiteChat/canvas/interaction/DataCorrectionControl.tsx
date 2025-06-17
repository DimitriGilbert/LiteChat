import React from 'react';
import type { WorkflowStep } from '@/types/litechat/workflow';
import { emitter } from '@/lib/litechat/event-emitter';
import { workflowEvent } from '@/types/litechat/events/workflow.events';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFormedible } from '../../../../hooks/use-formedible';
import * as z from 'zod';
import { Label } from '@/components/ui/label';

interface DataCorrectionControlProps {
    runId: string;
    step: WorkflowStep;
    rawAssistantResponse?: string;
}

const correctionSchema = z.object({
    correctedJson: z.string().min(2, "JSON cannot be empty.").refine(val => {
        try {
            JSON.parse(val);
            return true;
        } catch {
            return false;
        }
    }, { message: "Must be a valid JSON string." }),
});

type CorrectionFormData = z.infer<typeof correctionSchema>;

export const DataCorrectionControl: React.FC<DataCorrectionControlProps> = ({ runId, /*step,*/ rawAssistantResponse }) => {
    
    const fields = [
        {
            name: 'correctedJson',
            type: 'textarea',
            label: 'Corrected JSON Data',
            placeholder: '{ "key": "value", "another_key": 123 }',
            description: 'Enter the valid JSON that should have been produced by the assistant.',
        }
    ];

    let initialValue = '';
    try {
        if(rawAssistantResponse) {
            initialValue = JSON.stringify(JSON.parse(rawAssistantResponse), null, 2);
        }
    } catch {
        initialValue = rawAssistantResponse || '';
    }

    const { Form } = useFormedible<CorrectionFormData>({
        fields,
        schema: correctionSchema,
        submitLabel: 'Resume Workflow',
        formOptions: {
            defaultValues: {
                correctedJson: initialValue
            },
            onSubmit: ({ value }: { value: CorrectionFormData }) => {
                emitter.emit(workflowEvent.resumeRequest, {
                    runId,
                    resumeData: JSON.parse(value.correctedJson),
                });
            }
        }
    });

    return (
        <div className="p-4 border-l-4 border-yellow-500 bg-yellow-500/10 rounded-r-lg space-y-4">
            <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Action Required: Correct Data</AlertTitle>
                <AlertDescription>
                    The workflow paused because it couldn't automatically extract structured data. Please review the raw response below and provide the correct data in JSON format.
                </AlertDescription>
            </Alert>

            {rawAssistantResponse && (
                <div className="space-y-2">
                    <Label className='font-semibold'>Raw Assistant Response (from last attempt)</Label>
                    <ScrollArea className="h-48 border rounded-md bg-background p-3">
                        <pre className="text-sm whitespace-pre-wrap">{rawAssistantResponse}</pre>
                    </ScrollArea>
                </div>
            )}
            
            <Form />
        </div>
    );
}; 