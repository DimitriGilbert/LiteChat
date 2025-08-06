'use client';
import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import type { BaseFieldProps } from '@/lib/formedible/types';
import { FieldWrapper } from './base-field-wrapper';

export interface RadioFieldSpecificProps extends BaseFieldProps {
  options: Array<{ value: string; label: string }> | string[];
  direction?: 'horizontal' | 'vertical';
}

export const RadioField: React.FC<RadioFieldSpecificProps> = ({
  fieldApi,
  label,
  description,
  placeholder,
  inputClassName,
  labelClassName,
  wrapperClassName,
  options = [],
  direction = 'vertical',
}) => {
  const name = fieldApi.name;
  const value = fieldApi.state?.value as string | undefined;
  const isDisabled = fieldApi.form?.state?.isSubmitting ?? false;
  const hasErrors = fieldApi.state?.meta?.isTouched && fieldApi.state?.meta?.errors?.length > 0;

  const normalizedOptions = options.map(option => 
    typeof option === 'string' 
      ? { value: option, label: option }
      : option
  );

  const onValueChange = (value: string) => {
    fieldApi.handleChange(value);
  };

  const onBlur = () => {
    fieldApi.handleBlur();
  };

  return (
    <FieldWrapper
      fieldApi={fieldApi}
      label={label}
      description={description}
      inputClassName={inputClassName}
      labelClassName={labelClassName}
      wrapperClassName={wrapperClassName}
    >
      <RadioGroup
        value={value || ''}
        onValueChange={onValueChange}
        onBlur={onBlur}
        disabled={isDisabled}
        className={cn(
          direction === 'horizontal' 
            ? "flex flex-wrap gap-6" 
            : "flex flex-col space-y-2",
          inputClassName
        )}
      >
        {normalizedOptions.map((option, index) => (
          <div key={`${option.value}-${index}`} className="flex items-center space-x-2">
            <RadioGroupItem
              value={option.value}
              id={`${name}-${option.value}`}
              className={cn(
                hasErrors ? "border-destructive" : ""
              )}
            />
            <Label
              htmlFor={`${name}-${option.value}`}
              className="text-sm font-normal cursor-pointer"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </FieldWrapper>
  );
}; 