import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { emitter } from "@/lib/litechat/event-emitter";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { Star } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface CompactInteractionRatingProps {
  interactionId: string;
  currentRating: number | null | undefined;
}

export const CompactInteractionRating: React.FC<CompactInteractionRatingProps> = ({
  interactionId,
  currentRating,
}) => {
  const [open, setOpen] = useState(false);

  const handleRate = (newRating: number | null) => {
    // If clicking the same rating again, clear it
    const ratingToSet = newRating === currentRating ? null : newRating;
    emitter.emit(interactionEvent.rateInteractionRequest, {
      interactionId,
      rating: ratingToSet,
    });
    setOpen(false); // Close popover after rating
  };

  // Create array of ratings from -5 to 5
  const ratings = Array.from({ length: 11 }, (_, i) => i - 5);

  // Determine the display state of the main star
  let starColorClass = "text-muted-foreground";
  let starFillClass = "";
  let hoverColorClass = "hover:text-foreground";

  if (currentRating !== null && currentRating !== undefined) {
    if (currentRating < 0) {
      starColorClass = "text-red-500";
      starFillClass = "fill-red-500";
    } else if (currentRating === 0) {
      starColorClass = "text-gray-500";
      starFillClass = "fill-gray-500";
    } else {
      starColorClass = "text-green-500";
      starFillClass = "fill-green-500";
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ActionTooltipButton
          tooltipText={
            currentRating !== null && currentRating !== undefined
              ? `Rating: ${currentRating}`
              : "Rate response"
          }
          onClick={() => setOpen(!open)}
          aria-label="Rate response"
          icon={
            <Star
              className={cn(
                starFillClass,
                currentRating !== null && currentRating !== undefined ? "fill-current" : "fill-none",
              )}
            />
          }
          variant="ghost"
          className={cn(
            "h-4 w-4 md:h-5 md:w-5 p-0",
            starColorClass,
            hoverColorClass,
          )}
        />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">Rate this response</div>
          <div className="grid grid-cols-11 gap-1">
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
                  tooltipText={`${ratingValue}: ${tooltip}`}
                  onClick={() => handleRate(ratingValue)}
                  aria-label={`Rate response as ${tooltip} (${ratingValue})`}
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
                    "h-6 w-6 p-0",
                    colorClass,
                    hoverColorClass,
                    activeBgClass,
                  )}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>-5 (Terrible)</span>
            <span>0 (Neutral)</span>
            <span>+5 (Perfect)</span>
          </div>
          {currentRating !== null && currentRating !== undefined && (
            <div className="pt-2 border-t">
              <button
                onClick={() => handleRate(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear rating
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}; 