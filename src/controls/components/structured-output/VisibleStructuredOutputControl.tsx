// src/controls/components/structured-output/VisibleStructuredOutputControl.tsx
// FULL FILE
import React, { useEffect, useState } from "react";
import { StructuredOutputControl } from "./StructuredOutputControl";
import type { StructuredOutputControlModule } from "@/controls/modules/StructuredOutputControlModule";

interface VisibleStructuredOutputControlProps {
  module: StructuredOutputControlModule;
}

export const VisibleStructuredOutputControl: React.FC<
  VisibleStructuredOutputControlProps
> = ({ module }) => {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const isVisible = module.getIsVisible();

  if (!isVisible) {
    return null;
  }
  return <StructuredOutputControl module={module} />;
};
