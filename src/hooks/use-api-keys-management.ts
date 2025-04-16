// src/hooks/use-api-keys-management.ts
import { useCallback } from "react";
// import type { DbApiKey } from "@/lib/types";

// --- NEW: Props Interface ---
interface UseApiKeysManagementProps {
  // apiKeys: DbApiKey[]; // Pass live array in
  addDbApiKey: (
    name: string,
    providerId: string, // Keep for display/grouping? Or remove? Let's keep for now.
    value: string,
  ) => Promise<string>;
  deleteDbApiKey: (id: string) => Promise<void>;
}

export interface UseApiKeysManagementReturn {
  // selectedApiKeyId: Record<string, string | null>; // Keyed by DbProviderConfig.id
  // setSelectedApiKeyId: (providerConfigId: string, keyId: string | null) => void;
  addApiKey: (
    name: string,
    providerId: string, // Keep for now
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  // getApiKeyForProvider: (providerConfigId: string) => string | undefined; // REMOVED - Logic moved
}

// --- MODIFIED: Accept props ---
export function useApiKeysManagement({
  // apiKeys,
  addDbApiKey,
  deleteDbApiKey,
}: UseApiKeysManagementProps): UseApiKeysManagementReturn {
  // Selection state is now managed implicitly by DbProviderConfig.apiKeyId
  // const [selectedApiKeyIdState, setSelectedApiKeyIdState] = useState<
  //   Record<string, string | null>
  // >({});

  // const setSelectedApiKeyId = useCallback(
  //   (providerConfigId: string, keyId: string | null) => {
  //     setSelectedApiKeyIdState((prev) => ({ ...prev, [providerConfigId]: keyId }));
  //   },
  //   [],
  // );

  const addApiKey = useCallback(
    async (
      name: string,
      providerId: string, // Keep for now
      value: string,
    ): Promise<string> => {
      const keyToAdd = value;
      value = ""; // Clear original value immediately
      const newId = await addDbApiKey(name, providerId, keyToAdd);
      // No automatic selection needed here anymore
      return newId;
    },
    [addDbApiKey],
  );

  const deleteApiKey = useCallback(
    async (id: string): Promise<void> => {
      // Deletion logic in useChatStorage now handles unlinking from providerConfigs
      await deleteDbApiKey(id);
      // No need to update selection state here
    },
    [deleteDbApiKey],
  );

  // const getApiKeyForProvider = useCallback(
  //   (providerConfigId: string): string | undefined => {
  //     // This logic is now handled within ChatProvider using DbProviderConfig.apiKeyId
  //     console.warn("getApiKeyForProvider in useApiKeysManagement is deprecated.");
  //     return undefined;
  //   },
  //   [],
  // );

  return {
    // selectedApiKeyId: selectedApiKeyIdState,
    // setSelectedApiKeyId,
    addApiKey,
    deleteApiKey,
    // getApiKeyForProvider, // REMOVED
  };
}
