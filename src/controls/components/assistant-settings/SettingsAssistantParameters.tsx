// src/controls/components/assitant/SettingsAssistantParameters.tsx
// FULL FILE
import React, { useEffect } from "react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
// import { Label } from "@/components/ui/label"; // No longer directly used
// import { Slider } from "@/components/ui/slider"; // No longer directly used
// import { Input } from "@/components/ui/input"; // No longer directly used
import { Button } from "@/components/ui/button";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import { NumberField } from "@/components/LiteChat/common/form-fields/NumberField";
import { SliderField } from "@/components/LiteChat/common/form-fields/SliderField";
// ParameterControlComponent is for prompt-time overrides, not global settings.
// We will replicate its relevant UI parts here for global settings.

const assistantParamsSchema = z.object({
  temperature: z.number().min(0).max(1),
  topP: z.number().min(0).max(1),
  maxTokens: z.number().min(1).nullable(),
  topK: z.number().min(1).nullable(),
  presencePenalty: z.number().min(-2).max(2),
  frequencyPenalty: z.number().min(-2).max(2),
});

// Local FieldMetaMessages removed as it's part of primitives

export const SettingsAssistantParameters: React.FC = () => {
  const store = useSettingsStore(
    useShallow((state) => ({
      temperature: state.temperature,
      setTemperature: state.setTemperature,
      topP: state.topP,
      setTopP: state.setTopP,
      maxTokens: state.maxTokens,
      setMaxTokens: state.setMaxTokens,
      topK: state.topK,
      setTopK: state.setTopK,
      presencePenalty: state.presencePenalty,
      setPresencePenalty: state.setPresencePenalty,
      frequencyPenalty: state.frequencyPenalty,
      setFrequencyPenalty: state.setFrequencyPenalty,
    }))
  );

  const form = useForm({
    defaultValues: {
      temperature: store.temperature ?? 0.7,
      topP: store.topP ?? 1.0,
      maxTokens: store.maxTokens ?? null,
      topK: store.topK ?? null,
      presencePenalty: store.presencePenalty ?? 0.0,
      frequencyPenalty: store.frequencyPenalty ?? 0.0,
    },
    validators: {
      onChangeAsync: assistantParamsSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      try {
        store.setTemperature(value.temperature);
        store.setTopP(value.topP);
        store.setMaxTokens(value.maxTokens ?? null);
        store.setTopK(value.topK ?? null);
        store.setPresencePenalty(value.presencePenalty);
        store.setFrequencyPenalty(value.frequencyPenalty);
        toast.success("Assistant parameters updated!");
      } catch (error) {
        toast.error("Failed to update parameters.");
        console.error("Error submitting parameters form:", error);
      }
    },
  });

  useEffect(() => {
    form.reset({
      temperature: store.temperature ?? 0.7,
      topP: store.topP ?? 1.0,
      maxTokens: store.maxTokens ?? null,
      topK: store.topK ?? null,
      presencePenalty: store.presencePenalty ?? 0.0,
      frequencyPenalty: store.frequencyPenalty ?? 0.0,
    });
  }, [
    store.temperature,
    store.topP,
    store.maxTokens,
    store.topK,
    store.presencePenalty,
    store.frequencyPenalty,
    form,
  ]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <p className="text-xs text-muted-foreground mb-3">
        Set the default global values for AI parameters. These can be overridden
        per-project or per-prompt turn.
      </p>
      
      <SliderField
        form={form}
        name="temperature"
        label="Temperature"
        min={0}
        max={1}
        step={0.01}
        valueDisplayPrecision={2}
        wrapperClassName="space-y-1.5"
      />

      <SliderField
        form={form}
        name="topP"
        label="Top P"
        min={0}
        max={1}
        step={0.01}
        valueDisplayPrecision={2}
        wrapperClassName="space-y-1.5"
      />

      <div className="grid grid-cols-2 gap-4 items-end">
        <NumberField
          form={form}
          name="maxTokens"
          label="Max Tokens"
          placeholder="Default (None)"
          min={1}
          className="h-9 text-sm"
          allowNull={true}
          wrapperClassName="space-y-1.5"
        />
        <NumberField
          form={form}
          name="topK"
          label="Top K"
          placeholder="Default (None)"
          min={1}
          className="h-9 text-sm"
          allowNull={true}
          wrapperClassName="space-y-1.5"
        />
      </div>

      <SliderField
        form={form}
        name="presencePenalty"
        label="Presence Penalty"
        min={-2}
        max={2}
        step={0.01}
        valueDisplayPrecision={2}
        wrapperClassName="space-y-1.5"
      />

      <SliderField
        form={form}
        name="frequencyPenalty"
        label="Frequency Penalty"
        min={-2}
        max={2}
        step={0.01}
        valueDisplayPrecision={2}
        wrapperClassName="space-y-1.5"
      />

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => form.reset()}
          disabled={!form.state.isDirty}
        >
          Reset
        </Button>
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          )}
        />
      </div>
    </form>
  );
};
