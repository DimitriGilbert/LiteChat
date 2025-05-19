import React from 'react';
import type { AnyFieldApi } from '@tanstack/react-form';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FieldMetaMessages } from './FieldMetaMessages';
import { cn } from '@/lib/utils';

interface TextareaFieldProps<TFormValues extends Record<string, any>>
  extends Omit<React.ComponentProps<typeof Textarea>, 'name' | 'defaultValue' | 'value' | 'onChange' | 'onBlur'> {
  form: any; 
  name: keyof TFormValues & string;
  label: string;
  description?: string;
  wrapperClassName?: string;
  className?: string;
  rows?: number;
}

export function TextareaField<TFormValues extends Record<string, any>>({
  form,
  name,
  label,
  description,
  placeholder,
  disabled,
  wrapperClassName,
  className,
  rows,
  ...rest
}: TextareaFieldProps<TFormValues>) {
  return (
    <form.Field
      name={name}
      children={(field: AnyFieldApi) => {
        const value = typeof field.state.value === 'string' || typeof field.state.value === 'number' 
                      ? String(field.state.value) 
                      : '';
        return (
          <div className={cn("space-y-1.5", wrapperClassName)}>
            <Label htmlFor={field.name} className="text-sm">
              {label}
            </Label>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            <Textarea
              id={field.name}
              name={field.name}
              value={value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled ?? field.form.state.isSubmitting}
              rows={rows}
              className={cn(className, field.state.meta.errors.length ? "border-destructive" : "")}
              {...rest}
            />
            <FieldMetaMessages field={field} />
          </div>
        );
      }}
    />
  );
} 