// src/hooks/use-provider-model-selection.ts
import { useState, useEffect, useMemo } from "react";
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
  // Determine the effective initial provider ID
  const getEffectiveInitialProviderId = () => {
    if (
      initialProviderId &&
      providers.some((p) => p.id === initialProviderId)
    ) {
      return initialProviderId; // Use valid initial ID
    }
    if (providers.length > 0) {
      return providers[0].id; // Fallback to first provider if initial is invalid or null
    }
    return null; // No providers, initial is null
  };

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    getEffectiveInitialProviderId, // Initialize state based on logic
  );

  // Determine initial model based on the *effective* initial provider
  const getInitialModelId = (providerId: string | null) => {
    if (!providerId) return null;
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return null;

    // If an initialModelId was provided AND it's valid for the initial provider
    if (
      initialModelId &&
      provider.models.some((m) => m.id === initialModelId)
    ) {
      return initialModelId;
    }
    // Otherwise, use the first model of the initial provider
    return provider.models[0]?.id ?? null;
  };

  const [selectedModelId, setSelectedModelId] = useState<string | null>(() =>
    getInitialModelId(selectedProviderId),
  ); // Initialize model based on initial provider

  // Memoize selected provider/model based on current state
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId),
    [providers, selectedProviderId],
  );

  const selectedModel = useMemo(
    () => selectedProvider?.models.find((m) => m.id === selectedModelId),
    [selectedProvider, selectedModelId],
  );

  // Effect 1: Handle changes in the providers list affecting the selected provider
  useEffect(() => {
    // If the currently selected provider ID is no longer valid in the new list...
    if (
      selectedProviderId &&
      !providers.some((p) => p.id === selectedProviderId)
    ) {
      // ...select the first available provider, or null if the list is empty.
      const newProviderId = providers.length > 0 ? providers[0].id : null;
      // console.log(`[Effect 1] Invalid provider ${selectedProviderId}, switching to ${newProviderId}`);
      setSelectedProviderId(newProviderId);
    }
    // This effect ONLY reacts to the providers list changing.
  }, [providers, selectedProviderId]); // Keep selectedProviderId here to react to invalidation

  // Effect 2: Handle model selection based on the current selectedProvider
  useEffect(() => {
    if (selectedProvider) {
      // Check if the current model ID is valid for the *current* provider
      const currentModelIsValid =
        selectedModelId &&
        selectedProvider.models.some((m) => m.id === selectedModelId);

      if (!currentModelIsValid) {
        // If model is null or invalid, select the first model of the *current* provider
        const firstModelId = selectedProvider.models[0]?.id ?? null;
        // console.log(`[Effect 2] Auto-selecting first model for ${selectedProvider.id}: ${firstModelId}`);
        setSelectedModelId(firstModelId);
      }
      // If model is already valid, do nothing.
    } else {
      // No provider is selected (selectedProviderId is null), ensure model is also null.
      if (selectedModelId !== null) {
        // console.log('[Effect 2] Clearing model ID because no provider selected.');
        setSelectedModelId(null);
      }
    }
    // This effect reacts to the derived selectedProvider changing, or if the model ID changes externally.
  }, [selectedProvider, selectedModelId]); // Removed 'providers' dependency here, handled by Effect 1

  return {
    selectedProviderId,
    setSelectedProviderId,
    selectedModelId,
    setSelectedModelId,
    selectedProvider,
    selectedModel,
  };
}
