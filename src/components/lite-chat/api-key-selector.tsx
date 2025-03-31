import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatContext } from "@/context/chat-context";
import { KeyIcon } from "lucide-react";

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
      <SelectTrigger className={`w-[180px] ${className}`}>
        <KeyIcon className="h-3 w-3 mr-1 text-muted-foreground" />
        <SelectValue placeholder="Select API Key" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="text-muted-foreground">None (Use Default)</span>
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
