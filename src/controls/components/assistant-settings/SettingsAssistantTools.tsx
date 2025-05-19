// src/components/LiteChat/settings/assistant/SettingsAssistantTools.tsx
// FULL FILE
import React, { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";

const assistantToolsSchema = z.object({
  toolMaxSteps: z
    .number({
      required_error: "Max steps is required",
      invalid_type_error: "Max steps must be a number",
    })
    .min(1, "Must be at least 1")
    .max(20, "Cannot exceed 20"),
});

// Utility component for field meta messages (can be shared)
function FieldMetaMessages({ field }: { field: AnyFieldApi }) {
  return (
    <>
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <em className="text-xs text-destructive mt-1 block">
          {field.state.meta.errors.join(", ")}
        </em>
      ) : null}
    </>
  );
}

export const SettingsAssistantTools: React.FC = () => {
  const { toolMaxSteps, setToolMaxSteps } = useSettingsStore(
    useShallow((state) => ({
      toolMaxSteps: state.toolMaxSteps,
      setToolMaxSteps: state.setToolMaxSteps,
    })),
  );

  const form = useForm({
    defaultValues: {
      toolMaxSteps: toolMaxSteps ?? 5,
    },
    validators: {
      onChangeAsync: assistantToolsSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      try {
        setToolMaxSteps(value.toolMaxSteps);
        toast.success("Tool settings updated!");
      } catch (error) {
        toast.error("Failed to update tool settings.");
        console.error("Error submitting tool settings form:", error);
      }
    },
  });

  useEffect(() => {
    if (form.state.values.toolMaxSteps !== (toolMaxSteps ?? 5)) {
      form.reset({ toolMaxSteps: toolMaxSteps ?? 5 });
    }
  }, [toolMaxSteps, form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field
        name="toolMaxSteps"
        children={(field) => (
          <div>
            <Label htmlFor={field.name} className="text-sm mb-1 block">
              Maximum Tool Steps per Turn
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Limits the number of sequential tool calls the AI can make before
              generating a final response (1-20). Higher values allow more complex
              tasks but increase latency and cost. (Default: 5)
            </p>
            <Input
              id={field.name}
              type="number"
              min={1}
              max={20}
              step={1}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => {
                const numValue = e.target.valueAsNumber;
                if (!isNaN(numValue)) {
                  field.handleChange(numValue);
                } else if (e.target.value === "") {
                   // Allow clearing, Zod schema will catch if it's required
                  field.handleChange(undefined as any); // Or a specific default like null/0 if appropriate for schema
                }
              }}
              className={`w-24 ${field.state.meta.errors.length ? "border-destructive" : ""}`}
            />
            <FieldMetaMessages field={field} />
          </div>
        )}
      />
      <div className="flex justify-end pt-2">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting, state.isValidating, state.isValid] as const}
          children={([canSubmit, isSubmitting, isValidating, isValid]) => (
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit || isSubmitting || isValidating || !isValid}
            >
              {isSubmitting ? "Saving..." : isValidating ? "Validating..." : "Save Tool Settings"}
            </Button>
          )}
        />
      </div>
    </form>
  );
};
