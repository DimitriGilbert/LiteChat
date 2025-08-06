'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, Loader2 } from 'lucide-react';
import type { AnyFieldApi } from '@tanstack/react-form';


interface InlineValidationWrapperProps {
  children: React.ReactNode;
  fieldApi: AnyFieldApi;
  inlineValidation?: {
    enabled?: boolean;
    debounceMs?: number;
    showSuccess?: boolean;
    asyncValidator?: (value: unknown) => Promise<string | null>;
  };
  className?: string;
}

export const InlineValidationWrapper: React.FC<InlineValidationWrapperProps> = ({
  children,
  fieldApi,
  inlineValidation = {},
  className,
}) => {
  const {
    enabled = true,
    debounceMs = 300,
    showSuccess = true,
    asyncValidator,
  } = inlineValidation;

  const [validationState, setValidationState] = useState<{
    isValidating: boolean;
    isValid: boolean | null;
    message: string | null;
  }>({
    isValidating: false,
    isValid: null,
    message: null,
  });

  const { state } = fieldApi;
  const value = state.value;
  const hasErrors = state.meta.errors.length > 0;
  const isTouched = state.meta.isTouched;

  // Validation function
  const validateValue = useCallback(async (currentValue: unknown) => {
    if (!enabled || !asyncValidator) return;

    setValidationState(prev => ({ ...prev, isValidating: true }));

    try {
      const result = await asyncValidator(currentValue);
      
      setValidationState({
        isValidating: false,
        isValid: result === null,
        message: result,
      });
    } catch (error) {
      setValidationState({
        isValidating: false,
        isValid: false,
        message: error instanceof Error ? error.message : 'Validation failed',
      });
    }
  }, [enabled, asyncValidator]);

  // Debounced validation function
  const debouncedValidate = useMemo(
    () => debounce(validateValue, debounceMs),
    [validateValue, debounceMs]
  );

  // Trigger validation when value changes
  useEffect(() => {
    if (enabled && isTouched && value !== undefined && value !== '') {
      debouncedValidate(value);
    } else {
      setValidationState({
        isValidating: false,
        isValid: null,
        message: null,
      });
    }
  }, [value, isTouched, enabled, debouncedValidate]);

  // Reset validation state when field is reset
  useEffect(() => {
    if (!isTouched) {
      setValidationState({
        isValidating: false,
        isValid: null,
        message: null,
      });
    }
  }, [isTouched]);

  const getValidationIcon = () => {
    if (!enabled || !isTouched) return null;
    
    if (validationState.isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }

    if (hasErrors) {
      return <X className="h-4 w-4 text-destructive" />;
    }

    if (validationState.isValid === false) {
      return <X className="h-4 w-4 text-destructive" />;
    }

    if (showSuccess && validationState.isValid === true) {
      return <Check className="h-4 w-4 text-green-500" />;
    }

    if (showSuccess && !hasErrors && isTouched && value) {
      return <Check className="h-4 w-4 text-green-500" />;
    }

    return null;
  };

  const getValidationMessage = () => {
    if (!enabled || !isTouched) return null;

    // Show form validation errors first
    if (hasErrors) {
      return state.meta.errors[0];
    }

    // Show async validation message
    if (validationState.message) {
      return validationState.message;
    }

    return null;
  };

  const validationIcon = getValidationIcon();
  const validationMessage = getValidationMessage();

  return (
    <div className={cn("relative", className)}>
      {/* Field with validation icon */}
      <div className="relative">
        {children}
        {validationIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {validationIcon}
          </div>
        )}
      </div>
      
      {/* Validation message */}
      {validationMessage && (
        <div className={cn(
          "text-xs mt-1 flex items-center gap-1",
          hasErrors || validationState.isValid === false
            ? "text-destructive"
            : "text-muted-foreground"
        )}>
          {typeof validationMessage === 'string' 
            ? validationMessage 
            : (validationMessage as Error)?.message || 'Validation error'
          }
        </div>
      )}
    </div>
  );
};

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
} 