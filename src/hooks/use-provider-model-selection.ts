// src/hooks/use-provider-model-selection.ts
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
    if (
      initialProviderId &&
      providers.some((p) => p.id === initialProviderId)
    ) {
      return initialProviderId;
    }
    if (providers.length > 0) {
      return providers[0].id;
    }
    return null;
  }, [providers, initialProviderId]);

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
    } else if (selectedProviderId !== currentEffectiveProviderId) {
      setSelectedProviderId(currentEffectiveProviderId);
      setSelectedModelId(getInitialModelId(currentEffectiveProviderId));
    }
  }, [
    providers,
    selectedProviderId,
    getEffectiveInitialProviderId,
    getInitialModelId,
    initialProviderId,
  ]);

  useEffect(() => {
    if (selectedProvider) {
      const currentModelIsValid =
        selectedModelId &&
        selectedProvider.models.some((m) => m.id === selectedModelId);

      if (!currentModelIsValid) {
        const firstModelId = selectedProvider.models[0]?.id ?? null;
        setSelectedModelId(firstModelId);
      }
    } else {
      if (selectedModelId !== null) {
        setSelectedModelId(null);
      }
    }
  }, [selectedProvider, selectedModelId]);

  return {
    selectedProviderId,
    setSelectedProviderId,
    selectedModelId,
    setSelectedModelId,
    selectedProvider,
    selectedModel,
  };
}
