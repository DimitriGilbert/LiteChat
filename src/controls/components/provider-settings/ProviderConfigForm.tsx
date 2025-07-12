// src/components/LiteChat/settings/ProviderConfigForm.tsx
import React, { useCallback, useEffect, useRef } from "react";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import type {
  DbProviderConfig,
  DbApiKey,
  DbProviderType,
} from "@/types/litechat/provider";
import { Label } from "@/components/ui/label";

import { ApiKeySelector } from "./ApiKeySelector";
import {
  requiresApiKey,
  optionalApiKey,
  requiresBaseURL,
  supportsModelFetching,
  PROVIDER_TYPES,
} from "@/lib/litechat/provider-helpers";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, SaveIcon, XIcon } from "lucide-react";

import { TextField } from "@/components/LiteChat/common/form-fields/TextField";
import {
  SelectField,
  type SelectFieldOption,
} from "@/components/LiteChat/common/form-fields/SelectField";
import { SwitchField } from "@/components/LiteChat/common/form-fields/SwitchField";
import { FieldMetaMessages } from "@/components/LiteChat/common/form-fields/FieldMetaMessages"; // For direct use with ApiKeySelector

export type ProviderFormData = Pick<
  DbProviderConfig,
  "name" | "type" | "isEnabled" | "apiKeyId" | "baseURL" | "autoFetchModels"
>;

const allProviderTypeValues = PROVIDER_TYPES.map((pt) => pt.value) as [
  DbProviderType,
  ...DbProviderType[]
];

const providerConfigSchema = z
  .object({
    name: z.string().min(1, "Provider Name is required."),
    type: z.enum(allProviderTypeValues, {
      errorMap: () => ({ message: "Provider Type is required." }),
    }),
    isEnabled: z.boolean(),
    apiKeyId: z.string().nullable(),
    baseURL: z.string().url().nullable().or(z.literal("")), // Allow empty string, refine handles real validation
    autoFetchModels: z.boolean(),
  })
  .refine(
    (data) => {
      if (requiresBaseURL(data.type)) {
        if (!data.baseURL || data.baseURL.trim() === "") return false;
        // URL check already in schema, or handled by specific refine if it was more complex.
        // The z.string().url() on baseURL handles basic format.
        return true; // If required and not empty, assume z.url() did its job.
      }
      return true;
    },
    {
      message:
        "Base URL is required and must be a valid URL for this provider type.",
      path: ["baseURL"],
    }
  )
  .refine(
    (data) => {
      if (requiresApiKey(data.type)) {
        return !!data.apiKeyId;
      }
      return true;
    },
    {
      message: "API Key is required for this provider type.",
      path: ["apiKeyId"],
    }
  );

interface ProviderConfigFormProps {
  initialData?: Partial<ProviderFormData>;
  onSubmit: (data: ProviderFormData) => Promise<void>;
  onChange?: (
    field: keyof ProviderFormData,
    value: string | boolean | string[] | null
  ) => Promise<void> | void;
  onCancel: () => void;
  apiKeys: DbApiKey[];
  isSavingExt?: boolean;
  disabled?: boolean;
  className?: string;
}

const providerTypeOptions: SelectFieldOption[] = PROVIDER_TYPES.map((pt) => ({
  value: pt.value,
  label: pt.label,
}));

