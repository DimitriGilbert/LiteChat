// src/hooks/use-provider-model-selection.ts
import { useState, useEffect, useMemo, useCallback } from "react";
import type { AiProviderConfig, AiModelConfig } from "@/lib/types";

interface UseProviderModelSelectionProps {
  /** Array of currently active/available provider configurations. */
  providers: AiProviderConfig[];
  /** Optional initial provider ID to select. */
  initialProviderId?: string | null;
  /** Optional initial model ID to select (only used if initialProviderId is also set and valid). */
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
  // --- State Initialization ---

  // Function to determine the effective initial provider ID based on props and available providers
  const getEffectiveInitialProviderId = useCallback(() => {
    // 1. Check if the explicitly passed initialProviderId is valid within the current providers
    if (
      initialProviderId &&
      providers.some((p) => p.id === initialProviderId)
    ) {
      return initialProviderId;
    }
    // 2. Otherwise, default to the first provider in the list if available
    if (providers.length > 0) {
      return providers[0].id;
    }
    // 3. Otherwise, no provider can be selected initially
    return null;
  }, [providers, initialProviderId]); // Dependencies: providers list and initial prop

  // Initialize provider state using the function above
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    getEffectiveInitialProviderId,
  );

  // Function to determine the initial model ID based on the selected provider
  const getInitialModelId = useCallback(
    (providerId: string | null): string | null => {
      if (!providerId) return null; // No provider, no model

      const provider = providers.find((p) => p.id === providerId);
      if (!provider || !provider.models || provider.models.length === 0) {
        return null; // Provider not found or has no models
      }

      // 1. Check if the explicitly passed initialModelId is valid for the *selected* provider
      if (
        initialModelId &&
        provider.models.some((m) => m.id === initialModelId)
      ) {
        return initialModelId;
      }
      // 2. Otherwise, default to the first model of the selected provider
      return provider.models[0]?.id ?? null; // Use optional chaining
    },
    [providers, initialModelId], // Dependencies: providers list and initial prop
  );

  // Initialize model state using the provider state and the function above
  const [selectedModelId, setSelectedModelId] = useState<string | null>(() =>
    getInitialModelId(getEffectiveInitialProviderId()),
  );

  // --- Derived State ---

  // Memoize the selected provider object based on the ID
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId),
    [providers, selectedProviderId], // Recalculate only if providers or selected ID change
  );

  // Memoize the selected model object based on the provider and model ID
  const selectedModel = useMemo(
    () => selectedProvider?.models.find((m) => m.id === selectedModelId),
    [selectedProvider, selectedModelId], // Recalculate only if provider object or model ID change
  );

  // --- Effects for Synchronization ---

  // Effect 1: Ensure a provider is selected if possible, handling changes in the providers list
  useEffect(() => {
    const currentEffectiveProviderId = getEffectiveInitialProviderId();
    const isCurrentSelectionValid =
      selectedProviderId && providers.some((p) => p.id === selectedProviderId);

    // If the current selection is invalid OR no provider is selected but one is available
    if (
      !isCurrentSelectionValid ||
      (!selectedProviderId && currentEffectiveProviderId)
    ) {
      console.log(
        `[useProviderModelSelection] Sync Effect 1: Updating provider selection to ${currentEffectiveProviderId}`,
      );
      setSelectedProviderId(currentEffectiveProviderId);
      // Also reset the model when the provider changes automatically
      setSelectedModelId(getInitialModelId(currentEffectiveProviderId));
    }
    // This effect runs when the available providers change or the initial prop changes
  }, [
    providers,
    selectedProviderId,
    getEffectiveInitialProviderId,
    getInitialModelId,
  ]);

  // Effect 2: Ensure a valid model is selected for the *currently selected* provider
  useEffect(() => {
    // Only run if a provider is actually selected
    if (selectedProviderId && selectedProvider) {
      const currentModelIsValid = selectedProvider.models.some(
        (m) => m.id === selectedModelId,
      );

      // If the current model ID is not valid for the selected provider
      if (!currentModelIsValid) {
        // Select the first available model for this provider
        const firstModelId = selectedProvider.models[0]?.id ?? null;
        console.log(
          `[useProviderModelSelection] Sync Effect 2: Auto-selecting first model for provider ${selectedProviderId}: ${firstModelId}`,
        );
        setSelectedModelId(firstModelId);
      }
    } else if (!selectedProviderId) {
      // If no provider is selected, ensure no model is selected either
      if (selectedModelId !== null) {
        console.log(
          "[useProviderModelSelection] Sync Effect 2: Clearing model selection as provider is null.",
        );
        setSelectedModelId(null);
      }
    }
    // This effect runs when the selected provider (object) or selected model ID changes
  }, [selectedProviderId, selectedProvider, selectedModelId]);

  // --- Return Value ---
  return {
    selectedProviderId,
    setSelectedProviderId,
    selectedModelId,
    setSelectedModelId,
    selectedProvider,
    selectedModel,
  };
}
