// src/components/LiteChat/settings/ModelEnablementList.tsx

import React, { useState, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

interface ModelEnablementListProps {
  providerId: string;
  allAvailableModels: { id: string; name: string }[];
  enabledModelIds: Set<string>;
  onToggleModel: (modelId: string, isEnabled: boolean) => void;
  isLoading?: boolean;
  disabled?: boolean;
  listHeightClass?: string;
  onModelClick?: (modelId: string) => void;
}

export const ModelEnablementList: React.FC<ModelEnablementListProps> = ({
  providerId,
  allAvailableModels,
  enabledModelIds,
  onToggleModel,
  isLoading = false,
  disabled = false,
  listHeightClass = "h-48",
  onModelClick,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredModels = useMemo(() => {
    if (!searchQuery) return allAvailableModels;
    const query = searchQuery.toLowerCase();
    return allAvailableModels.filter(
      (model) =>
        model.name.toLowerCase().includes(query) ||
        model.id.toLowerCase().includes(query),
    );
  }, [allAvailableModels, searchQuery]);

  if (isLoading) {
    return (
      <div className={`space-y-2 ${listHeightClass}`}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (allAvailableModels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic pt-2">
        No models available for this provider. Try fetching models.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search models..."
        className="h-9 w-full text-xs"
        type="text"
      />
      <ScrollArea
        className={`${listHeightClass} w-full rounded-md border border-border p-3 bg-background/50`}
      >
        <div className="space-y-2">
          {filteredModels.map((model) => (
            <div
              key={model.id}
              className="flex items-center justify-between space-x-2 p-1.5 rounded hover:bg-muted/50"
            >
              <Label
                htmlFor={`enable-model-${providerId}-${model.id}`}
                className="text-sm font-normal text-card-foreground flex-grow cursor-pointer truncate"
                title={model.name || model.id}
                // Use onClick for the label to trigger model details
                onClick={
                  onModelClick ? () => onModelClick(model.id) : undefined
                }
              >
                {model.name || model.id}
              </Label>
              <div className="flex items-center flex-shrink-0 gap-1">
                {/* Info Button - Removed as Label is now clickable */}
                {/* Enable Switch */}
                <Switch
                  id={`enable-model-${providerId}-${model.id}`}
                  checked={enabledModelIds.has(model.id)}
                  onCheckedChange={(checked) =>
                    onToggleModel(model.id, checked)
                  }
                  disabled={disabled}
                  aria-label={`Enable model ${model.name || model.id}`}
                  // Prevent label click from toggling switch
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
