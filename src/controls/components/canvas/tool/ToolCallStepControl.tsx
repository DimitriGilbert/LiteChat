import React from "react";
import type { ToolCallPart, ToolResultPart } from "ai";
import { ToolCallDisplay } from "@/components/LiteChat/canvas/tool/CallDisplay";
import { ToolResultDisplay } from "@/components/LiteChat/canvas/tool/ResultDisplay";

interface ToolCallStepControlProps {
  interactionId: string; // ID of the parent interaction
  toolCall: ToolCallPart;
  toolResult?: ToolResultPart;
  // Add other context props if needed, e.g., for actions within the tool display
}

export const ToolCallStepControl: React.FC<ToolCallStepControlProps> = ({
  interactionId,
  toolCall,
  toolResult,
}) => {
  // console.log(`[ToolCallStepControl] Rendering for interaction: ${interactionId}, toolCallId: ${toolCall.toolCallId}`);
  return (
    <div className="tool-call-step my-1" data-interaction-id={interactionId} data-tool-call-id={toolCall.toolCallId}>
      <ToolCallDisplay toolCall={toolCall} />
      {toolResult && <ToolResultDisplay toolResult={toolResult} />}
      {/* 
        Future: Could add action buttons here specific to a tool call/result, 
        e.g., "Retry tool", "Edit arguments", "View trace", etc.
        These would be rendered via another renderSlot call with a different targetSlot.
      */}
    </div>
  );
}; 