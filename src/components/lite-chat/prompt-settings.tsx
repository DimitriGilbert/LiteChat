import React from "react";
import { ProviderSelector } from "./provider-selector";
import { ModelSelector } from "./model-selector";
import { ApiKeySelector } from "./api-key-selector"; // Create this new component
import { useChatContext } from "@/hooks/use-chat-context"; // Import context
import { KeyIcon, AlertTriangleIcon } from "lucide-react"; // Import icons
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Import Tooltip
import { cn } from "@/lib/utils";

interface PromptSettingsProps {
  className?: string;
}

export const PromptSettings: React.FC<PromptSettingsProps> = ({
  className,
}) => {
  const {
    selectedProviderId,
    providers,
    getApiKeyForProvider,
    selectedApiKeyId,
  } = useChatContext();

  const providerConfig = providers.find((p) => p.id === selectedProviderId);
  const needsKey =
    providerConfig?.requiresApiKey ?? selectedProviderId !== "mock"; // Default true unless explicitly false or mock
  const keyIsSelected = !!(
    selectedProviderId && selectedApiKeyId[selectedProviderId]
  );
  const keyHasValue = !!(
    selectedProviderId && getApiKeyForProvider(selectedProviderId)
  ); // Check if selected key actually has a value (might be deleted but still selected)

  const showKeyRequiredWarning = needsKey && (!keyIsSelected || !keyHasValue);
  const showKeyProvidedIndicator = needsKey && keyIsSelected && keyHasValue;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 bg-gray-800 text-gray-300",
        className,
      )}
    >
      <ProviderSelector />
      <ModelSelector />
      <ApiKeySelector />

      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center h-9">
              {showKeyRequiredWarning && (
                <AlertTriangleIcon className="h-4 w-4 text-amber-500 ml-1" />
              )}
              {showKeyProvidedIndicator && (
                <KeyIcon className="h-4 w-4 text-green-500 ml-1" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            {showKeyRequiredWarning && (
              <p>
                API Key required for this provider is missing or not selected.
              </p>
            )}
            {showKeyProvidedIndicator && (
              <p>API Key is selected for this provider.</p>
            )}
            {!needsKey && <p>API Key not required for this provider.</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
