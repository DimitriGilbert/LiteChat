// src/components/lite-chat/api-key-selector.tsx
import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
// import { useProviderManagementContext } from "@/context/provider-management-context";
import { KeyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DbApiKey } from "@/lib/types"; // Import DbApiKey

interface ApiKeySelectorProps {
  className?: string;
  label?: string;
  /** The ID of the currently selected/linked API key, or null if none. */
  selectedKeyId: string | null;
  /** Callback function when a key is selected from the dropdown. */
  onKeySelected: (keyId: string | null) => void;
  /** List of all available API keys to choose from. */
  apiKeys: DbApiKey[];
  /** Optional: Disable the selector */
  disabled?: boolean;
}

export const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({
  className,
  label,
  selectedKeyId,
  onKeySelected,
  apiKeys,
  disabled = false,
}) => {
  const handleValueChange = (value: string) => {
    // Pass null if "none" is selected, otherwise pass the key ID
    onKeySelected(value === "none" ? null : value);
  };

  // Determine the display value for the trigger
  const selectedKeyName = apiKeys.find((k) => k.id === selectedKeyId)?.name;
  const displayValue = selectedKeyId
    ? selectedKeyName || `Key ID: ${selectedKeyId.substring(0, 6)}...` // Show name or truncated ID
    : "None"; // Show "None" if no key is linked

  return (
    <Select
      value={selectedKeyId ?? "none"} // Use "none" as the value when selectedKeyId is null
      onValueChange={handleValueChange}
      disabled={disabled || apiKeys.length === 0} // Disable if no keys exist or explicitly disabled
    >
      <SelectTrigger
        className={cn(
          "w-full h-9 text-sm bg-gray-700 border-gray-600 text-gray-200", // Changed default width to full
          className,
        )}
        aria-label={label || "Select API Key"}
      >
        <div className="flex items-center overflow-hidden">
          <KeyIcon className="h-3 w-3 mr-1.5 text-gray-400 flex-shrink-0" />
          <span className="truncate flex-grow text-left">
            {label && <span className="mr-1">{label}</span>}
            {apiKeys.length === 0 ? (
              <span className="text-gray-400">No keys available</span>
            ) : (
              displayValue
            )}
          </span>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-gray-700 border-gray-600 text-gray-200">
        <SelectItem value="none">
          <span className="text-gray-400">None</span>
        </SelectItem>
        {apiKeys.map((key) => (
          <SelectItem key={key.id} value={key.id}>
            {key.name || `Key ID: ${key.id.substring(0, 6)}...`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
