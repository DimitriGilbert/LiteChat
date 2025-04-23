
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
    // Initialize state using the function based on initial props/providers
    getEffectiveInitialProviderId,
  );

  const getInitialModelId = useCallback(
    (providerId: string | null) => {
      if (!providerId) return null;
      const provider = providers.find((p) => p.id === providerId);
      if (!provider) return null;

      // Check if the explicitly passed initialModelId is valid for the selected provider
      if (
        initialModelId &&
        provider.models.some((m) => m.id === initialModelId)
      ) {
        return initialModelId;
      }
      // Otherwise, default to the first model of the selected provider
      return provider.models[0]?.id ?? null;
    },
    [providers, initialModelId], // Depends on current providers and initial prop
  );

  const [selectedModelId, setSelectedModelId] = useState<string | null>(() =>
    // Initialize state using the function based on the initially selected provider
    getInitialModelId(getEffectiveInitialProviderId()),
  );

  // Memoize the selected provider object based on the ID
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId),
    [providers, selectedProviderId],
  );

  // Memoize the selected model object based on the provider and model ID
  const selectedModel = useMemo(
    () => selectedProvider?.models.find((m) => m.id === selectedModelId),
    [selectedProvider, selectedModelId],
  );

  // Effect 1: Handle changes in the available providers list
  // This ensures a valid provider is selected if the list changes or on initial load.
  useEffect(() => {
    const currentEffectiveProviderId = getEffectiveInitialProviderId();

    // Condition 1: Current selection is invalid OR no selection but there should be one.
    // This handles cases where the previously selected provider is removed or
    // when initializing and no provider was selected yet.
    if (
      (selectedProviderId && // If something IS selected...
        !providers.some((p) => p.id === selectedProviderId)) || // ...but it's NOT in the current list
      (!selectedProviderId && currentEffectiveProviderId) // OR if NOTHING is selected, but there IS an effective ID now
    ) {
      // Reset to the effective ID (initial or first available)
      setSelectedProviderId(currentEffectiveProviderId);
      // Also reset the model based on the new provider
      setSelectedModelId(getInitialModelId(currentEffectiveProviderId));
    }
    // --- REMOVED THE PROBLEMATIC else if BLOCK ---
    // The previous else if block incorrectly forced the selection back to
    // currentEffectiveProviderId even if the user had selected something else valid.
  }, [
    providers, // Re-run if the list of available providers changes
    selectedProviderId, // Re-run if the current selection changes (needed for the check)
    getEffectiveInitialProviderId, // Stable callback
    getInitialModelId, // Stable callback
    // Note: initialProviderId is implicitly handled by getEffectiveInitialProviderId dependency on `providers`
  ]);

  // Effect 2: Handle changes in the selected provider
  // This ensures a valid model is selected for the *currently* selected provider.
  useEffect(() => {
    if (selectedProvider) {
      // Check if the currently selected model ID is valid within the selected provider's models
      const currentModelIsValid =
        selectedModelId &&
        selectedProvider.models.some((m) => m.id === selectedModelId);

      // If the current model selection is not valid (or no model is selected)...
      if (!currentModelIsValid) {
select the first available model for the new provider.
        const firstModelId = selectedProvider.models[0]?.id ?? null;
        setSelectedModelId(firstModelId);
      }
      // If the current model IS valid, we don't need to do anything, leave it as is.
    } else {
      // If no provider is selected, ensure no model is selected either.
      if (selectedModelId !== null) {
        setSelectedModelId(null);
      }
    }
    // This effect should run ONLY when the selectedProvider object changes,
    // or potentially if selectedModelId changes externally (though less likely).
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
