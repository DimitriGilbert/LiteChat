// src/components/LiteChat/canvas/interaction/InteractionRating.tsx
import React from "react";
import { cn } from "@/lib/utils";
// import { useInteractionStore } from "@/store/interaction.store"; // No longer directly calling store action
import { emitter } from "@/lib/litechat/event-emitter"; // Added
import { interactionEvent } from "@/types/litechat/events/interaction.events"; // Added
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { Star } from "lucide-react"; // Import star icon
import { useTranslation } from "react-i18next";

interface InteractionRatingProps {
  interactionId: string;
  currentRating: number | null | undefined;
}

export const InteractionRating: React.FC<InteractionRatingProps> = ({
  interactionId,
  currentRating,
}) => {
  const { t } = useTranslation('canvas');
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
        if (ratingValue === -5) tooltip = t('actions.ratings.terrible', 'Terrible');
        else if (ratingValue === -4) tooltip = t('actions.ratings.veryBad', 'Very Bad');
        else if (ratingValue === -3) tooltip = t('actions.ratings.bad', 'Bad');
        else if (ratingValue === -2) tooltip = t('actions.ratings.poor', 'Poor');
        else if (ratingValue === -1) tooltip = t('actions.ratings.belowAverage', 'Below Average');
        else if (ratingValue === 0) tooltip = t('actions.ratings.neutral', 'Neutral');
        else if (ratingValue === 1) tooltip = t('actions.ratings.aboveAverage', 'Above Average');
        else if (ratingValue === 2) tooltip = t('actions.ratings.good', 'Good');
        else if (ratingValue === 3) tooltip = t('actions.ratings.veryGood', 'Very Good');
        else if (ratingValue === 4) tooltip = t('actions.ratings.excellent', 'Excellent');
        else if (ratingValue === 5) tooltip = t('actions.ratings.perfect', 'Perfect');

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
            aria-label={t('actions.ratings.ariaLabel', 'Rate response as {{rating}}', { rating: tooltip })}
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
