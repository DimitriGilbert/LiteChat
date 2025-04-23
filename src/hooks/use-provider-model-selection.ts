import { useState, useEffect, useMemo, useCallback } from "react";
import type { AiProviderConfig, AiModelConfig } from "@/lib/types";

interface UseProviderModelSelectionProps {
  providers: AiProviderConfig[];
  initialProviderId?: string | null;
  initialModelId?: string | null;
}

interface UseProviderModelSelectionReturn {
  selectedProviderId: string | null;
  setSelectedProviderId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedModelId: string | null;
  setSelectedModelId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedProvider: AiProviderConfig | undefined;
  selectedModel: AiModelConfig | undefined;
}

export function useProviderModelSelection({
  providers,
  initialProviderId = null,
  initialModelId = null,
}: UseProviderModelSelectionProps): UseProviderModelSelectionReturn {
  const getEffectiveInitialProviderId = useCallback(() => {
    // Check if the explicitly passed initialProviderId is valid within the current providers
    if (
      initialProviderId &&
      providers.some((p) => p.id === initialProviderId)
    ) {
      return initialProviderId;
    }
    // Otherwise, default to the first provider in the list if available
    if (providers.length > 0) {
      return providers[0].id;
    }
    // Otherwise, no provider can be selected initially
    return null;
  }, [providers, initialProviderId]); // Depends on the current list and the initial prop

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    getEffectiveInitialProviderId,
  );

  const getInitialModelId = useCallback(
    (providerId: string | null) => {
      if (!providerId) return null;
      const provider = providers.find((p) => p.id === providerId);
      if (!provider) return null;

      if (
        initialModelId &&
        provider.models.some((m) => m.id === initialModelId)
      ) {
        return initialModelId;
      }
      return provider.models[0]?.id ?? null;
    },
    [providers, initialModelId],
  );

  const [selectedModelId, setSelectedModelId] = useState<string | null>(() =>
    getInitialModelId(getEffectiveInitialProviderId()),
  );

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId),
    [providers, selectedProviderId],
  );

  const selectedModel = useMemo(
    () => selectedProvider?.models.find((m) => m.id === selectedModelId),
    [selectedProvider, selectedModelId],
  );
  useEffect(() => {
    const currentEffectiveProviderId = getEffectiveInitialProviderId();
    if (
      (selectedProviderId &&
        !providers.some((p) => p.id === selectedProviderId)) ||
      (!selectedProviderId && currentEffectiveProviderId)
    ) {
      setSelectedProviderId(currentEffectiveProviderId);
      setSelectedModelId(getInitialModelId(currentEffectiveProviderId));
    }
  }, [
    providers,
    selectedProviderId,
    getEffectiveInitialProviderId,
    getInitialModelId,
  ]);

  useEffect(() => {
    if (selectedProviderId && selectedProvider) {
      const currentModelIsValid = selectedProvider.models.some(
        (m) => m.id === selectedModelId,
      );

      if (!currentModelIsValid) {
        const firstModelId = selectedProvider.models[0]?.id ?? null;
        console.log(
          `[useProviderModelSelection] Auto-selecting first model for new provider ${selectedProviderId}: ${firstModelId}`,
        );
        setSelectedModelId(firstModelId);
      }
    } else if (!selectedProviderId) {
      // If provider is deselected, deselect model too
      setSelectedModelId(null);
    }
    // Depend only on selectedProviderId to re-run this check
  }, [selectedProviderId, selectedProvider, selectedModelId]);

  return {
    selectedProviderId,
    setSelectedProviderId,
    selectedModelId,
    setSelectedModelId,
    selectedProvider,
    selectedModel,
  };
}
