import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { BaseFieldProps } from '@/lib/formedible/types';
import { FieldWrapper } from './base-field-wrapper';

interface SelectFieldSpecificProps extends BaseFieldProps {
  options: Array<{ value: string; label: string }> | string[];
}

export const SelectField: React.FC<SelectFieldSpecificProps> = ({
  fieldApi,
  label,
  description,
  placeholder,
  inputClassName,
  labelClassName,
  wrapperClassName,
  options = [],
}) => {
  const name = fieldApi.name;
  const value = (fieldApi.state?.value as string) || '';
  const isDisabled = fieldApi.form?.state?.isSubmitting ?? false;
  const hasErrors = fieldApi.state?.meta?.isTouched && fieldApi.state?.meta?.errors?.length > 0;

  const onValueChange = (value: string) => {
    fieldApi.handleChange(value);
  };

  const onBlur = () => {
    fieldApi.handleBlur();
  };

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
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={isDisabled}
      >
        <SelectTrigger
          id={name + "-trigger"}
          onBlur={onBlur}
          className={computedInputClassName}
        >
          <SelectValue placeholder={placeholder || "Select an option"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option, index) => {
            const optionValue = typeof option === 'string' ? option : option.value;
            const optionLabel = typeof option === 'string' ? option : option.label;
            return (
              <SelectItem key={optionValue + index} value={optionValue}>
                {optionLabel}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
};