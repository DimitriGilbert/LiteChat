// src/components/LiteChat/settings/SettingsProviderRowView.tsx
import React, { useMemo } from "react"; // Added useMemo
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Edit2Icon,
  Trash2Icon,
  Loader2,
  RefreshCwIcon,
  CheckIcon,
  AlertCircleIcon,
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
} from "@/lib/litechat/provider-helpers";
import { cn } from "@/lib/utils";
import { useProviderStore } from "@/store/provider.store"; // Import store

type FetchStatus = "idle" | "fetching" | "error" | "success";

interface ProviderRowViewModeProps {
  provider: DbProviderConfig;
  apiKeys: DbApiKey[];
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onFetchModels: () => Promise<void>;
  fetchStatus: FetchStatus;
  isDeleting: boolean;
}

const ProviderRowViewModeComponent: React.FC<ProviderRowViewModeProps> = ({
  provider,
  apiKeys,
  onEdit,
  onDelete,
  onFetchModels,
  fetchStatus,
  isDeleting,
}) => {
  const needsKey = requiresApiKey(provider.type);
  const needsURL = requiresBaseURL(provider.type);
  const canFetch = supportsModelFetching(provider.type);
  const isFetchButtonDisabled = fetchStatus === "fetching" || isDeleting;
  const isEditButtonDisabled = isDeleting || fetchStatus === "fetching";
  const isDeleteButtonDisabled = isDeleting || fetchStatus === "fetching";

  const getAllAvailableModelDefsForProvider = useProviderStore(
    (state) => state.getAllAvailableModelDefsForProvider,
  );
  const allAvailableModels = getAllAvailableModelDefsForProvider(provider.id);
  const enabledModelsSet = useMemo(
    () => new Set(provider.enabledModels ?? []),
    [provider.enabledModels],
  );

  // Display only the models enabled for this provider
  const enabledDisplayModels = useMemo(() => {
    return allAvailableModels
      .filter((m) => enabledModelsSet.has(m.id))
      .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id)); // Sort alphabetically for display here
  }, [allAvailableModels, enabledModelsSet]);

  const apiKeyLinked = provider.apiKeyId
    ? apiKeys.some((k) => k.id === provider.apiKeyId)
    : false;
  const showKeyWarning = needsKey && !apiKeyLinked;

  return (
    <div className="space-y-2">
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
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onEdit}
                  disabled={isEditButtonDisabled}
                  aria-label="Edit provider"
                  className="h-8 w-8"
                >
                  <Edit2Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Edit</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  disabled={isDeleteButtonDisabled}
                  className="text-destructive hover:text-destructive/80 h-8 w-8"
                  aria-label="Delete provider"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2Icon className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Delete</TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
        </div>

        {/* Enabled Models List */}
        {enabledDisplayModels.length > 0 && (
          <div className="pt-1">
            <span className="font-medium text-card-foreground">
              Enabled Models ({enabledDisplayModels.length}):
            </span>
            <ScrollArea className="h-16 mt-1 rounded-md border border-border p-2 bg-background/50 text-xs">
              {enabledDisplayModels.map(
                (model: { id: string; name: string }) => (
                  <div key={model.id} className="truncate" title={model.name}>
                    {model.name}
                  </div>
                ),
              )}
            </ScrollArea>
          </div>
        )}

        {/* All Available Models List */}
        {allAvailableModels.length > 0 && (
          <div className="pt-1">
            <span className="font-medium text-card-foreground">
              All Fetched Models ({allAvailableModels.length}):
            </span>
            <ScrollArea className="h-20 mt-1 rounded-md border border-border p-2 bg-background/50 text-xs">
              {allAvailableModels
                .slice()
                .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
                .map((m: { id: string; name?: string }) => (
                  <div key={m.id} className="truncate" title={m.name || m.id}>
                    {m.name || m.id}
                  </div>
                ))}
            </ScrollArea>
            {provider.fetchedModels && (
              <span className="text-xs text-muted-foreground/80">
                Last fetched:{" "}
                {provider.modelsLastFetchedAt
                  ? new Date(provider.modelsLastFetchedAt).toLocaleString()
                  : "Never"}
              </span>
            )}
          </div>
        )}

        {/* Fetch Models Button */}
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
    </div>
  );
};

export const ProviderRowViewMode = React.memo(ProviderRowViewModeComponent);
