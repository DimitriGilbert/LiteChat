// src/components/LiteChat/settings/ModelDataDisplay.tsx
// FULL FILE
import React, { useMemo, useCallback } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { splitModelId } from "@/lib/litechat/provider-helpers";
import { Skeleton } from "@/components/ui/skeleton";

interface ModelDataDisplayProps {
  modelId: string | null; // Combined ID
}

const formatPrice = (priceStr: string | null | undefined): string => {
  if (!priceStr) return "N/A";
  const priceNum = parseFloat(priceStr);
  if (isNaN(priceNum)) return "N/A";
  return `$${(priceNum / 1000).toFixed(4)} / 1K tokens`;
};

const renderDetailRow = (
  label: string,
  value: React.ReactNode | string | number | null | undefined,
  isBadge: boolean = false,
  badgeVariant:
    | "default"
    | "secondary"
    | "destructive"
    | "outline" = "secondary",
) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  return (
    <TableRow>
      <TableCell className="font-medium text-xs w-1/3 py-1.5 px-3">
        {label}
      </TableCell>
      <TableCell className="text-xs py-1.5 px-3 break-all">
        {isBadge ? (
          <Badge variant={badgeVariant} className="text-xs">
            {String(value)}
          </Badge>
        ) : Array.isArray(value) ? (
          <div className="flex flex-wrap gap-1">
            {value.map((item, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {String(item)}
              </Badge>
            ))}
          </div>
        ) : (
          String(value)
        )}
      </TableCell>
    </TableRow>
  );
};

