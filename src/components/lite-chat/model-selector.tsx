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
      <SelectTrigger
        className={cn(
          "w-[180px] h-9 text-sm bg-gray-700 border-gray-600 text-gray-200",
          className,
        )}
      >
        <SelectValue placeholder="Select Model" />
      </SelectTrigger>
      <SelectContent className="bg-gray-700 border-gray-600 text-gray-200">
        {availableModels.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
