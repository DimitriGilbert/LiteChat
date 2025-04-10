// src/components/lite-chat/settings-api-keys.tsx
import React, { useState } from "react";
import { useChatContext } from "@/hooks/use-chat-context";
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
import { Trash2Icon, EyeIcon, EyeOffIcon, InfoIcon } from "lucide-react"; // Added InfoIcon
import { toast } from "sonner";

export const SettingsApiKeys: React.FC = () => {
  const {
    apiKeys,
    addApiKey,
    deleteApiKey,
    providers,
    enableApiKeyManagement, // <-- Get flag from context
  } = useChatContext();
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyProviderId, setNewKeyProviderId] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  // --- Conditional Rendering ---
  if (!enableApiKeyManagement) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2 bg-gray-800/30 rounded-md border border-dashed border-gray-700 min-h-[200px]">
        <InfoIcon className="h-5 w-5" />
        API Key Management is disabled in the configuration.
      </div>
    );
  }
  // --- End Conditional Rendering ---

  const handleAddKey = async (e: React.FormEvent) => {
    // ... (handleAddKey logic remains the same)
    e.preventDefault();
    if (!newKeyName.trim() || !newKeyValue.trim() || !newKeyProviderId) {
      toast.error("Please fill in all fields for the API key.");
      return;
    }
    setIsAdding(true);
    try {
      await addApiKey(newKeyName.trim(), newKeyProviderId, newKeyValue.trim());
      toast.success(`API Key "${newKeyName.trim()}" added.`);
      setNewKeyName("");
      setNewKeyValue("");
      setNewKeyProviderId("");
    } catch (error: unknown) {
      console.error("Failed to add API key:", error);
      if (error instanceof Error) {
        toast.error(`Failed to add API key: ${error.message}`);
      } else {
        toast.error(`Failed to add API key: ${String(error)}`);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteKey = async (id: string, name: string) => {
    // ... (handleDeleteKey logic remains the same)
    if (window.confirm(`Are you sure you want to delete the key "${name}"?`)) {
      try {
        await deleteApiKey(id);
        toast.success(`API Key "${name}" deleted.`);
        setShowValues((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } catch (error: unknown) {
        console.error("Failed to delete API key:", error);
        if (error instanceof Error) {
          toast.error(`Failed to delete API key: ${error.message}`);
        } else {
          toast.error(`Failed to delete API key: ${String(error)}`);
        }
      }
    }
  };

  const toggleShowValue = (id: string) => {
    // ... (toggleShowValue logic remains the same)
    setShowValues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getProviderName = (providerId: string) => {
    // ... (getProviderName logic remains the same)
    return providers.find((p) => p.id === providerId)?.name ?? providerId;
  };

  return (
    <div className="space-y-6 p-1">
      {/* Add New Key Form */}
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
            />
          </div>
          <div>
            <Label htmlFor="new-key-provider">Provider</Label>
            <Select
              value={newKeyProviderId}
              onValueChange={setNewKeyProviderId}
              required
            >
              <SelectTrigger id="new-key-provider" className="mt-1">
                <SelectValue placeholder="Select Provider" />
              </SelectTrigger>
              <SelectContent>
                {providers
                  .filter((p) => p.requiresApiKey !== false && p.id !== "mock")
                  .map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
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
            />
          </div>
        </div>
        <Button type="submit" disabled={isAdding}>
          {isAdding ? "Adding..." : "Add Key"}
        </Button>
      </form>

      {/* Existing Keys List */}
      <div>
        <h3 className="text-lg font-medium mb-2">Stored API Keys</h3>
        {apiKeys.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No API keys stored yet. Add one above.
          </p>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Key Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>{getProviderName(key.providerId)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">
                          {showValues[key.id] ? key.value : "••••••••••••••••"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleShowValue(key.id)}
                          className="h-6 w-6"
                          aria-label={
                            showValues[key.id] ? "Hide key" : "Show key"
                          }
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
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};
