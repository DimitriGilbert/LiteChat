"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { BaseFieldProps } from "@/lib/formedible/types";
// Note: Import individual field components directly to avoid circular dependency
import { TextField } from "./text-field";
import { NumberField } from "./number-field";
import { SelectField } from "./select-field";
import { FieldWrapper } from './base-field-wrapper';

interface ObjectFieldConfig {
  title?: string;
  description?: string;
  fields: Array<{
    name: string;
    type: string;
    label?: string;
    placeholder?: string;
    description?: string;
    options?: Array<{ value: string; label: string }>;
    min?: number;
    max?: number;
    step?: number;
    [key: string]: unknown;
  }>;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  showCard?: boolean;
  layout?: "vertical" | "horizontal" | "grid";
  columns?: number;
}

interface ObjectFieldProps extends BaseFieldProps {
  objectConfig?: ObjectFieldConfig;
  disabled?: boolean;
}

export const ObjectField: React.FC<ObjectFieldProps> = ({
  fieldApi,
  objectConfig,
  disabled,
  ...wrapperProps
}) => {
  const name = fieldApi.name;
  const [isExpanded, setIsExpanded] = React.useState(
    objectConfig?.defaultExpanded !== false
  );

  // Create a properly typed mockFieldApi that includes the form property
  const createMockFieldApi = (fieldName: string, fieldValue: unknown) => {
    return {
      name: `${fieldApi.name}.${fieldName}`,
      form: fieldApi.form, // Include the form property to fix the bug
      state: {
        ...fieldApi.state,
        value: fieldValue,
        meta: {
          ...fieldApi.state.meta,
          errors: [], // Reset errors for subfield
          isTouched: false, // Reset touched state for subfield
        }
      },
      handleChange: (value: unknown) => {
        const currentValue = fieldApi.state?.value || {};
        fieldApi.handleChange({
          ...currentValue,
          [fieldName]: value
        });
      },
      handleBlur: fieldApi.handleBlur,
    };
  };

  const renderField = (fieldConfig: ObjectFieldConfig['fields'][0]) => {
    // Map field types to components directly to avoid circular dependency
    const fieldComponentMap = {
      text: TextField,
      number: NumberField,
      select: SelectField,
    };
    
    const FieldComponent = fieldComponentMap[fieldConfig.type as keyof typeof fieldComponentMap];
    
    if (!FieldComponent) {
      console.warn(`Object field: Unknown field type "${fieldConfig.type}"`);
      return null;
    }

    const fieldValue = fieldApi.state?.value?.[fieldConfig.name] || '';
    const mockFieldApi = createMockFieldApi(fieldConfig.name, fieldValue) as unknown as BaseFieldProps['fieldApi'];

    // Create properly typed field props using the helper
    const baseProps: BaseFieldProps = {
      fieldApi: mockFieldApi,
      label: fieldConfig.label,
      placeholder: fieldConfig.placeholder,
      description: fieldConfig.description,
    };

    const additionalProps: Record<string, unknown> = {
      ...(fieldConfig.min !== undefined && { min: fieldConfig.min }),
      ...(fieldConfig.max !== undefined && { max: fieldConfig.max }),
      ...(fieldConfig.step !== undefined && { step: fieldConfig.step }),
      ...(disabled !== undefined && { disabled }),
    };

    // Handle fields that require options with proper typing
    if (['select', 'radio', 'multiselect'].includes(fieldConfig.type)) {
      additionalProps.options = fieldConfig.options || [];
    }

    const fieldProps: any = {
      ...baseProps,
      ...additionalProps,
    };

    // Ensure required props are provided for each field type
    if (fieldConfig.type === 'select') {
      fieldProps.options = fieldConfig.options || [];
    }

    return (
      <div key={fieldConfig.name}>
        <FieldComponent {...fieldProps} />
      </div>
    );
  };

  const getLayoutClasses = () => {
    const layout = objectConfig?.layout || "vertical";
    const columns = objectConfig?.columns || 2;
    
    switch (layout) {
      case "horizontal":
        return "flex flex-wrap gap-4";
      case "grid":
        return `grid grid-cols-1 md:grid-cols-${columns} gap-4`;
      default:
        return "space-y-4";
    }
  };

  const content = (
    <FieldWrapper fieldApi={fieldApi} {...wrapperProps}>
      <div className="space-y-4">
        {/* Object title and description */}
        {(objectConfig?.title || objectConfig?.description) && (
          <div className="space-y-1">
            {objectConfig?.title && (
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {objectConfig.title}
                </h4>
                {objectConfig?.collapsible && (
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? "Collapse" : "Expand"}
                  </button>
                )}
              </div>
            )}
            {objectConfig?.description && (
              <p className="text-xs text-muted-foreground">
                {objectConfig.description}
              </p>
            )}
          </div>
        )}

        {/* Fields */}
        {(!objectConfig?.collapsible || isExpanded) && (
          <>
            {objectConfig?.title && <div className="border-t my-4" />}
            <div className={getLayoutClasses()}>
              {objectConfig?.fields?.map(renderField)}
            </div>
          </>
        )}

        {/* Show field errors */}
        {fieldApi.state?.meta?.errors && fieldApi.state?.meta?.errors.length > 0 && (
          <div className="text-sm text-destructive">
            {fieldApi.state?.meta?.errors.join(", ")}
          </div>
        )}
      </div>
    </FieldWrapper>
  );

  // Wrap in card if specified
  if (objectConfig?.showCard) {
    return (
      <Card className="w-full">
        {(objectConfig?.title || objectConfig?.description) && (
          <CardHeader className="pb-3">
            {objectConfig?.title && (
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{objectConfig.title}</CardTitle>
                {objectConfig?.collapsible && (
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? "Collapse" : "Expand"}
                  </button>
                )}
              </div>
            )}
            {objectConfig?.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {objectConfig.description}
              </p>
            )}
          </CardHeader>
        )}
        <CardContent className="pt-0">
          {(!objectConfig?.collapsible || isExpanded) && (
            <div className={getLayoutClasses()}>
              {objectConfig?.fields?.map(renderField)}
            </div>
          )}
          
          {/* Show field errors */}
          {fieldApi.state?.meta?.errors && fieldApi.state?.meta?.errors.length > 0 && (
            <div className="text-sm text-destructive mt-4">
              {fieldApi.state?.meta?.errors.join(", ")}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return content;
};