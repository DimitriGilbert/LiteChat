// src/hooks/litechat/registerReasoningControl.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { BrainCircuitIcon } from "lucide-react";
import { useControlRegistryStore } from "@/store/control.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { useProviderStore } from "@/store/provider.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function registerReasoningControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  const ReasoningControlTrigger: React.FC = () => {
    const { reasoningEnabled, setReasoningEnabled } = usePromptStateStore(
      useShallow((state) => ({
        reasoningEnabled: state.reasoningEnabled,
        setReasoningEnabled: state.setReasoningEnabled,
      })),
    );
    const isStreaming = useInteractionStore(
      useShallow((state) => state.status === "streaming"),
    );

    const isExplicitlyEnabled = reasoningEnabled === true;

    const handleToggle = () => {
      // Toggle behavior: null -> true, true -> null
      setReasoningEnabled(isExplicitlyEnabled ? null : true);
    };

    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isExplicitlyEnabled ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={handleToggle}
              disabled={isStreaming}
              aria-label={
                isExplicitlyEnabled
                  ? "Disable Reasoning for Next Turn"
                  : "Enable Reasoning for Next Turn"
              }
            >
              <BrainCircuitIcon
                className={cn(
                  "h-4 w-4",
                  isExplicitlyEnabled
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isExplicitlyEnabled
              ? "Reasoning Enabled (Click to Disable)"
              : "Reasoning Disabled (Click to Enable)"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  registerPromptControl({
    id: "core-reasoning",
    // order removed
    status: () => "ready",
    triggerRenderer: () => React.createElement(ReasoningControlTrigger),
    getParameters: () => {
      const { reasoningEnabled } = usePromptStateStore.getState();
      // Only add parameter if explicitly enabled (true), not null
      return reasoningEnabled === true ? { reasoning: true } : undefined;
    },
    clearOnSubmit: () => {
      // Reset transient state after submit
      usePromptStateStore.getState().setReasoningEnabled(null);
    },
    show: () => {
      // Show only if the selected model supports it
      const selectedModel = useProviderStore.getState().getSelectedModel();
      return (
        selectedModel?.metadata?.supported_parameters?.includes("reasoning") ??
        false
      );
    },
  });

  console.log("[Function] Registered Core Reasoning Control");
}
