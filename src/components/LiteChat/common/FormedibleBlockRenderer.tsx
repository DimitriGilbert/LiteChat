import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
} from "react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import type { CanvasControl } from "@/types/litechat/canvas/control";
import { useControlRegistryStore } from "@/store/control.store";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { AlertCircleIcon, Loader2Icon, FormInputIcon, CodeIcon } from "lucide-react";
import { CodeBlockRenderer } from "./CodeBlockRenderer";
import { toast } from "sonner";
import { useFormedible } from "@/hooks/use-formedible";
import { z } from "zod";
import { emitter } from "@/lib/litechat/event-emitter";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import { ConversationService } from "@/services/conversation.service";
import { nanoid } from "nanoid";
import type { PromptTurnObject } from "@/types/litechat/prompt";

interface FormedibleBlockRendererProps {
  code: string;
  isStreaming?: boolean;
}

// Safe parser for Formedible form definitions
class FormedibleParser {
  private static readonly ALLOWED_FIELD_TYPES = [
    'text', 'email', 'password', 'url', 'tel', 'textarea', 'select', 
    'checkbox', 'switch', 'number', 'date', 'slider', 'file'
  ];

  private static readonly ALLOWED_KEYS = [
    'schema', 'fields', 'pages', 'progress', 'submitLabel', 'nextLabel', 
    'previousLabel', 'formClassName', 'fieldClassName', 'formOptions'
  ];

  private static readonly ALLOWED_FIELD_KEYS = [
    'name', 'type', 'label', 'placeholder', 'description', 'options', 
    'min', 'max', 'step', 'accept', 'multiple', 'page', 'conditional'
  ];

  private static readonly ALLOWED_PAGE_KEYS = [
    'page', 'title', 'description'
  ];

  private static readonly ALLOWED_PROGRESS_KEYS = [
    'showSteps', 'showPercentage', 'className'
  ];

  private static readonly ALLOWED_FORM_OPTIONS_KEYS = [
    'defaultValues', 'asyncDebounceMs', 'canSubmitWhenInvalid'
  ];

