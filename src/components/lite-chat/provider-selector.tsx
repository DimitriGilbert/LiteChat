// src/components/lite-chat/provider-selector.tsx
import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatContext } from "@/hooks/use-chat-context"; // Uses the main context
import { cn } from "@/lib/utils";
import type { AiProviderConfig } from "@/lib/types";

interface ProviderSelectorProps {
  className?: string;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  className,
}) => {
  // Pulling state and setters from the main ChatContext
  const {
    activeProviders,
    selectedProviderId,
    setSelectedProviderId,
    setSelectedModelId, // Also gets the model setter
  } = useChatContext();

  const handleValueChange = (value: string) => {
    // This should update the provider ID state via the context
    setSelectedProviderId(value);
    // Resetting the model ID when the provider changes is good practice
    setSelectedModelId(null);
  };

  // Disable selection if there's 1 or 0 providers
  const isDisabled = activeProviders.length <= 1;

  return (
    <Select
      value={selectedProviderId ?? ""} // Control the component with state value
      onValueChange={handleValueChange} // Call handler on change
      disabled={isDisabled} // Disable if only one/zero provider
    >
      <SelectTrigger
        className={cn(
          "w-[180px] h-9 text-sm bg-gray-700 border-gray-600 text-gray-200",
          className,
        )}
        aria-label="Select AI provider" // Added aria-label for accessibility
      >
        <SelectValue placeholder="Select Provider" />
      </SelectTrigger>
      <SelectContent className="bg-gray-700 border-gray-600 text-gray-200">
        {activeProviders.map((provider: AiProviderConfig) => (
          <SelectItem key={provider.id} value={provider.id}>
            {provider.name} {/* Display provider name */}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
