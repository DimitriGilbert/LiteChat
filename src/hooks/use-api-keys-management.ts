// src/hooks/use-api-keys-management.ts
import { useState, useCallback } from "react";
import type { DbApiKey } from "@/lib/types";

// --- NEW: Props Interface ---
interface UseApiKeysManagementProps {
  apiKeys: DbApiKey[]; // Pass live array in
  addDbApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteDbApiKey: (id: string) => Promise<void>;
}

export interface UseApiKeysManagementReturn {
  // apiKeys: DbApiKey[]; // No longer returned, passed in
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

// --- MODIFIED: Accept props ---
export function useApiKeysManagement({
  apiKeys,
  addDbApiKey,
  deleteDbApiKey,
}: UseApiKeysManagementProps): UseApiKeysManagementReturn {
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
      const keyToAdd = value;
      value = ""; // Clear original value immediately
      // Use passed-in function
      const newId = await addDbApiKey(name, providerId, keyToAdd);
      setSelectedApiKeyId(providerId, newId);
      return newId;
    },
    [addDbApiKey, setSelectedApiKeyId], // Use passed-in function in dependency array
  );

  const deleteApiKey = useCallback(
    async (id: string): Promise<void> => {
      const keyToDelete = apiKeys.find((k) => k.id === id);
      // Use passed-in function
      await deleteDbApiKey(id);
      if (keyToDelete && selectedApiKeyIdState[keyToDelete.providerId] === id) {
        setSelectedApiKeyId(keyToDelete.providerId, null);
      }
    },
    [apiKeys, deleteDbApiKey, selectedApiKeyIdState, setSelectedApiKeyId], // Use passed-in function and apiKeys prop in dependency array
  );

  const getApiKeyForProvider = useCallback(
    (providerId: string): string | undefined => {
      const selectedId = selectedApiKeyIdState[providerId];
      if (!selectedId) return undefined;
      // Find the key in the passed-in live query result
      return apiKeys.find((key) => key.id === selectedId)?.value;
    },
    [apiKeys, selectedApiKeyIdState], // Use passed-in apiKeys prop in dependency array
  );

  return {
    // apiKeys, // No longer returned
    selectedApiKeyId: selectedApiKeyIdState,
    setSelectedApiKeyId,
    addApiKey,
    deleteApiKey,
    getApiKeyForProvider,
  };
}
