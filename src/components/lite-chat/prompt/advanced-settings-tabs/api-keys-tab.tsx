// src/components/lite-chat/prompt/advanced-settings-tabs/api-keys-tab.tsx
import React, { useMemo, useCallback } from "react";
import { ApiKeySelector } from "@/components/lite-chat/api-key-selector";
import { toast } from "sonner";
import type { DbProviderConfig } from "@/lib/types";
import { useProviderStore } from "@/store/provider.store";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useShallow } from "zustand/react/shallow";

export const ApiKeysTab: React.FC = () => {
  const { selectedProviderId, updateDbProviderConfig } = useProviderStore(
    useShallow((state) => ({
      selectedProviderId: state.selectedProviderId,
      updateDbProviderConfig: state.updateDbProviderConfig,
    })),
  );

  const { providerConfigs: dbProviderConfigs, apiKeys } = useChatStorage();

  const selectedDbProviderConfig = useMemo(() => {
    return (dbProviderConfigs || []).find(
      (p: DbProviderConfig) => p.id === selectedProviderId,
    );
  }, [dbProviderConfigs, selectedProviderId]);

  const handleApiKeySelectionChange = useCallback(
    (keyId: string | null) => {
      if (selectedDbProviderConfig) {
        updateDbProviderConfig(selectedDbProviderConfig.id, {
          apiKeyId: keyId,
        })
          .then(() => {
            toast.success(
              `API Key ${keyId ? "linked" : "unlinked"} for ${selectedDbProviderConfig.name}.`,
            );
          })
          .catch((err) => {
            console.error("Failed to update API key link", err);
            toast.error("Failed to update API key link.");
          });
      }
    },
    [selectedDbProviderConfig, updateDbProviderConfig],
  );

  return (
    <div className="mt-0">
      {selectedDbProviderConfig ? (
        <ApiKeySelector
          selectedKeyId={selectedDbProviderConfig.apiKeyId ?? null}
          onKeySelected={handleApiKeySelectionChange}
          apiKeys={apiKeys || []}
          disabled={!selectedDbProviderConfig}
        />
      ) : (
        <p className="text-xs text-gray-500">Select a provider first.</p>
      )}
      <p className="text-xs text-gray-400 mt-2">
        Select the API key to use for the current provider configuration. Manage
        all keys in the main Settings dialog (API Keys tab).
      </p>
    </div>
  );
};
