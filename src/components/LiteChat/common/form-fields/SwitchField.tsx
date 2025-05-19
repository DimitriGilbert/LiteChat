import React from 'react';
import type { AnyFieldApi } from '@tanstack/react-form';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FieldMetaMessages } from './FieldMetaMessages';
import { cn } from '@/lib/utils';

interface SwitchFieldProps<TFormValues extends Record<string, any>> 
  extends Omit<React.ComponentProps<typeof Switch>, 'name' | 'defaultChecked' | 'checked' | 'onCheckedChange' | 'onBlur'> {
  form: any; // Simplifying to any, form is mainly for form.Field namespacing
  name: keyof TFormValues & string;
  label: string;
  description?: string; // Optional description text
  wrapperClassName?: string; // ClassName for the wrapper div
  className?: string; // For the Switch component itself
  labelClassName?: string; // For the Label component itself
}

export function SwitchField<TFormValues extends Record<string, any>>({
  form,
  name,
  label,
  description,
  disabled,
  wrapperClassName,
  className,
  labelClassName,
  ...rest
}: SwitchFieldProps<TFormValues>) {
  return (
    <form.Field
      name={name}
      children={(field: AnyFieldApi) => {
        // Ensure value is boolean for Switch
        const checked = typeof field.state.value === 'boolean' ? field.state.value : false;

        return (
          <div className={cn("space-y-1.5", wrapperClassName)}>
            <div className="flex items-center justify-between">
              <Label 
                htmlFor={field.name} 
                className={cn("text-sm font-medium leading-none cursor-pointer", labelClassName)}
              >
                {label}
              </Label>
              <Switch
                id={field.name}
                name={field.name}
                checked={checked}
                onCheckedChange={(checked) => field.handleChange(checked)}
                onBlur={field.handleBlur}
                disabled={disabled ?? field.form.state.isSubmitting}
                className={cn(className, field.state.meta.errors.length ? "border-destructive" : "")}
                {...rest}
              />
            </div>
            {description && (
              <p className="text-xs text-muted-foreground pt-1">{description}</p>
            )}
            <FieldMetaMessages field={field} />
          </div>
        );
      }}
    />
  );
} 