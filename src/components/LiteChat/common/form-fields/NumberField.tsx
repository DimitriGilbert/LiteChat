import React from 'react';
import type { AnyFieldApi } from '@tanstack/react-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldMetaMessages } from './FieldMetaMessages';
import { cn } from '@/lib/utils';

interface NumberFieldProps<TFormValues extends Record<string, any>> 
  extends Omit<React.ComponentProps<typeof Input>, 'name' | 'defaultValue' | 'value' | 'onChange' | 'onBlur' | 'type'> {
  form: any;
  name: keyof TFormValues & string;
  label: string;
  allowNull?: boolean; // If true, an empty input will result in null
  wrapperClassName?: string; // ClassName for the wrapper div
  className?: string; // This is for the Input component itself
  onBlurInput?: (event: React.FocusEvent<HTMLInputElement>) => void; // New prop for custom blur logic
}

export function NumberField<TFormValues extends Record<string, any>>({
  form,
  name,
  label,
  placeholder,
  disabled,
  wrapperClassName, // Destructure wrapperClassName
  allowNull = false, 
  min,
  max,
  step,
  className, // This will be for the Input component, passed via ...rest if not destructured explicitly
  onBlurInput, // Use the new prop
  ...rest // any other Input props
}: NumberFieldProps<TFormValues>) {
  return (
    <form.Field
      name={name}
      children={(field: AnyFieldApi) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const valStr = e.target.value;
          if (valStr === '' && allowNull) {
            field.handleChange(null as any); 
          } else {
            const num = parseFloat(valStr);
            if (!isNaN(num)) {
              field.handleChange(num);
            } else if (valStr === '' && !allowNull) {
              field.handleChange(valStr as any); 
            }
          }
        };

        const value = typeof field.state.value === 'number' 
                      ? field.state.value.toString() 
                      : (field.state.value === null && allowNull) ? '' : ''; 

        const handleBlurEvent = (event: React.FocusEvent<HTMLInputElement>) => {
          field.handleBlur(); // Call TanStack Form's blur handler
          if (onBlurInput) {
            onBlurInput(event); // Call the custom blur handler if provided
          }
        };

        return (
          <div className={cn("space-y-1.5", wrapperClassName)}> {/* Use wrapperClassName here */}
            <Label htmlFor={field.name} className="text-sm">
              {label}
            </Label>
            <Input
              id={field.name}
              name={field.name}
              type="number"
              value={value} 
              onBlur={handleBlurEvent} // Use the combined blur handler 
              onChange={handleChange}
              placeholder={placeholder}
              disabled={disabled ?? field.form.state.isSubmitting}
              min={min}
              max={max}
              step={step}
              className={cn(className, field.state.meta.errors.length ? "border-destructive" : "")} // Pass className from props here, merged with error class
              {...rest} // Pass other props to Input
            />
            <FieldMetaMessages field={field} />
          </div>
        );
      }}
    />
  );
} 