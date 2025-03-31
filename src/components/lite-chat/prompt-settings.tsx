import React from "react";
import { ProviderSelector } from "./provider-selector";
import { ModelSelector } from "./model-selector";
import { ApiKeySelector } from "./api-key-selector"; // Create this new component

interface PromptSettingsProps {
  className?: string;
}

export const PromptSettings: React.FC<PromptSettingsProps> = ({
  className,
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <ProviderSelector />
      <ModelSelector />
      <ApiKeySelector /> {/* Add the key selector */}
      {/* Add other settings like temperature, max tokens later */}
    </div>
  );
};
