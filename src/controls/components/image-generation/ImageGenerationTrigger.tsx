import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ImageGenerationControlModule } from "@/controls/modules/ImageGenerationControlModule";

interface ImageGenerationTriggerProps {
  module: ImageGenerationControlModule;
}

export const ImageGenerationTrigger: React.FC<ImageGenerationTriggerProps> = ({
  module,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  useEffect(() => {
    const enabled = module.getImageGenerationEnabled();
    setIsPressed(enabled === true);
  }, [module]);

  const isVisible = module.getIsVisible();
  const isStreaming = module.getIsStreaming();

  const handleToggle = useCallback(() => {
    const newState = !isPressed;
    module.setImageGenerationEnabled(newState ? true : null);
    setIsPressed(newState);
  }, [isPressed, module]);

  if (!isVisible) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isPressed ? "secondary" : "ghost"}
            size="icon"
            onClick={handleToggle}
            disabled={isStreaming}
            className="h-8 w-8"
            aria-label={
              isPressed
                ? "Disable Image Generation for Next Turn"
                : "Enable Image Generation for Next Turn"
            }
          >
            <Palette
              className={cn(
                "h-4 w-4",
                isPressed ? "text-primary" : "text-muted-foreground"
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isPressed
            ? "Image Generation Enabled (Click to Disable)"
            : "Image Generation Disabled (Click to Enable)"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}; 