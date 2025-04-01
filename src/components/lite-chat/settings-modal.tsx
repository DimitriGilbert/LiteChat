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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatContext } from "@/hooks/use-chat-context";
import { Trash2Icon, PlusCircleIcon, KeyIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Assuming shadcn/ui Alert
import { toast } from "sonner";

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
  const [isSessionOnly, setIsSessionOnly] = useState(false);

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
      toast.warning("Please fill in all fields for the new API key."); // Use toast
      return;
    }
    try {
      await addApiKey(newKeyName.trim(), newKeyProviderId, newKeyValue.trim());
      setNewKeyValue("");
      setNewKeyName("");
      setNewKeyProviderId(providers[0]?.id ?? "");
      setIsAdding(false);
      toast.success("API Key saved successfully!"); // Use toast
    } catch (error: any) {
      console.error("Failed to add API key:", error);
      toast.error(`Error adding API key: ${error.message || error}`); // Use toast
    }
  };

  const handleDeleteKey = async (id: string) => {
    // Consider using a custom confirmation dialog instead of window.confirm
    if (window.confirm("Are you sure you want to delete this API key?")) {
      try {
        await deleteApiKey(id);
        toast.success("API Key deleted."); // Use toast
      } catch (error: any) {
        console.error("Failed to delete API key:", error);
        toast.error(`Error deleting API key: ${error.message || error}`); // Use toast
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl">Settings</DialogTitle>
          <DialogDescription>
            Manage API keys and other preferences.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow pr-6">
          <div className="px-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                API Keys
              </h3>
              <Alert
                variant="destructive"
                className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30"
              >
                <KeyIcon className="h-4 w-4" />
                <AlertTitle>Security Warning</AlertTitle>
                <AlertDescription>
                  API keys are stored locally in your browser's IndexedDB. While
                  convenient, this is less secure than server-side storage.
                  Anyone with access to your browser could potentially extract
                  these keys.
                </AlertDescription>
              </Alert>

              <div className="space-y-3 pt-2">
                <Label className="text-sm text-gray-700 dark:text-gray-300">
                  Saved Keys
                </Label>
                <ScrollArea className="h-[180px] border border-gray-200 dark:border-gray-800 rounded-md p-2 bg-white dark:bg-gray-900">
                  {apiKeys.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full py-6 text-center">
                      <KeyIcon className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No API keys saved yet
                      </p>
                    </div>
                  )}
                  {apiKeys.map((key) => {
                    const providerName =
                      providers.find((p) => p.id === key.providerId)?.name ??
                      key.providerId;
                    const isSelected =
                      selectedApiKeyId[key.providerId] === key.id;
                    return (
                      <div
                        key={key.id}
                        className="flex items-center justify-between gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
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
                            className="h-4 w-4 text-primary border-gray-300 dark:border-gray-700 focus:ring-primary"
                            aria-label={`Select key ${key.name} for ${providerName}`}
                          />
                          <label
                            htmlFor={`select-key-${key.id}`}
                            className="text-sm cursor-pointer flex-grow"
                          >
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {key.name}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 ml-2">
                              ({providerName})
                            </span>
                          </label>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                          onClick={() => handleDeleteKey(key.id)}
                          aria-label={`Delete key ${key.name}`}
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </ScrollArea>
              </div>

              {!isAdding && (
                <Button
                  variant="outline"
                  onClick={() => setIsAdding(true)}
                  className="w-full mt-2"
                >
                  <PlusCircleIcon className="mr-2 h-4 w-4" /> Add New API Key
                </Button>
              )}

              {isAdding && (
                <form
                  onSubmit={handleAddKey}
                  className="border border-gray-200 dark:border-gray-800 p-4 rounded-md space-y-4 bg-gray-50 dark:bg-gray-900/50 mt-2"
                >
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    Add New Key
                  </h4>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label
                      htmlFor="new-key-name"
                      className="text-right text-sm"
                    >
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
                    <Label
                      htmlFor="new-key-provider"
                      className="text-right text-sm"
                    >
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
                    <Label
                      htmlFor="new-key-value"
                      className="text-right text-sm"
                    >
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
                  <div className="flex items-center space-x-2 col-start-2 col-span-3">
                    <Switch
                      id="session-only"
                      onCheckedChange={setIsSessionOnly}
                      checked={isSessionOnly}
                    />
                    <Label
                      htmlFor="session-only"
                      className="text-sm font-normal"
                    >
                      Save for this session only
                    </Label>
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

            <Separator className="my-6" />

            <div className="space-y-4 pb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Preferences
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Additional settings will be available in future updates.
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
