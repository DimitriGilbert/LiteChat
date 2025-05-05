// src/components/LiteChat/settings/SettingsProviderRowView.tsx
// FULL FILE
import React, { useMemo, useCallback, useState } from "react";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import { Button } from "@/components/ui/button";
import {
  Edit2Icon,
  Trash2Icon,
  Loader2,
  RefreshCwIcon,
  CheckIcon,
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  requiresApiKey,
  requiresBaseURL,
  supportsModelFetching,
  combineModelId,
} from "@/lib/litechat/provider-helpers";
import { cn } from "@/lib/utils";
import { useProviderStore } from "@/store/provider.store";
import { ModelEnablementList } from "./ModelEnablementList";
import { toast } from "sonner";
import { ActionTooltipButton } from "../common/ActionTooltipButton";

type FetchStatus = "idle" | "fetching" | "error" | "success";

interface ProviderRowViewModeProps {
  provider: DbProviderConfig;
  apiKeys: DbApiKey[];
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onFetchModels: () => Promise<void>;
  onUpdate: (id: string, changes: Partial<DbProviderConfig>) => Promise<void>;
  fetchStatus: FetchStatus;
  isDeleting: boolean;
  onSelectModelForDetails: (combinedModelId: string | null) => void;
}

const ProviderRowViewModeComponent: React.FC<ProviderRowViewModeProps> = ({
  provider,
  apiKeys,
  onEdit,
  onDelete,
  onFetchModels,
  onUpdate,
  fetchStatus,
  isDeleting,
  onSelectModelForDetails,
}) => {
  const [isModelListFolded, setIsModelListFolded] = useState(true);

  const needsKey = requiresApiKey(provider.type);
  const needsURL = requiresBaseURL(provider.type);
  const canFetch = supportsModelFetching(provider.type);
  const isFetchButtonDisabled = fetchStatus === "fetching" || isDeleting;
  const isEditButtonDisabled = isDeleting || fetchStatus === "fetching";
  const isDeleteButtonDisabled = isDeleting || fetchStatus === "fetching";

  const getAllAvailableModelDefsForProvider = useProviderStore(
    (state) => state.getAllAvailableModelDefsForProvider,
  );
  // Get full model defs here for display/linking
  const allAvailableModels = getAllAvailableModelDefsForProvider(provider.id);
  const enabledModelsSet = useMemo(
    () => new Set(provider.enabledModels ?? []),
    [provider.enabledModels],
  );

  const apiKeyLinked = provider.apiKeyId
    ? apiKeys.some((k) => k.id === provider.apiKeyId)
    : false;
  const showKeyWarning = needsKey && !apiKeyLinked;

  const handleModelToggle = useCallback(
    async (modelId: string, checked: boolean) => {
      const currentEnabledSet = new Set(provider.enabledModels ?? []);
      if (checked) {
        currentEnabledSet.add(modelId);
      } else {
        currentEnabledSet.delete(modelId);
      }
      const newEnabledModels = Array.from(currentEnabledSet);

      try {
        await onUpdate(provider.id, { enabledModels: newEnabledModels });
      } catch (error) {
        toast.error("Failed to update model status.");
        console.error("Failed to save model toggle:", error);
      }
    },
    [provider.enabledModels, provider.id, onUpdate],
  );

  const toggleFold = () => setIsModelListFolded((prev) => !prev);

  const enabledCount = provider.enabledModels?.length ?? 0;
  const availableCount = allAvailableModels.length;

  // Handler for clicking a model name
  const handleModelClick = (modelId: string) => {
    const combinedId = combineModelId(provider.id, modelId);
    onSelectModelForDetails(combinedId);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger>
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full flex-shrink-0 block",
                    fetchStatus === "error"
                      ? "bg-destructive animate-pulse"
                      : provider.isEnabled
                        ? "bg-green-500"
                        : "bg-muted-foreground",
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="top">
                {fetchStatus === "error"
                  ? "Error fetching models"
                  : provider.isEnabled
                    ? "Enabled"
                    : "Disabled"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <h3 className="font-semibold text-lg text-card-foreground truncate">
            {provider.name}
          </h3>
          <span className="text-sm text-muted-foreground flex-shrink-0">
            ({provider.type})
          </span>
          {showKeyWarning && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircleIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>API Key required but none linked/found.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center space-x-1 flex-shrink-0">
          <ActionTooltipButton
            tooltipText="Edit"
            onClick={onEdit}
            disabled={isEditButtonDisabled}
            aria-label="Edit provider"
            icon={<Edit2Icon />}
            className="h-8 w-8"
          />
          <ActionTooltipButton
            tooltipText="Delete"
            onClick={onDelete}
            disabled={isDeleteButtonDisabled}
            className="text-destructive hover:text-destructive/80 h-8 w-8"
            aria-label="Delete provider"
            icon={
              isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2Icon />
              )
            }
          />
        </div>
      </div>

      {/* Details */}
      <div className="text-sm text-muted-foreground mt-1 space-y-1 pl-5">
        {needsKey && (
          <div>
            API Key:{" "}
            {provider.apiKeyId ? (
              apiKeyLinked ? (
                <span className="text-green-400">
                  {apiKeys.find((k) => k.id === provider.apiKeyId)?.name ||
                    "Linked (Unnamed Key)"}
                </span>
              ) : (
                <span className="text-destructive">Linked Key Missing!</span>
              )
            ) : (
              <span className="text-amber-400">Not Linked</span>
            )}
          </div>
        )}
        {needsURL && <div>Base URL: {provider.baseURL || "Not Set"}</div>}
        <div>
          Auto-fetch Models:{" "}
          {provider.autoFetchModels ? (
            <span className="text-green-400">Enabled</span>
          ) : (
            <span className="text-muted-foreground/80">Disabled</span>
          )}
          {provider.fetchedModels && (
            <span className="text-xs text-muted-foreground/80 ml-2">
              (Last fetched:{" "}
              {provider.modelsLastFetchedAt
                ? new Date(provider.modelsLastFetchedAt).toLocaleString()
                : "Never"}
              )
            </span>
          )}
        </div>
        {canFetch && (
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onFetchModels}
              disabled={isFetchButtonDisabled}
              className="text-xs h-7 px-2"
            >
              {fetchStatus === "fetching" && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              {fetchStatus === "success" && (
                <CheckIcon className="h-3 w-3 mr-1 text-green-500" />
              )}
              {fetchStatus === "error" && (
                <AlertCircleIcon className="h-3 w-3 mr-1 text-destructive" />
              )}
              {fetchStatus === "idle" && (
                <RefreshCwIcon className="h-3 w-3 mr-1" />
              )}
              {fetchStatus === "fetching"
                ? "Fetching..."
                : fetchStatus === "error"
                  ? "Fetch Failed"
                  : "Fetch Models Now"}
            </Button>
          </div>
        )}
      </div>

      {/* Model Enablement Section */}
      <div className="space-y-1 pt-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-card-foreground text-sm">
            Model Enablement ({enabledCount} / {availableCount} enabled)
          </span>
          <ActionTooltipButton
            tooltipText={isModelListFolded ? "Show Models" : "Hide Models"}
            onClick={toggleFold}
            aria-label={
              isModelListFolded ? "Show model list" : "Hide model list"
            }
            icon={isModelListFolded ? <ChevronDownIcon /> : <ChevronUpIcon />}
            className="h-6 w-6"
          />
        </div>
        {!isModelListFolded && (
          // Pass the model click handler to the list
          <ModelEnablementList
            providerId={provider.id}
            allAvailableModels={allAvailableModels} // Pass full model data
            enabledModelIds={enabledModelsSet}
            onToggleModel={handleModelToggle}
            isLoading={fetchStatus === "fetching"}
            disabled={isDeleting}
            listHeightClass="h-64"
            // Add the click handler prop
            onModelClick={handleModelClick}
          />
        )}
      </div>
    </div>
  );
};

export const ProviderRowViewMode = React.memo(ProviderRowViewModeComponent);
