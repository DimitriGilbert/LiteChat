import type { WorkflowTemplate } from "@/types/litechat/workflow";

export interface WorkflowValidationResult {
  isValid: boolean;
  workflow?: WorkflowTemplate;
  error?: string;
}

/**
 * Validates and parses a workflow definition from JSON string (comprehensive validation)
 */
export function validateWorkflow(jsonString: string): WorkflowValidationResult {
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
}

/**
 * Simple workflow validation for block renderer - less strict than editor
 */
export function validateWorkflowForRenderer(jsonString: string): WorkflowValidationResult {
  if (!jsonString.trim()) {
    return { isValid: false, error: 'Workflow definition cannot be empty' };
  }

  try {
    const parsed = JSON.parse(jsonString);
    
    // Basic validation
    if (typeof parsed !== 'object' || parsed === null) {
      return { isValid: false, error: 'Workflow must be a valid JSON object' };
    }
    
    if (!parsed.id || typeof parsed.id !== 'string') {
      return { isValid: false, error: 'Workflow must have a valid id' };
    }
    
    if (!parsed.name || typeof parsed.name !== 'string') {
      return { isValid: false, error: 'Workflow must have a valid name' };
    }
    
    if (!Array.isArray(parsed.steps)) {
      return { isValid: false, error: 'Workflow must have a steps array' };
    }

    return { isValid: true, workflow: parsed as WorkflowTemplate };
  } catch (error) {
    return { 
      isValid: false, 
      error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}