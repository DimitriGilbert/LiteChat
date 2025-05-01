// src/components/LiteChat/chat/ChatControlWrapper.tsx
import React from "react";
import type { ChatControl } from "@/types/litechat/chat";
import { cn } from "@/lib/utils";

interface ChatControlWrapperProps {
  controls: ChatControl[];
  panelId: string;
  renderMode?: "full" | "icon";
  className?: string;
}

export const ChatControlWrapper: React.FC<ChatControlWrapperProps> = ({
  controls,
  panelId,
  renderMode = "full",
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
      {relevantControls.map((c) => {
        // Choose the renderer based on renderMode
        const renderer = renderMode === "icon" ? c.iconRenderer : c.renderer;
        // Render the control's renderer function inside a Fragment with a key
        return (
          <React.Fragment key={c.id}>
            {renderer ? renderer() : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};
