// src/components/LiteChat/canvas/StreamingInteractionCard.tsx
// Entire file content provided
import React, { useMemo } from "react"; // Import useMemo
import { UserPromptDisplay } from "./UserPromptDisplay";
import { StreamingContentView } from "./StreamingContentView";
import { StopButton } from "../common/StopButton";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { useProviderStore } from "@/store/provider.store";
import { splitModelId } from "@/lib/litechat/provider-helpers";

interface StreamingInteractionCardProps {
  interactionId: string;
  onStop?: (interactionId: string) => void;
  className?: string;
}

export const StreamingInteractionCard: React.FC<StreamingInteractionCardProps> =
  React.memo(({ interactionId, onStop, className }) => {
    // Get interaction data and buffered content
    const { interaction, bufferedContent } = useInteractionStore(
      useShallow((state) => {
        const interaction = state.interactions.find(
          (i) => i.id === interactionId,
        );
        return {
          interaction,
          bufferedContent: state.activeStreamBuffers[interactionId] ?? "",
        };
      }),
    );

    // Get provider data using useShallow
    const { dbProviderConfigs, getAllAvailableModelDefsForProvider } =
      useProviderStore(
        useShallow((state) => ({
          dbProviderConfigs: state.dbProviderConfigs,
          getAllAvailableModelDefsForProvider:
            state.getAllAvailableModelDefsForProvider,
        })),
      );

    // --- Memoize Model Name Calculation ---
    const displayModelName = useMemo(() => {
      const modelIdFromMeta = interaction?.metadata?.modelId;
      if (!modelIdFromMeta) return "Loading Model...";

      const { providerId, modelId: specificModelId } =
        splitModelId(modelIdFromMeta);
      if (!providerId || !specificModelId) {
        return modelIdFromMeta; // Fallback if split fails
      }

      const provider = dbProviderConfigs.find((p) => p.id === providerId);
      const providerName = provider?.name ?? providerId;

      // Use the stable selector function from the store
      const allModels = getAllAvailableModelDefsForProvider(providerId);
      const modelDef = allModels.find((m) => m.id === specificModelId);

      return `${modelDef?.name ?? specificModelId} (${providerName})`;
    }, [
      interaction?.metadata?.modelId, // Depend on the specific interaction's modelId
      dbProviderConfigs, // Depend on the array reference
      getAllAvailableModelDefsForProvider, // Depend on the stable selector function
    ]);
    // --- End Memoize Model Name Calculation ---

    if (!interaction) {
      console.warn(
        `StreamingInteractionCard: Interaction data for ${interactionId} not found yet.`,
      );
      // Render a simple placeholder while interaction data loads
      return (
        <div
          className={cn(
            "group relative rounded-lg border border-primary/30 bg-card p-4 shadow-sm animate-pulse",
            className,
          )}
        >
          <div className="h-8 bg-muted rounded w-3/4 mb-4"></div>{" "}
          {/* Skeleton for user prompt */}
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Assistant (Loading...)
              </span>
              <span className="text-xs text-muted-foreground">
                Streaming...
              </span>
            </div>
            <div className="h-16 bg-muted rounded w-full"></div>{" "}
            {/* Skeleton for response */}
          </div>
        </div>
      );
    }

    const handleStopClick = () => {
      if (onStop) {
        onStop(interactionId);
      }
    };

    return (
      <div
        className={cn(
          "group relative rounded-lg border border-primary/30 bg-card p-4 shadow-sm animate-fadeIn",
          className,
        )}
      >
        {/* User Prompt */}
        {interaction.prompt && (
          <UserPromptDisplay
            turnData={interaction.prompt}
            timestamp={interaction.startedAt}
          />
        )}

        {/* Assistant Response */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Assistant ({displayModelName})
            </span>
            <span className="text-xs text-muted-foreground">Streaming...</span>
          </div>
          {/* Render buffered content */}
          <StreamingContentView
            markdownContent={bufferedContent}
            isStreaming={true}
          />
        </div>

        {/* Stop Button */}
        {onStop && (
          <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <StopButton onStop={handleStopClick} aria-label="Stop Generation" />
          </div>
        )}
      </div>
    );
  });
StreamingInteractionCard.displayName = "StreamingInteractionCard";