  static parse(code: string): any {
    try {
      // Remove any potential function calls or dangerous patterns
      const sanitizedCode = this.sanitizeCode(code);
      
      // Parse the JSON-like structure
      const parsed = this.parseObjectLiteral(sanitizedCode);
      
      // Validate and sanitize the parsed object
      return this.validateAndSanitize(parsed);
    } catch (error) {
      throw new Error(`Failed to parse Formedible definition: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private static sanitizeCode(code: string): string {
    // Remove comments
    let sanitized = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    
    // Remove any function calls or expressions that could be dangerous
    sanitized = sanitized.replace(/\b(eval|Function|setTimeout|setInterval|require|import)\s*\(/g, '');
    
    // Remove any arrow functions or function expressions
    sanitized = sanitized.replace(/=>\s*{[^}]*}/g, '""');
    sanitized = sanitized.replace(/function\s*\([^)]*\)\s*{[^}]*}/g, '""');
    
    return sanitized;
  }

    private static parseObjectLiteral(code: string): any {
    try {
      // First try direct JSON parsing
      return JSON.parse(code);
    } catch (jsonError) {
      // If that fails, try to convert JS object literal to JSON
      try {
        let processedCode = code.trim();
        
        // Replace Zod expressions with placeholder strings - handle nested structures
        processedCode = this.replaceZodExpressions(processedCode);
        
        // Convert unquoted keys to quoted keys
        processedCode = processedCode.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
        
        // Remove trailing commas
        processedCode = processedCode.replace(/,(\s*[}\]])/g, '$1');
        
        // Convert single quotes to double quotes
        processedCode = processedCode.replace(/'/g, '"');
        
        return JSON.parse(processedCode);
      } catch (conversionError) {
        throw new Error(`Invalid syntax. Please use valid JSON format or JavaScript object literal syntax. Error: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`);
      }
    }
  }

  private static replaceZodExpressions(code: string): string {
    // Handle nested Zod expressions by finding balanced parentheses
    let result = code;
    let changed = true;
    
    while (changed) {
      changed = false;
      // Match z.method( and find the matching closing parenthesis
      const zodMatch = result.match(/z\.[a-zA-Z]+\(/);
      if (zodMatch) {
        const startIndex = zodMatch.index!;
        const openParenIndex = startIndex + zodMatch[0].length - 1;
        
        // Find the matching closing parenthesis
        let depth = 1;
        let endIndex = openParenIndex + 1;
        
        while (endIndex < result.length && depth > 0) {
          if (result[endIndex] === '(') {
            depth++;
          } else if (result[endIndex] === ')') {
            depth--;
          }
          endIndex++;
        }
        
        if (depth === 0) {
          // Check for chained methods like .min().max()
          let chainEnd = endIndex;
          while (chainEnd < result.length) {
            const chainMatch = result.slice(chainEnd).match(/^\.[a-zA-Z]+\(/);
            if (chainMatch) {
              // Find the closing parenthesis for this chained method
              let chainDepth = 1;
              let chainParenIndex = chainEnd + chainMatch[0].length - 1;
              let chainEndIndex = chainParenIndex + 1;
              
              while (chainEndIndex < result.length && chainDepth > 0) {
                if (result[chainEndIndex] === '(') {
                  chainDepth++;
                } else if (result[chainEndIndex] === ')') {
                  chainDepth--;
                }
                chainEndIndex++;
              }
              
              if (chainDepth === 0) {
                chainEnd = chainEndIndex;
              } else {
                break;
              }
            } else {
              break;
            }
          }
          
          // Replace the entire Zod expression with a placeholder
          result = result.slice(0, startIndex) + '"__ZOD_SCHEMA__"' + result.slice(chainEnd);
          changed = true;
        } else {
          // If we can't find matching parentheses, just replace the method name
          result = result.replace(/z\.[a-zA-Z]+/, '"__ZOD_SCHEMA__"');
          changed = true;
        }
      }
    }
    
    return result;
  }

  private static validateAndSanitize(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      throw new Error('Definition must be an object');
    }

    const sanitized: any = {};

    // Validate top-level keys
    for (const [key, value] of Object.entries(obj)) {
      if (!this.ALLOWED_KEYS.includes(key)) {
        continue; // Skip unknown keys
      }

      switch (key) {
        case 'schema':
          // Skip schema validation for now - we'll create a simple one
          break;
        case 'fields':
          sanitized[key] = this.validateFields(value);
          break;
        case 'pages':
          sanitized[key] = this.validatePages(value);
          break;
        case 'progress':
          sanitized[key] = this.validateProgress(value);
          break;
        case 'formOptions':
          sanitized[key] = this.validateFormOptions(value);
          break;
        case 'submitLabel':
        case 'nextLabel':
        case 'previousLabel':
        case 'formClassName':
        case 'fieldClassName':
          if (typeof value === 'string') {
            sanitized[key] = value;
          }
          break;
      }
    }

    return sanitized;
  }

  private static validateFields(fields: any): any[] {
    if (!Array.isArray(fields)) {
      throw new Error('Fields must be an array');
    }

    return fields.map((field, index) => {
      if (typeof field !== 'object' || field === null) {
        throw new Error(`Field at index ${index} must be an object`);
      }

      const sanitizedField: any = {};

      for (const [key, value] of Object.entries(field)) {
        if (!this.ALLOWED_FIELD_KEYS.includes(key)) {
          continue;
        }

        switch (key) {
          case 'name':
            if (typeof value === 'string' && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value)) {
              sanitizedField[key] = value;
            }
            break;
          case 'type':
            if (typeof value === 'string' && this.ALLOWED_FIELD_TYPES.includes(value)) {
              sanitizedField[key] = value;
            }
            break;
          case 'label':
          case 'placeholder':
          case 'description':
          case 'accept':
            if (typeof value === 'string') {
              sanitizedField[key] = value;
            }
            break;
          case 'options':
            if (Array.isArray(value)) {
              sanitizedField[key] = value.filter(opt => 
                typeof opt === 'string' || 
                (typeof opt === 'object' && opt !== null && 
                 typeof opt.value === 'string' && typeof opt.label === 'string')
              );
            }
            break;
          case 'min':
          case 'max':
          case 'step':
          case 'page':
            if (typeof value === 'number' && !isNaN(value)) {
              sanitizedField[key] = value;
            }
            break;
          case 'multiple':
            if (typeof value === 'boolean') {
              sanitizedField[key] = value;
            }
            break;
        }
      }

      // Ensure required fields
      if (!sanitizedField.name || !sanitizedField.type) {
        throw new Error(`Field at index ${index} must have 'name' and 'type' properties`);
      }

      return sanitizedField;
    });
  }

  private static validatePages(pages: any): any[] {
    if (!Array.isArray(pages)) {
      return [];
    }

    return pages.map(page => {
      if (typeof page !== 'object' || page === null) {
        return null;
      }

      const sanitizedPage: any = {};

      for (const [key, value] of Object.entries(page)) {
        if (!this.ALLOWED_PAGE_KEYS.includes(key)) {
          continue;
        }

        switch (key) {
          case 'page':
            if (typeof value === 'number' && !isNaN(value)) {
              sanitizedPage[key] = value;
            }
            break;
          case 'title':
          case 'description':
            if (typeof value === 'string') {
              sanitizedPage[key] = value;
            }
            break;
        }
      }

      return sanitizedPage.page ? sanitizedPage : null;
    }).filter(Boolean);
  }

  private static validateProgress(progress: any): any {
    if (typeof progress !== 'object' || progress === null) {
      return {};
    }

    const sanitizedProgress: any = {};

    for (const [key, value] of Object.entries(progress)) {
      if (!this.ALLOWED_PROGRESS_KEYS.includes(key)) {
        continue;
      }

      switch (key) {
        case 'showSteps':
        case 'showPercentage':
          if (typeof value === 'boolean') {
            sanitizedProgress[key] = value;
          }
          break;
        case 'className':
          if (typeof value === 'string') {
            sanitizedProgress[key] = value;
          }
          break;
      }
    }

    return sanitizedProgress;
  }

  private static validateFormOptions(formOptions: any): any {
    if (typeof formOptions !== 'object' || formOptions === null) {
      return {};
    }

    const sanitizedOptions: any = {};

    for (const [key, value] of Object.entries(formOptions)) {
      if (!this.ALLOWED_FORM_OPTIONS_KEYS.includes(key)) {
        continue;
      }

      switch (key) {
        case 'defaultValues':
          if (typeof value === 'object' && value !== null) {
            sanitizedOptions[key] = value;
          }
          break;
        case 'asyncDebounceMs':
          if (typeof value === 'number' && !isNaN(value)) {
            sanitizedOptions[key] = value;
          }
          break;
        case 'canSubmitWhenInvalid':
          if (typeof value === 'boolean') {
            sanitizedOptions[key] = value;
          }
          break;
      }
    }

    return sanitizedOptions;
  }
}

const FormedibleBlockRendererComponent: React.FC<FormedibleBlockRendererProps> = ({
  code,
  isStreaming = false,
}) => {
  const { foldStreamingCodeBlocks } = useSettingsStore(
    useShallow((state) => ({
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks,
    }))
  );

  const [isFolded, setIsFolded] = useState(
    isStreaming ? foldStreamingCodeBlocks : false
  );
  const [formDefinition, setFormDefinition] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [sendOnSubmit, setSendOnSubmit] = useState(false);

  const canvasControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.canvasControls))
  );

  const renderSlotForCodeBlock = useCallback(
    (
      targetSlotName: CanvasControl["targetSlot"],
      currentCode: string,
      // @ts-expect-error unused, do not feel like fixing type for now
      currentLang?: string,
      currentIsFolded?: boolean,
      currentToggleFold?: () => void
    ): React.ReactNode[] => {
      return canvasControls
        .filter(
          (c) =>
            c.type === "codeblock" &&
            c.targetSlot === targetSlotName &&
            c.renderer
        )
        .map((control) => {
          if (control.renderer) {
            const context: CanvasControlRenderContext = {
              codeBlockContent: currentCode,
              codeBlockLang: "formedible",
              isFolded: currentIsFolded,
              toggleFold: currentToggleFold,
              canvasContextType: "codeblock",
            };
            return (
              <React.Fragment key={control.id}>
                {control.renderer(context)}
              </React.Fragment>
            );
          }
          return null;
        })
        .filter(Boolean);
    },
    [canvasControls]
  );

  const parseFormDefinition = useCallback(async () => {
    if (!code.trim() || isFolded) return;

    setIsLoading(true);
    setError(null);
    setFormDefinition(null);

    try {
      const parsed = FormedibleParser.parse(code);
      setFormDefinition(parsed);
    } catch (err) {
      console.error("Formedible parsing error:", err);
      setError(err instanceof Error ? err.message : "Failed to parse Formedible definition");
    } finally {
      setIsLoading(false);
    }
  }, [code, isFolded]);

  useEffect(() => {
    // Only parse if not folded, code is present, not showing raw code, AND NOT STREAMING
    if (!isFolded && code.trim() && !showCode && !isStreaming) {
      parseFormDefinition();
    }
  }, [code, isFolded, showCode, isStreaming, parseFormDefinition]);

  const toggleFold = () => {
    const unfolding = isFolded;
    setIsFolded((prev) => !prev);
    if (unfolding && !showCode) {
      setTimeout(parseFormDefinition, 0);
    }
  };

  const toggleView = useCallback(() => {
    setShowCode((prev) => !prev);
  }, []);

  const foldedPreviewText = useMemo(() => {
    if (!code) return "";
    return code
      .split("\n")
      .slice(0, 3)
      .join("\n");
  }, [code]);

  // Create a simple schema from the fields for validation
  const createSchemaFromFields = useCallback((fields: any[]) => {
    const schemaObj: Record<string, z.ZodTypeAny> = {};
    
    fields.forEach(field => {
      switch (field.type) {
        case 'text':
        case 'email':
        case 'password':
        case 'url':
        case 'tel':
        case 'textarea':
          schemaObj[field.name] = z.string();
          break;
        case 'number':
        case 'slider':
          schemaObj[field.name] = z.number();
          break;
        case 'checkbox':
        case 'switch':
          schemaObj[field.name] = z.boolean();
          break;
        case 'date':
          schemaObj[field.name] = z.date();
          break;
        case 'select':
          schemaObj[field.name] = z.string();
          break;
        case 'file':
          schemaObj[field.name] = z.any();
          break;
        default:
          schemaObj[field.name] = z.string();
      }
    });

    return z.object(schemaObj);
  }, []);

  // Create default values from fields
  const createDefaultValues = useCallback((fields: any[]) => {
    const defaults: Record<string, any> = {};
    
    fields.forEach(field => {
      switch (field.type) {
        case 'text':
        case 'email':
        case 'password':
        case 'url':
        case 'tel':
        case 'textarea':
          defaults[field.name] = "";
          break;
        case 'number':
        case 'slider':
          defaults[field.name] = field.min || 0;
          break;
        case 'checkbox':
        case 'switch':
          defaults[field.name] = false;
          break;
        case 'date':
          defaults[field.name] = new Date().toISOString().split('T')[0];
          break;
        case 'select':
          if (field.options && field.options.length > 0) {
            const firstOption = field.options[0];
            defaults[field.name] = typeof firstOption === 'string' ? firstOption : firstOption.value;
          } else {
            defaults[field.name] = "";
          }
          break;
        case 'file':
          defaults[field.name] = null;
          break;
        default:
          defaults[field.name] = "";
      }
    });

    return defaults;
  }, []);

  // Handle form submission
  const handleFormSubmit = useCallback(async (formData: Record<string, any>, sendOnSubmitValue: boolean) => {
    try {
      // Create JSON block with form results
      const formResultsJson = JSON.stringify(formData, null, 2);
      const promptText = `These are the form values:\n\`\`\`json\n${formResultsJson}\n\`\`\`\n`;
      
      // Add to prompt input and focus
      emitter.emit(promptEvent.setInputTextRequest, { text: promptText });
      emitter.emit(promptEvent.focusInputRequest, undefined);
      
      console.log("Formedible: sendOnSubmit value before conditional: ", sendOnSubmitValue);

      // If send on submit is enabled, submit the prompt
      if (sendOnSubmitValue) {
        console.log("Sending form data to prompt");
        // Use requestAnimationFrame to ensure the input text is set before submission
        // This is more reliable than setTimeout for DOM updates
        requestAnimationFrame(() => {
          console.log("Setting input text");
          try {
            console.log("Creating turn data");
            const turnData: PromptTurnObject = {
              id: nanoid(),
              content: promptText, // Use the promptText that was just set
              parameters: {},
              metadata: {},
            };
            
            emitter.emit(promptEvent.submitPromptRequest, { turnData });
            toast.success("Form submitted and prompt sent!");
          } catch (error) {
            console.error("Failed to submit prompt:", error);
            toast.error("Form data added to input, but failed to send prompt");
          }
        });
      } else {
        toast.success("Form data added to prompt input");
      }
    } catch (error) {
      console.error("Form submission error:", error);
      toast.error("Failed to process form submission");
    }
  }, []); // Removed sendOnSubmit from dependencies

