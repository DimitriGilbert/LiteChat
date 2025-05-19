import React from 'react';
import type { AnyFieldApi } from '@tanstack/react-form';

interface FieldMetaMessagesProps {
  field: AnyFieldApi;
  className?: string;
}

export const FieldMetaMessages: React.FC<FieldMetaMessagesProps> = ({ field, className }) => {
  const hasErrors = field.state.meta.isTouched && field.state.meta.errors.length > 0;
  // const isValidating = field.state.meta.isValidating; // Uncomment if you want to show validating state

  if (!hasErrors) {
    return null;
  }

  return (
    <em className={`text-xs text-destructive mt-1 block ${className || ''}`}>
      {field.state.meta.errors
        .map((err: unknown) => {
          if (typeof err === 'string') {
            return err;
          }
          if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string') {
            return (err as any).message;
          }
          console.warn('[GlobalFieldMetaMessages] Encountered an unexpected error structure:', err);
          return 'Validation error';
        })
        .join(', ')}
    </em>
  );
}; 