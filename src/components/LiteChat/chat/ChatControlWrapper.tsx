// src/components/LiteChat/chat/ChatControlWrapper.tsx
import React from "react";
import type { ChatControl } from "@/types/litechat/chat";
import { cn } from "@/lib/utils"; // Import cn

interface ChatControlWrapperProps {
  controls: ChatControl[];
  panelId: string;
  className?: string;
}

export const ChatControlWrapper: React.FC<ChatControlWrapperProps> = ({
  controls,
  panelId,
  className,
}) => {
  // Filter controls based on panelId and the show condition
  const relevantControls = controls
    .filter(
      (c) => (c.panel ?? "main") === panelId && (c.show ? c.show() : true),
    )
    // Sort controls by the order property (ascending)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  // Return null if no controls match the criteria
  if (relevantControls.length === 0) {
    return null;
  }

  return (
    <div className={cn(className)}>
      {relevantControls.map((c) => (
        // Render the control's renderer function inside a Fragment with a key
        <React.Fragment key={c.id}>
          {c.renderer ? c.renderer() : null}
        </React.Fragment>
      ))}
    </div>
  );
};
