import React from 'react';
import type { AnyFieldApi } from '@tanstack/react-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldMetaMessages } from './FieldMetaMessages';
import { cn } from '@/lib/utils';

interface TextFieldProps<TFormValues extends Record<string, any>> 
  extends Omit<React.ComponentProps<typeof Input>, 'name' | 'defaultValue' | 'value' | 'onChange' | 'onBlur'> {
  form: any;
  name: keyof TFormValues & string;
  label: string;
  type?: React.HTMLInputTypeAttribute;
  wrapperClassName?: string;
  className?: string;
}

export function TextField<TFormValues extends Record<string, any>>({
  form,
  name,
  label,
  type = 'text',
  placeholder,
  disabled,
  wrapperClassName,
  className,
  ...rest
}: TextFieldProps<TFormValues>) {
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
            <Input
              id={field.name}
              name={field.name}
              type={type}
              value={value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled ?? field.form.state.isSubmitting}
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