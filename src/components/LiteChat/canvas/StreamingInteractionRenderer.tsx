// src/components/LiteChat/canvas/StreamingInteractionRenderer.tsx
import React from "react";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils"; // Import cn

// Internal component to render a single streaming interaction
const SingleStreamingInteraction: React.FC<{ interactionId: string }> = ({
  interactionId,
}) => {
  // Select the specific interaction using its ID
  const interaction = useInteractionStore(
    useShallow((state) =>
      state.interactions.find((i) => i.id === interactionId),
    ),
  );

  // Return null if interaction not found or not streaming
  if (!interaction || interaction.status !== "STREAMING") {
    return null;
  }

  // Placeholder UI for streaming state
  // TODO: Replace with a proper InteractionCard/Renderer for streaming state later
  return (
    <div
      key={interaction.id}
      className={cn(
        "p-3 my-2 border rounded-md shadow-sm bg-card border-dashed animate-pulse", // Example styling
      )}
    >
      <div className="text-xs text-muted-foreground mb-1">
        Idx:{interaction.index} | {interaction.type} | Streaming...
      </div>
      {/* Display accumulated response content */}
      <pre className="text-sm whitespace-pre-wrap">
        {interaction.response || ""}
      </pre>
    </div>
  );
};

interface StreamingInteractionRendererProps {
  interactionIds: string[];
}

export const StreamingInteractionRenderer: React.FC<
  StreamingInteractionRendererProps
> = ({ interactionIds }) => {
  // Return null if no streaming interactions
  if (!interactionIds || interactionIds.length === 0) {
    return null;
  }

  // Map over the IDs and render the SingleStreamingInteraction component for each
  return (
    <>
      {interactionIds.map((id) => (
        <SingleStreamingInteraction key={id} interactionId={id} />
      ))}
    </>
  );
};
