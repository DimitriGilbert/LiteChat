// src/components/LiteChat/settings/rules/RuleForm.tsx
// FULL FILE
import React, { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SaveIcon, XIcon, Loader2 } from "lucide-react";
import type { DbRule, RuleType } from "@/types/litechat/rules";

import { TextField } from "@/components/LiteChat/common/form-fields/TextField";
import { TextareaField } from "@/components/LiteChat/common/form-fields/TextareaField";
import { SelectField, type SelectFieldOption } from "@/components/LiteChat/common/form-fields/SelectField";

interface RuleFormProps {
  initialData?: Partial<DbRule>;
  isSavingExt: boolean;
  onSave: (
    data: Omit<DbRule, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string | void>;
  onCancel: () => void;
}

const ruleSchema = z.object({
  name: z.string().min(1, "Rule Name is required."),
  content: z.string().min(1, "Rule Content is required."),
  type: z.enum(["system", "before", "after"], {
    errorMap: () => ({ message: "Rule Type is required." }),
  }),
});

const ruleTypes: SelectFieldOption[] = [
  { value: "system", label: "System Prompt" },
  { value: "before", label: "Before User Prompt" },
  { value: "after", label: "After User Prompt" },
];

export const RuleForm: React.FC<RuleFormProps> = ({
  initialData,
  isSavingExt,
  onSave,
  onCancel,
}) => {
  const form = useForm({
    defaultValues: {
      name: initialData?.name || "",
      content: initialData?.content || "",
      type: initialData?.type || ("before" as RuleType),
    },
    validators: {
      onChangeAsync: ruleSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      await onSave({
        name: value.name.trim(),
        content: value.content.trim(),
        type: value.type as RuleType,
      });
    },
  });

  useEffect(() => {
    form.reset({
      name: initialData?.name || "",
      content: initialData?.content || "",
      type: initialData?.type || ("before" as RuleType),
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
        {initialData?.id ? "Edit Rule" : "Add New Rule"}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TextField
          form={form}
          name="name"
          label="Rule Name"
          placeholder="e.g., Always respond in JSON"
          required
          disabled={isSavingExt}
          wrapperClassName="md:col-span-2"
        />
        <SelectField
          form={form}
          name="type"
          label="Rule Type"
          options={ruleTypes}
          placeholder="Select Type"
          disabled={isSavingExt}
        />
      </div>
      <TextareaField
        form={form}
        name="content"
        label="Rule Content"
        placeholder="Enter the rule text to be injected..."
        required
        rows={4}
        disabled={isSavingExt}
        className="font-mono text-xs"
      />
      <div className="flex justify-end space-x-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSavingExt}
          type="button"
        >
          <XIcon className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting, state.isValidating, state.isValid] as const}
          children={([canSubmit, isSubmitting, isValidating, isValid]) => (
            <Button
              variant="secondary"
              size="sm"
              type="submit"
              disabled={isSavingExt || !canSubmit || isSubmitting || !isValid || isValidating}
            >
              {(isSavingExt || isSubmitting || isValidating) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <SaveIcon className="h-4 w-4 mr-1" />{" "}
              {(isSavingExt || isSubmitting || isValidating) ? "Saving..." : "Save Rule"}
            </Button>
          )}
        />
      </div>
    </form>
  );
};