export const ProviderConfigForm: React.FC<ProviderConfigFormProps> = ({
  initialData,
  onSubmit,
  onChange: onChangeProp,
  onCancel,
  apiKeys,
  isSavingExt = false,
  disabled = false,
  className,
}) => {
  const form = useForm({
    defaultValues: {
      name: initialData?.name || "",
      type: initialData?.type || PROVIDER_TYPES[0]?.value,
      isEnabled: initialData?.isEnabled ?? true,
      apiKeyId: initialData?.apiKeyId || null,
      baseURL: initialData?.baseURL || null,
      autoFetchModels: initialData?.autoFetchModels ?? false,
    } as ProviderFormData,
    validators: {
      onChangeAsync: providerConfigSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      const submissionValue = {
        ...value,
        baseURL:
          (value.baseURL === null ||
            (typeof value.baseURL === "string" &&
              value.baseURL.trim() === "")) &&
          !requiresBaseURL(value.type)
            ? null
            : value.baseURL,
      };
      await onSubmit(submissionValue as ProviderFormData);
    },
  });

  const prevValuesRef = useRef<ProviderFormData | undefined>(form.state.values);

  useEffect(() => {
    const unsubscribe = form.store.subscribe(() => {
      const currentValues = form.state.values;
      const prevValues = prevValuesRef.current;

      if (onChangeProp && prevValues) {
        for (const key in currentValues) {
          const fieldName = key as keyof ProviderFormData;
          if (currentValues[fieldName] !== prevValues[fieldName]) {
            onChangeProp(fieldName, currentValues[fieldName]);
            // Assuming onChangeProp is primarily interested in one change at a time
            // or handles multiple rapid changes appropriately.
            // If only one change callback per subscription event is desired, add a break here.
          }
        }
      }
      prevValuesRef.current = { ...currentValues };
    });

    // Update ref if initialData causes a reset and form values change
    // This is to ensure prevValuesRef is in sync after a programmatic reset.
    if (form.state.values !== prevValuesRef.current) {
        prevValuesRef.current = form.state.values;
    }

    return unsubscribe;
  }, [form, onChangeProp]); // form.store and onChangeProp are dependencies

  // Effect for resetting form based on initialData
  useEffect(() => {
    const defaultType = initialData?.type || PROVIDER_TYPES[0]?.value;
    const defaultValuesUpdate: ProviderFormData = {
      name:
        initialData?.name ||
        PROVIDER_TYPES.find((p) => p.value === defaultType)?.label ||
        "",
      type: defaultType as DbProviderType,
      isEnabled: initialData?.isEnabled ?? true,
      apiKeyId: initialData?.apiKeyId || null,
      baseURL: initialData?.baseURL || null,
      autoFetchModels:
        initialData?.autoFetchModels ??
        supportsModelFetching(defaultType as DbProviderType),
    };
    form.reset(defaultValuesUpdate);
    prevValuesRef.current = defaultValuesUpdate; // Sync ref after reset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]); // form is not needed in deps for reset with initialData

  // Directly use form.state.values for conditional rendering logic
  const currentType = form.state.values.type;
  const needsKey = requiresApiKey(currentType ?? null);
  const hasOptionalKey = optionalApiKey(currentType ?? null);
  const showApiKeyField = needsKey || hasOptionalKey;
  const needsURL = requiresBaseURL(currentType ?? null);
  const canFetch = supportsModelFetching(currentType ?? null);

  const handleTypeChange = useCallback(
    (newType: DbProviderType | undefined) => {
      if (!newType) return;

      const previousType = form.state.values.type;

      if (newType !== previousType) {
        form.setFieldValue("apiKeyId", null);
        form.setFieldValue("baseURL", null);
        form.setFieldValue("autoFetchModels", supportsModelFetching(newType));

        const providerLabel = PROVIDER_TYPES.find(
          (p) => p.value === newType
        )?.label;
        const oldProviderLabelFromState = PROVIDER_TYPES.find(
          (p) => p.value === previousType
        )?.label;
        const currentNameValue = form.state.values.name;

        if (
          providerLabel &&
          (!currentNameValue?.trim() ||
            currentNameValue === oldProviderLabelFromState)
        ) {
          form.setFieldValue("name", providerLabel);
        }
      }
    },
    [form] 
  );

  useEffect(() => {
    const typeFromState = form.state.values.type;
    if (typeFromState !== undefined) {
      handleTypeChange(typeFromState as DbProviderType | undefined);
    }
  }, [form.state.values.type, handleTypeChange]);

  const relevantApiKeys = (apiKeys || []).filter(
    (key) => !currentType || key.providerId === currentType
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className={cn(
        "space-y-4 border rounded-md p-4 bg-card shadow-sm",
        className
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
        <SelectField
          form={form}
          name="type"
          label="Provider Type"
          options={providerTypeOptions}
          disabled={disabled || isSavingExt}
          placeholder="Select Type"
          wrapperClassName="md:col-span-1"
        />
        <TextField
          form={form}
          name="name"
          label="Provider Name"
          placeholder="e.g., My Ollama"
          disabled={disabled || isSavingExt}
          aria-label="Provider Name"
          wrapperClassName="md:col-span-1"
        />

        {showApiKeyField && (
          <form.Field
            name="apiKeyId"
            children={(field: AnyFieldApi) => (
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor={`${field.name}-trigger`}>API Key {!needsKey && "(Optional)"}</Label>{" "}
                <ApiKeySelector
                  selectedKeyId={field.state.value ?? null}
                  onKeySelected={(keyId: string | null) => {
                    field.handleChange(keyId);
                    field.handleBlur(); 
                  }}
                  apiKeys={relevantApiKeys}
                  disabled={disabled || isSavingExt || !currentType}
                />
                <FieldMetaMessages field={field} />
              </div>
            )}
          />
        )}

        {needsURL && (
          <TextField
            form={form}
            name="baseURL"
            label="Base URL"
            placeholder="e.g., http://localhost:11434"
            type="url"
            disabled={disabled || isSavingExt || !currentType}
            wrapperClassName="md:col-span-2"
          />
        )}

        {canFetch && (
          <SwitchField
            form={form}
            name="autoFetchModels"
            label="Auto-Fetch Models"
            description="Automatically fetch and update the list of available models from this provider."
            disabled={disabled || isSavingExt || !currentType}
            wrapperClassName="md:col-span-2"
          />
        )}
        <SwitchField
          form={form}
          name="isEnabled"
          label="Enable Provider"
          description="Allow this provider to be used for generating responses."
          disabled={disabled || isSavingExt}
          wrapperClassName="md:col-span-2"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={disabled || isSavingExt}
          type="button"
        >
          <XIcon className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <form.Subscribe
          selector={(state) =>
            [
              state.canSubmit,
              state.isSubmitting,
              state.isValidating,
              state.isValid,
            ] as const
          }
          children={([canSubmit, isSubmitting, isValidating, isValid]) => (
            <Button
              type="submit"
              size="sm"
              disabled={
                disabled ||
                isSavingExt ||
                !canSubmit ||
                isSubmitting ||
                !isValid ||
                isValidating
              }
            >
              {(isSavingExt || isSubmitting || isValidating) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              <SaveIcon className="h-4 w-4 mr-1" />{" "}
              {isSavingExt || isSubmitting || isValidating
                ? "Saving..."
                : initialData?.name 
                ? "Save Changes"
                : "Add Provider"}
            </Button>
          )}
        />
      </div>
    </form>
  );
};
