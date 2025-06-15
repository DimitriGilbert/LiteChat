import React, { useState, useEffect } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ModelListItem } from "@/types/litechat/provider";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";

interface RacePromptControlProps {
  module: {
    globallyEnabledModels: ModelListItem[];
    isLoadingProviders: boolean;
    setNotifyCallback: (callback: (() => void) | null) => void;
    setRaceMode: (active: boolean, modelIds?: string[], staggerMs?: number) => void;
    isRaceModeActive: boolean;
  };
}

export const RacePromptControl: React.FC<RacePromptControlProps> = ({
  module,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [staggerMs, setStaggerMs] = useState(250);
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

  const handleModelToggle = (modelId: string, checked: boolean) => {
    setSelectedModelIds(prev => 
      checked 
        ? [...prev, modelId]
        : prev.filter(id => id !== modelId)
    );
  };

  const handleStartRace = () => {
    if (selectedModelIds.length < 1) {
      toast.error("Please select at least 1 model to race");
      return;
    }

    // Enable race mode in the module
    module.setRaceMode(true, selectedModelIds, staggerMs);
    
    setOpen(false);
    
    toast.info(`Race mode enabled! Send your prompt to race ${selectedModelIds.length} models.`);

    // Reset selections for next use
    setSelectedModelIds([]);
    setStaggerMs(250);
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
  const canRace = interactionStatus !== "streaming" &&
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
        className={`h-5 w-5 md:h-6 md:w-6 ${module.isRaceModeActive ? 'bg-primary text-primary-foreground' : ''}`}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="min-w-[65vw] max-h-[75vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle>Race Models</DialogTitle>
            <DialogDescription>
              Select multiple models to race against each other. After clicking "Enable Race Mode", send your prompt and all selected models will respond.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">

            {/* Model Selection */}
            <div className="space-y-2">
              <Label>Select Models to Race ({selectedModelIds.length} selected)</Label>
              <ScrollArea className="h-48 w-full border rounded-md p-3">
                <div className="space-y-2">
                  {module.globallyEnabledModels.map((model: ModelListItem) => (
                    <div key={model.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`model-${model.id}`}
                        checked={selectedModelIds.includes(model.id)}
                        onCheckedChange={(checked) => 
                          handleModelToggle(model.id, checked === true)
                        }
                      />
                      <Label
                        htmlFor={`model-${model.id}`}
                        className="text-sm cursor-pointer flex-1 min-w-0"
                      >
                        <div className="truncate">
                          <span className="font-medium">{model.name}</span>
                          <span className="text-muted-foreground ml-2">
                            ({model.providerName})
                          </span>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {module.globallyEnabledModels.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No models available
                </p>
              )}
            </div>

            {/* Stagger Timing Input */}
            <div className="space-y-2">
              <Label htmlFor="stagger-input">Stagger Delay (ms)</Label>
              <Input
                id="stagger-input"
                type="number"
                min="0"
                max="5000"
                step="50"
                value={staggerMs}
                onChange={(e) => setStaggerMs(parseInt(e.target.value) || 250)}
                placeholder="250"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Delay between starting each model (0-5000ms)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStartRace}
              disabled={selectedModelIds.length < 1 || module.isLoadingProviders}
            >
              Enable Race Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}; 