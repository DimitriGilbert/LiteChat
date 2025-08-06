import React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PaperclipIcon, XIcon, UploadCloudIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BaseFieldProps } from '@/lib/formedible/types';
import { FieldWrapper } from './base-field-wrapper';

interface FileUploadFieldSpecificProps extends BaseFieldProps {
  accept?: string;
  className?: string;
}

export const FileUploadField: React.FC<FileUploadFieldSpecificProps> = ({
  fieldApi,
  label,
  description,
  placeholder,
  inputClassName,
  labelClassName,
  wrapperClassName,
  accept,
  className,
}) => {
  const name = fieldApi.name;
  const isDisabled = fieldApi.form?.state?.isSubmitting ?? false;
  const hasErrors = fieldApi.state?.meta?.isTouched && fieldApi.state?.meta?.errors?.length > 0;
  
  const file = fieldApi.state?.value as File | null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    fieldApi.handleChange(selectedFile);
    fieldApi.handleBlur();
  };

  const handleRemoveFile = () => {
    fieldApi.handleChange(null);
    const inputElement = document.getElementById(name) as HTMLInputElement;
    if (inputElement) {
      inputElement.value = "";
    }
    fieldApi.handleBlur();
  };

  const triggerFileInput = () => {
    const inputElement = document.getElementById(name) as HTMLInputElement;
    inputElement?.click();
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
      <div className="space-y-1.5">
        <Input
          id={name}
          name={name}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          disabled={isDisabled}
        />
        {file ? (
          <div
            className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/40 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 text-sm overflow-hidden">
              <PaperclipIcon className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate" title={file.name}>{file.name}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleRemoveFile}
              className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
              aria-label="Remove file"
              disabled={isDisabled}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={triggerFileInput}
            className={cn(
              "w-full flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg hover:border-primary transition-colors cursor-pointer bg-background hover:bg-muted/50",
              className,
              hasErrors ? "border-destructive hover:border-destructive" : "border-muted-foreground/50",
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
            disabled={isDisabled}
          >
            <UploadCloudIcon className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm font-medium text-muted-foreground">
              Click or drag and drop a file
            </span>
            {accept && <span className="text-xs text-muted-foreground/80 mt-1">Accepted types: {accept}</span>}
          </button>
        )}
      </div>
    </FieldWrapper>
  );
};
