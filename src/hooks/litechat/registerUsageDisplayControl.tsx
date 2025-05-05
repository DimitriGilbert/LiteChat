// src/hooks/litechat/registerUsageDisplayControl.tsx
// FULL FILE
import React, { useState, useEffect, useMemo } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useInputStore } from "@/store/input.store";
import { useInteractionStore } from "@/store/interaction.store";
// useConversationStore removed
// useShallow removed
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
import type { AttachedFileMetadata } from "@/store/input.store";

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
      totalBytes += f.size;
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
  // --- Component State ---
  const [currentInputText, setCurrentInputText] = useState("");
  const [historyTokens, setHistoryTokens] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileMetadata[]>(
    [],
  );
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [contextLength, setContextLength] = useState<number>(0);

  // --- Effects for Event Subscription ---
  useEffect(() => {
    // Initial state fetch
    const initialInputState = useInputStore.getState();
    const initialProviderState = useProviderStore.getState();
    const initialInteractionState = useInteractionStore.getState();

    setAttachedFiles(initialInputState.attachedFilesMetadata);
    setSelectedModelId(initialProviderState.selectedModelId);

    // Calculate initial history tokens
    if (initialInteractionState.currentConversationId) {
      const staticInteractions = initialInteractionState.interactions.filter(
        (i) => i.status === "COMPLETED",
      );
      setHistoryTokens(estimateHistoryTokens(staticInteractions));
    } else {
      setHistoryTokens(0);
    }

    // --- Event Handlers ---
    const handleInputChange = (payload: { value: string }) => {
      setCurrentInputText(payload.value);
    };
    const handleFilesChanged = (payload: { files: AttachedFileMetadata[] }) => {
      setAttachedFiles(payload.files);
    };
    const handleModelChanged = (payload: { modelId: string | null }) => {
      console.log(payload);
      setSelectedModelId(payload.modelId);
    };
    // Recalculate history when interactions complete or context changes
    const handleInteractionCompleted = () => {
      const state = useInteractionStore.getState();
      if (state.currentConversationId) {
        const staticInteractions = state.interactions.filter(
          (i) => i.status === "COMPLETED",
        );
        setHistoryTokens(estimateHistoryTokens(staticInteractions));
      }
    };
    const handleContextChanged = () => {
      const state = useInteractionStore.getState();
      if (state.currentConversationId) {
        const staticInteractions = state.interactions.filter(
          (i) => i.status === "COMPLETED",
        );
        setHistoryTokens(estimateHistoryTokens(staticInteractions));
      } else {
        setHistoryTokens(0);
      }
    };

    // --- Subscriptions ---
    emitter.on(ModEvent.PROMPT_INPUT_CHANGE, handleInputChange);
    emitter.on(ModEvent.ATTACHED_FILES_CHANGED, handleFilesChanged);
    emitter.on(ModEvent.MODEL_SELECTION_CHANGED, handleModelChanged);
    emitter.on(ModEvent.INTERACTION_COMPLETED, handleInteractionCompleted);
    emitter.on(ModEvent.CONTEXT_CHANGED, handleContextChanged);

    // --- Cleanup ---
    return () => {
      emitter.off(ModEvent.PROMPT_INPUT_CHANGE, handleInputChange);
      emitter.off(ModEvent.ATTACHED_FILES_CHANGED, handleFilesChanged);
      emitter.off(ModEvent.MODEL_SELECTION_CHANGED, handleModelChanged);
      emitter.off(ModEvent.INTERACTION_COMPLETED, handleInteractionCompleted);
      emitter.off(ModEvent.CONTEXT_CHANGED, handleContextChanged);
    };
  }, []);

  // --- Effect to update contextLength when selectedModelId changes ---
  useEffect(() => {
    if (!selectedModelId) {
      setContextLength(0);
      return;
    }
    // Get necessary state *inside* the effect or pass as dependency
    const { dbProviderConfigs, dbApiKeys } = useProviderStore.getState();
    const { providerId, modelId: specificModelId } =
      splitModelId(selectedModelId);
    if (!providerId || !specificModelId) {
      setContextLength(0);
      return;
    }
    const config = dbProviderConfigs.find((p) => p.id === providerId);
    if (!config) {
      setContextLength(0);
      return;
    }
    const apiKeyRecord = dbApiKeys.find((k) => k.id === config.apiKeyId);
    const model = createAiModelConfig(
      config,
      specificModelId,
      apiKeyRecord?.value,
    );
    const meta = model?.metadata;
    const length =
      meta?.top_provider?.context_length ?? meta?.context_length ?? 0;
    setContextLength(length);
  }, [selectedModelId]);

  // --- Memoized Calculations ---
  const { estimatedInputTokens, totalEstimatedTokens, contextPercentage } =
    useMemo(() => {
      const inputTextBytes = new TextEncoder().encode(currentInputText).length;
      const fileBytes = attachedFiles.reduce((sum, file) => sum + file.size, 0);
      const inputTokens = Math.ceil(
        (inputTextBytes + fileBytes) / BYTES_PER_TOKEN_ESTIMATE,
      );
      const totalTokens = historyTokens + inputTokens;
      const percentage = contextLength
        ? Math.min(100, Math.round((totalTokens / contextLength) * 100))
        : 0;

      return {
        estimatedInputTokens: inputTokens,
        totalEstimatedTokens: totalTokens,
        contextPercentage: percentage,
      };
    }, [currentInputText, attachedFiles, historyTokens, contextLength]);

  // Determine color based on percentage
  const indicatorColor = useMemo(() => {
    if (contextPercentage > 85) return "text-red-600 dark:text-red-500";
    if (contextPercentage > 70) return "text-orange-500 dark:text-orange-400";
    if (contextPercentage > 40) return "text-yellow-500 dark:text-yellow-400";
    return "text-green-600 dark:text-green-500";
  }, [contextPercentage]);

  // Early return if no model or context length is available
  if (!selectedModelId || contextLength === 0) {
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
    // Show function removed - component handles its own rendering logic
    // show: () => true,
  });

  console.log("[Function] Registered Core Usage Display Control (Trigger)");
}
