import React, { useState, useEffect } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { Axe } from "lucide-react";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import { ModelSelector } from "@/controls/components/global-model-selector/ModelSelector";
import type { ModelListItem } from "@/types/litechat/provider";

interface ForkCompactActionControlProps {
  module: {
    globallyEnabledModels: ModelListItem[];
    isLoadingProviders: boolean;
    setNotifyCallback: (callback: (() => void) | null) => void;
  };
  interactionId: string;
  disabled: boolean;
}

export const ForkCompactActionControl: React.FC<
  ForkCompactActionControlProps
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

    // Close selector and immediately fork compact
    setShowSelector(false);
    
    emitter.emit(canvasEvent.forkConversationCompactRequest, {
      interactionId,
      modelId,
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) {
      toast.info("Fork compact is currently disabled.");
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
      tooltipText="Summarize"
      onClick={handleClick}
      aria-label="Fork Conversation with Compact Summary"
      disabled={disabled}
      icon={<Axe className="h-4 w-4" />}
      className="h-5 w-5 md:h-6 md:w-6"
    />
  );
}; 