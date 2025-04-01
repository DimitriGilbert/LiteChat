import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Assuming shadcn/ui
import { useChatContext } from "@/hooks/use-chat-context";
import { cn } from "@/lib/utils";

interface ProviderSelectorProps {
  className?: string;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  className,
}) => {
  const {
    providers,
    selectedProviderId,
    setSelectedProviderId,
    setSelectedModelId, // Reset model when provider changes
  } = useChatContext();

  const handleValueChange = (value: string) => {
    setSelectedProviderId(value);
    setSelectedModelId(null); // Reset model selection
  };

  return (
    <Select
      value={selectedProviderId ?? ""}
      onValueChange={handleValueChange}
      disabled={providers.length <= 1}
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
        {providers.map((provider) => (
          <SelectItem key={provider.id} value={provider.id}>
            {provider.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
