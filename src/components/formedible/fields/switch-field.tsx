import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { BaseFieldProps } from '@/lib/formedible/types';
import { FieldWrapper } from './base-field-wrapper';

export const SwitchField: React.FC<BaseFieldProps> = ({
  fieldApi,
  label,
  description,
  placeholder,
  inputClassName,
  labelClassName,
  wrapperClassName,
}) => {
  const name = fieldApi.name;
  const value = fieldApi.state?.value as boolean | undefined;
  const isDisabled = fieldApi.form?.state?.isSubmitting ?? false;

  const onCheckedChange = (checked: boolean) => {
    fieldApi.handleChange(checked);
  };

  const onBlur = () => {
    fieldApi.handleBlur();
  };

  return (
    // Note: We pass label={undefined} to FieldWrapper and render the label manually
    // because Switch components need the label positioned next to (not above) the control
    <FieldWrapper 
      fieldApi={fieldApi} 
      label={undefined}
      description={description}
      inputClassName={inputClassName}
      labelClassName={labelClassName}
      wrapperClassName={wrapperClassName}
    >
      <div className="flex items-center space-x-2">
        <Switch
          id={name}
          checked={!!value}
          onCheckedChange={onCheckedChange}
          onBlur={onBlur}
          disabled={isDisabled}
          aria-describedby={description ? `${name}-description` : undefined}
        />
        {label && (
          <Label 
            htmlFor={name} 
            className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", labelClassName)}
          >
            {label}
          </Label>
        )}
      </div>
    </FieldWrapper>
  );
};
