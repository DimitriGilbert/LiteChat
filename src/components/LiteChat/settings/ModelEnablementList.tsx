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
  enabledModelIds: Set<string>; // Use a Set for efficient lookup
  onToggleModel: (modelId: string, isEnabled: boolean) => void;
  isLoading?: boolean; // Optional loading state
  disabled?: boolean; // Optional disabled state for switches
  listHeightClass?: string; // Allow customizing height
}

export const ModelEnablementList: React.FC<ModelEnablementListProps> = ({
  providerId,
  allAvailableModels,
  enabledModelIds,
  onToggleModel,
  isLoading = false,
  disabled = false,
  listHeightClass = "h-48", // Default height
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Filter models based on search query
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
              >
                {model.name || model.id}
              </Label>
              <Switch
                id={`enable-model-${providerId}-${model.id}`}
                checked={enabledModelIds.has(model.id)}
                onCheckedChange={(checked) => onToggleModel(model.id, checked)}
                className="flex-shrink-0"
                disabled={disabled}
                aria-label={`Enable model ${model.name || model.id}`}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
