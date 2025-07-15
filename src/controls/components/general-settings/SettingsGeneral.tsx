// src/components/LiteChat/settings/SettingsGeneral.tsx
import React, { useEffect } from "react";
import { RotateCcwIcon } from "lucide-react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Import new form field primitives
import { SwitchField } from "@/components/LiteChat/common/form-fields/SwitchField";
import { SliderField } from "@/components/LiteChat/common/form-fields/SliderField";
import { NumberField } from "@/components/LiteChat/common/form-fields/NumberField";

const SettingsGeneralComponent: React.FC = () => {
  const { t } = useTranslation('settings');

  const settingsSchema = z.object({
    enableStreamingMarkdown: z.boolean(),
    enableStreamingCodeBlockParsing: z.boolean(),
    foldStreamingCodeBlocks: z.boolean(),
    foldUserMessagesOnCompletion: z.boolean(),
    enableAutoScrollOnStream: z.boolean(),
    streamingRenderFPS: z.number().min(3, t('generalSettings.validation.minFps')).max(60, t('generalSettings.validation.maxFps')),
    autoScrollInterval: z.number().min(50, t('generalSettings.validation.minMs')).max(5000, t('generalSettings.validation.maxMs')),
    
    // Auto Tool Selection Settings
    autoToolSelectionEnabled: z.boolean(),
    
    // Text Trigger Settings
    textTriggersEnabled: z.boolean(),
    textTriggerStartDelimiter: z.string().min(1),
    textTriggerEndDelimiter: z.string().min(1),
  });

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
      
      // Auto Tool Selection Setters
      setAutoToolSelectionEnabled: state.setAutoToolSelectionEnabled,
      
      // Text Trigger Setters
      setTextTriggersEnabled: state.setTextTriggersEnabled,
      setTextTriggerDelimiters: state.setTextTriggerDelimiters,
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
      
      // Auto Tool Selection Values
      autoToolSelectionEnabled: state.autoToolSelectionEnabled,
      
      // Text Trigger Values
      textTriggersEnabled: state.textTriggersEnabled,
      textTriggerStartDelimiter: state.textTriggerStartDelimiter,
      textTriggerEndDelimiter: state.textTriggerEndDelimiter,
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
      
      // Auto Tool Selection Defaults
      autoToolSelectionEnabled: storeValues.autoToolSelectionEnabled ?? false,
      
      // Text Trigger Defaults
      textTriggersEnabled: storeValues.textTriggersEnabled ?? true,
      textTriggerStartDelimiter: storeValues.textTriggerStartDelimiter ?? "@.",
      textTriggerEndDelimiter: storeValues.textTriggerEndDelimiter ?? ";",
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
      
      // Auto Tool Selection Settings
      storeSetters.setAutoToolSelectionEnabled(value.autoToolSelectionEnabled);
      
      // Text Trigger Settings
      storeSetters.setTextTriggersEnabled(value.textTriggersEnabled);
      storeSetters.setTextTriggerDelimiters(value.textTriggerStartDelimiter, value.textTriggerEndDelimiter);
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
      
      // Auto Tool Selection Reset Values
      autoToolSelectionEnabled: storeValues.autoToolSelectionEnabled ?? false,
      
      // Text Trigger Reset Values
      textTriggersEnabled: storeValues.textTriggersEnabled ?? true,
      textTriggerStartDelimiter: storeValues.textTriggerStartDelimiter ?? "@.",
      textTriggerEndDelimiter: storeValues.textTriggerEndDelimiter ?? ";",
    });
  }, [
    storeValues.enableStreamingMarkdown,
    storeValues.enableStreamingCodeBlockParsing,
    storeValues.foldStreamingCodeBlocks,
    storeValues.foldUserMessagesOnCompletion,
    storeValues.enableAutoScrollOnStream,
    storeValues.streamingRenderFPS,
    storeValues.autoScrollInterval,
    storeValues.autoToolSelectionEnabled,
    storeValues.textTriggersEnabled,
    storeValues.textTriggerStartDelimiter,
    storeValues.textTriggerEndDelimiter,
    form,
  ]);

  const handleResetClick = () => {
    if (
      window.confirm(
        t('generalSettings.resetConfirmation', "Are you sure you want to reset Streaming & Display settings to their defaults?")
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
          <h3 className="text-lg font-medium">{t('generalSettings.title', 'General Settings')}</h3>
          <div className="flex items-center space-x-2">
            <label htmlFor="advanced-toggle" className="text-sm font-medium text-muted-foreground">
              {t('generalSettings.advancedSettings', 'Advanced Settings')}
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
            ? t('generalSettings.advancedVisible', "Advanced configuration options are visible. Toggle off to hide complex settings.")
            : t('generalSettings.advancedHidden', "Basic mode - advanced configuration options are hidden. Toggle on to show all settings.")
          }
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-lg font-medium">{t('generalSettings.streamingDisplayTitle', 'Streaming & Display')}</h3>

        <SwitchField
          form={form}
          name="enableStreamingMarkdown"
          label={t('generalSettings.enableStreamingMarkdownLabel', "Parse Markdown While Streaming")}
          description={t('generalSettings.enableStreamingMarkdownDescription', "Render Markdown formatting as the response arrives (may impact performance slightly).")}
        />

        <SwitchField
          form={form}
          name="enableStreamingCodeBlockParsing"
          label={t('generalSettings.enableStreamingCodeBlockParsingLabel', "Use Full Code Blocks While Streaming")}
          description={t('generalSettings.enableStreamingCodeBlockParsingDescription', "Use the syntax-highlighting component for code blocks during streaming.")}
        />

        <SwitchField
          form={form}
          name="foldStreamingCodeBlocks"
          label={t('generalSettings.foldStreamingCodeBlocksLabel', "Fold Code Blocks by Default During Streaming")}
          description={t('generalSettings.foldStreamingCodeBlocksDescription', "Automatically collapse code blocks as they stream in. Useful for long code outputs.")}
        />

        <SwitchField
          form={form}
          name="foldUserMessagesOnCompletion"
          label={t('generalSettings.foldUserMessagesOnCompletionLabel', "Fold User Messages After Response")}
          description={t('generalSettings.foldUserMessagesOnCompletionDescription', "Automatically collapse the user's prompt message once the assistant finishes responding.")}
        />

        <SwitchField
          form={form}
          name="enableAutoScrollOnStream"
          label={t('generalSettings.enableAutoScrollOnStreamLabel', "Auto-Scroll While Streaming")}
          description={t('generalSettings.enableAutoScrollOnStreamDescription', "Automatically scroll to the bottom as new content arrives.")}
        />

        {storeValues.enableAdvancedSettings && (
          <div className="rounded-lg border p-3 shadow-sm space-y-2">
            <div className="flex items-center space-x-2">
              <SliderField
                form={form}
                name="streamingRenderFPS"
                label={t('generalSettings.streamingUpdateRateLabel')}
                min={3}
                max={60}
                step={1}
                valueLabelSuffix={t('generalSettings.fpsSuffix')}
              />
              <NumberField
                form={form}
                name="streamingRenderFPS"
                label={t('generalSettings.fpsInputLabel')}
                min={3}
                max={60}
                step={1}
                className="w-24 h-8 text-xs ml-auto"
                aria-label={t('generalSettings.streamingUpdateRateAriaLabel')}
              />
            </div>
            <p className={cn("text-sm text-muted-foreground")}>{t('generalSettings.streamingUpdateRateDescription')}</p>
          </div>
        )}

        {storeValues.enableAdvancedSettings && (
          <div className="rounded-lg border p-3 shadow-sm space-y-2">
            <div className="flex items-center space-x-2">
              <SliderField
                form={form}
                name="autoScrollInterval"
                label={t('generalSettings.autoScrollIntervalLabel')}
                min={50}
                max={5000}
                step={50}
                valueLabelSuffix={t('generalSettings.msSuffix')}
                disabled={!form.state.values.enableAutoScrollOnStream}
              />
              <NumberField
                form={form}
                name="autoScrollInterval"
                label={t('generalSettings.msInputLabel')}
                min={50}
                max={5000}
                step={50}
                className="w-24 h-8 text-xs ml-auto"
                aria-label={t('generalSettings.autoScrollIntervalAriaLabel')}
                disabled={!form.state.values.enableAutoScrollOnStream}
              />
            </div>
            <p className={cn("text-sm text-muted-foreground", { 'text-muted-foreground/50': !form.state.values.enableAutoScrollOnStream })}>
              {t('generalSettings.autoScrollIntervalDescription')}
            </p>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Auto Tool Selection</h3>
        
        <SwitchField
          form={form}
          name="autoToolSelectionEnabled"
          label="Enable Automatic Tool Selection"
          description="Allow AI to automatically select relevant tools based on your prompt content."
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Text Triggers</h3>
        
        <SwitchField
          form={form}
          name="textTriggersEnabled"
          label="Enable Text Triggers"
          description="Allow inline commands in prompts using trigger syntax (e.g., @.tools.activate websearch;)."
        />

        {storeValues.enableAdvancedSettings && (
          <div className="rounded-lg border p-3 shadow-sm space-y-3">
            <h4 className="text-sm font-medium">Trigger Delimiters</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="textTriggerStartDelimiter" className="block text-sm font-medium mb-1">
                  Start Delimiter
                </label>
                <form.Field name="textTriggerStartDelimiter" children={(field) => (
                  <input
                    id="textTriggerStartDelimiter"
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md text-sm"
                    placeholder="@."
                  />
                )} />
              </div>
              
              <div>
                <label htmlFor="textTriggerEndDelimiter" className="block text-sm font-medium mb-1">
                  End Delimiter
                </label>
                <form.Field name="textTriggerEndDelimiter" children={(field) => (
                  <input
                    id="textTriggerEndDelimiter"
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md text-sm"
                    placeholder=";"
                  />
                )} />
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Customize the delimiters used for text triggers. Default: @.namespace.method args;
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
                    ? t('generalSettings.saving')
                    : isValidating
                    ? t('generalSettings.validating')
                    : t('generalSettings.saveChanges')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetClick}
                  type="button"
                >
                  <RotateCcwIcon className="mr-2 h-4 w-4" />
                  {t('generalSettings.resetButton', 'Reset Streaming & Display Settings')}
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
