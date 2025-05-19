import React from 'react';
import type { AnyFieldApi } from '@tanstack/react-form';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { FieldMetaMessages } from './FieldMetaMessages';
import { cn } from '@/lib/utils';

interface SliderFieldProps<TFormValues extends Record<string, any>> 
  extends Omit<React.ComponentProps<typeof Slider>, 'name' | 'defaultValue' | 'value' | 'onValueChange' | 'onBlur'> {
  form: any; 
  name: keyof TFormValues & string;
  label: string; // Label text
  valueLabelPrefix?: string; // E.g., "Temperature"
  valueLabelSuffix?: string; // E.g., "FPS"
  valueDisplayPrecision?: number; // For toFixed()
  showRawValue?: boolean; // Optionally show raw value next to formatted one
  wrapperClassName?: string; // ClassName for the wrapper div
  // className prop from Omit will be for the Slider itself
}

export function SliderField<TFormValues extends Record<string, any>>({
  form,
  name,
  label,
  valueLabelPrefix = '',
  valueLabelSuffix = '',
  valueDisplayPrecision = 2,
  showRawValue = false,
  disabled,
  wrapperClassName,
  className,
  min,
  max,
  step,
  ...rest
}: SliderFieldProps<TFormValues>) {
  return (
    <form.Field
      name={name}
      children={(field: AnyFieldApi) => {
        const fieldValue = typeof field.state.value === 'number' ? field.state.value : (min ?? 0);
        const displayValue = fieldValue.toFixed(valueDisplayPrecision);

        return (
          <div className={cn("space-y-1.5", wrapperClassName)}>
            <Label htmlFor={field.name} className="text-sm">
              {label} ({valueLabelPrefix}{displayValue}{valueLabelSuffix})
              {showRawValue && <span className="text-xs text-muted-foreground ml-2">(Raw: {field.state.value})</span>}
            </Label>
            <Slider
              id={field.name}
              name={field.name}
              value={[fieldValue]} // Slider expects an array
              onValueChange={(valueArray) => field.handleChange(valueArray[0])} // Send single number to form state
              onBlur={field.handleBlur}
              disabled={disabled ?? field.form.state.isSubmitting}
              min={min}
              max={max}
              step={step}
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