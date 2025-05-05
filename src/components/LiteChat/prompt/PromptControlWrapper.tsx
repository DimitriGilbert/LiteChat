// src/components/LiteChat/prompt/PromptControlWrapper.tsx

import React from "react";
import type { PromptControl } from "@/types/litechat/prompt";
import { cn } from "@/lib/utils";

interface PromptControlWrapperProps {
  controls: PromptControl[];
  area: "trigger" | "panel";
  className?: string;
}

export const PromptControlWrapper: React.FC<PromptControlWrapperProps> = ({
  controls,
  area,
  className,
}) => {
  // Filter controls based on the area and whether the corresponding function exists
  const controlsToRender = controls.filter((c) =>
    // Use triggerRenderer instead of trigger
    area === "trigger" ? !!c.triggerRenderer : !!c.renderer,
  );

  // Return null if no controls are relevant for this area
  if (controlsToRender.length === 0) {
    return null;
  }

  return (
    <div className={cn(className)}>
      {controlsToRender.map((c) => {
        // Call the appropriate render function (triggerRenderer or renderer)
        const elementToRender =
          // Use triggerRenderer instead of trigger
          area === "trigger" ? c.triggerRenderer?.() : c.renderer?.();
        // Render the element inside a Fragment with a key
        return elementToRender ? (
          <React.Fragment key={c.id}>{elementToRender}</React.Fragment>
        ) : null;
      })}
    </div>
  );
};
