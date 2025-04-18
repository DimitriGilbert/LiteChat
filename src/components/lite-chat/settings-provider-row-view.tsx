// src/components/lite-chat/settings-provider-row-view.tsx
import React from "react";
import type { DbProviderConfig, DbApiKey } from "@/lib/types";
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
  requiresApiKey,
  requiresBaseURL,
  supportsModelFetching,
} from "@/lib/litechat";

interface ProviderRowViewModeProps {
  provider: DbProviderConfig;
  apiKeys: DbApiKey[];
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onFetchModels: () => Promise<void>;
  fetchStatus: "idle" | "fetching" | "error" | "success";
  isDeleting: boolean;
  getAllAvailableModelDefs: () => { id: string; name: string }[];
}

export const ProviderRowViewMode: React.FC<ProviderRowViewModeProps> = ({
  provider,
  apiKeys,
  onEdit,
  onDelete,
  onFetchModels,
  fetchStatus,
  isDeleting,
  getAllAvailableModelDefs,
}) => {
  const needsKey = requiresApiKey(provider.type);
  const needsURL = requiresBaseURL(provider.type);
  const canFetch = supportsModelFetching(provider.type);
  const isFetchButtonDisabled = fetchStatus === "fetching" || isDeleting;
  const isEditButtonDisabled = isDeleting;
  const isDeleteButtonDisabled = isDeleting || fetchStatus === "fetching";

  const allAvailableModels = getAllAvailableModelDefs();
  const enabledModelsSet = new Set(provider.enabledModels ?? []);
  const orderedDisplayModels = (
    provider.modelSortOrder ??
    provider.enabledModels ??
    []
  )
    .map((modelId) => {
      if (!enabledModelsSet.has(modelId)) return null; // Only show enabled models
      const modelDef = allAvailableModels.find((m) => m.id === modelId);
      return { id: modelId, name: modelDef?.name || modelId };
    })
    .filter((m): m is { id: string; name: string } => m !== null);

  return (
    <div>
      {/* Provider Header: Name, Type, Status, Edit/Delete Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span
            className={`h-2 w-2 rounded-full ${provider.isEnabled ? "bg-green-500" : "bg-gray-500"}`}
          ></span>
          <h3 className="font-semibold text-lg text-white">{provider.name}</h3>
          <span className="text-sm text-gray-400">({provider.type})</span>
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            disabled={isEditButtonDisabled}
            aria-label="Edit provider"
          >
            <Edit2Icon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={isDeleteButtonDisabled}
            className="text-red-500 hover:text-red-400"
            aria-label="Delete provider"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2Icon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      {/* Provider Details: API Key, URL, Auto-fetch */}
      <div className="text-sm text-gray-400 mt-1 space-y-1">
        {needsKey && (
          <div>
            API Key:{" "}
            {provider.apiKeyId ? (
              <span className="text-green-400">
                {apiKeys.find((k) => k.id === provider.apiKeyId)?.name ||
                  "Linked"}
              </span>
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
            <span className="text-gray-500">Disabled</span>
          )}
        </div>
        {/* Display Ordered & Enabled Models List */}
        {orderedDisplayModels.length > 0 && (
          <div className="pt-1">
            <span className="font-medium text-gray-300">
              Enabled & Ordered Models ({orderedDisplayModels.length}):
            </span>
            <ScrollArea className="h-16 mt-1 rounded-md border border-gray-600 p-2 bg-gray-900 text-xs">
              {orderedDisplayModels.map((model) => (
                <div key={model.id}>{model.name}</div>
              ))}
            </ScrollArea>
          </div>
        )}
        {/* Display All Available Models List (if fetched or default) */}
        {allAvailableModels.length > 0 && (
          <div className="pt-1">
            <span className="font-medium text-gray-300">
              All Available Models ({allAvailableModels.length}):
            </span>
            <ScrollArea className="h-20 mt-1 rounded-md border border-gray-600 p-2 bg-gray-900 text-xs">
              {allAvailableModels
                .slice() // Create a copy before sorting
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((m) => (
                  <div key={m.id}>{m.name || m.id}</div>
                ))}
            </ScrollArea>
            {provider.fetchedModels && (
              <span className="text-xs text-gray-500">
                Last fetched:{" "}
                {provider.modelsLastFetchedAt
                  ? provider.modelsLastFetchedAt.toLocaleString()
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
              className="text-xs"
            >
              {fetchStatus === "fetching" && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              {fetchStatus === "success" && (
                <CheckIcon className="h-3 w-3 mr-1 text-green-500" />
              )}
              {fetchStatus === "error" && (
                <AlertCircleIcon className="h-3 w-3 mr-1 text-red-500" />
              )}
              {fetchStatus === "idle" && (
                <RefreshCwIcon className="h-3 w-3 mr-1" />
              )}
              {fetchStatus === "fetching" ? "Fetching..." : "Fetch Models Now"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
