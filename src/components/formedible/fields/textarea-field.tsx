import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { BaseFieldProps } from '@/lib/formedible/types';
import { FieldWrapper } from './base-field-wrapper';

export interface TextareaFieldSpecificProps extends BaseFieldProps {
  rows?: number;
}

export const TextareaField: React.FC<TextareaFieldSpecificProps> = ({
  fieldApi,
  label,
  description,
  placeholder,
  inputClassName,
  labelClassName,
  wrapperClassName,
  rows = 3,
}) => {
  const name = fieldApi.name;
  const value = (fieldApi.state?.value as string) || '';
  const isDisabled = fieldApi.form?.state?.isSubmitting ?? false;
  const hasErrors = fieldApi.state?.meta?.isTouched && fieldApi.state?.meta?.errors?.length > 0;

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    fieldApi.handleChange(e.target.value);
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
      <Textarea
        id={name}
        name={name}
        value={value}
        onBlur={onBlur}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={computedInputClassName}
        disabled={isDisabled}
      />
    </FieldWrapper>
  );
};