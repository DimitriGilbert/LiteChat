import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatContext } from "@/hooks/use-chat-context";
import { cn } from "@/lib/utils";
import type { AiProviderConfig } from "@/lib/types";

interface ProviderSelectorProps {
  className?: string;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  className,
}) => {
  const {
    activeProviders,
    selectedProviderId,
    setSelectedProviderId,
    setSelectedModelId,
  } = useChatContext();

  const handleValueChange = (value: string) => {
    setSelectedProviderId(value);
    setSelectedModelId(null);
  };

  return (
    <Select
      value={selectedProviderId ?? ""}
      onValueChange={handleValueChange}
      disabled={activeProviders.length <= 1}
    >
      <SelectTrigger
        className={cn(
          "w-[180px] h-9 text-sm bg-gray-700 border-gray-600 text-gray-200",
          className,
        )}
      >
        <SelectValue placeholder="Select Provider" />
      </SelectTrigger>
      <SelectContent className="bg-gray-700 border-gray-600 text-gray-200">
        {activeProviders.map((provider: AiProviderConfig) => (
          <SelectItem key={provider.id} value={provider.id}>
            {provider.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
