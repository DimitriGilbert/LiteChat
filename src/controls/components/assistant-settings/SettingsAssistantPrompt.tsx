// src/components/LiteChat/settings/assistant/SettingsAssistantPrompt.tsx
// FULL FILE
import React, { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";

// Zod schema for validation
const assistantPromptSchema = z.object({
  globalSystemPrompt: z.string(), // Assuming empty string is acceptable
});

// Simplified FieldInfo for displaying errors (can be extracted if used elsewhere)
function FieldMetaMessages({ field }: { field: AnyFieldApi }) {
  return (
    <>
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <em className="text-xs text-destructive mt-1 block">
          {field.state.meta.errors.join(", ")}
        </em>
      ) : null}
      {/* We can add field.state.meta.isValidating ? 'Validating...' : null here if needed */}
    </>
  );
}

export const SettingsAssistantPrompt: React.FC = () => {
  const { globalSystemPrompt, setGlobalSystemPrompt } = useSettingsStore(
    useShallow((state) => ({
      globalSystemPrompt: state.globalSystemPrompt,
      setGlobalSystemPrompt: state.setGlobalSystemPrompt,
    })),
  );

  const form = useForm({
    defaultValues: {
      globalSystemPrompt: globalSystemPrompt ?? "",
    },
    validators: {
      onChangeAsync: assistantPromptSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      try {
        setGlobalSystemPrompt(value.globalSystemPrompt);
        toast.success("Global system prompt updated!");
      } catch (error) {
        toast.error("Failed to update prompt. Please try again.");
        console.error("Error submitting assistant prompt form:", error);
      }
    },
  });

  useEffect(() => {
    if (form.state.values.globalSystemPrompt !== (globalSystemPrompt ?? "")) {
      form.reset({ globalSystemPrompt: globalSystemPrompt ?? "" });
    }
  }, [globalSystemPrompt, form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <div>
        <form.Field
          name="globalSystemPrompt"
          children={(field) => (
            <>
              <Label
                htmlFor={field.name}
                className="text-sm mb-1 block"
              >
                Global System Prompt
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Default instructions for the assistant. Can be overridden per-project.
              </p>
              <Textarea
                id={field.name}
                placeholder="Enter default system instructions for the assistant..."
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                rows={6}
                className={field.state.meta.errors.length ? "border-destructive" : ""}
              />
              <FieldMetaMessages field={field} />
            </>
          )}
        />
      </div>
      <div className="flex justify-end pt-2">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting, state.isValidating, state.isValid] as const}
          children={([canSubmit, isSubmitting, isValidating, isValid]) => (
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit || isSubmitting || isValidating || !isValid}
            >
              {isSubmitting ? "Saving..." : isValidating ? "Validating..." : "Save Prompt"}
            </Button>
          )}
        />
      </div>
    </form>
  );
};
