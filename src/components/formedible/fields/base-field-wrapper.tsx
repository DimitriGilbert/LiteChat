'use client';
import React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { BaseFieldProps } from '@/lib/formedible/types';

export interface FieldWrapperProps extends BaseFieldProps {
  children: React.ReactNode;
  htmlFor?: string;
  showErrors?: boolean;
}

// Simplified wrapper that doesn't interfere with TanStack Form's state management
export const FieldWrapper: React.FC<FieldWrapperProps> = ({
  fieldApi,
  label,
  description,
  inputClassName,
  labelClassName,
  wrapperClassName,
  children,
  htmlFor,
  showErrors = true,
}) => {
  const name = fieldApi.name;
  const hasErrors = fieldApi.state?.meta?.isTouched && fieldApi.state?.meta?.errors?.length > 0;

  return (
    <div className={cn("space-y-1.5", wrapperClassName)}>
      {label && (
        <Label 
          htmlFor={htmlFor || name} 
          className={cn("text-sm font-medium", labelClassName)}
        >
          {label}
        </Label>
      )}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      
      {children}
      
      {showErrors && hasErrors && (
        <div className="text-xs text-destructive pt-1">
          {fieldApi.state?.meta?.errors?.map((err: string | Error, index: number) => (
            <p key={index}>
              {typeof err === 'string' ? err : (err as Error)?.message || 'Invalid'}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};