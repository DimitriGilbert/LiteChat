import React from "react";
import type { ChatControl } from "@/types/litechat/chat";

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
  const relevantControls = controls
    .filter(
      (c) => (c.panel ?? "main") === panelId && (c.show ? c.show() : true),
    )
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  if (relevantControls.length === 0) return null;
  return (
    <div className={className}>
      {relevantControls.map((c) => (
        <React.Fragment key={c.id}>
          {c.renderer ? c.renderer() : null}
        </React.Fragment>
      ))}
    </div>
  );
};