  // Prepare form configuration
  const formConfig = useMemo(() => {
    if (!formDefinition || !formDefinition.fields) {
      return null;
    }

    try {
      const schema = createSchemaFromFields(formDefinition.fields);
      const defaultValues = formDefinition.formOptions?.defaultValues || createDefaultValues(formDefinition.fields);

      // Determine the last page for multi-page forms
      const lastPage = formDefinition.pages && formDefinition.pages.length > 0
        ? Math.max(...formDefinition.pages.map((p: { page: number }) => p.page))
        : 1; // Default to page 1 for single-page forms

      // Add the "send on submit" switch to the fields
      const fieldsWithSendSwitch = [
        ...formDefinition.fields,
        {
          name: "_sendOnSubmit",
          type: "switch",
          label: "Send on submit",
          description: "Automatically send the prompt after form submission",
          page: lastPage, // Assign to the last page
        }
      ];

      // Update schema to include the send switch
      const schemaWithSendSwitch = schema.extend({
        _sendOnSubmit: z.boolean().default(false),
      });

      // Update default values to include the send switch
      const defaultValuesWithSendSwitch = {
        ...defaultValues,
        _sendOnSubmit: false,
      };

      return {
        schema: schemaWithSendSwitch,
        fields: fieldsWithSendSwitch,
        pages: formDefinition.pages,
        progress: formDefinition.progress,
        submitLabel: formDefinition.submitLabel || "Submit",
        nextLabel: formDefinition.nextLabel || "Next",
        previousLabel: formDefinition.previousLabel || "Previous",
        formClassName: formDefinition.formClassName,
        fieldClassName: formDefinition.fieldClassName,
        formOptions: {
          ...formDefinition.formOptions,
          defaultValues: defaultValuesWithSendSwitch,
          canSubmitWhenInvalid: true,
          onSubmit: async ({ value }: { value: Record<string, any> }) => {
            console.log("Formedible onSubmit received full value:", value);
            console.log("Formedible onSubmit received _sendOnSubmit:", value._sendOnSubmit);
            // Extract the send on submit value and remove it from form data
            const { _sendOnSubmit, ...actualFormData } = value;
            setSendOnSubmit(_sendOnSubmit); // Still update state for display, but not for handler logic
            await handleFormSubmit(actualFormData, _sendOnSubmit);
          },
          onSubmitInvalid: ({ value, formApi }: { value: Record<string, any>; formApi: any }) => {
            console.error("Formedible onSubmitInvalid triggered. Values:", value);
            console.error("Formedible onSubmitInvalid triggered. Form API errors:", formApi.formState.errors);
            toast.error("Form has validation errors. Please check your input.");
          },
        },
        disabled: false, // Enable the form for actual use
      };
    } catch (err) {
      console.error("Form configuration error:", err);
      return { error: err instanceof Error ? err.message : "Unknown error" };
    }
  }, [formDefinition, createSchemaFromFields, createDefaultValues, handleFormSubmit]);

