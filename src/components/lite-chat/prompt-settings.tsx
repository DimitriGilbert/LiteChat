import React, { useState } from "react"; // Add useState
import { ProviderSelector } from "./provider-selector";
import { ModelSelector } from "./model-selector";
// import { ApiKeySelector } from "./api-key-selector"; // REMOVED from here
import { PromptSettingsAdvanced } from "./prompt-settings-advanced"; // Import advanced
import { useChatContext } from "@/hooks/use-chat-context";
import { KeyIcon, AlertTriangleIcon, Settings2Icon } from "lucide-react"; // Add Settings2Icon
import { Button } from "@/components/ui/button"; // Import Button
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false); // State for toggle

  const providerConfig = providers.find((p) => p.id === selectedProviderId);
  const needsKey =
    providerConfig?.requiresApiKey ?? selectedProviderId !== "mock";
  const keyIsSelected = !!(
    selectedProviderId && selectedApiKeyId[selectedProviderId]
  );
  const keyHasValue = !!(
    selectedProviderId && getApiKeyForProvider(selectedProviderId)
  );
  const showKeyRequiredWarning = needsKey && (!keyIsSelected || !keyHasValue);
  const showKeyProvidedIndicator = needsKey && keyIsSelected && keyHasValue;

  return (
    <div className={cn("bg-gray-800 text-gray-300", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 bg-gray-800 text-gray-300",
          className,
        )}
      >
        <ProviderSelector />
        <ModelSelector />
        {/* <ApiKeySelector /> */}

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
                {!needsKey && <div className="w-4 h-4 ml-1" />}
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
        <div className="flex-grow" />
        {/* Advanced Settings Toggle Button */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className={cn(
                  "h-8 w-8 text-gray-400 hover:text-gray-200",
                  isAdvancedOpen && "bg-gray-700 text-gray-200",
                )}
                aria-label="Toggle advanced settings"
              >
                <Settings2Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{isAdvancedOpen ? "Hide" : "Show"} Advanced Settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {/* Conditionally render Advanced Settings */}
      {isAdvancedOpen && <PromptSettingsAdvanced />}
    </div>
  );
};
