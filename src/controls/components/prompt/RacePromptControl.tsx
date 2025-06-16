import React, { useState, useEffect, useMemo } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { LandPlot } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { ModelSelector } from "@/controls/components/global-model-selector/ModelSelector";

type CapabilityFilter =
  | "reasoning"
  | "webSearch"
  | "tools"
  | "multimodal"
  | "imageGeneration";

interface RacePromptControlProps {
  module: {
    globallyEnabledModels: ModelListItem[];
    isLoadingProviders: boolean;
    setNotifyCallback: (callback: (() => void) | null) => void;
    setRaceMode: (
      active: boolean,
      config?: {
        modelIds: string[];
        staggerMs: number;
        combineEnabled: boolean;
        combineModelId?: string;
        combinePrompt?: string;
        raceTimeoutSec?: number;
      }
    ) => void;
    isRaceModeActive: boolean;
  };
}

export const RacePromptControl: React.FC<RacePromptControlProps> = ({
  module,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [staggerMs, setStaggerMs] = useState(250);
  const [raceTimeoutSec, setRaceTimeoutSec] = useState(120);
  const [combineEnabled, setCombineEnabled] = useState(false);
  const [combineModelId, setCombineModelId] = useState<string | null>(null);
  const [combinePrompt, setCombinePrompt] = useState(
    "You are a helpful assistant that analyzes and combines multiple AI model responses. Below are responses from different models to the same prompt. Please provide a comprehensive combined response that incorporates the best insights from each model while maintaining coherence and accuracy.\n\nPlease analyze the responses and provide a single, well-structured answer that combines their strengths."
  );
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

  const activeCapabilityFilterCount =
    Object.values(capabilityFilters).filter(Boolean).length;
  const totalActiveFilters = activeCapabilityFilterCount;

  const handleModelToggle = (modelId: string, checked: boolean) => {
    setSelectedModelIds((prev) =>
      checked ? [...prev, modelId] : prev.filter((id) => id !== modelId)
    );
  };

  const handleStartRace = () => {
    if (selectedModelIds.length < 1) {
      toast.error("Please select at least 1 model to race");
      return;
    }

    if (combineEnabled && !combineModelId) {
      toast.error("Please select a model for combining");
      return;
    }

    // Enable race mode in the module
    module.setRaceMode(true, {
      modelIds: selectedModelIds,
      staggerMs: staggerMs,
      raceTimeoutSec: raceTimeoutSec,
      combineEnabled: combineEnabled,
      combineModelId: combineModelId || undefined,
      combinePrompt: combinePrompt,
    });

    setOpen(false);

    toast.info(
      `Race mode enabled! Send your prompt to race ${selectedModelIds.length} models.`
    );

    // Reset selections for next use
    setSelectedModelIds([]);
    setStaggerMs(250);
    setRaceTimeoutSec(120);
    setFilterText("");
    setCapabilityFilters({
      reasoning: false,
      webSearch: false,
      tools: false,
      multimodal: false,
      imageGeneration: false,
    });
    setCombineEnabled(false);
    setCombineModelId(null);
    setCombinePrompt(
      "You are a helpful assistant that analyzes and combines multiple AI model responses. Below are responses from different models to the same prompt. Please provide a comprehensive combined response that incorporates the best insights from each model while maintaining coherence and accuracy.\n\nPlease analyze the responses and provide a single, well-structured answer that combines their strengths."
    );
  };

  const handleCancelRace = () => {
    module.setRaceMode(false);
    toast.info("Race mode disabled");
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If already in race mode, cancel it
    if (module.isRaceModeActive) {
      handleCancelRace();
      return;
    }

    if (interactionStatus === "streaming") {
      toast.info("Cannot start race while another response is streaming");
      return;
    }

    if (module.globallyEnabledModels.length < 2) {
      toast.info("Need at least 2 models enabled to race");
      return;
    }

    setOpen(true);
  };

  // Check if racing is available
  const canRace =
    interactionStatus !== "streaming" &&
    module.globallyEnabledModels.length >= 2;

  // Dynamic tooltip based on state
  const getTooltipText = () => {
    if (module.isRaceModeActive) {
      return "Race mode active - click to cancel, or send your prompt to race models";
    }
    if (interactionStatus === "streaming") {
      return "Cannot race while streaming";
    }
    if (module.globallyEnabledModels.length < 2) {
      return `Need at least 2 models enabled to race (currently have ${module.globallyEnabledModels.length})`;
    }
    return "Race multiple models with your prompt";
  };

  return (
    <>
      <ActionTooltipButton
        tooltipText={getTooltipText()}
        onClick={handleClick}
        aria-label="Race Multiple Models Against Each Other"
        disabled={!canRace}
        icon={<LandPlot />}
        className={`h-5 w-5 md:h-6 md:w-6 ${
          module.isRaceModeActive ? "bg-primary text-primary-foreground" : ""
        }`}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="min-w-[85vw] max min-h-[75vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle>Race Models</DialogTitle>
            <DialogDescription>
              Select multiple models to race against each other. After clicking
              "Enable Race Mode", send your prompt and all selected models will
              respond.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
                    variant={
                      capabilityFilters.reasoning ? "secondary" : "ghost"
                    }
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
                    variant={
                      capabilityFilters.webSearch ? "secondary" : "ghost"
                    }
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
                    variant={
                      capabilityFilters.multimodal ? "secondary" : "ghost"
                    }
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
                    variant={
                      capabilityFilters.imageGeneration ? "secondary" : "ghost"
                    }
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
                {totalActiveFilters > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-primary rounded-full">
                    {totalActiveFilters}
                  </span>
                )}
              </div>
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <Label>
                Select Models to Race ({selectedModelIds.length} selected)
              </Label>
              <ScrollArea className="h-48 w-full border rounded-md p-3">
                <div className="space-y-2">
                  {filteredModels.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {totalActiveFilters > 0
                        ? "No models match all active filters."
                        : module.globallyEnabledModels.length === 0
                        ? "No models available."
                        : "No models match search."}
                    </p>
                  ) : (
                    filteredModels.map((model: ModelListItem) => (
                      <div
                        key={model.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`model-${model.id}`}
                          checked={selectedModelIds.includes(model.id)}
                          onCheckedChange={(checked) =>
                            handleModelToggle(model.id, checked === true)
                          }
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
                            ) && (
                              <Brain className="h-3.5 w-3.5 text-purple-500" />
                            )}
                            {(model.metadataSummary?.supported_parameters?.includes(
                              "web_search"
                            ) ||
                              model.metadataSummary?.supported_parameters?.includes(
                                "web_search_options"
                              )) && (
                              <Globe className="h-3.5 w-3.5 text-blue-500" />
                            )}
                            {model.metadataSummary?.supported_parameters?.includes(
                              "tools"
                            ) && (
                              <Wrench className="h-3.5 w-3.5 text-orange-500" />
                            )}
                            {model.metadataSummary?.input_modalities?.some(
                              (mod) => mod !== "text"
                            ) && (
                              <ImageIcon className="h-3.5 w-3.5 text-green-500" />
                            )}
                            {model.metadataSummary?.output_modalities?.includes(
                              "image"
                            ) && (
                              <Palette className="h-3.5 w-3.5 text-pink-500" />
                            )}
                          </div>
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Stagger Timing Input */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="stagger-ms">Stagger (ms)</Label>
                <Input
                  id="stagger-ms"
                  type="number"
                  value={staggerMs}
                  onChange={(e) => setStaggerMs(parseInt(e.target.value, 10))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="race-timeout">Timeout (s)</Label>
                <Input
                  id="race-timeout"
                  type="number"
                  value={raceTimeoutSec}
                  onChange={(e) =>
                    setRaceTimeoutSec(parseInt(e.target.value, 10) || 120)
                  }
                  className="mt-1"
                />
              </div>
            </div>

            {/* Combine Switch */}
            <div className="space-y-2">
              <Label htmlFor="combine-switch">Combine Models</Label>
              <Switch
                id="combine-switch"
                checked={combineEnabled}
                onCheckedChange={(checked) => setCombineEnabled(checked)}
              />
            </div>

            {/* Combine Model Selector */}
            {combineEnabled && (
              <div className="space-y-2">
                <Label htmlFor="combine-model-selector">
                  Combine with Model
                </Label>
                <ModelSelector
                  models={module.globallyEnabledModels}
                  value={combineModelId}
                  onChange={(id: string | null) => setCombineModelId(id)}
                  isLoading={module.isLoadingProviders}
                />
              </div>
            )}

            {/* Combine Prompt Input */}
            {combineEnabled && (
              <div className="space-y-2">
                <Label htmlFor="combine-prompt">Combine Prompt</Label>
                <Textarea
                  id="combine-prompt"
                  value={combinePrompt}
                  onChange={(e) => setCombinePrompt(e.target.value)}
                  placeholder="Enter a prompt to combine models"
                  className="w-full"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStartRace}
              disabled={
                selectedModelIds.length < 1 || module.isLoadingProviders
              }
            >
              Enable Race Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
