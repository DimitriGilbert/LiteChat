import React from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { BaseFieldProps } from '@/lib/formedible/types';
import { FieldWrapper } from './base-field-wrapper';

export const DateField: React.FC<BaseFieldProps> = ({
  fieldApi,
  label,
  description,
  placeholder,
  inputClassName,
  labelClassName,
  wrapperClassName,
}) => {
  const name = fieldApi.name;
  const isDisabled = fieldApi.form?.state?.isSubmitting ?? false;
  const hasErrors = fieldApi.state?.meta?.isTouched && fieldApi.state?.meta?.errors?.length > 0;

  const [isOpen, setIsOpen] = React.useState(false);

  const value = fieldApi.state?.value;
  const selectedDate = value
    ? value instanceof Date
      ? value
      : typeof value === 'string'
        ? parseISO(value)
        : undefined
    : undefined;

  const handleDateSelect = (date: Date | undefined) => {
    fieldApi.handleChange(date);
    fieldApi.handleBlur();
    setIsOpen(false);
  };

  const computedInputClassName = cn(
    "w-full justify-start text-left font-normal",
    !selectedDate && "text-muted-foreground",
    hasErrors ? "border-destructive" : "",
    inputClassName
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
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={computedInputClassName}
            disabled={isDisabled}
            onClick={() => setIsOpen(true)}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? format(selectedDate, "PPP") : <span>{placeholder || "Pick a date"}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            initialFocus
            disabled={isDisabled}
          />
        </PopoverContent>
      </Popover>
    </FieldWrapper>
  );
};