export const ModelDataDisplay: React.FC<ModelDataDisplayProps> = ({
  modelId: combinedModelId,
}) => {
  const {
    createAiModelConfig, // Use the action from the store
    dbProviderConfigs,
    dbApiKeys,
    updateProviderConfig,
    isLoading,
  } = useProviderStore(
    useShallow((state) => ({
      createAiModelConfig: state.createAiModelConfig,
      dbProviderConfigs: state.dbProviderConfigs,
      dbApiKeys: state.dbApiKeys,
      updateProviderConfig: state.updateProviderConfig,
      isLoading: state.isLoading,
    })),
  );

  const model = useMemo(() => {
    if (!combinedModelId) return undefined;
    const { providerId, modelId: simpleId } = splitModelId(combinedModelId);
    if (!providerId || !simpleId) return undefined;
    const config = dbProviderConfigs.find((p) => p.id === providerId);
    if (!config) return undefined;
    const apiKeyRecord = dbApiKeys.find((k) => k.id === config.apiKeyId);
    return createAiModelConfig(config, simpleId, apiKeyRecord?.value);
  }, [combinedModelId, dbProviderConfigs, dbApiKeys, createAiModelConfig]);

  const metadata = model?.metadata;

  const handleToggleModelEnabled = useCallback(async () => {
    if (!model || !combinedModelId) return;

    const { providerId, modelId: simpleModelId } =
      splitModelId(combinedModelId);
    if (!providerId || !simpleModelId) return;

    const providerConfig = dbProviderConfigs.find((p) => p.id === providerId);
    if (!providerConfig) {
      toast.error("Provider configuration not found.");
      return;
    }

    const currentEnabledSet = new Set(providerConfig.enabledModels ?? []);
    const isCurrentlyEnabled = currentEnabledSet.has(simpleModelId);

    if (isCurrentlyEnabled) {
      currentEnabledSet.delete(simpleModelId);
    } else {
      currentEnabledSet.add(simpleModelId);
    }
    const newEnabledModels = Array.from(currentEnabledSet);

    try {
      await updateProviderConfig(providerConfig.id, {
        enabledModels: newEnabledModels,
      });
      toast.success(
        `Model "${model.name}" ${!isCurrentlyEnabled ? "enabled" : "disabled"}.`,
      );
    } catch (error) {
      toast.error("Failed to update model status.");
    }
  }, [model, combinedModelId, dbProviderConfigs, updateProviderConfig]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-1 h-full flex flex-col">
        <Skeleton className="h-8 w-3/4 flex-shrink-0" />
        <Skeleton className="h-4 w-1/2 flex-shrink-0" />
        <div className="flex-grow space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!combinedModelId) {
    return (
      <div className="p-4 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
        <AlertCircleIcon className="mx-auto h-10 w-10 mb-2 text-amber-500" />
        <p className="text-sm">
          No model selected. Click a model in the "Configuration" or "Browse
          Models" tab to view its details.
        </p>
      </div>
    );
  }

  if (!model || !metadata) {
    return (
      <div className="p-4 text-center text-destructive h-full flex flex-col items-center justify-center">
        <AlertCircleIcon className="mx-auto h-10 w-10 mb-2" />
        <p className="text-sm">
          Details not available for model: {combinedModelId}. It might be
          misconfigured or no longer available.
        </p>
      </div>
    );
  }

  const { providerId, modelId: simpleModelId } = splitModelId(combinedModelId);
  const providerConfig = dbProviderConfigs.find((p) => p.id === providerId);
  const isModelEnabled =
    simpleModelId != null &&
    providerConfig?.isEnabled &&
    providerConfig?.enabledModels?.includes(simpleModelId) === true;

  return (
    <div className="space-y-4 p-1 h-full flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <h4 className="text-lg font-semibold text-card-foreground truncate">
          {model.name}
          <span className="text-sm text-muted-foreground ml-2">
            ({model.providerName})
          </span>
        </h4>
        <div className="flex items-center space-x-2">
          <Label
            htmlFor={`enable-details-${simpleModelId}`}
            className="text-xs"
          >
            {isModelEnabled ? "Enabled" : "Disabled"}
          </Label>
          <Switch
            id={`enable-details-${simpleModelId}`}
            checked={isModelEnabled}
            onCheckedChange={handleToggleModelEnabled}
            disabled={!providerConfig?.isEnabled}
            aria-label={`Enable model ${model.name}`}
          />
        </div>
      </div>
      {metadata.description && (
        <p className="text-xs text-muted-foreground flex-shrink-0">
          {metadata.description}
        </p>
      )}
      <ScrollArea className="flex-grow border rounded-md bg-background/30">
        <Table>
          <TableCaption className="py-2 text-xs">
            Model ID: {metadata.id}
          </TableCaption>
          <TableBody>
            {renderDetailRow(
              "Context Length",
              metadata.top_provider?.context_length ?? metadata.context_length,
            )}
            {renderDetailRow(
              "Max Completion Tokens",
              metadata.top_provider?.max_completion_tokens,
            )}
            {renderDetailRow(
              "Input Modalities",
              metadata.architecture?.input_modalities,
            )}
            {renderDetailRow(
              "Output Modalities",
              metadata.architecture?.output_modalities,
            )}
            {renderDetailRow(
              "Tokenizer",
              metadata.architecture?.tokenizer,
              true,
            )}
            {renderDetailRow(
              "Instruct Type",
              metadata.architecture?.instruct_type,
              true,
            )}
            {renderDetailRow(
              "Pricing (Prompt)",
              formatPrice(metadata.pricing?.prompt),
            )}
            {renderDetailRow(
              "Pricing (Completion)",
              formatPrice(metadata.pricing?.completion),
            )}
            {renderDetailRow(
              "Pricing (Image)",
              formatPrice(metadata.pricing?.image),
            )}
            {renderDetailRow(
              "Pricing (Request)",
              formatPrice(metadata.pricing?.request),
            )}
            {renderDetailRow(
              "Supported Parameters",
              metadata.supported_parameters,
            )}
            {renderDetailRow(
              "Moderated",
              metadata.top_provider?.is_moderated ? (
                <CheckCircle2Icon className="h-4 w-4 text-green-500" />
              ) : (
                "No"
              ),
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
};
