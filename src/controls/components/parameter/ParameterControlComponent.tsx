// src/controls/components/parameter/ParameterControlComponent.tsx
import React, { useEffect, useCallback } from "react";
import { useForm,  } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ParameterControlModule } from "@/controls/modules/ParameterControlModule";

import { NumberField } from "@/components/LiteChat/common/form-fields/NumberField";
import { SliderField } from "@/components/LiteChat/common/form-fields/SliderField";
import { useTranslation } from "react-i18next";

interface ParameterControlComponentProps {
  module: ParameterControlModule;
  className?: string;
}

const paramsSchema = z.object({
  temperature: z.number().min(0).max(1),
  topP: z.number().min(0).max(1),
  maxTokens: z.number().min(1).nullable(),
  topK: z.number().min(1).nullable(),
  presencePenalty: z.number().min(-2).max(2),
  frequencyPenalty: z.number().min(-2).max(2),
});

type ParamsFormValues = z.infer<typeof paramsSchema>;

export const ParameterControlComponent: React.FC<ParameterControlComponentProps> = ({ module, className }) => {
  const { t } = useTranslation('prompt');
  const form = useForm({
    defaultValues: {
      temperature: module.temperature ?? module.defaultTemperature ?? 0.7,
      topP: module.topP ?? module.defaultTopP ?? 1.0,
      maxTokens: module.maxTokens ?? module.defaultMaxTokens ?? null,
      topK: module.topK ?? module.defaultTopK ?? null,
      presencePenalty: module.presencePenalty ?? module.defaultPresencePenalty ?? 0.0,
      frequencyPenalty: module.frequencyPenalty ?? module.defaultFrequencyPenalty ?? 0.0,
    } as ParamsFormValues,
    validators: {
      onChangeAsync: paramsSchema,
      onChangeAsyncDebounceMs: 500,
    },
  });

  useEffect(() => {
    form.reset({
      temperature: module.temperature ?? module.defaultTemperature ?? 0.7,
      topP: module.topP ?? module.defaultTopP ?? 1.0,
      maxTokens: module.maxTokens ?? module.defaultMaxTokens ?? null,
      topK: module.topK ?? module.defaultTopK ?? null,
      presencePenalty: module.presencePenalty ?? module.defaultPresencePenalty ?? 0.0,
      frequencyPenalty: module.frequencyPenalty ?? module.defaultFrequencyPenalty ?? 0.0,
    } as ParamsFormValues);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    module.temperature,
    module.defaultTemperature,
    module.topP,
    module.defaultTopP,
    module.maxTokens,
    module.defaultMaxTokens,
    module.topK,
    module.defaultTopK,
    module.presencePenalty,
    module.defaultPresencePenalty,
    module.frequencyPenalty,
    module.defaultFrequencyPenalty,
    // form instance removed from deps based on Tanstack Form guidance for reset
  ]);

  const [, forceUpdate] = React.useState({});
  useEffect(() => {
    const callback = () => forceUpdate({});
    module.setNotifyCallback(callback);
    return () => module.setNotifyCallback(null);
  }, [module]);

  // Updated commit handlers to work with primitive field values
  const handleSliderCommit = useCallback(
    (fieldName: keyof ParamsFormValues, moduleSetter: (value: number | null) => void, value: number) => {
      // Value is already set in form state by SliderField's internal handleChange on onValueChange
      // SliderField's onValueCommit gives the committed value.
      if (form.getFieldMeta(fieldName)?.errors.length === 0) {
        moduleSetter(value);
      }
    },
    [form, module]
  );
  
  const handleNumberInputBlur = useCallback(
    (fieldName: keyof ParamsFormValues, moduleSetter: (value: number | null) => void) => {
      // NumberField's onBlur is called after its internal handleChange updates form state
      if (form.getFieldMeta(fieldName)?.errors.length === 0) {
        const formValue = form.getFieldValue(fieldName);
        moduleSetter(formValue as number | null); // formValue type should align with ParamsFormValues
      }
    },
    [form, module]
  );

  const handleUseDefault = useCallback(
    (fieldName: keyof ParamsFormValues, moduleSetter: (value: number | null) => void, defaultValueToSet: number | null) => {
      form.setFieldValue(fieldName, defaultValueToSet);
      // Simulate a commit to ensure module updates if necessary, or rely on blur/commit of the field
      // For simplicity, we directly call moduleSetter(null) as per original logic.
      moduleSetter(null); 
    },
    [form, module]
  );
  
  const supportedParams = module.supportedParams;
  const showUseDefault =
    module.defaultTemperature !== undefined ||
    module.defaultTopP !== undefined ||
    module.defaultMaxTokens !== undefined ||
    module.defaultTopK !== undefined ||
    module.defaultPresencePenalty !== undefined ||
    module.defaultFrequencyPenalty !== undefined;

  // Helper to render the "Use Default" button
  const renderUseDefaultButton = (
    fieldName: keyof ParamsFormValues,
    moduleValue: number | null | undefined, // current value in the module
    moduleSetter: (value: number | null) => void, 
    defaultValue: number | null | undefined,
    defaultDisplayValue: string = t('parameterControl.none')
  ) => {
    if (!showUseDefault || defaultValue === undefined) return null;
    const displayValue = defaultValue?.toFixed?.(2) ?? defaultDisplayValue;
    return (
      <Button
        variant="link"
        size="sm"
        className="text-xs h-auto p-0 mt-1 text-muted-foreground"
        onClick={() => handleUseDefault(fieldName, moduleSetter, defaultValue ?? null)}
        disabled={moduleValue === null} // Disabled if module is already using its internal default
      >
        {t('parameterControl.useDefault', { defaultValue: displayValue })}
      </Button>
    );
  };

  return (
    <div className={cn("space-y-4 p-4", className)}>
      {supportedParams.has("temperature") && (
        <div className="space-y-0.5"> {/* Extra div to group SliderField and its default button */}
          <SliderField
            form={form}
            name="temperature"
            label={t('parameterControl.temperature')}
            min={0}
            max={1}
            step={0.01}
            valueDisplayPrecision={2}
            onValueCommit={(val) => handleSliderCommit("temperature", module.setTemperature, val[0])}
            wrapperClassName="text-xs" // Apply text-xs to wrapper for label consistency
          />
          {renderUseDefaultButton("temperature", module.temperature, module.setTemperature, module.defaultTemperature, "0.70")}
        </div>
      )}

      {supportedParams.has("top_p") && (
        <div className="space-y-0.5">
          <SliderField
            form={form}
            name="topP"
            label={t('parameterControl.topP')}
            min={0}
            max={1}
            step={0.01}
            valueDisplayPrecision={2}
            onValueCommit={(val) => handleSliderCommit("topP", module.setTopP, val[0])}
            wrapperClassName="text-xs"
          />
          {renderUseDefaultButton("topP", module.topP, module.setTopP, module.defaultTopP, "1.00")}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 items-start"> {/* items-start for alignment with button */}
        {supportedParams.has("max_tokens") && (
          <div className="space-y-0.5">
            <NumberField
              form={form}
              name="maxTokens"
              label={t('parameterControl.maxTokens')}
              placeholder={t('parameterControl.placeholder', { defaultValue: module.defaultMaxTokens ?? t('parameterControl.none') })}
              min={1}
              allowNull={true}
              onBlurInput={() => handleNumberInputBlur("maxTokens", module.setMaxTokens)}
              className="h-8 text-xs"
              wrapperClassName="text-xs"
            />
            {renderUseDefaultButton("maxTokens", module.maxTokens, module.setMaxTokens, module.defaultMaxTokens, t('parameterControl.none'))}
          </div>
        )}
        {supportedParams.has("top_k") && (
          <div className="space-y-0.5">
            <NumberField
              form={form}
              name="topK"
              label={t('parameterControl.topK')}
              placeholder={t('parameterControl.placeholder', { defaultValue: module.defaultTopK ?? t('parameterControl.none') })}
              min={1}
              allowNull={true}
              onBlurInput={() => handleNumberInputBlur("topK", module.setTopK)}
              className="h-8 text-xs"
              wrapperClassName="text-xs"
            />
            {renderUseDefaultButton("topK", module.topK, module.setTopK, module.defaultTopK, t('parameterControl.none'))}
          </div>
        )}
      </div>

      {supportedParams.has("presence_penalty") && (
         <div className="space-y-0.5">
          <SliderField
            form={form}
            name="presencePenalty"
            label={t('parameterControl.presencePenalty')}
            min={-2}
            max={2}
            step={0.01}
            valueDisplayPrecision={2}
            onValueCommit={(val) => handleSliderCommit("presencePenalty", module.setPresencePenalty, val[0])}
            wrapperClassName="text-xs"
          />
          {renderUseDefaultButton("presencePenalty", module.presencePenalty, module.setPresencePenalty, module.defaultPresencePenalty, "0.00")}
        </div>
      )}

      {supportedParams.has("frequency_penalty") && (
        <div className="space-y-0.5">
          <SliderField
            form={form}
            name="frequencyPenalty"
            label={t('parameterControl.frequencyPenalty')}
            min={-2}
            max={2}
            step={0.01}
            valueDisplayPrecision={2}
            onValueCommit={(val) => handleSliderCommit("frequencyPenalty", module.setFrequencyPenalty, val[0])}
            wrapperClassName="text-xs"
          />
          {renderUseDefaultButton("frequencyPenalty", module.frequencyPenalty, module.setFrequencyPenalty, module.defaultFrequencyPenalty, "0.00")}
        </div>
      )}
    </div>
  );
};
