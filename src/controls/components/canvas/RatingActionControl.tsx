// src/controls/components/canvas/RatingActionControl.tsx
// FULL FILE
import React from "react";
import { InteractionRating } from "@/components/LiteChat/canvas/interaction/InteractionRating";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";

interface RatingActionControlProps {
  context: CanvasControlRenderContext;
}

export const RatingActionControl: React.FC<RatingActionControlProps> = ({
  context,
}) => {
  if (!context.interactionId || !context.interaction) {
    return null;
  }
  return (
    <InteractionRating
      interactionId={context.interactionId}
      currentRating={context.interaction.rating}
    />
  );
};
