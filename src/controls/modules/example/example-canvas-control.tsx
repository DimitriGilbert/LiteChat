// src/controls/modules/example/example-canvas-control.tsx
// FULL FILE
// React import removed as it's not used directly in this component's logic
// import React from "react";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { Button } from "@/components/ui/button";
import { SmileIcon } from "lucide-react";
import { toast } from "sonner";

interface ExampleCanvasControlComponentProps {
  context: CanvasControlRenderContext;
}

export const ExampleCanvasControlComponent: React.FC<
  ExampleCanvasControlComponentProps
> = ({ context }) => {
  const handleClick = () => {
    toast.info(
      `Example Canvas Action Clicked! Interaction ID: ${context.interactionId}`
    );
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="h-6 px-2 text-xs"
    >
      <SmileIcon className="h-3 w-3 mr-1" /> Example Action
    </Button>
  );
};
