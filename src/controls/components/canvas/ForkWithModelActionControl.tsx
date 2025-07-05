import React, { useState, useEffect } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { GitForkIcon, PlusIcon } from "lucide-react";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import { toast } from "sonner";
import { ModelSelector } from "@/controls/components/global-model-selector/ModelSelector";
import type { ForkWithModelActionControlModule } from "@/controls/modules/canvas/ForkWithModelActionControlModule";
import { useTranslation } from "react-i18next";

interface ForkWithModelActionControlProps {
  module: ForkWithModelActionControlModule;
  interactionId: string;
  disabled?: boolean;
}

export const ForkWithModelActionControl: React.FC<
  ForkWithModelActionControlProps
> = ({ module, interactionId, disabled }) => {
  const { t } = useTranslation('canvas');
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

    // Close selector and immediately fork
    setShowSelector(false);
    
    emitter.emit(canvasEvent.forkConversationWithModelRequest, {
      interactionId,
      modelId,
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) {
      toast.info(t('actions.forkDisabled', 'Fork is currently disabled.'));
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
      tooltipText={t('actions.forkWith', 'Fork with')}
      onClick={handleClick}
      aria-label={t('actions.forkWithModelAriaLabel', 'Fork Conversation with Model Selection')}
      disabled={disabled}
      icon={
        <div className="relative">
          <GitForkIcon className="h-4 w-4" />
          <PlusIcon className="absolute -top-1 -right-1 h-2 w-2" />
        </div>
      }
      className="h-5 w-5 md:h-6 md:w-6"
    />
  );
}; 