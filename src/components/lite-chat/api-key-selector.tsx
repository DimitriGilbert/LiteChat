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
import type { AiProviderConfig } from "@/lib/types";

interface ApiKeySelectorProps {
  className?: string;
}

export const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({
  className,
}) => {
  const {
    apiKeys,
    selectedProviderId,
    activeProviders, // Use activeProviders instead of providers
  } = useChatContext();

  const currentProvider = activeProviders.find(
    (p: AiProviderConfig) => p.id === selectedProviderId,
  );
  const requiresKey =
    selectedProviderId &&
    currentProvider &&
    selectedProviderId !== "mock" &&
    // @ ts-expect-error: requiresApiKey may not exist on AiProviderConfig
    (currentProvider as any).requiresApiKey;

  const availableKeys = selectedProviderId
    ? apiKeys.filter((key) => key.providerId === selectedProviderId)
    : [];

  const currentSelection = "none"; // Selection logic is now handled in provider config
  // @ts-expect-error: for types
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  const handleValueChange = (value: string) => {
    // No-op: selection is now handled in provider config
  };

  if (!requiresKey) {
    return null;
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
