// src/components/LiteChat/common/form-fields/SelectField.tsx
import React from 'react';
import type { AnyFieldApi } from '@tanstack/react-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FieldMetaMessages } from './FieldMetaMessages';
import { cn } from '@/lib/utils';

export interface SelectFieldOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface SelectFieldProps<TFormValues extends Record<string, any>> 
  extends Omit<React.ComponentProps<typeof Select>, 'name' | 'defaultValue' | 'value' | 'onValueChange'> {
  form: any; 
  name: keyof TFormValues & string;
  label: string;
  options: SelectFieldOption[];
  placeholder?: string;
  wrapperClassName?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export function SelectField<TFormValues extends Record<string, any>>({
  form,
  name,
  label,
  options,
  placeholder,
  disabled,
  wrapperClassName,
  triggerClassName,
  contentClassName,
  ...rest
}: SelectFieldProps<TFormValues>) {
  return (
    <form.Field
      name={name}
      children={(field: AnyFieldApi) => {
        const selectValue = field.state.value !== null && field.state.value !== undefined 
                            ? String(field.state.value)
                            : '';

        return (
          <div className={cn("space-y-1.5", wrapperClassName)}>
            <Label htmlFor={field.name} className="text-sm">
              {label}
            </Label>
            <Select
              value={selectValue}
              onValueChange={(value) => field.handleChange(value)} 
              disabled={disabled ?? field.form.state.isSubmitting}
              {...rest}
            >
              <SelectTrigger id={field.name} onBlur={field.handleBlur} className={cn(triggerClassName, field.state.meta.errors.length ? "border-destructive" : "")}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent className={contentClassName}>
                {options.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={String(option.value)} 
                    disabled={option.disabled}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldMetaMessages field={field} />
          </div>
        );
      }}
    />
  );
}
