// src/components/LiteChat/settings/tags/TagForm.tsx
// FULL FILE
import React, { useEffect } from "react";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SaveIcon, XIcon, Loader2 } from "lucide-react";
import type { DbTag } from "@/types/litechat/rules";
import { FieldMetaMessages } from "@/components/LiteChat/common/form-fields/FieldMetaMessages";

interface TagFormProps {
  initialData?: Partial<DbTag>;
  isParentSaving?: boolean;
  onSave: (
    data: Omit<DbTag, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string | void>;
  onCancel: () => void;
}

const tagFormSchema = z.object({
  name: z.string().min(1, "Tag Name is required."),
  description: z.string().nullable(),
});

export const TagForm: React.FC<TagFormProps> = ({
  initialData,
  isParentSaving = false,
  onSave,
  onCancel,
}) => {
  const form = useForm({
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || null,
    },
    validators: {
      onChangeAsync: tagFormSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      await onSave({
        name: value.name.trim(),
        description: value.description?.trim() || null,
      });
    },
  });

  useEffect(() => {
    form.reset({
      name: initialData?.name || "",
      description: initialData?.description || null,
    });
  }, [initialData, form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4 border rounded-md p-4 bg-card shadow-md"
    >
      <h4 className="font-semibold text-card-foreground">
        {initialData?.id ? "Edit Tag" : "Add New Tag"}
      </h4>
      <form.Field
        name="name"
        validators={{ onChange: tagFormSchema.shape.name }}
        children={(field: AnyFieldApi) => (
          <div className="space-y-1.5">
            <Label htmlFor={field.name}>Tag Name</Label>
            <Input
              id={field.name}
              value={field.state.value ?? ""}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="e.g., Code Generation, Summarization"
              disabled={form.state.isSubmitting || isParentSaving}
            />
            <FieldMetaMessages field={field} />
          </div>
        )}
      />
      <form.Field
        name="description"
        validators={{ onChange: tagFormSchema.shape.description }}
        children={(field: AnyFieldApi) => (
          <div className="space-y-1.5">
            <Label htmlFor={field.name}>Description (Optional)</Label>
            <Textarea
              id={field.name}
              value={field.state.value ?? ""}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="Describe when to use this tag..."
              rows={2}
              disabled={form.state.isSubmitting || isParentSaving}
            />
            <FieldMetaMessages field={field} />
          </div>
        )}
      />
      <div className="flex justify-end space-x-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={form.state.isSubmitting || isParentSaving}
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
              variant="secondary"
              size="sm"
              type="submit"
              disabled={
                isParentSaving ||
                !canSubmit ||
                isSubmitting ||
                isValidating ||
                !isValid
              }
            >
              {(isSubmitting || isValidating) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              <SaveIcon className="h-4 w-4 mr-1" />{" "}
              {isSubmitting || isValidating
                ? "Saving..."
                : "Save Tag"}
            </Button>
          )}
        />
      </div>
    </form>
  );
};
