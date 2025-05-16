// src/components/LiteChat/canvas/interaction/InteractionRating.tsx
import React from "react";
import { cn } from "@/lib/utils";
// import { useInteractionStore } from "@/store/interaction.store"; // No longer directly calling store action
import { emitter } from "@/lib/litechat/event-emitter"; // Added
import { interactionEvent } from "@/types/litechat/events/interaction.events"; // Added
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { Star } from "lucide-react"; // Import star icon

interface InteractionRatingProps {
  interactionId: string;
  currentRating: number | null | undefined;
}

export const InteractionRating: React.FC<InteractionRatingProps> = ({
  interactionId,
  currentRating,
}) => {
  // const rateInteraction = useInteractionStore((state) => state.rateInteraction); // Removed

  const handleRate = (newRating: number | null) => {
    // If clicking the same rating again, clear it
    const ratingToSet = newRating === currentRating ? null : newRating;
    // rateInteraction(interactionId, ratingToSet); // Removed
    emitter.emit(interactionEvent.rateInteractionRequest, { // Added event emission
      interactionId,
      rating: ratingToSet,
    });
  };

  // Create array of ratings from -5 to 5
  const ratings = Array.from({ length: 11 }, (_, i) => i - 5);

  return (
    <div className="flex items-center gap-1">
      {ratings.map((ratingValue) => {
        // Determine tooltip text based on rating value
        let tooltip = "";
        if (ratingValue === -5) tooltip = "Terrible";
        else if (ratingValue === -4) tooltip = "Very Bad";
        else if (ratingValue === -3) tooltip = "Bad";
        else if (ratingValue === -2) tooltip = "Poor";
        else if (ratingValue === -1) tooltip = "Below Average";
        else if (ratingValue === 0) tooltip = "Neutral";
        else if (ratingValue === 1) tooltip = "Above Average";
        else if (ratingValue === 2) tooltip = "Good";
        else if (ratingValue === 3) tooltip = "Very Good";
        else if (ratingValue === 4) tooltip = "Excellent";
        else if (ratingValue === 5) tooltip = "Perfect";

        // Determine star color based on rating value
        let colorClass = "text-muted-foreground";
        let hoverColorClass = "hover:text-foreground";
        let fillClass = "";

        // Negative ratings (red)
        if (ratingValue < 0) {
          hoverColorClass = "hover:text-red-500";
          if (currentRating === ratingValue) {
            colorClass = "text-red-500";
            fillClass = "fill-red-500";
          }
        }
        // Zero rating (gray)
        else if (ratingValue === 0) {
          hoverColorClass = "hover:text-gray-500";
          if (currentRating === ratingValue) {
            colorClass = "text-gray-500";
            fillClass = "fill-gray-500";
          }
        }
        // Positive ratings (green)
        else {
          hoverColorClass = "hover:text-green-500";
          if (currentRating === ratingValue) {
            colorClass = "text-green-500";
            fillClass = "fill-green-500";
          }
        }

        // Highlight if this is the current rating
        const activeBgClass = currentRating === ratingValue ? "bg-muted" : "";

        return (
          <ActionTooltipButton
            key={ratingValue}
            tooltipText={tooltip}
            onClick={() => handleRate(ratingValue)}
            aria-label={`Rate response as ${tooltip}`}
            icon={
              <Star
                className={cn(
                  fillClass,
                  currentRating === ratingValue ? "fill-current" : "fill-none",
                )}
              />
            }
            variant="ghost"
            className={cn(
              "h-4 w-4 md:h-5 md:w-5 p-0",
              colorClass,
              hoverColorClass,
              activeBgClass,
            )}
          />
        );
      })}
    </div>
  );
};
