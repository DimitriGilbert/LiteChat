// src/components/LiteChat/canvas/StreamingInteractionRenderer.tsx
import React from "react";
import { useInteractionStore } from "@/store/interaction.store";
import { useSettingsStore } from "@/store/settings.store"; // Import SettingsStore
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { StopButton } from "@/components/LiteChat/common/StopButton";
import { useMarkdownParser } from "@/lib/litechat/useMarkdownParser"; // Import parser hook

// Internal component to render a single streaming interaction
const SingleStreamingInteraction: React.FC<{
  interactionId: string;
  onStop: (id: string) => void;
}> = ({ interactionId, onStop }) => {
  // Select the specific interaction using its ID
  const interaction = useInteractionStore(
    useShallow((state) =>
      state.interactions.find((i) => i.id === interactionId),
    ),
  );
  // Get the setting for streaming markdown
  const enableStreamingMarkdown = useSettingsStore(
    (state) => state.enableStreamingMarkdown,
  );

  // Parse markdown conditionally
  const contentToRender = interaction?.response || "";
  const renderedHtml = useMarkdownParser(
    enableStreamingMarkdown ? contentToRender : null, // Only parse if enabled
  );

  // Return null if interaction not found or not streaming
  if (!interaction || interaction.status !== "STREAMING") {
    return null;
  }

  return (
    <div
      key={interaction.id}
      className={cn(
        "p-3 my-2 border rounded-md shadow-sm bg-card border-dashed animate-pulse relative group",
      )}
    >
      {/* Header Info */}
      <div className="text-xs text-muted-foreground mb-1 flex justify-between items-center">
        <span>
          Idx:{interaction.index} | {interaction.type} | Streaming...
          {interaction.metadata?.modelId && (
            <span className="ml-2 text-blue-400">
              ({interaction.metadata.modelId})
            </span>
          )}
        </span>
        {/* Stop Button - Positioned top-right */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <StopButton interactionId={interactionId} onStop={onStop} />
        </div>
      </div>
      {/* Display accumulated response content */}
      {enableStreamingMarkdown ? (
        // Render parsed HTML if enabled
        <div
          className="text-sm markdown-content" // Add markdown class
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      ) : (
        // Render plain text if disabled
        <pre className="text-sm whitespace-pre-wrap">{contentToRender}</pre>
      )}
    </div>
  );
};

interface StreamingInteractionRendererProps {
  interactionIds: string[];
  onStop: (id: string) => void;
}

export const StreamingInteractionRenderer: React.FC<
  StreamingInteractionRendererProps
> = ({ interactionIds, onStop }) => {
  // Return null if no streaming interactions
  if (!interactionIds || interactionIds.length === 0) {
    return null;
  }

  // Map over the IDs and render the SingleStreamingInteraction component for each
  return (
    <>
      {interactionIds.map((id) => (
        <SingleStreamingInteraction
          key={id}
          interactionId={id}
          onStop={onStop}
        />
      ))}
    </>
  );
};
