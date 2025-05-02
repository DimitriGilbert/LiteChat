// src/hooks/litechat/registerUsageDisplayControl.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useInputStore } from "@/store/input.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useConversationStore } from "@/store/conversation.store";
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
import { useControlRegistryStore } from "@/store/control.store";
import type { Interaction } from "@/types/litechat/interaction";

// Rough estimation: 1 token ~ 4 bytes
const BYTES_PER_TOKEN_ESTIMATE = 4;

// Helper to estimate tokens from interactions
const estimateHistoryTokens = (interactions: Interaction[]): number => {
  let totalBytes = 0;
  interactions.forEach((i) => {
    // Estimate user prompt bytes
    if (i.prompt?.content) {
      totalBytes += new TextEncoder().encode(i.prompt.content).length;
    }
    i.prompt?.metadata?.attachedFiles?.forEach((f) => {
      totalBytes += f.size; // Add file sizes
    });
    // Estimate assistant response bytes
    if (i.response && typeof i.response === "string") {
      totalBytes += new TextEncoder().encode(i.response).length;
    }
    // Note: Tool calls/results could also be estimated, but might be complex
  });
  return Math.ceil(totalBytes / BYTES_PER_TOKEN_ESTIMATE);
};

export const UsageDisplayControl: React.FC = () => {
  // Internal state for input text and history tokens
  const [currentInputText, setCurrentInputText] = useState("");
  const [historyTokens, setHistoryTokens] = useState(0);

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
  const {
    currentConversationId,
    interactions,
    status: interactionStatus,
  } = useInteractionStore(
    useShallow((state) => ({
      currentConversationId: state.currentConversationId,
      interactions: state.interactions,
      status: state.status,
    })),
  );

  // Effect to subscribe/unsubscribe to input changes
  useEffect(() => {
    const handleInputChange = (payload: { value: string }) => {
      setCurrentInputText(payload.value);
    };
    emitter.on(ModEvent.PROMPT_INPUT_CHANGE, handleInputChange);
    return () => {
      emitter.off(ModEvent.PROMPT_INPUT_CHANGE, handleInputChange);
    };
  }, []);

  // Effect to calculate history tokens when conversation changes or interactions update (statically)
  useEffect(() => {
    if (
      currentConversationId &&
      interactionStatus !== "streaming" &&
      interactionStatus !== "loading"
    ) {
      const staticInteractions = interactions.filter(
        (i) => i.status === "COMPLETED",
      ); // Or filter as needed
      const estimatedTokens = estimateHistoryTokens(staticInteractions);
      setHistoryTokens(estimatedTokens);
    } else if (!currentConversationId) {
      setHistoryTokens(0); // Reset if no conversation selected
    }
    // Only recalculate when conversation ID changes or interactions array ref changes *while not streaming*
  }, [currentConversationId, interactions, interactionStatus]);

  // --- Compute selectedModel *inside* useMemo based on stable IDs/configs ---
  const selectedModel = useMemo(() => {
    if (!selectedModelId) return undefined;
    const { providerId, modelId: specificModelId } =
      splitModelId(selectedModelId);
    if (!providerId || !specificModelId) return undefined;
    const config = dbProviderConfigs.find((p) => p.id === providerId);
    if (!config) return undefined;
    const apiKeyRecord = dbApiKeys.find((k) => k.id === config.apiKeyId);
    return createAiModelConfig(config, specificModelId, apiKeyRecord?.value);
  }, [selectedModelId, dbProviderConfigs, dbApiKeys]);

  // Memoized calculations based on internal state and computed model data
  const {
    contextLength,
    estimatedInputTokens,
    totalEstimatedTokens,
    contextPercentage,
  } = useMemo(() => {
    const meta = selectedModel?.metadata;
    const length =
      meta?.top_provider?.context_length ?? meta?.context_length ?? 0;

    const inputTextBytes = new TextEncoder().encode(currentInputText).length;
    const fileBytes = attachedFiles.reduce((sum, file) => sum + file.size, 0);
    const inputTokens = Math.ceil(
      (inputTextBytes + fileBytes) / BYTES_PER_TOKEN_ESTIMATE,
    );
    const totalTokens = historyTokens + inputTokens;

    const percentage = length
      ? Math.min(100, Math.round((totalTokens / length) * 100))
      : 0;

    return {
      contextLength: length,
      estimatedInputTokens: inputTokens,
      totalEstimatedTokens: totalTokens,
      contextPercentage: percentage,
    };
  }, [currentInputText, attachedFiles, selectedModel, historyTokens]);

  // Determine color based on percentage
  const indicatorColor = useMemo(() => {
    if (contextPercentage > 85) return "text-red-600 dark:text-red-500"; // Stricter threshold
    if (contextPercentage > 70) return "text-orange-500 dark:text-orange-400";
    if (contextPercentage > 40) return "text-yellow-500 dark:text-yellow-400";
    return "text-green-600 dark:text-green-500";
  }, [contextPercentage]);

  // Early return if no model or context length is available
  if (!selectedModel || contextLength === 0) {
    return null;
  }

  const tooltipText = `Context: ~${totalEstimatedTokens.toLocaleString()} / ${contextLength.toLocaleString()} tokens (${contextPercentage}%) [History: ${historyTokens}, Input: ${estimatedInputTokens}]`;

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

// Registration Function (No longer a hook)
export function registerUsageDisplayControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  registerPromptControl({
    id: "core-usage-display",
    // order removed
    status: () => "ready",
    triggerRenderer: () => React.createElement(UsageDisplayControl),
    renderer: undefined,
    show: () => true,
  });

  console.log("[Function] Registered Core Usage Display Control (Trigger)");
}
