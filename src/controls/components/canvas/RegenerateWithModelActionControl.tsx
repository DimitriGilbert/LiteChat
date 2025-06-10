import React, { useState, useEffect } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { ListRestartIcon } from "lucide-react";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import { toast } from "sonner";
import { ModelSelector } from "@/controls/components/global-model-selector/ModelSelector";
import type { RegenerateWithModelActionControlModule } from "@/controls/modules/canvas/RegenerateWithModelActionControlModule";

interface RegenerateWithModelActionControlProps {
  module: RegenerateWithModelActionControlModule;
  interactionId: string;
  disabled?: boolean;
}

export const RegenerateWithModelActionControl: React.FC<
  RegenerateWithModelActionControlProps
> = ({ module, interactionId, disabled }) => {
  const [showSelector, setShowSelector] = useState(false);
  const [, forceUpdate] = useState({});

  // Set up notification callback for module-driven updates
  useEffect(() => {
    if (module) {
      module.setNotifyCallback(() => forceUpdate({}));
      return () => module.setNotifyCallback(null);
    }
  }, [module]);

  const handleModelSelect = (modelId: string | null) => {
    if (!modelId) {
      setShowSelector(false);
      return;
    }

    // Close selector and immediately regenerate
    setShowSelector(false);
    
    emitter.emit(canvasEvent.regenerateInteractionWithModelRequest, {
      interactionId,
      modelId,
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) {
      toast.info("Regeneration is currently disabled.");
      return;
    }
    setShowSelector(!showSelector);
  };

  if (showSelector) {
    return (
      <div className="relative">
        <ModelSelector
          models={module.globallyEnabledModels}
          value={null}
          onChange={handleModelSelect}
          isLoading={module.isLoadingProviders}
        />
      </div>
    );
  }

  return (
    <ActionTooltipButton
      tooltipText="Regenerate with Model"
      onClick={handleClick}
      aria-label="Regenerate Response with Model Selection"
      disabled={disabled}
      icon={<ListRestartIcon />}
      className="h-5 w-5 md:h-6 md:w-6"
    />
  );
}; 