// src/components/LiteChat/settings/ModelDataDisplay.tsx
// FULL FILE
import React, { useMemo } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import {
  splitModelId,
  createAiModelConfig,
} from "@/lib/litechat/provider-helpers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BrainCircuitIcon,
  DollarSignIcon,
  FileTextIcon,
  ImageIcon,
  InfoIcon,
  LanguagesIcon,
  MaximizeIcon,
  PuzzleIcon,
  SearchIcon,
  Settings2Icon,
  TagIcon,
  UsersIcon,
} from "lucide-react";
import { CodeBlockRenderer } from "../common/CodeBlockRenderer";

interface ModelDataDisplayProps {
  modelId: string | null; // This is the combinedModelId
}

const DetailRow: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}> = ({ label, value, icon, className }) => (
  <TableRow className={className}>
    <TableCell className="font-medium py-1.5 px-3 w-1/3">
      <div className="flex items-center gap-2">
        {icon}
        {label}
      </div>
    </TableCell>
    <TableCell className="py-1.5 px-3 text-muted-foreground">{value}</TableCell>
  </TableRow>
);

const CapabilityBadge: React.FC<{
  supported: boolean;
  label: string;
  icon: React.ReactNode;
}> = ({ supported, label, icon }) => (
  <Badge
    variant={supported ? "default" : "outline"}
    className={`text-xs ${supported ? "bg-green-500/20 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-500/30" : "text-muted-foreground border-border/50"}`}
  >
    <div className="flex items-center gap-1">
      {icon}
      {label}
    </div>
  </Badge>
);

