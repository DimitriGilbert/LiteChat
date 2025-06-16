import React, { useState, useEffect, useMemo } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabbedLayout, type TabDefinition } from "@/components/LiteChat/common/TabbedLayout";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  SearchIcon,
  Brain,
  Globe,
  Wrench,
  Image as ImageIcon,
  Palette,
} from "lucide-react";
import type { ModelListItem } from "@/types/litechat/provider";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import { emitter } from "@/lib/litechat/event-emitter";
import { promptEvent } from "@/types/litechat/events/prompt.events";

type CapabilityFilter = "reasoning" | "webSearch" | "tools" | "multimodal" | "imageGeneration";

interface ImprovePromptControlProps {
  module: {
    globallyEnabledModels: ModelListItem[];
    isLoadingProviders: boolean;
    setNotifyCallback: (callback: (() => void) | null) => void;
    getCurrentPromptText: () => string;
  };
}

export const ImprovePromptControl: React.FC<ImprovePromptControlProps> = ({
  module,
}) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("setup");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [customSystemPrompt, setCustomSystemPrompt] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [capabilityFilters, setCapabilityFilters] = useState<
    Record<CapabilityFilter, boolean>
  >({
    reasoning: false,
    webSearch: false,
    tools: false,
    multimodal: false,
    imageGeneration: false,
  });
  const [, forceUpdate] = useState({});

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
    const handleStarted = () => {
      setIsRunning(true);
      toast.info("Enhancing your prompt...");
    };

    const handleCompleted = (payload: { enhancedPrompt: string }) => {
      setEnhancedPrompt(payload.enhancedPrompt);
      setIsRunning(false);
      setActiveTab("result");
      toast.success("Prompt enhanced successfully!");
    };

    const handleFailed = (payload: { error: string }) => {
      setIsRunning(false);
      toast.error(`Enhancement failed: ${payload.error}`);
    };

    emitter.on(promptEvent.enhancementStarted, handleStarted);
    emitter.on(promptEvent.enhancementCompleted, handleCompleted);
    emitter.on(promptEvent.enhancementFailed, handleFailed);

    return () => {
      emitter.off(promptEvent.enhancementStarted, handleStarted);
      emitter.off(promptEvent.enhancementCompleted, handleCompleted);
      emitter.off(promptEvent.enhancementFailed, handleFailed);
    };
  }, []);

  const filteredModels = useMemo(() => {
    let textFiltered = module.globallyEnabledModels;
    if (filterText.trim()) {
      const lowerFilter = filterText.toLowerCase();
      textFiltered = module.globallyEnabledModels.filter(
        (model) =>
          model.name.toLowerCase().includes(lowerFilter) ||
          model.providerName.toLowerCase().includes(lowerFilter) ||
          model.id.toLowerCase().includes(lowerFilter)
      );
    }
    const activeCapabilityFilters = Object.entries(capabilityFilters)
      .filter(([, isActive]) => isActive)
      .map(([key]) => key as CapabilityFilter);
    if (activeCapabilityFilters.length === 0) {
      return textFiltered;
    }
    return textFiltered.filter((model: ModelListItem) => {
      const supportedParams = new Set(
        model.metadataSummary?.supported_parameters ?? []
      );
      const inputModalities = new Set(
        model.metadataSummary?.input_modalities ?? []
      );
      const outputModalities = new Set(
        model.metadataSummary?.output_modalities ?? []
      );
      return activeCapabilityFilters.every((filter) => {
        switch (filter) {
          case "reasoning":
            return supportedParams.has("reasoning");
          case "webSearch":
            return (
              supportedParams.has("web_search") ||
              supportedParams.has("web_search_options")
            );
          case "tools":
            return supportedParams.has("tools");
          case "multimodal":
            return Array.from(inputModalities).some((mod) => mod !== "text");
          case "imageGeneration":
            return outputModalities.has("image");
          default:
            return true;
        }
      });
    });
  }, [module.globallyEnabledModels, filterText, capabilityFilters]);

  const toggleCapabilityFilter = (filter: CapabilityFilter) => {
    setCapabilityFilters((prev) => ({
      ...prev,
      [filter]: !prev[filter],
    }));
  };

  const activeCapabilityFilterCount = Object.values(capabilityFilters).filter(Boolean).length;

  const handleRun = () => {
    if (!selectedModelId) {
      toast.error("Please select a model for enhancement");
      return;
    }

    if (!originalPrompt.trim()) {
      toast.error("Please enter a prompt to enhance");
      return;
    }

    // Emit enhancement request
    emitter.emit(promptEvent.enhancePromptRequest, {
      prompt: originalPrompt,
      modelId: selectedModelId,
      systemPrompt: customSystemPrompt.trim() || undefined,
    });
  };

  const handleUseEnhanced = () => {
    if (!enhancedPrompt.trim()) {
      toast.error("No enhanced prompt to use");
      return;
    }

    // Set the enhanced prompt as the input text
    emitter.emit(promptEvent.setInputTextRequest, {
      text: enhancedPrompt,
    });

    // Close dialog and reset state
    setOpen(false);
    handleReset();
    
    toast.success("Enhanced prompt applied to input!");
  };

  const handleReset = () => {
    setActiveTab("setup");
    setSelectedModelId("");
    setCustomSystemPrompt("");
    setOriginalPrompt("");
    setEnhancedPrompt("");
    setIsRunning(false);
    setFilterText("");
    setCapabilityFilters({
      reasoning: false,
      webSearch: false,
      tools: false,
      multimodal: false,
      imageGeneration: false,
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (interactionStatus === "streaming") {
      toast.info("Cannot enhance prompt while streaming");
      return;
    }

    if (module.globallyEnabledModels.length === 0) {
      toast.info("No models available for prompt enhancement");
      return;
    }

    // Get current prompt text
    const currentPrompt = module.getCurrentPromptText();
    setOriginalPrompt(currentPrompt);
    
    // Pre-select the first available model
    if (filteredModels.length > 0 && !selectedModelId) {
      setSelectedModelId(filteredModels[0].id);
    }

    setOpen(true);
  };

  // Check if enhancement is available
  const canEnhance = interactionStatus !== "streaming" &&
                     module.globallyEnabledModels.length > 0;

  // Dynamic tooltip based on state
  const getTooltipText = () => {
    if (interactionStatus === "streaming") {
      return "Cannot enhance prompt while streaming";
    }
    if (module.globallyEnabledModels.length === 0) {
      return "No models available for prompt enhancement";
    }
    return "Improve your prompt with AI assistance";
  };

  const setupTabContent = (
    <div className="space-y-6 p-1">
      {/* Original Prompt Input */}
      <div className="space-y-2">
        <Label htmlFor="original-prompt">Original Prompt</Label>
        <Textarea
          id="original-prompt"
          placeholder="Enter the prompt you want to improve..."
          value={originalPrompt}
          onChange={(e) => setOriginalPrompt(e.target.value)}
          className="min-h-[120px] resize-none"
        />
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <Label>Select Enhancement Model</Label>
        
        {/* Search and Filter Controls */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-grow">
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search models..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant={capabilityFilters.reasoning ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  capabilityFilters.reasoning && "text-primary"
                )}
                onClick={() => toggleCapabilityFilter("reasoning")}
                title="Filter: Reasoning"
                aria-label="Filter by reasoning capability"
              >
                <Brain className="h-4 w-4" />
              </Button>
              <Button
                variant={capabilityFilters.webSearch ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  capabilityFilters.webSearch && "text-primary"
                )}
                onClick={() => toggleCapabilityFilter("webSearch")}
                title="Filter: Web Search"
                aria-label="Filter by web search capability"
              >
                <Globe className="h-4 w-4" />
              </Button>
              <Button
                variant={capabilityFilters.tools ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  capabilityFilters.tools && "text-primary"
                )}
                onClick={() => toggleCapabilityFilter("tools")}
                title="Filter: Tools"
                aria-label="Filter by tool usage capability"
              >
                <Wrench className="h-4 w-4" />
              </Button>
              <Button
                variant={capabilityFilters.multimodal ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  capabilityFilters.multimodal && "text-primary"
                )}
                onClick={() => toggleCapabilityFilter("multimodal")}
                title="Filter: Multimodal"
                aria-label="Filter by multimodal capability"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={capabilityFilters.imageGeneration ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  capabilityFilters.imageGeneration && "text-primary"
                )}
                onClick={() => toggleCapabilityFilter("imageGeneration")}
                title="Filter: Image Generation"
                aria-label="Filter by image generation capability"
              >
                <Palette className="h-4 w-4" />
              </Button>
            </div>
            {activeCapabilityFilterCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-primary rounded-full">
                {activeCapabilityFilterCount}
              </span>
            )}
          </div>
        </div>

        <ScrollArea className="h-32 w-full border rounded-md p-3">
          <div className="space-y-2">
            {filteredModels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {activeCapabilityFilterCount > 0
                  ? "No models match all active filters."
                  : module.globallyEnabledModels.length === 0
                  ? "No models available."
                  : "No models match search."}
              </p>
            ) : (
              filteredModels.map((model: ModelListItem) => (
                <div key={model.id} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={`model-${model.id}`}
                    name="enhancement-model"
                    checked={selectedModelId === model.id}
                    onChange={() => setSelectedModelId(model.id)}
                    className="w-4 h-4"
                  />
                  <Label
                    htmlFor={`model-${model.id}`}
                    className="text-sm cursor-pointer flex-1 min-w-0 flex justify-between items-center"
                  >
                    <div className="truncate">
                      <span className="font-medium">{model.name}</span>
                      <span className="text-muted-foreground ml-2">
                        ({model.providerName})
                      </span>
                    </div>
                    <div className="flex gap-1 ml-2">
                      {model.metadataSummary?.supported_parameters?.includes(
                        "reasoning"
                      ) && <Brain className="h-3.5 w-3.5 text-purple-500" />}
                      {(model.metadataSummary?.supported_parameters?.includes(
                        "web_search"
                      ) ||
                        model.metadataSummary?.supported_parameters?.includes(
                          "web_search_options"
                        )) && <Globe className="h-3.5 w-3.5 text-blue-500" />}
                      {model.metadataSummary?.supported_parameters?.includes(
                        "tools"
                      ) && <Wrench className="h-3.5 w-3.5 text-orange-500" />}
                      {model.metadataSummary?.input_modalities?.some(
                        (mod) => mod !== "text"
                      ) && <ImageIcon className="h-3.5 w-3.5 text-green-500" />}
                      {model.metadataSummary?.output_modalities?.includes(
                        "image"
                      ) && <Palette className="h-3.5 w-3.5 text-pink-500" />}
                    </div>
                  </Label>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Custom System Prompt */}
      <div className="space-y-2">
        <Label htmlFor="system-prompt">Custom System Prompt (Optional)</Label>
        <Textarea
          id="system-prompt"
          placeholder="Leave empty to use the default prompt enhancement instructions..."
          value={customSystemPrompt}
          onChange={(e) => setCustomSystemPrompt(e.target.value)}
          className="min-h-[100px] resize-none"
        />
        <p className="text-xs text-muted-foreground">
          If empty, a default prompt engineering system prompt will be used.
        </p>
      </div>
    </div>
  );

  const resultTabContent = (
    <div className="space-y-6 p-1">
      {/* Original Prompt Display */}
      <div className="space-y-2">
        <Label>Original Prompt</Label>
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm whitespace-pre-wrap">{originalPrompt}</p>
        </div>
      </div>

      {/* Enhanced Prompt */}
      <div className="space-y-2">
        <Label>Enhanced Prompt</Label>
        <Textarea
          value={enhancedPrompt}
          onChange={(e) => setEnhancedPrompt(e.target.value)}
          className="min-h-[200px] resize-none"
          placeholder="Enhanced prompt will appear here..."
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button 
          onClick={handleUseEnhanced}
          disabled={!enhancedPrompt.trim()}
          className="flex-1"
        >
          Use Enhanced Prompt
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setActiveTab("setup")}
          className="flex-1"
        >
          Back to Setup
        </Button>
      </div>
    </div>
  );

  const tabs: TabDefinition[] = [
    {
      value: "setup",
      label: "Setup",
      content: setupTabContent,
    },
    {
      value: "result",
      label: "Result",
      content: resultTabContent,
      disabled: !enhancedPrompt,
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
        <DialogContent className="!w-[80vw] !h-[85vh] !max-w-none flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Improve Prompt</DialogTitle>
            <DialogDescription>
              Use AI to enhance and improve your prompt for better results.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 px-6 py-4">
            <TabbedLayout
              tabs={tabs}
              initialValue={activeTab}
              onValueChange={setActiveTab}
              scrollable={false}
            />
          </div>

          <DialogFooter className="px-6 py-4 border-t">
            {activeTab === "setup" && (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleRun}
                  disabled={!selectedModelId || !originalPrompt.trim() || isRunning || module.isLoadingProviders}
                >
                  {isRunning ? "Enhancing..." : "Run Enhancement"}
                </Button>
              </>
            )}
            {activeTab === "result" && (
              <Button variant="outline" onClick={() => { setOpen(false); handleReset(); }}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}; 