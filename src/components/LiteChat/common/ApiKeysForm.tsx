// src/components/LiteChat/common/ApiKeysForm.tsx
// FULL FILE
import React, { useEffect, useRef } from "react";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SaveIcon, XIcon, Loader2 } from "lucide-react";
import type { DbProviderType } from "@/types/litechat/provider";
import { PROVIDER_TYPES } from "@/lib/litechat/provider-helpers";
import { cn } from "@/lib/utils";
import { FieldMetaMessages } from "./form-fields/FieldMetaMessages"; // Assuming path

interface ApiKeyFormProps {
  initialProviderType?: DbProviderType | null;
  initialName?: string;
  initialValue?: string;
  initialApiKeyId?: string | null; 
  // Enhanced onSave to support both add and edit modes
  onSave: (
    name: string,
    providerId: DbProviderType, // Assuming providerId will be non-null on save
    value: string,
    id?: string // Optional id parameter for edit mode
  ) => Promise<string | void>;
  onCancel: () => void;
  // isSaving prop will be handled by form.state.isSubmitting
  disabled?: boolean; // External disabled state
  className?: string;
  // Edit mode props for backwards compatibility
  isEditMode?: boolean; // Indicates if this is an edit form
  editId?: string; // The ID of the API key being edited
}

const providerTypeValues = PROVIDER_TYPES.map((pt) => pt.value) as [
  DbProviderType,
  ...DbProviderType[]
];

export const ApiKeyForm: React.FC<ApiKeyFormProps> = ({
  initialProviderType = null,
  initialName = "",
  initialValue = "",
  // initialApiKeyId, // Not directly used in form fields, context for parent
  onSave,
  onCancel,
  disabled = false,
  className,
  isEditMode = false,
  editId,
}) => {
  const { t } = useTranslation('common');
  const keyInputRef = useRef<HTMLInputElement>(null);

  const apiKeyFormSchema = z.object({
    keyName: z.string().min(1, t('apiKeyForm.keyNameRequired')),
    providerType: z.enum(providerTypeValues, {
      errorMap: () => ({ message: t('apiKeyForm.providerTypeRequired') }),
    }),
    keyValue: z.string().min(1, t('apiKeyForm.apiKeyValueRequired')),
  });

  const form = useForm({
    defaultValues: {
      keyName: initialName,
      providerType: initialProviderType,
      keyValue: initialValue,
    },
    validators: {
      onChangeAsync: apiKeyFormSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      // Type assertion because schema ensures providerType is not null here
      await onSave(value.keyName, value.providerType as DbProviderType, value.keyValue, editId);
    },
  });

  useEffect(() => {
    form.reset({
      keyName: initialName,
      providerType: initialProviderType,
      keyValue: initialValue,
    });
  }, [initialName, initialValue, initialProviderType, form]);

  const handleProviderTypeSelected = (
    newType: DbProviderType | null,
    currentName: string | undefined
  ) => {
    if (!newType) return;

    const providerLabel = PROVIDER_TYPES.find((p) => p.value === newType)?.label;
    // Get the currently selected providerType from the form state for oldProviderLabel comparison
    const currentProviderTypeInForm = form.getFieldValue("providerType");
    const oldProviderLabel = PROVIDER_TYPES.find(
      (p) => p.value === currentProviderTypeInForm
    )?.label;

    if (
      providerLabel &&
      (!currentName?.trim() || currentName === oldProviderLabel)
    ) {
      form.setFieldValue("keyName", providerLabel); // Removed { touch: true }
    }
    requestAnimationFrame(() => {
      keyInputRef.current?.focus();
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className={cn("space-y-6", className)} // Increased spacing
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <form.Field
          name="providerType"
          validators={{ onChange: apiKeyFormSchema.shape.providerType }}
          children={(field: AnyFieldApi) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>{t('apiKeyForm.providerTypeLabel')}</Label>
              <Select
                value={field.state.value ?? ""} // Select expects string value, or handle null in options
                onValueChange={(value: string) => {
                  const newProviderType = value as DbProviderType;
                  field.handleChange(newProviderType);
                  field.handleBlur();
                  handleProviderTypeSelected(newProviderType, form.getFieldValue("keyName"));
                }}
                disabled={disabled || form.state.isSubmitting}
              >
                <SelectTrigger id={field.name}>
                  <SelectValue placeholder={t('apiKeyForm.selectProviderPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>
                      {pt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldMetaMessages field={field} />
            </div>
          )}
        />
        <form.Field
          name="keyName"
          validators={{ onChange: apiKeyFormSchema.shape.keyName }}
          children={(field: AnyFieldApi) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>{t('apiKeyForm.keyNameLabel')}</Label>
              <Input
                id={field.name}
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder={t('apiKeyForm.keyNamePlaceholder')}
                disabled={disabled || form.state.isSubmitting}
              />
              <FieldMetaMessages field={field} />
            </div>
          )}
        />
        <form.Field
          name="keyValue"
          validators={{ onChange: apiKeyFormSchema.shape.keyValue }}
          children={(field: AnyFieldApi) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>{t('apiKeyForm.apiKeyValueLabel')}</Label>
              <Input
                ref={keyInputRef} // Keep ref here
                id={field.name}
                type="password"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder={t('apiKeyForm.keyValuePlaceholder')}
                disabled={disabled || form.state.isSubmitting}
                autoComplete="new-password"
              />
              <FieldMetaMessages field={field} />
            </div>
          )}
        />
      </div>
      <div className="flex justify-end space-x-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel} // onCancel is still a prop
          disabled={disabled || form.state.isSubmitting}
          type="button"
        >
          <XIcon className="h-4 w-4 mr-1" /> {t('cancel')}
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
                !canSubmit ||
                isSubmitting ||
                isValidating ||
                !isValid
              }
            >
              {(isSubmitting || isValidating) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              <SaveIcon className="h-4 w-4 mr-1" />
              {isSubmitting || isValidating
                ? t('apiKeyForm.saving')
                : isEditMode ? t('apiKeyForm.updateApiKey') : t('apiKeyForm.saveApiKey')}
            </Button>
          )}
        />
      </div>
    </form>
  );
};
