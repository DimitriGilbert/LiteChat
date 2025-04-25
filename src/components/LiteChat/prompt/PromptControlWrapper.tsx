import React from "react";
import type { PromptControl } from "@/types/litechat/prompt";

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
  const controlsToRender = controls.filter((c) =>
    area === "trigger" ? c.trigger : c.renderer,
  );
  if (controlsToRender.length === 0) return null;
  return (
    <div className={className}>
      {controlsToRender.map((c) => {
        const e = area === "trigger" ? c.trigger?.() : c.renderer?.();
        return e ? <React.Fragment key={c.id}>{e}</React.Fragment> : null;
      })}
    </div>
  );
};
