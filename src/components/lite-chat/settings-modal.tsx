import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatContext } from "@/context/chat-context";
import { Trash2Icon, PlusCircleIcon, KeyIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Assuming shadcn/ui Alert

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    providers,
    apiKeys,
    addApiKey,
    deleteApiKey,
    selectedApiKeyId,
    setSelectedApiKeyId,
    // Add settings state later
    // theme, setTheme, systemPrompt, setSystemPrompt, ...
  } = useChatContext();

  // Local state for the "Add New Key" form
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyProviderId, setNewKeyProviderId] = useState<string>("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Reset form when modal opens/closes or provider list changes
  useEffect(() => {
    if (isOpen) {
      setNewKeyName("");
      setNewKeyProviderId(providers[0]?.id ?? ""); // Default to first provider
      setNewKeyValue("");
      setIsAdding(false);
    }
  }, [isOpen, providers]);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || !newKeyProviderId || !newKeyValue.trim()) {
      alert("Please fill in all fields for the new API key.");
      return;
    }
    try {
      await addApiKey(newKeyName.trim(), newKeyProviderId, newKeyValue.trim());
      // Clear sensitive value from state immediately after passing
      setNewKeyValue("");
      setNewKeyName("");
      // Keep provider selected? Or reset? Resetting might be safer.
      setNewKeyProviderId(providers[0]?.id ?? "");
      setIsAdding(false); // Hide form after adding
    } catch (error) {
      console.error("Failed to add API key:", error);
      alert(`Error adding API key: ${error}`);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this API key?")) {
      try {
        await deleteApiKey(id);
      } catch (error) {
        console.error("Failed to delete API key:", error);
        alert(`Error deleting API key: ${error}`);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage API keys and other preferences.
          </DialogDescription>
        </DialogHeader>

        {/* API Key Management Section */}
        <div className="py-4 space-y-4">
          <h3 className="text-lg font-semibold mb-2">API Keys</h3>
          <Alert variant="destructive">
            <KeyIcon className="h-4 w-4" />
            <AlertTitle>Security Warning</AlertTitle>
            <AlertDescription>
              API keys are stored locally in your browser's IndexedDB. While
              convenient, this is less secure than server-side storage. Anyone
              with access to your browser could potentially extract these keys.
              Use with caution and consider the risks. Do not use keys with
              broad permissions or spending limits in production environments.
            </AlertDescription>
          </Alert>

          <Separator />

          <div className="space-y-3">
            <Label>Saved Keys</Label>
            <ScrollArea className="h-[150px] border rounded-md p-2">
              {apiKeys.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No API keys saved yet.
                </p>
              )}
              {apiKeys.map((key) => {
                const providerName =
                  providers.find((p) => p.id === key.providerId)?.name ??
                  key.providerId;
                const isSelected = selectedApiKeyId[key.providerId] === key.id;
                return (
                  <div
                    key={key.id}
                    className="flex items-center justify-between gap-2 p-2 hover:bg-muted/50 rounded"
                  >
                    <div className="flex-grow flex items-center gap-2">
                      <input
                        type="radio"
                        id={`select-key-${key.id}`}
                        name={`select-key-${key.providerId}`}
                        checked={isSelected}
                        onChange={() =>
                          setSelectedApiKeyId(key.providerId, key.id)
                        }
                        className="form-radio h-4 w-4 text-primary focus:ring-primary"
                        aria-label={`Select key ${key.name} for ${providerName}`}
                      />
                      <label
                        htmlFor={`select-key-${key.id}`}
                        className="text-sm cursor-pointer"
                      >
                        <span className="font-medium">{key.name}</span>
                        <span className="text-muted-foreground ml-2">
                          ({providerName})
                        </span>
                      </label>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteKey(key.id)}
                      aria-label={`Delete key ${key.name}`}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </ScrollArea>
            {/* Button to deselect key for a provider (optional) */}
            {/* Consider adding a "None" option per provider */}
          </div>

          {!isAdding && (
            <Button variant="outline" onClick={() => setIsAdding(true)}>
              <PlusCircleIcon className="mr-2 h-4 w-4" /> Add New API Key
            </Button>
          )}

          {isAdding && (
            <form
              onSubmit={handleAddKey}
              className="border p-4 rounded-md space-y-3"
            >
              <h4 className="font-medium">Add New Key</h4>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-key-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="new-key-name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g., My Personal Key"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-key-provider" className="text-right">
                  Provider
                </Label>
                <Select
                  value={newKeyProviderId}
                  onValueChange={setNewKeyProviderId}
                  required
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-key-value" className="text-right">
                  API Key
                </Label>
                <Input
                  id="new-key-value"
                  type="password"
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  className="col-span-3"
                  placeholder="Paste your API key here"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save Key</Button>
              </div>
            </form>
          )}
        </div>

        {/* Placeholder for other settings */}
        <Separator />
        <div className="py-4 space-y-4">
          <h3 className="text-lg font-semibold mb-2">Preferences</h3>
          <p className="text-sm text-muted-foreground">
            (Theme, System Prompt, etc. settings will go here)
          </p>
          {/* Add Theme Selector, System Prompt Input, etc. here */}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          {/* Optional: Add a global "Save Settings" if other prefs are added */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