  // Use the hook at the top level, but conditionally
  const formedibleResult = useFormedible(formConfig && !('error' in formConfig) ? formConfig : {
    fields: [],
    formOptions: { defaultValues: {} }
  });

  const renderedForm = useMemo(() => {
    if (!formConfig) {
      return null;
    }

    if ('error' in formConfig) {
      return (
        <div className="p-4 border border-destructive/20 bg-destructive/10 rounded-md">
          <div className="text-sm text-destructive">
            Failed to render form: {formConfig.error}
          </div>
        </div>
      );
    }

    if (!formDefinition || !formDefinition.fields) {
      return null;
    }

    return <formedibleResult.Form />;
  }, [formConfig, formDefinition, formedibleResult.Form]);

  const codeBlockHeaderActions = renderSlotForCodeBlock(
    "codeblock-header-actions",
    code,
    "formedible",
    isFolded,
    toggleFold
  );

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      <div className="code-block-header sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">FORMEDIBLE</div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
            {codeBlockHeaderActions}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
          {/* Toggle between form and code view */}
          <button
            onClick={toggleView}
            className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
            title={showCode ? "Show form" : "Show code"}
          >
            {showCode ? (
              <FormInputIcon className="h-4 w-4" />
            ) : (
              <CodeIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {!isFolded && (
        <div className="overflow-hidden w-full">
          {showCode ? (
            // Show raw code using CodeBlockRenderer
            <CodeBlockRenderer
              lang="formedible"
              code={code}
              isStreaming={isStreaming}
            />
          ) : (
            // Show form
            <>
              {isLoading && (
                <div className="flex items-center justify-center p-8">
                  <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Parsing form definition...
                  </span>
                </div>
              )}
              
              {error && (
                <div className="flex items-center gap-2 p-4 border border-destructive/20 bg-destructive/10 rounded-md">
                  <AlertCircleIcon className="h-5 w-5 text-destructive flex-shrink-0" />
                  <div className="text-sm text-destructive">
                    <div className="font-medium">Failed to parse Formedible definition</div>
                    <div className="text-xs mt-1 opacity-80">{error}</div>
                  </div>
                </div>
              )}
              
              {renderedForm && !isLoading && !error && (
                <div className="p-4 bg-background border rounded-md">
                  <div className="mb-4 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                    📋 Interactive Form - Fill out and submit to add data to prompt input
                  </div>
                  {renderedForm}
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {isFolded && (
        <div
          className="folded-content-preview p-4 cursor-pointer w-full box-border"
          onClick={toggleFold}
        >
          <pre className="whitespace-pre-wrap break-words text-muted-foreground font-mono text-sm">
            {foldedPreviewText}
          </pre>
        </div>
      )}
    </div>
  );
};

export const FormedibleBlockRenderer = memo(FormedibleBlockRendererComponent); 