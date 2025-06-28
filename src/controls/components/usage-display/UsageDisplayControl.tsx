// src/controls/components/usage-display/UsageDisplayControl.tsx
// FULL FILE
import React, { useMemo, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CircleIcon } from "lucide-react";
import type { UsageDisplayControlModule } from "@/controls/modules/UsageDisplayControlModule";

interface UsageDisplayControlProps {
  module: UsageDisplayControlModule;
}

const formatCost = (cost: number): string => {
  if (cost >= 1) {
    return `$${cost.toFixed(2)}`;
  } else {
    const cents = cost * 100;
    if (cents >= 0.01) {
      return `${cents.toFixed(2)}¢`;
    } else {
      return `${(cents * 1000).toFixed(2)}‰`;
    }
  }
};

export const UsageDisplayControl: React.FC<UsageDisplayControlProps> = ({
  module,
}) => {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const contextLength = module.contextLength;
  const estimatedInputTokens = module.getEstimatedInputTokens();
  const totalEstimatedTokens = module.getTotalEstimatedTokens();
  const contextPercentage = module.getContextPercentage();
  const historyTokens = module.historyTokens;
  const selectedModelId = module.selectedModelId; // For visibility check

  const indicatorColor = useMemo(() => {
    if (contextPercentage > 85) return "text-red-600 dark:text-red-500";
    if (contextPercentage > 70) return "text-orange-500 dark:text-orange-400";
    if (contextPercentage > 40) return "text-yellow-500 dark:text-yellow-400";
    return "text-green-600 dark:text-green-500";
  }, [contextPercentage]);

  const isVisible = selectedModelId !== null && contextLength > 0;

  if (!isVisible) {
    return null;
  }

  const estimatedCost = module.estimatedPromptCost;
  const estimatedTokens = module.estimatedPromptTokens;
  
  const tooltipText = estimatedCost > 0 
    ? `Context: ~${totalEstimatedTokens.toLocaleString()} / ${contextLength.toLocaleString()} tokens (${contextPercentage}%) [History: ${historyTokens}, Input: ${estimatedInputTokens}] | Est. Cost: ${formatCost(estimatedCost)} (~${estimatedTokens.toLocaleString()} tokens)`
    : `Context: ~${totalEstimatedTokens.toLocaleString()} / ${contextLength.toLocaleString()} tokens (${contextPercentage}%) [History: ${historyTokens}, Input: ${estimatedInputTokens}]`;

  useEffect(() => {
    if (estimatedCost > 0) {
      console.debug(`[USAGE DISPLAY] EstimatedCost: ${estimatedCost}, EstimatedTokens: ${estimatedTokens}, Format: ${formatCost(estimatedCost)}`);
    }
  }, [estimatedCost, estimatedTokens]);

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center h-8 w-8 px-2">
            <CircleIcon
              className={cn("h-3 w-3 fill-current", indicatorColor)}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
