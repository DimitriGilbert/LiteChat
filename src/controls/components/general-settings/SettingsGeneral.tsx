// src/components/LiteChat/settings/SettingsGeneral.tsx
import React, { useEffect } from "react";
import { RotateCcwIcon } from "lucide-react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Import new form field primitives
import { SwitchField } from "@/components/LiteChat/common/form-fields/SwitchField";
import { SliderField } from "@/components/LiteChat/common/form-fields/SliderField";
import { NumberField } from "@/components/LiteChat/common/form-fields/NumberField";

const settingsSchema = z.object({
  enableStreamingMarkdown: z.boolean(),
  enableStreamingCodeBlockParsing: z.boolean(),
  foldStreamingCodeBlocks: z.boolean(),
  foldUserMessagesOnCompletion: z.boolean(),
  enableAutoScrollOnStream: z.boolean(),
  streamingRenderFPS: z.number().min(3, "Min 3 FPS").max(60, "Max 60 FPS"),
  autoScrollInterval: z.number().min(50, "Min 50ms").max(5000, "Max 5000ms"),
});

const SettingsGeneralComponent: React.FC = () => {
  const storeSetters = useSettingsStore(
    useShallow((state) => ({
      setEnableStreamingMarkdown: state.setEnableStreamingMarkdown,
      setEnableStreamingCodeBlockParsing:
        state.setEnableStreamingCodeBlockParsing,
      setFoldStreamingCodeBlocks: state.setFoldStreamingCodeBlocks,
      setFoldUserMessagesOnCompletion: state.setFoldUserMessagesOnCompletion,
      setStreamingRenderFPS: state.setStreamingRenderFPS,
      setAutoScrollInterval: state.setAutoScrollInterval,
      setEnableAutoScrollOnStream: state.setEnableAutoScrollOnStream,
      setEnableAdvancedSettings: state.setEnableAdvancedSettings,
      resetGeneralSettings: state.resetGeneralSettings,
    }))
  );
  const storeValues = useSettingsStore(
    useShallow((state) => ({
      enableStreamingMarkdown: state.enableStreamingMarkdown,
      enableStreamingCodeBlockParsing: state.enableStreamingCodeBlockParsing,
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks,
      foldUserMessagesOnCompletion: state.foldUserMessagesOnCompletion,
      streamingRenderFPS: state.streamingRenderFPS,
      autoScrollInterval: state.autoScrollInterval,
      enableAutoScrollOnStream: state.enableAutoScrollOnStream,
      enableAdvancedSettings: state.enableAdvancedSettings,
    }))
  );

  const form = useForm({
    defaultValues: {
      enableStreamingMarkdown: storeValues.enableStreamingMarkdown ?? true,
      enableStreamingCodeBlockParsing:
        storeValues.enableStreamingCodeBlockParsing ?? true,
      foldStreamingCodeBlocks: storeValues.foldStreamingCodeBlocks ?? false,
      foldUserMessagesOnCompletion:
        storeValues.foldUserMessagesOnCompletion ?? false,
      enableAutoScrollOnStream: storeValues.enableAutoScrollOnStream ?? true,
      streamingRenderFPS: storeValues.streamingRenderFPS ?? 15,
      autoScrollInterval: storeValues.autoScrollInterval ?? 1000,
    },
    validators: {
      onChangeAsync: settingsSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      storeSetters.setEnableStreamingMarkdown(value.enableStreamingMarkdown);
      storeSetters.setEnableStreamingCodeBlockParsing(
        value.enableStreamingCodeBlockParsing
      );
      storeSetters.setFoldStreamingCodeBlocks(value.foldStreamingCodeBlocks);
      storeSetters.setFoldUserMessagesOnCompletion(
        value.foldUserMessagesOnCompletion
      );
      storeSetters.setEnableAutoScrollOnStream(value.enableAutoScrollOnStream);
      storeSetters.setStreamingRenderFPS(value.streamingRenderFPS);
      storeSetters.setAutoScrollInterval(value.autoScrollInterval);
    },
  });

  useEffect(() => {
    form.reset({
      enableStreamingMarkdown: storeValues.enableStreamingMarkdown ?? true,
      enableStreamingCodeBlockParsing:
        storeValues.enableStreamingCodeBlockParsing ?? true,
      foldStreamingCodeBlocks: storeValues.foldStreamingCodeBlocks ?? false,
      foldUserMessagesOnCompletion:
        storeValues.foldUserMessagesOnCompletion ?? false,
      enableAutoScrollOnStream: storeValues.enableAutoScrollOnStream ?? true,
      streamingRenderFPS: storeValues.streamingRenderFPS ?? 15,
      autoScrollInterval: storeValues.autoScrollInterval ?? 1000,
    });
  }, [
    storeValues.enableStreamingMarkdown,
    storeValues.enableStreamingCodeBlockParsing,
    storeValues.foldStreamingCodeBlocks,
    storeValues.foldUserMessagesOnCompletion,
    storeValues.enableAutoScrollOnStream,
    storeValues.streamingRenderFPS,
    storeValues.autoScrollInterval,
    form,
  ]);

  const handleResetClick = () => {
    if (
      window.confirm(
        "Are you sure you want to reset Streaming & Display settings to their defaults?"
      )
    ) {
      storeSetters.resetGeneralSettings();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="p-1 space-y-4"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">General Settings</h3>
          <div className="flex items-center space-x-2">
            <label htmlFor="advanced-toggle" className="text-sm font-medium text-muted-foreground">
              Advanced Settings
            </label>
            <input
              id="advanced-toggle"
              type="checkbox"
              checked={storeValues.enableAdvancedSettings}
              onChange={(e) => storeSetters.setEnableAdvancedSettings(e.target.checked)}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => storeSetters.setEnableAdvancedSettings(!storeValues.enableAdvancedSettings)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                storeValues.enableAdvancedSettings ? "bg-primary" : "bg-input"
              )}
              aria-labelledby="advanced-toggle"
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
                  storeValues.enableAdvancedSettings ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {storeValues.enableAdvancedSettings 
            ? "Advanced configuration options are visible. Toggle off to hide complex settings."
            : "Basic mode - advanced configuration options are hidden. Toggle on to show all settings."
          }
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Streaming & Display</h3>

        <SwitchField
          form={form}
          name="enableStreamingMarkdown"
          label="Parse Markdown While Streaming"
          description="Render Markdown formatting as the response arrives (may impact performance slightly)."
        />

        <SwitchField
          form={form}
          name="enableStreamingCodeBlockParsing"
          label="Use Full Code Blocks While Streaming"
          description="Use the syntax-highlighting component for code blocks during streaming."
        />

        <SwitchField
          form={form}
          name="foldStreamingCodeBlocks"
          label="Fold Code Blocks by Default During Streaming"
          description="Automatically collapse code blocks as they stream in. Useful for long code outputs."
        />

        <SwitchField
          form={form}
          name="foldUserMessagesOnCompletion"
          label="Fold User Messages After Response"
          description="Automatically collapse the user's prompt message once the assistant finishes responding."
        />

        <SwitchField
          form={form}
          name="enableAutoScrollOnStream"
          label="Auto-Scroll While Streaming"
          description="Automatically scroll to the bottom as new content arrives."
        />

        {storeValues.enableAdvancedSettings && (
          <div className="rounded-lg border p-3 shadow-sm space-y-2">
            <SliderField
              form={form}
              name="streamingRenderFPS"
              label="Streaming Update Rate"
              min={3}
              max={60}
              step={1}
              valueLabelSuffix=" FPS"
            />
            <NumberField
              form={form}
              name="streamingRenderFPS"
              label="FPS Input" // Hidden or visually distinct label if SliderField shows value
              min={3}
              max={60}
              step={1}
              className="w-24 h-8 text-xs ml-auto" // Style to place it like original
              aria-label="Streaming Render FPS Value"
            />
            {/* Original description was under a common Label. We can add it to SliderField or here explicitly */}
            <p className={cn("text-sm text-muted-foreground")}>
              Controls how frequently the UI updates during streaming (3-60 FPS).
            </p>
          </div>
        )}

        {storeValues.enableAdvancedSettings && (
          <div className="rounded-lg border p-3 shadow-sm space-y-2">
            <SliderField
              form={form}
              name="autoScrollInterval"
              label="Auto-Scroll Interval"
              min={50}
              max={5000}
              step={50}
              valueLabelSuffix=" ms"
              disabled={!form.state.values.enableAutoScrollOnStream}
            />
            <NumberField
              form={form}
              name="autoScrollInterval"
              label="Interval Input (ms)" // Hidden or visually distinct label
              min={50}
              max={5000}
              step={50}
              className="w-24 h-8 text-xs ml-auto" // Style to place it like original
              disabled={!form.state.values.enableAutoScrollOnStream}
              aria-label="Auto Scroll Interval Value"
            />
            <p className={cn("text-sm text-muted-foreground")}>
              How often to scroll to the bottom during streaming (50-5000 ms).
            </p>
          </div>
        )}
      </div>

      <Separator />
      <div className="flex items-center justify-between pt-3">
        <form.Subscribe
          children={(state) => {
            const canSubmit = state.canSubmit;
            const isSubmitting = state.isSubmitting;
            const isValidating = state.isValidating;
            const isValid = state.isValid;
            return (
              <div className="flex items-center space-x-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    !canSubmit || isSubmitting || isValidating || !isValid
                  }
                >
                  {isSubmitting
                    ? "Saving..."
                    : isValidating
                    ? "Validating..."
                    : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetClick}
                  type="button"
                >
                  <RotateCcwIcon className="mr-2 h-4 w-4" />
                  Reset General Settings
                </Button>
              </div>
            );
          }}
        />
      </div>
    </form>
  );
};

export const SettingsGeneral = React.memo(SettingsGeneralComponent);
