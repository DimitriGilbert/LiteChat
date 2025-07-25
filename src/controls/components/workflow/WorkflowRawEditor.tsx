import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CodeEditor } from '@/components/LiteChat/common/CodeEditor';
import type { WorkflowTemplate } from '@/types/litechat/workflow';
import { toast } from 'sonner';
import { validateWorkflow } from '@/lib/litechat/workflow-validation';

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
    return validateWorkflow(jsonString);
  }, []);

  // Debounced validation - ONLY update validation errors, NO parent calls
  const debouncedValidate = useCallback((value: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      const validation = validateAndParse(value);
      setValidationError(validation.error || '');
    }, 750); // Increased from 300ms to 750ms for better textarea UX
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