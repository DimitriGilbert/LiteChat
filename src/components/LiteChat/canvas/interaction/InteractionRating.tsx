// src/components/LiteChat/canvas/interaction/InteractionRating.tsx
// FULL FILE
import React from "react";
import { cn } from "@/lib/utils";
import { useInteractionStore } from "@/store/interaction.store";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import {
  ThumbsUpIcon,
  ThumbsDownIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react"; // Import icons

interface InteractionRatingProps {
  interactionId: string;
  currentRating: number | null | undefined;
}

export const InteractionRating: React.FC<InteractionRatingProps> = ({
  interactionId,
  currentRating,
}) => {
  const rateInteraction = useInteractionStore((state) => state.rateInteraction);

  const handleRate = (newRating: number | null) => {
    // If clicking the same rating again, clear it
    const ratingToSet = newRating === currentRating ? null : newRating;
    rateInteraction(interactionId, ratingToSet);
  };

  // Define the rating scale buttons
  const ratingButtons = [-2, -1, 0, 1, 2].map((ratingValue) => {
    let Icon = ratingValue > 0 ? ThumbsUpIcon : ThumbsDownIcon;
    let tooltip = ratingValue > 0 ? "Good" : "Bad";
    let colorClass = "text-muted-foreground";
    let hoverColorClass = "hover:text-foreground";
    let activeBgClass = "";

    if (ratingValue === 0) {
      Icon = MinusIcon; // Or maybe a neutral face?
      tooltip = "Neutral";
      hoverColorClass = "hover:text-foreground";
    } else if (ratingValue === 1) {
      tooltip = "Good";
      hoverColorClass = "hover:text-green-500";
    } else if (ratingValue === 2) {
      tooltip = "Very Good";
      hoverColorClass = "hover:text-green-600";
    } else if (ratingValue === -1) {
      tooltip = "Bad";
      hoverColorClass = "hover:text-red-500";
    } else if (ratingValue === -2) {
      tooltip = "Very Bad";
      hoverColorClass = "hover:text-red-600";
    }

    if (currentRating === ratingValue) {
      if (ratingValue > 0) colorClass = "text-green-500";
      else if (ratingValue < 0) colorClass = "text-red-500";
      else colorClass = "text-primary"; // Neutral selected
      activeBgClass = "bg-muted"; // Highlight background if selected
    }

    return (
      <ActionTooltipButton
        key={ratingValue}
        tooltipText={tooltip}
        onClick={() => handleRate(ratingValue)}
        aria-label={`Rate response as ${tooltip}`}
        icon={<Icon />}
        variant="ghost"
        className={cn(
          "h-5 w-5 md:h-6 md:w-6 p-0.5", // Adjust padding
          colorClass,
          hoverColorClass,
          activeBgClass,
        )}
      />
    );
  });

  return <div className="flex items-center gap-0">{ratingButtons}</div>;
};
