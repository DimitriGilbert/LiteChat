// src/components/LiteChat/settings/ApiKeys.tsx
// FULL FILE
import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2Icon, Loader2, PlusIcon } from "lucide-react";
import type { DbApiKey } from "@/types/litechat/provider";
import { useShallow } from "zustand/react/shallow";
import { useProviderStore } from "@/store/provider.store";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
// Import the new form component
import { ApiKeyForm } from "@/components/LiteChat/common/ApiKeysForm";

const SettingsApiKeysComponent: React.FC = () => {
  const { apiKeys, addApiKey, deleteApiKey, isLoading } = useProviderStore(
    useShallow((state) => ({
      apiKeys: state.dbApiKeys,
      addApiKey: state.addApiKey,
      deleteApiKey: state.deleteApiKey,
      isLoading: state.isLoading,
    })),
  );

  const [isAdding, setIsAdding] = useState(false);
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  const handleSaveNewKey = useCallback(
    async (name: string, providerId: string, value: string) => {
      setIsSavingNew(true);
      try {
        await addApiKey(name, providerId, value);
        setIsAdding(false); // Close form on success
      } catch (error) {
        console.error("Failed to add API key (from component):", error);
        // Toast handled by store action
      } finally {
        setIsSavingNew(false);
      }
    },
    [addApiKey],
  );

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (
        window.confirm(
          `Are you sure you want to delete the API key "${name}"? This will unlink it from any providers using it.`,
        )
      ) {
        setIsDeleting((prev) => ({ ...prev, [id]: true }));
        try {
          await deleteApiKey(id);
          // Toast handled by store action
        } catch (error) {
          console.error("Failed to delete API key (from component):", error);
          // Toast handled by store action
        } finally {
          // Reset deleting state regardless of success/failure if error is caught
          setIsDeleting((prev) => ({ ...prev, [id]: false }));
        }
      }
    },
    [deleteApiKey],
  );

  return (
    <div className="space-y-6 p-1">
      <div>
        <h3 className="text-lg font-medium">API Key Management</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Manage API keys for different providers. Keys are stored securely in
          your browser's local storage and never sent to any server other than
          the intended AI provider.
        </p>
      </div>

      {!isAdding && (
        <Button
          onClick={() => setIsAdding(true)}
          variant="outline"
          className="w-full mb-4"
          disabled={isLoading}
        >
          <PlusIcon className="h-4 w-4 mr-1" /> Add New API Key
        </Button>
      )}

      {isAdding && (
        <div className="border rounded-md p-4 space-y-3 bg-card shadow-md mb-4">
          <h4 className="font-semibold text-card-foreground">Add New Key</h4>
          <ApiKeyForm
            onSave={handleSaveNewKey}
            onCancel={() => setIsAdding(false)}
            isSaving={isSavingNew}
          />
        </div>
      )}

      <div>
        <h4 className="text-md font-medium mb-2">Stored API Keys</h4>
        {isLoading && !isAdding ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (apiKeys || []).length === 0 && !isAdding ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No API keys stored yet.
          </p>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(apiKeys || []).map((key: DbApiKey) => {
                  const isKeyDeleting = isDeleting[key.id];
                  return (
                    <TableRow
                      key={key.id}
                      className={isKeyDeleting ? "opacity-50" : ""}
                    >
                      <TableCell className="font-medium">
                        {key.name || "Unnamed Key"}
                      </TableCell>
                      <TableCell>{key.providerId || "Unknown"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(key.createdAt), "PPp")}
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionTooltipButton
                          tooltipText="Delete Key"
                          onClick={() =>
                            handleDelete(key.id, key.name || "Unnamed Key")
                          }
                          disabled={isKeyDeleting}
                          aria-label={`Delete key ${key.name || "Unnamed Key"}`}
                          icon={
                            isKeyDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2Icon />
                            )
                          }
                          className="text-destructive hover:text-destructive/80 h-8 w-8"
                        />
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
