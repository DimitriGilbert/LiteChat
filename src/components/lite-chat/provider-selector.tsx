import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Assuming shadcn/ui
import { useChatContext } from "@/context/chat-context";

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
      <SelectTrigger className={`w-[180px] ${className}`}>
        <SelectValue placeholder="Select Provider" />
      </SelectTrigger>
      <SelectContent>
        {providers.map((provider) => (
          <SelectItem key={provider.id} value={provider.id}>
            {provider.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
