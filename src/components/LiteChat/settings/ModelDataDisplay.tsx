// src/components/LiteChat/settings/ModelDataDisplay.tsx

import React, { useMemo } from "react";
import { useProviderStore } from "@/store/provider.store";
import { splitModelId } from "@/lib/litechat/provider-helpers";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ModelDataDisplayProps {
  modelId: string | null;
}

export const ModelDataDisplay: React.FC<ModelDataDisplayProps> = ({
  modelId: combinedModelId,
}) => {
  const { getProviderById, getAllAvailableModelDefsForProvider } =
    useProviderStore((state) => ({
      getProviderById: (id: string) =>
        state.dbProviderConfigs.find((p) => p.id === id),
      getAllAvailableModelDefsForProvider:
        state.getAllAvailableModelDefsForProvider,
    }));

  const modelData = useMemo(() => {
    if (!combinedModelId) return null;
    const { providerId, modelId } = splitModelId(combinedModelId);
    if (!providerId || !modelId) return null;

    const provider = getProviderById(providerId);
    if (!provider) return null;

    const allModels = getAllAvailableModelDefsForProvider(providerId);
    const model = allModels.find((m) => m.id === modelId);

    return model ? { ...model, providerName: provider.name } : null;
  }, [combinedModelId, getProviderById, getAllAvailableModelDefsForProvider]);

  if (!modelData) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Select a model from a provider's list to view its details.
      </div>
    );
  }

  const formatPrice = (priceStr: string | null | undefined): string => {
    if (!priceStr) return "N/A";
    const price = parseFloat(priceStr);
    if (isNaN(price) || price === 0) return "Free";
    return `$${price.toFixed(4)} / 1M tokens`;
  };

  const formatContext = (length: number | null | undefined): string => {
    if (!length) return "Unknown";
    return `${length.toLocaleString()} tokens`;
  };

  return (
    <ScrollArea className="h-full p-1">
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">
          {modelData.name}{" "}
          <span className="text-sm text-muted-foreground">
            ({modelData.providerName})
          </span>
        </h3>
        <p className="text-sm text-muted-foreground">{modelData.id}</p>

        {modelData.description && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p>{modelData.description}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1 border p-3 rounded-md bg-muted/30">
            <h4 className="font-medium mb-1">Context & Limits</h4>
            <p>
              <span className="font-semibold">Context Length:</span>{" "}
              {formatContext(
                modelData.top_provider?.context_length ??
                  modelData.context_length,
              )}
            </p>
            <p>
              <span className="font-semibold">Max Completion Tokens:</span>{" "}
              {modelData.top_provider?.max_completion_tokens
                ? modelData.top_provider.max_completion_tokens.toLocaleString()
                : "Default"}
            </p>
            {modelData.per_request_limits && (
              <p>
                <span className="font-semibold">Request Limits:</span>{" "}
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(modelData.per_request_limits, null, 2)}
                </pre>
              </p>
            )}
          </div>

          <div className="space-y-1 border p-3 rounded-md bg-muted/30">
            <h4 className="font-medium mb-1">Pricing (per 1M tokens)</h4>
            <p>
              <span className="font-semibold">Prompt:</span>{" "}
              {formatPrice(modelData.pricing?.prompt)}
            </p>
            <p>
              <span className="font-semibold">Completion:</span>{" "}
              {formatPrice(modelData.pricing?.completion)}
            </p>
            {modelData.pricing?.request &&
              parseFloat(modelData.pricing.request) > 0 && (
                <p>
                  <span className="font-semibold">Request:</span> $
                  {parseFloat(modelData.pricing.request).toFixed(6)}
                </p>
              )}
            {modelData.pricing?.image &&
              parseFloat(modelData.pricing.image) > 0 && (
                <p>
                  <span className="font-semibold">Image:</span> $
                  {parseFloat(modelData.pricing.image).toFixed(6)}
                </p>
              )}
          </div>

          <div className="space-y-1 border p-3 rounded-md bg-muted/30 md:col-span-2">
            <h4 className="font-medium mb-1">Architecture</h4>
            <p>
              <span className="font-semibold">Modality:</span>{" "}
              {modelData.architecture?.modality ?? "Unknown"}
            </p>
            <p>
              <span className="font-semibold">Input Modalities:</span>{" "}
              {modelData.architecture?.input_modalities?.join(", ") ??
                "Unknown"}
            </p>
            <p>
              <span className="font-semibold">Output Modalities:</span>{" "}
              {modelData.architecture?.output_modalities?.join(", ") ??
                "Unknown"}
            </p>
            <p>
              <span className="font-semibold">Tokenizer:</span>{" "}
              {modelData.architecture?.tokenizer ?? "Unknown"}
            </p>
            <p>
              <span className="font-semibold">Instruct Type:</span>{" "}
              {modelData.architecture?.instruct_type ?? "N/A"}
            </p>
          </div>

          <div className="space-y-1 border p-3 rounded-md bg-muted/30 md:col-span-2">
            <h4 className="font-medium mb-1">Supported Parameters</h4>
            <div className="flex flex-wrap gap-1">
              {modelData.supported_parameters &&
              modelData.supported_parameters.length > 0 ? (
                modelData.supported_parameters.map((param) => (
                  <Badge key={param} variant="secondary">
                    {param}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground italic">
                  None specified
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
