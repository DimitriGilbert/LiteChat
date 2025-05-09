// src/controls/components/structured-output/VisibleStructuredOutputControl.tsx
// NEW FILE
import React, { useEffect, useState } from "react";
import { StructuredOutputControl } from "./StructuredOutputControl"; // Assume this is the actual UI
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
  // Pass the module to the actual UI component
  return <StructuredOutputControl module={module} />;
};