export const ModelDataDisplay: React.FC<ModelDataDisplayProps> = ({
  modelId: combinedModelId,
}) => {
  const { dbProviderConfigs, dbApiKeys, getAllAvailableModelDefsForProvider } =
    useProviderStore(
      useShallow((state) => ({
        dbProviderConfigs: state.dbProviderConfigs,
        dbApiKeys: state.dbApiKeys,
        getAllAvailableModelDefsForProvider:
          state.getAllAvailableModelDefsForProvider,
      })),
    );

  const modelData = useMemo(() => {
    if (!combinedModelId) return null;
    const { providerId, modelId: specificModelId } =
      splitModelId(combinedModelId);
    if (!providerId || !specificModelId) return null;

    const providerConfig = dbProviderConfigs.find((p) => p.id === providerId);
    if (!providerConfig) return null;

    // Get all models for this provider (these are OpenRouterModel type)
    const allProviderModels = getAllAvailableModelDefsForProvider(providerId);
    const modelDefinition = allProviderModels.find(
      (m) => m.id === specificModelId,
    );

    if (!modelDefinition) return null;

    // We can also create the AiModelConfig if needed for other properties,
    // but modelDefinition (OpenRouterModel) holds most of what we need.
    const apiKeyRecord = dbApiKeys.find(
      (k) => k.id === providerConfig.apiKeyId,
    );
    const aiModelConfig = createAiModelConfig(
      providerConfig,
      specificModelId,
      apiKeyRecord?.value,
    );

    return {
      definition: modelDefinition, // This is the OpenRouterModel
      config: aiModelConfig, // This is AiModelConfig (includes instance)
      providerName: providerConfig.name,
    };
  }, [
    combinedModelId,
    dbProviderConfigs,
    dbApiKeys,
    getAllAvailableModelDefsForProvider,
  ]);

  if (!combinedModelId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4">
        <InfoIcon className="h-5 w-5 mr-2" />
        Select a model from the list to view its details.
      </div>
    );
  }

  if (!modelData) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Could not load details for model ID: {combinedModelId}. It might have
          been removed or the provider configuration is missing.
        </AlertDescription>
      </Alert>
    );
  }

  const { definition: model, providerName } = modelData;
  const arch = model.architecture;
  const pricing = model.pricing;
  const topProvider = model.top_provider;

  const supportedParams = new Set(model.supported_parameters ?? []);
  const inputModalities = new Set(arch?.input_modalities ?? []);

  const capabilities = [
    {
      label: "Reasoning",
      supported: supportedParams.has("reasoning"),
      icon: <BrainCircuitIcon className="h-3 w-3" />,
    },
    {
      label: "Web Search",
      supported:
        supportedParams.has("web_search") ||
        supportedParams.has("web_search_options"),
      icon: <SearchIcon className="h-3 w-3" />,
    },
    {
      label: "Tools",
      supported: supportedParams.has("tools"),
      icon: <PuzzleIcon className="h-3 w-3" />,
    },
    {
      label: "Multimodal Input",
      supported: Array.from(inputModalities).some((mod) => mod !== "text"),
      icon: <ImageIcon className="h-3 w-3" />,
    },
  ];

  return (
    <ScrollArea className="h-full p-1">
      <div className="max-w-4xl mx-auto space-y-6 py-4 px-2">
        <div className="pb-4 border-b">
          <h2 className="text-2xl font-bold tracking-tight">{model.name}</h2>
          <p className="text-sm text-muted-foreground">
            Provider: {providerName} (ID: {model.id})
          </p>
          {model.description && (
            <p className="text-sm mt-2">{model.description}</p>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Capabilities</h3>
          <div className="flex flex-wrap gap-2">
            {capabilities.map((cap) => (
              <CapabilityBadge
                key={cap.label}
                supported={cap.supported}
                label={cap.label}
                icon={cap.icon}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Details</h3>
            <Table>
              <TableBody>
                <DetailRow
                  label="Context Length"
                  value={
                    model.context_length
                      ? model.context_length.toLocaleString()
                      : "N/A"
                  }
                  icon={<MaximizeIcon className="h-3.5 w-3.5" />}
                />
                {topProvider?.max_completion_tokens && (
                  <DetailRow
                    label="Max Completion Tokens"
                    value={topProvider.max_completion_tokens.toLocaleString()}
                    icon={<FileTextIcon className="h-3.5 w-3.5" />}
                  />
                )}
                <DetailRow
                  label="Tokenizer"
                  value={arch?.tokenizer || "N/A"}
                  icon={<TagIcon className="h-3.5 w-3.5" />}
                />
                <DetailRow
                  label="Input Modalities"
                  value={arch?.input_modalities?.join(", ") || "text (default)"}
                  icon={<ImageIcon className="h-3.5 w-3.5" />}
                />
                <DetailRow
                  label="Output Modalities"
                  value={
                    arch?.output_modalities?.join(", ") || "text (default)"
                  }
                  icon={<FileTextIcon className="h-3.5 w-3.5" />}
                />
                {arch?.instruct_type && (
                  <DetailRow
                    label="Instruct Type"
                    value={arch.instruct_type}
                    icon={<LanguagesIcon className="h-3.5 w-3.5" />}
                  />
                )}
                {topProvider && (
                  <DetailRow
                    label="Moderated"
                    value={topProvider.is_moderated ? "Yes" : "No"}
                    icon={<UsersIcon className="h-3.5 w-3.5" />}
                  />
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Pricing ($ / 1M tokens)</h3>
            {pricing ? (
              <Table>
                <TableBody>
                  <DetailRow
                    label="Prompt"
                    value={pricing.prompt || "N/A"}
                    icon={<DollarSignIcon className="h-3.5 w-3.5" />}
                  />
                  <DetailRow
                    label="Completion"
                    value={pricing.completion || "N/A"}
                    icon={<DollarSignIcon className="h-3.5 w-3.5" />}
                  />
                  {pricing.request && (
                    <DetailRow
                      label="Request (Fixed)"
                      value={pricing.request}
                      icon={<DollarSignIcon className="h-3.5 w-3.5" />}
                    />
                  )}
                  {pricing.image && (
                    <DetailRow
                      label="Image (Per Image)"
                      value={pricing.image}
                      icon={<ImageIcon className="h-3.5 w-3.5" />}
                    />
                  )}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pricing information not available.
              </p>
            )}
          </div>
        </div>

        {model.supported_parameters &&
          model.supported_parameters.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Supported Parameters</h3>
              <div className="flex flex-wrap gap-2">
                {model.supported_parameters.map((param) => (
                  <Badge key={param} variant="secondary" className="text-xs">
                    <Settings2Icon className="h-3 w-3 mr-1" />
                    {param}
                  </Badge>
                ))}
              </div>
            </div>
          )}

        {model.per_request_limits && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Per-Request Limits</h3>
            <CodeBlockRenderer
              lang="json"
              code={JSON.stringify(model.per_request_limits, null, 2)}
            />
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Raw Definition</h3>
          <CodeBlockRenderer
            lang="json"
            code={JSON.stringify(model, null, 2)}
          />
        </div>
      </div>
    </ScrollArea>
  );
};
