// src/components/LiteChat/prompt/control/UsageDisplayControl.tsx

import React, { useState, useEffect, useMemo } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useInputStore } from "@/store/input.store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CircleIcon } from "lucide-react";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";
import {
  createAiModelConfig,
  splitModelId,
} from "@/lib/litechat/provider-helpers";

// Rough estimation: 1 token ~ 4 bytes
const BYTES_PER_TOKEN_ESTIMATE = 4;

export const UsageDisplayControl: React.FC = () => {
  // Internal state to hold the input text, updated via event
  const [currentInputText, setCurrentInputText] = useState("");

  // Subscribe to stores using hooks, selecting PRIMITIVE/STABLE values
  const { selectedModelId, dbProviderConfigs, dbApiKeys } = useProviderStore(
    useShallow((state) => ({
      selectedModelId: state.selectedModelId,
      dbProviderConfigs: state.dbProviderConfigs,
      dbApiKeys: state.dbApiKeys,
    })),
  );
  const attachedFiles = useInputStore(
    useShallow((state) => state.attachedFilesMetadata),
  );

  // Effect to subscribe/unsubscribe to input changes
  useEffect(() => {
    const handleInputChange = (payload: { value: string }) => {
      setCurrentInputText(payload.value);
    };

    emitter.on(ModEvent.PROMPT_INPUT_CHANGE, handleInputChange);

    // Cleanup function
    return () => {
      emitter.off(ModEvent.PROMPT_INPUT_CHANGE, handleInputChange);
    };
  }, []);

  // --- Compute selectedModel *inside* useMemo based on stable IDs/configs ---
  const selectedModel = useMemo(() => {
    if (!selectedModelId) return undefined;
    const { providerId, modelId: specificModelId } =
      splitModelId(selectedModelId);
    if (!providerId || !specificModelId) return undefined;
    const config = dbProviderConfigs.find((p) => p.id === providerId);
    if (!config) return undefined;
    const apiKeyRecord = dbApiKeys.find((k) => k.id === config.apiKeyId);
    // Use createAiModelConfig helper here
    return createAiModelConfig(config, specificModelId, apiKeyRecord?.value);
  }, [selectedModelId, dbProviderConfigs, dbApiKeys]);

  // Memoized calculations based on internal state and computed model data
  const {
    contextLength,

    estimatedInputTokens,
    contextPercentage,
  } = useMemo(() => {
    const meta = selectedModel?.metadata;
    const length =
      meta?.top_provider?.context_length ?? meta?.context_length ?? 0;
    let price = 0;
    if (meta?.pricing?.prompt) {
      price = parseFloat(meta.pricing.prompt) || 0;
    }

    const inputTextBytes = new TextEncoder().encode(currentInputText).length;
    const fileBytes = attachedFiles.reduce((sum, file) => sum + file.size, 0);
    const totalBytes = inputTextBytes + fileBytes;
    const tokens = Math.ceil(totalBytes / BYTES_PER_TOKEN_ESTIMATE);

    const percentage = length
      ? Math.min(100, Math.round((tokens / length) * 100))
      : 0;

    return {
      contextLength: length,
      promptPricePerMillionTokens: price,
      estimatedInputTokens: tokens,
      contextPercentage: percentage,
    };
    // Dependencies: internal text state, attached files, and computed selected model
  }, [currentInputText, attachedFiles, selectedModel]);

  // Determine color based on percentage
  const indicatorColor = useMemo(() => {
    if (contextPercentage > 75) return "text-red-600 dark:text-red-500";
    if (contextPercentage > 60) return "text-orange-500 dark:text-orange-400";
    if (contextPercentage > 30) return "text-yellow-500 dark:text-yellow-400";
    return "text-green-600 dark:text-green-500";
  }, [contextPercentage]);

  // Early return if no model or context length is available
  if (!selectedModel || contextLength === 0) {
    return null;
  }

  const tooltipText = `Context Usage: ~${estimatedInputTokens.toLocaleString()} / ${contextLength.toLocaleString()} tokens (${contextPercentage}%)`;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Render a simple colored icon */}
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
