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
import { formatTokenCost } from "@/lib/litechat/ai-helpers";

interface UsageDisplayControlProps {
  module: UsageDisplayControlModule;
}

export const UsageDisplayControl: React.FC<UsageDisplayControlProps> = ({
  module,
}) => {
  const [liveTokens, setLiveTokens] = useState<number | null>(null);
  const [liveCost, setLiveCost] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contextLength = module.contextLength;
  const contextPercentage = module.getContextPercentage();
  const selectedModelId = module.selectedModelId;

  const isVisible = selectedModelId !== null && contextLength > 0;

  const handleTooltipOpenChange = async (open: boolean) => {
    if (open) {
      setLoading(true);
      setError(null);
      setLiveTokens(null);
      setLiveCost(null);
      let timeout: NodeJS.Timeout | null = null;
      try {
        const estimationPromise = module.getLiveTokenEstimation();
        timeout = setTimeout(() => {
          setError("Estimation timed out");
          setLoading(false);
        }, 2000);
        const result = await estimationPromise;
        if (timeout) clearTimeout(timeout);
        setLiveTokens(result.tokens);
        setLiveCost(result.cost);
        setLoading(false);
      } catch (e) {
        setError("Estimation error");
        setLoading(false);
      }
    } else {
      setLiveTokens(null);
      setLiveCost(null);
      setLoading(false);
      setError(null);
    }
  };

  let tooltipText = "Hover to calculate context tokens.";
  if (loading) tooltipText = "Calculating...";
  else if (error) tooltipText = error;
  else if (liveTokens !== null && liveCost !== null)
    tooltipText = `Context: ~${liveTokens.toLocaleString()} / ${contextLength.toLocaleString()} tokens (${contextPercentage}%)\nEst. Cost: ${formatTokenCost(liveCost)}`;

  if (!isVisible) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip onOpenChange={handleTooltipOpenChange}>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center h-8 w-8 px-2">
            <CircleIcon
              className={cn("h-3 w-3 fill-current", "text-green-600 dark:text-green-500")}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="whitespace-pre-line">{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
