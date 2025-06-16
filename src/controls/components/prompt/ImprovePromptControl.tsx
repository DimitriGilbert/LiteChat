import React, { useState, useEffect } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TabbedLayout } from "@/components/LiteChat/common/TabbedLayout";
import { ModelSelector } from "@/controls/components/global-model-selector/ModelSelector";
import type { ModelListItem } from "@/types/litechat/provider";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import { emitter } from "@/lib/litechat/event-emitter";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import { useFormedible } from "@/hooks/use-formedible";
import { z } from "zod";

interface ImprovePromptFormData {
  selectedModelId: string;
  originalPrompt: string;
  customSystemPrompt?: string;
}

const improvePromptSchema = z.object({
  selectedModelId: z.string().min(1, "Please select a model"),
  originalPrompt: z.string().min(1, "Please enter a prompt to enhance"),
  customSystemPrompt: z.string().optional(),
});

interface ImprovePromptControlProps {
  module: {
    globallyEnabledModels: ModelListItem[];
    isLoadingProviders: boolean;
    currentPromptText: string;
    setNotifyCallback: (callback: (() => void) | null) => void;
  };
}

export const ImprovePromptControl: React.FC<ImprovePromptControlProps> = ({
  module,
}) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("setup");
  const [, forceUpdate] = useState({});

  // Enhancement state
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [enhancementError, setEnhancementError] = useState<string | null>(null);

  const { status: interactionStatus } = useInteractionStore(
    useShallow((state) => ({
      status: state.status,
    }))
  );

  // Set up notification callback for module-driven updates
  useEffect(() => {
    if (module) {
      module.setNotifyCallback(() => forceUpdate({}));
      return () => module.setNotifyCallback(null);
    }
  }, [module]);

  // Listen for enhancement events
  useEffect(() => {
    const handleEnhancementStarted = () => {
      setIsEnhancing(true);
      setEnhancementError(null);
    };

    const handleEnhancementCompleted = (payload: { enhancedPrompt: string }) => {
      setIsEnhancing(false);
      setEnhancedPrompt(payload.enhancedPrompt);
      setActiveTab("result");
      toast.success("Prompt enhancement completed!");
    };

    const handleEnhancementFailed = (payload: { error: string }) => {
      setIsEnhancing(false);
      setEnhancementError(payload.error);
      toast.error(`Enhancement failed: ${payload.error}`);
    };

    emitter.on(promptEvent.enhancementStarted, handleEnhancementStarted);
    emitter.on(promptEvent.enhancementCompleted, handleEnhancementCompleted);
    emitter.on(promptEvent.enhancementFailed, handleEnhancementFailed);

    return () => {
      emitter.off(promptEvent.enhancementStarted, handleEnhancementStarted);
      emitter.off(promptEvent.enhancementCompleted, handleEnhancementCompleted);
      emitter.off(promptEvent.enhancementFailed, handleEnhancementFailed);
    };
  }, []);

    // Custom ModelSelector field component
  const ModelSelectorField: React.FC<any> = ({ fieldApi, label, ...props }) => (
    <div className="space-y-2">
      <Label htmlFor="model-selector">{label}</Label>
      <ModelSelector
        models={module.globallyEnabledModels}
        value={fieldApi.state.value}
        onChange={fieldApi.handleChange}
        isLoading={module.isLoadingProviders}
        className="w-full"
      />
      {fieldApi.state.meta.isTouched && fieldApi.state.meta.errors.length > 0 && (
        <div className="text-xs text-destructive pt-1">
          {fieldApi.state.meta.errors.map((err: any, index: number) => (
            <p key={index}>{String(err)}</p>
          ))}
        </div>
      )}
    </div>
  );

  const { Form } = useFormedible<ImprovePromptFormData>({
    schema: improvePromptSchema,
    fields: [
      {
        name: "selectedModelId",
        type: "custom",
        label: "Select Enhancement Model",
        component: ModelSelectorField
      },
      {
        name: "originalPrompt",
        type: "textarea",
        label: "Original Prompt",
        placeholder: "Enter the prompt you want to enhance...",
        description: "This will be enhanced using AI"
      },
      {
        name: "customSystemPrompt",
        type: "textarea",
        label: "Custom System Prompt (Optional)",
        placeholder: "Leave empty to use default prompt engineering instructions...",
        description: "Custom instructions for how to enhance the prompt"
      }
    ],
    defaultComponents: {
      custom: ModelSelectorField
    },
    submitLabel: isEnhancing ? "Enhancing..." : "Enhance Prompt",
    formOptions: {
      defaultValues: {
        selectedModelId: "",
        originalPrompt: module.currentPromptText,
        customSystemPrompt: "",
      },
      onSubmit: async ({ value }) => {
        if (!value.selectedModelId) {
          toast.error("Please select a model");
          return;
        }

        if (!value.originalPrompt.trim()) {
          toast.error("Please enter a prompt to enhance");
          return;
        }

        // Emit enhancement request event using the model ID directly
        emitter.emit(promptEvent.enhancePromptRequest, {
          prompt: value.originalPrompt.trim(),
          modelId: value.selectedModelId,
          systemPrompt: value.customSystemPrompt?.trim() || undefined,
        });
      },
    },
  });

  const handleUseEnhancedPrompt = () => {
    // Set the enhanced prompt as the current input text via events
    emitter.emit(promptEvent.setInputTextRequest, {
      text: enhancedPrompt,
    });
    
    setOpen(false);
    toast.success("Enhanced prompt applied!");
    
    // Reset state for next use
    resetState();
  };

  const resetState = () => {
    setActiveTab("setup");
    setIsEnhancing(false);
    setEnhancedPrompt("");
    setEnhancementError(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (interactionStatus === "streaming") {
      toast.info("Cannot enhance prompt while another response is streaming");
      return;
    }

    if (module.globallyEnabledModels.length === 0) {
      toast.info("No models available for prompt enhancement");
      return;
    }

    setOpen(true);
  };

  // Check if enhancement is available
  const canEnhance = interactionStatus !== "streaming" &&
                     module.globallyEnabledModels.length > 0;

  const getTooltipText = () => {
    if (interactionStatus === "streaming") {
      return "Cannot enhance prompt while streaming";
    }
    if (module.globallyEnabledModels.length === 0) {
      return "No models available for enhancement";
    }
    return "Improve your prompt with AI assistance";
  };

  const tabs = [
    {
      value: "setup",
      label: "Setup",
      content: (
        <div className="space-y-4">
          <Form />
        </div>
      ),
    },
    {
      value: "result",
      label: "Result",
      content: (
        <div className="space-y-4">
          {enhancementError ? (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">
                Enhancement failed: {enhancementError}
              </p>
            </div>
          ) : enhancedPrompt ? (
            <>
              <div className="space-y-2">
                <Label>Enhanced Prompt</Label>
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                  {enhancedPrompt}
                </div>
              </div>

              <Button 
                onClick={handleUseEnhancedPrompt}
                className="w-full"
              >
                Use Enhanced Prompt
              </Button>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              {isEnhancing ? "Enhancing your prompt..." : "No enhancement result yet. Run the enhancement first."}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <ActionTooltipButton
        tooltipText={getTooltipText()}
        onClick={handleClick}
        aria-label="Improve Prompt with AI"
        disabled={!canEnhance}
        icon={<Sparkles />}
        className="h-5 w-5 md:h-6 md:w-6"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!w-[80vw] !h-[85vh] !max-w-none flex flex-col p-4">
          <DialogHeader>
            <DialogTitle>Improve Prompt</DialogTitle>
            <DialogDescription>
              Use AI to enhance your prompt for better results. Select a model and optionally customize the enhancement instructions.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0">
            <TabbedLayout
              tabs={tabs}
              initialValue={activeTab}
              onValueChange={setActiveTab}
              scrollable={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}; 