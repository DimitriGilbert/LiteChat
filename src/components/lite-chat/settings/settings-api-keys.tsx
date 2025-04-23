// src/components/lite-chat/settings/settings-api-keys.tsx
import React, { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trash2Icon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { DbProviderConfig, DbApiKey } from "@/lib/types";
import { useShallow } from "zustand/react/shallow";
import { useProviderStore } from "@/store/provider.store";
import { useChatStorage } from "@/hooks/use-chat-storage"; // Import storage hook

const SettingsApiKeysComponent: React.FC = () => {
  // --- Fetch actions and flag from store ---
  const { addApiKey, deleteApiKey, enableApiKeyManagement } = useProviderStore(
    useShallow((state) => ({
      addApiKey: state.addApiKey, // Action remains
      deleteApiKey: state.deleteApiKey, // Action remains
      enableApiKeyManagement: state.enableApiKeyManagement,
    })),
  );

  // Fetch live data from storage
  const { apiKeys, providerConfigs: dbProviderConfigs } = useChatStorage(); // Use storage hook

  // Local UI state remains
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyProviderType, setNewKeyProviderType] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const handleAddKey = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newKeyName.trim() || !newKeyValue.trim() || !newKeyProviderType) {
        toast.error("Please fill in all fields for the API key.");
        return;
      }
      setIsAdding(true);
      try {
        // Call store action which now only interacts with DB
        await addApiKey(
          newKeyName.trim(),
          newKeyProviderType,
          newKeyValue.trim(),
        );
        setNewKeyName("");
        setNewKeyValue("");
        setNewKeyProviderType("");
      } catch (error: unknown) {
        // Error toast handled by action
        console.error("Failed to add API key (from component):", error);
      } finally {
        setIsAdding(false);
      }
    },
    [addApiKey, newKeyName, newKeyValue, newKeyProviderType],
  );

  const handleDeleteKey = useCallback(
    async (id: string, name: string) => {
      if (
        window.confirm(
          `Are you sure you want to delete the API key "${name}"? This will also unlink it from any providers using it. This action cannot be undone.`,
        )
      ) {
        setIsDeleting((prev) => ({ ...prev, [id]: true }));
        try {
          // Call store action which now only interacts with DB
          await deleteApiKey(id);
          setShowValues((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        } catch (error: unknown) {
          // Error toast handled by action
          console.error("Failed to delete API key (from component):", error);
        } finally {
          // Ensure loading state is reset even if delete fails
          setIsDeleting((prev) => ({ ...prev, [id]: false }));
        }
      }
    },
    [deleteApiKey],
  );

  // Derivations use live data from storage
  const linkedProviderNames = useMemo(() => {
    const map = new Map<string, string>();
    (apiKeys || []).forEach((key: DbApiKey) => {
      const linkedConfigs = (dbProviderConfigs || []).filter(
        (config: DbProviderConfig) => config.apiKeyId === key.id,
      );
      map.set(
        key.id,
        linkedConfigs.length === 0
          ? "Not linked"
          : linkedConfigs.map((c: DbProviderConfig) => c.name).join(", "),
      );
    });
    return map;
  }, [apiKeys, dbProviderConfigs]); // Depend on live data

  if (!enableApiKeyManagement) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2 bg-gray-800/30 rounded-md border border-dashed border-gray-700 min-h-[200px]">
        <InfoIcon className="h-5 w-5" />
        API Key Management is disabled in the configuration.
      </div>
    );
  }

  const toggleShowValue = (id: string) => {
    setShowValues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getKeyTypeLabel = (providerIdOrType: string): string => {
    const knownTypes = [
      "openai",
      "google",
      "openrouter",
      "ollama",
      "openai-compatible",
    ];
    return knownTypes.includes(providerIdOrType)
      ? providerIdOrType
      : "Unknown/Custom";
  };

  return (
    <div className="space-y-6 p-1">
      {/* Add Key Form */}
      <form onSubmit={handleAddKey} className="space-y-4">
        <h3 className="text-lg font-medium mb-2">Add New API Key</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="new-key-name">Name</Label>
            <Input
              id="new-key-name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., My Personal Key"
              required
              className="mt-1"
              disabled={isAdding}
            />
          </div>
          <div>
            <Label htmlFor="new-key-provider-type">
              Intended Provider Type
            </Label>
            <Select
              value={newKeyProviderType}
              onValueChange={setNewKeyProviderType}
              required
              disabled={isAdding}
            >
              <SelectTrigger id="new-key-provider-type" className="mt-1">
                <SelectValue placeholder="Select Type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="openai-compatible">
                  OpenAI-Compatible
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="new-key-value">API Key Value</Label>
            <Input
              id="new-key-value"
              type="password"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder="Paste your API key here"
              required
              className="mt-1"
              disabled={isAdding}
            />
          </div>
        </div>
        <Button type="submit" disabled={isAdding}>
          {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isAdding ? "Adding..." : "Add Key"}
        </Button>
      </form>

      {/* Stored Keys Table */}
      <div>
        <h3 className="text-lg font-medium mb-2">Stored API Keys</h3>
        {(apiKeys || []).length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No API keys stored yet. Add one above. Link keys to providers in the
            'Providers' tab.
          </p>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>Key Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(apiKeys || []).map((key: DbApiKey) => {
                  const isKeyDeleting = isDeleting[key.id];
                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>{getKeyTypeLabel(key.providerId)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {linkedProviderNames.get(key.id) ?? "Not linked"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">
                            {showValues[key.id]
                              ? key.value
                              : "••••••••••••••••"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleShowValue(key.id)}
                            className="h-6 w-6"
                            aria-label={
                              showValues[key.id] ? "Hide key" : "Show key"
                            }
                            disabled={isKeyDeleting}
                          >
                            {showValues[key.id] ? (
                              <EyeOffIcon className="h-4 w-4" />
                            ) : (
                              <EyeIcon className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteKey(key.id, key.name)}
                          className="text-red-600 hover:text-red-700 h-8 w-8"
                          aria-label={`Delete key ${key.name}`}
                          disabled={isKeyDeleting}
                        >
                          {isKeyDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2Icon className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export const SettingsApiKeys = React.memo(SettingsApiKeysComponent);
