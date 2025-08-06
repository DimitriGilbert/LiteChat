'use client';
import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { BaseFieldProps } from '@/lib/formedible/types';
import { FieldWrapper } from './base-field-wrapper';

export interface NumberFieldSpecificProps extends BaseFieldProps {
  min?: number;
  max?: number;
  step?: number;
}

export const NumberField: React.FC<NumberFieldSpecificProps> = ({
  fieldApi,
  label,
  description,
  placeholder,
  inputClassName,
  labelClassName,
  wrapperClassName,
  min,
  max,
  step,
}) => {
  const name = fieldApi.name;
  const value = fieldApi.state?.value as number | string | undefined;
  const isDisabled = fieldApi.form?.state?.isSubmitting ?? false;
  const hasErrors = fieldApi.state?.meta?.isTouched && fieldApi.state?.meta?.errors?.length > 0;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    let parsedValue: number | string | undefined;
    
    if (val === '') {
      parsedValue = undefined;
    } else {
      const num = parseFloat(val);
      parsedValue = isNaN(num) ? val : num;
    }
    
    fieldApi.handleChange(parsedValue);
  };

  const onBlur = () => {
    fieldApi.handleBlur();
  };

  let displayValue: string | number = '';
  if (typeof value === 'number') {
    displayValue = value;
  } else if (typeof value === 'string') {
    displayValue = value;
  }

  const computedInputClassName = cn(
    inputClassName,
    hasErrors ? "border-destructive" : ""
  );

  return (
    <FieldWrapper
      fieldApi={fieldApi}
      label={label}
      description={description}
      inputClassName={inputClassName}
      labelClassName={labelClassName}
      wrapperClassName={wrapperClassName}
    >
      <Input
        id={name}
        name={name}
        type="number"
        value={displayValue}
        onBlur={onBlur}
        onChange={onChange}
        placeholder={placeholder}
        className={computedInputClassName}
        disabled={isDisabled}
        min={min}
        max={max}
        step={step}
      />
    </FieldWrapper>
  );
};