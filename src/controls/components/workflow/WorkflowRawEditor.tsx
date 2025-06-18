import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CodeEditor } from '@/components/LiteChat/common/CodeEditor';
import type { WorkflowTemplate } from '@/types/litechat/workflow';
import { toast } from 'sonner';

interface WorkflowRawEditorProps {
  workflow: WorkflowTemplate;
  onChange: (workflow: WorkflowTemplate) => void;
  onSave?: (workflow: WorkflowTemplate) => void;
  disabled?: boolean;
  className?: string;
}

export const WorkflowRawEditor: React.FC<WorkflowRawEditorProps> = ({
  workflow,
  onChange,
  onSave,
  disabled = false,
  className,
}) => {
  const [rawValue, setRawValue] = useState('');
  const [validationError, setValidationError] = useState<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize raw value from workflow
  useEffect(() => {
    try {
      const formattedJson = JSON.stringify(workflow, null, 2);
      setRawValue(formattedJson);
      setValidationError('');
    } catch (error) {
      setValidationError(`Failed to serialize workflow: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [workflow]);

  // Validate and parse the raw JSON
  const validateAndParse = useCallback((jsonString: string): { isValid: boolean; workflow?: WorkflowTemplate; error?: string } => {
    if (!jsonString.trim()) {
      return { isValid: false, error: 'Workflow definition cannot be empty' };
    }

    try {
      const parsed = JSON.parse(jsonString);
      
      // Basic validation of required fields
      if (typeof parsed !== 'object' || parsed === null) {
        return { isValid: false, error: 'Workflow must be a valid JSON object' };
      }

      if (!parsed.id || typeof parsed.id !== 'string') {
        return { isValid: false, error: 'Workflow must have a valid "id" field (string)' };
      }

      if (!parsed.name || typeof parsed.name !== 'string') {
        return { isValid: false, error: 'Workflow must have a valid "name" field (string)' };
      }

      if (!parsed.description || typeof parsed.description !== 'string') {
        return { isValid: false, error: 'Workflow must have a valid "description" field (string)' };
      }

      if (!Array.isArray(parsed.steps)) {
        return { isValid: false, error: 'Workflow must have a "steps" field that is an array' };
      }

      if (!parsed.createdAt || typeof parsed.createdAt !== 'string') {
        return { isValid: false, error: 'Workflow must have a valid "createdAt" field (ISO string)' };
      }

      if (!parsed.updatedAt || typeof parsed.updatedAt !== 'string') {
        return { isValid: false, error: 'Workflow must have a valid "updatedAt" field (ISO string)' };
      }

      // Validate each step
      for (let i = 0; i < parsed.steps.length; i++) {
        const step = parsed.steps[i];
        
        if (!step.id || typeof step.id !== 'string') {
          return { isValid: false, error: `Step ${i + 1}: must have a valid "id" field (string)` };
        }

        if (!step.name || typeof step.name !== 'string') {
          return { isValid: false, error: `Step ${i + 1}: must have a valid "name" field (string)` };
        }

        if (!step.type || typeof step.type !== 'string') {
          return { isValid: false, error: `Step ${i + 1}: must have a valid "type" field (string)` };
        }

        const validTypes = ['prompt', 'agent-task', 'human-in-the-loop'];
        if (!validTypes.includes(step.type)) {
          return { isValid: false, error: `Step ${i + 1}: type must be one of: ${validTypes.join(', ')}` };
        }

        // Optional fields validation
        if (step.modelId !== undefined && typeof step.modelId !== 'string') {
          return { isValid: false, error: `Step ${i + 1}: "modelId" must be a string if provided` };
        }

        if (step.templateId !== undefined && typeof step.templateId !== 'string') {
          return { isValid: false, error: `Step ${i + 1}: "templateId" must be a string if provided` };
        }

        if (step.instructionsForHuman !== undefined && typeof step.instructionsForHuman !== 'string') {
          return { isValid: false, error: `Step ${i + 1}: "instructionsForHuman" must be a string if provided` };
        }

        if (step.prompt !== undefined && typeof step.prompt !== 'string') {
          return { isValid: false, error: `Step ${i + 1}: "prompt" must be a string if provided` };
        }

        if (step.inputMapping !== undefined) {
          if (typeof step.inputMapping !== 'object' || step.inputMapping === null || Array.isArray(step.inputMapping)) {
            return { isValid: false, error: `Step ${i + 1}: "inputMapping" must be an object if provided` };
          }
          
          // Validate that all values in inputMapping are strings
          for (const [key, value] of Object.entries(step.inputMapping)) {
            if (typeof value !== 'string') {
              return { isValid: false, error: `Step ${i + 1}: inputMapping["${key}"] must be a string` };
            }
          }
        }

        if (step.structuredOutput !== undefined) {
          if (typeof step.structuredOutput !== 'object' || step.structuredOutput === null || Array.isArray(step.structuredOutput)) {
            return { isValid: false, error: `Step ${i + 1}: "structuredOutput" must be an object if provided` };
          }

          if (!step.structuredOutput.schema || typeof step.structuredOutput.schema !== 'object') {
            return { isValid: false, error: `Step ${i + 1}: structuredOutput must have a "schema" object` };
          }

          if (!step.structuredOutput.jsonSchema || typeof step.structuredOutput.jsonSchema !== 'object') {
            return { isValid: false, error: `Step ${i + 1}: structuredOutput must have a "jsonSchema" object` };
          }
        }
      }

      return { isValid: true, workflow: parsed as WorkflowTemplate };
    } catch (error) {
      return { 
        isValid: false, 
        error: `JSON parsing error: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }, []);

  // Debounced validation - ONLY update validation errors, NO parent calls
  const debouncedValidate = useCallback((value: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      const validation = validateAndParse(value);
      setValidationError(validation.error || '');
    }, 300); // Faster debounce for validation display
  }, [validateAndParse]);

  // Handle changes to the raw editor - ONLY update local state, NO parent onChange
  const handleRawChange = useCallback((value: string) => {
    setRawValue(value);
    debouncedValidate(value);
    // NO onChange(validation.workflow) here - that was causing re-renders!
  }, [debouncedValidate]);

  // Handle save with validation - ONLY place where parent onChange is called
  const handleSave = useCallback(async (value: string) => {
    const validation = validateAndParse(value);
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid workflow definition');
    }

    if (!validation.workflow) {
      throw new Error('Failed to parse workflow definition');
    }

    try {
      if (onSave) {
        await onSave(validation.workflow);
        toast.success('Workflow saved successfully');
      }
      // Update parent ONLY when saving
      onChange(validation.workflow);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Save failed: ${errorMessage}`);
    }
  }, [onSave, validateAndParse, onChange]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={className}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Raw Workflow Editor</h3>
        <p className="text-sm text-muted-foreground">
          Edit the workflow as JSON. Changes are validated in real-time. Use the save button to persist changes to the database.
        </p>
      </div>
      
      <CodeEditor
        value={rawValue}
        onChange={handleRawChange}
        language="json"
        placeholder="Enter workflow JSON definition..."
        error={validationError}
        onSave={onSave ? handleSave : undefined}
        showSaveButton={!!onSave}
        saveButtonText="Save Workflow"
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}; 