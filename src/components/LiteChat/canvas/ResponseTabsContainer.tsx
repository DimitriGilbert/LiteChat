import React, { useState } from 'react';
import { Interaction } from '@/types/litechat/interaction';
import { InteractionCard } from './InteractionCard';
import { StreamingInteractionCard } from './StreamingInteractionCard';
import { CanvasControl, CanvasControlRenderContext } from '@/types/litechat/canvas/control';
import { Button } from '@/components/ui/button';
import { SparkleIcon, HistoryIcon, LandPlot, NotebookPenIcon } from 'lucide-react'; // Import icons and LandPlot icon and NotebookPenIcon

interface ResponseTabsContainerProps {
  interactionGroup: Interaction[]; // Original interaction + its regenerations/edits, sorted chronologically
  renderSlot: (
    targetSlotName: CanvasControl['targetSlot'],
    contextInteraction: Interaction,
    overrideContext?: Partial<CanvasControlRenderContext>
  ) => React.ReactNode[];
  // currentTurnInteractions: Interaction[]; // This prop is not directly passed to InteractionCard/StreamingInteractionCard
  activeStreamingInteractionId?: string; // ID of the currently streaming interaction, if any
  // Controls and config are usually accessed via stores/hooks from within InteractionCard/StreamingInteractionCard
}

export const ResponseTabsContainer: React.FC<ResponseTabsContainerProps> = ({
  interactionGroup,
  renderSlot,
  // currentTurnInteractions, // Removed from destructuring
  activeStreamingInteractionId,
}) => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  if (!interactionGroup || interactionGroup.length === 0) {
    return null;
  }

  // If only one version, don't render tabs, just the content directly.
  if (interactionGroup.length === 1) {
    const singleInteraction = interactionGroup[0];
    return (
      <div className="tab-content pt-0"> {/* Adjusted padding if no tabs */}
        {singleInteraction.id === activeStreamingInteractionId && singleInteraction.status === "STREAMING" ? (
          <StreamingInteractionCard
            key={singleInteraction.id}
            interactionId={singleInteraction.id}
            renderSlot={renderSlot}
            showPrompt={false} 
          />
        ) : (
          <InteractionCard
            key={singleInteraction.id}
            interaction={singleInteraction}
            renderSlot={renderSlot}
            showPrompt={false}
          />
        )}
      </div>
    );
  }

  // More than one version, render tabs.
  const activeInteraction = interactionGroup[activeTabIndex];

  return (
    <div className="response-tabs-container flex flex-col">
      <div className="tabs-header flex border-b mb-1"> {/* Reduced mb */}
        {interactionGroup.map((interaction, index) => {
          // Determine the appropriate icon for this tab
          const getTabIcon = () => {
            if (index === 0) {
              // Main tab (could be original response or edited response)
              if (interaction.metadata?.editedResponse) {
                // This is an edited response that became the main tab
                return <SparkleIcon className="h-3.5 w-3.5 mr-1 flex-shrink-0" />;
              }
              // Regular main tab (original response)
              return <SparkleIcon className="h-3.5 w-3.5 mr-1 flex-shrink-0" />;
            } else if (interaction.metadata?.raceTab) {
              // Race tab
              return <LandPlot className="h-3.5 w-3.5 mr-1 flex-shrink-0" />;
            } else if (interaction.metadata?.originalVersion) {
              // Original version of an edited response
              return <NotebookPenIcon className="h-3.5 w-3.5 mr-1 flex-shrink-0" />;
            } else {
              // Regular regeneration tab
              return <HistoryIcon className="h-3.5 w-3.5 mr-1 flex-shrink-0" />;
            }
          };

          return (
            <Button
              key={interaction.id}
              variant="ghost"
              size="sm" // keep sm, but padding will make it smaller
              onClick={() => setActiveTabIndex(index)}
              className={`mr-0.5 rounded-b-none flex items-center px-2 py-1 text-xs font-medium hover:bg-muted/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 transition-colors duration-150 ease-in-out \
                ${activeTabIndex === index 
                  ? 'border-b-2 border-primary text-primary' 
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {getTabIcon()}
              {index + 1} {/* Just the number */}
            </Button>
          );
        })}
      </div>
      <div className="tab-content pt-1"> {/* Reduced padding */}
        {activeInteraction && (
          activeInteraction.id === activeStreamingInteractionId && activeInteraction.status === "STREAMING" ? (
            <StreamingInteractionCard
              key={activeInteraction.id}
              interactionId={activeInteraction.id}
              renderSlot={renderSlot}
              showPrompt={false}
            />
          ) : (
            <InteractionCard
              key={activeInteraction.id}
              interaction={activeInteraction}
              renderSlot={renderSlot}
              showPrompt={false}
            />
          )
        )}
      </div>
    </div>
  );
}; 