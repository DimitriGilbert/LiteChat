import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatContext } from "@/hooks/use-chat-context";
import { KeyIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApiKeySelectorProps {
  className?: string;
}

export const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({
  className,
}) => {
  const {
    apiKeys,
    selectedProviderId,
    selectedApiKeyId,
    setSelectedApiKeyId,
    providers, // Need providers to check if key is required
  } = useChatContext();

  const currentProvider = providers.find((p) => p.id === selectedProviderId);
  // Simple check if provider might need a key (improve if needed)
  const requiresKey = selectedProviderId && selectedProviderId !== "mock"; // Example: mock provider doesn't need a key

  const availableKeys = selectedProviderId
    ? apiKeys.filter((key) => key.providerId === selectedProviderId)
    : [];

  const currentSelection = selectedProviderId
    ? (selectedApiKeyId[selectedProviderId] ?? "none") // Use 'none' as value for no selection
    : "none";

  const handleValueChange = (value: string) => {
    if (selectedProviderId) {
      setSelectedApiKeyId(selectedProviderId, value === "none" ? null : value);
    }
  };

  if (!requiresKey) {
    return null; // Don't show selector if provider doesn't need a key
  }

  return (
    <Select
      value={currentSelection}
      onValueChange={handleValueChange}
      disabled={!selectedProviderId || availableKeys.length === 0}
    >
      <SelectTrigger
        className={cn(
          "w-[180px] h-9 text-sm bg-gray-700 border-gray-600 text-gray-200",
          className,
        )}
      >
        <KeyIcon className="h-3 w-3 mr-1 text-gray-400" />
        <SelectValue placeholder="Select API Key" />
      </SelectTrigger>
      <SelectContent className="bg-gray-700 border-gray-600 text-gray-200">
        <SelectItem value="none">
          <span className="text-gray-400">None (Use Default)</span>
        </SelectItem>
        {availableKeys.map((key) => (
          <SelectItem key={key.id} value={key.id}>
            {key.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
