import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Assuming shadcn/ui
import { useChatContext } from "@/context/chat-context";

interface ModelSelectorProps {
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ className }) => {
  const { providers, selectedProviderId, selectedModelId, setSelectedModelId } =
    useChatContext();

  const currentProvider = providers.find((p) => p.id === selectedProviderId);
  const availableModels = currentProvider?.models ?? [];

  return (
    <Select
      value={selectedModelId ?? ""}
      onValueChange={setSelectedModelId}
      disabled={!selectedProviderId || availableModels.length <= 1}
    >
      <SelectTrigger className={`w-[180px] ${className}`}>
        <SelectValue placeholder="Select Model" />
      </SelectTrigger>
      <SelectContent>
        {availableModels.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
