// src/hooks/use-api-keys-management.ts
import { useState, useCallback } from "react";
import { useChatStorage } from "./use-chat-storage";
import type { DbApiKey } from "@/lib/types";

interface UseApiKeysManagementReturn {
  apiKeys: DbApiKey[];
  selectedApiKeyId: Record<string, string | null>;
  setSelectedApiKeyId: (providerId: string, keyId: string | null) => void;
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  getApiKeyForProvider: (providerId: string) => string | undefined;
}

export function useApiKeysManagement(): UseApiKeysManagementReturn {
  // We only need the API key parts from useChatStorage here
  const {
    apiKeys,
    addApiKey: addDbApiKey,
    deleteApiKey: deleteDbApiKey,
  } = useChatStorage(null); // Pass null as we don't need conversation-specific data

  const [selectedApiKeyIdState, setSelectedApiKeyIdState] = useState<
    Record<string, string | null>
  >({});

  const setSelectedApiKeyId = useCallback(
    (providerId: string, keyId: string | null) => {
      setSelectedApiKeyIdState((prev) => ({ ...prev, [providerId]: keyId }));
    },
    [],
  );

  const addApiKey = useCallback(
    async (
      name: string,
      providerId: string,
      value: string,
    ): Promise<string> => {
      // Simple obfuscation for safety, not true encryption
      const keyToAdd = value;
      value = ""; // Clear original value immediately
      const newId = await addDbApiKey(name, providerId, keyToAdd);
      // Auto-select the newly added key
      setSelectedApiKeyId(providerId, newId);
      return newId;
    },
    [addDbApiKey, setSelectedApiKeyId],
  );

  const deleteApiKey = useCallback(
    async (id: string): Promise<void> => {
      const keyToDelete = apiKeys.find((k) => k.id === id);
      await deleteDbApiKey(id);
      // If the deleted key was selected, deselect it
      if (keyToDelete && selectedApiKeyIdState[keyToDelete.providerId] === id) {
        setSelectedApiKeyId(keyToDelete.providerId, null);
      }
    },
    [apiKeys, deleteDbApiKey, selectedApiKeyIdState, setSelectedApiKeyId],
  );

  const getApiKeyForProvider = useCallback(
    (providerId: string): string | undefined => {
      const selectedId = selectedApiKeyIdState[providerId];
      if (!selectedId) return undefined;
      // Find the key in the live query result
      return apiKeys.find((key) => key.id === selectedId)?.value;
    },
    [apiKeys, selectedApiKeyIdState],
  );

  return {
    apiKeys,
    selectedApiKeyId: selectedApiKeyIdState,
    setSelectedApiKeyId,
    addApiKey,
    deleteApiKey,
    getApiKeyForProvider,
  };
}
