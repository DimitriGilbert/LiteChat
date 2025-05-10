// src/components/LiteChat/prompt/PromptControlWrapper.tsx
// FULL FILE
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
  // Removed the c.show() filter here as per plan
  const controlsToRender = controls.filter((c) =>
    area === "trigger" ? !!c.triggerRenderer : !!c.renderer
  );

  if (controlsToRender.length === 0) {
    return null;
  }

  return (
    <div className={cn(className)}>
      {controlsToRender.map((c) => {
        const elementToRender =
          area === "trigger" ? c.triggerRenderer?.() : c.renderer?.();
        return elementToRender ? (
          <React.Fragment key={c.id}>{elementToRender}</React.Fragment>
        ) : null;
      })}
    </div>
  );
};
