// src/controls/components/global-model-selector/GlobalModelSelector.tsx
import React, { useState, useEffect, useCallback } from "react";
import { ModelSelector } from "./ModelSelector";
import { type GlobalModelSelectorModule } from "@/controls/modules/GlobalModelSelectorModule";
import { useProviderStore } from "@/store/provider.store";

interface GlobalModelSelectorProps {
  module?: GlobalModelSelectorModule;
  value?: string | null;
  onChange?: (newModelId: string | null) => void;
  className?: string;
  disabled?: boolean;
}

export const GlobalModelSelector: React.FC<GlobalModelSelectorProps> =
  React.memo(
    ({
      module,
      value: directValue,
      onChange: directOnChange,
      className,
      disabled: directDisabled,
    }) => {
      const [, forceUpdate] = useState({});

      useEffect(() => {
        if (module) {
          module.setNotifyCallback(() => forceUpdate({}));
          return () => module.setNotifyCallback(null);
        }
      }, [module]);

      const isModuleDriven = !!module;

      const currentValue = isModuleDriven
        ? module.selectedModelId
        : directValue;
      const isDisabled = isModuleDriven ? module.isStreaming : directDisabled;
      const isLoadingProviders = isModuleDriven
        ? module.isLoadingProviders
        : false;

      const models = isModuleDriven
        ? module.globallyEnabledModels
        : useProviderStore((state) =>
            state.getGloballyEnabledModelDefinitions()
          );

      const handleModelChange = useCallback(
        (newValue: string | null) => {
          if (isModuleDriven && module) {
            module.handleSelectionChange(newValue);
          } else if (directOnChange) {
            directOnChange(newValue);
          }
        },
        [isModuleDriven, module, directOnChange]
      );

      return (
        <ModelSelector
          models={models}
          value={currentValue}
          onChange={handleModelChange}
          className={className}
          disabled={isDisabled}
          isLoading={isLoadingProviders}
        />
      );
    }
  );

GlobalModelSelector.displayName = "GlobalModelSelector";
