// src/components/LiteChat/settings/settings-data-management.tsx
import React, { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { UploadIcon, DownloadIcon, Trash2Icon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useShallow } from "zustand/react/shallow";
// Removed unused sidebar store import
import { useConversationStore } from "@/store/conversation.store"; // Use ConversationStore
import { PersistenceService } from "@/services/persistence.service"; // Use PersistenceService

const SettingsDataManagementComponent: React.FC = () => {
  // --- Fetch actions from stores ---
  const { importConversation, exportAllConversations } = useConversationStore(
    useShallow((state) => ({
      importConversation: state.importConversation, // Action now exists
      exportAllConversations: state.exportAllConversations, // Action now exists
    })),
  );
  // No need for useChatStorage hook

  // Local UI state remains
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setIsImporting(true);
        try {
          // Call store action
          await importConversation(file); // Removed null argument
        } catch (error) {
          // Error toast handled by action
          console.error("Import failed (from component):", error);
        } finally {
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          setIsImporting(false);
        }
      }
    },
    [importConversation],
  );

  const handleExportAllClick = useCallback(async () => {
    setIsExporting(true);
    try {
      // Call store action
      await exportAllConversations();
    } catch (error) {
      // Error toast handled by action
      console.error("Export all failed (from component):", error);
    } finally {
      setIsExporting(false);
    }
  }, [exportAllConversations]);

  const handleClearAllDataClick = useCallback(async () => {
    if (
      window.confirm(
        `🚨 ARE YOU ABSOLUTELY SURE? 🚨

This will permanently delete ALL conversations, messages, mods, settings, providers, and stored API keys from your browser. This action cannot be undone.`,
      )
    ) {
      if (
        window.confirm(
          `SECOND CONFIRMATION:

Really delete everything? Consider exporting first.`,
        )
      ) {
        setIsClearing(true);
        try {
          // Call PersistenceService action directly
          await PersistenceService.clearAllData();
          toast.success("All local data cleared. Reloading the application...");
          setTimeout(() => window.location.reload(), 1500);
        } catch (error: unknown) {
          const errorMsg = "Failed to clear all data";
          console.error(errorMsg, error);
          toast.error(
            `${errorMsg}: ${error instanceof Error ? error.message : String(error)}`,
          );
          setIsClearing(false); // Reset loading state on error
        }
        // No finally needed here as reload happens on success
      }
    }
  }, []); // Removed clearAllData dependency as we call service directly

  return (
    <div className="space-y-6 p-1">
      <div>
        <h3 className="text-lg font-medium mb-2">Import Conversation</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Import a previously exported conversation (.json file). It will be
          added as a new chat.
        </p>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
          id="import-file-input"
          disabled={isImporting}
        />
        <Button
          onClick={handleImportClick}
          variant="outline"
          disabled={isImporting}
        >
          {isImporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UploadIcon className="mr-2 h-4 w-4" />
          )}
          {isImporting ? "Importing..." : "Select Import File..."}
        </Button>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2">Export Data</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Export all your conversations and messages into a single JSON file.
        </p>
        <Button
          onClick={handleExportAllClick}
          variant="outline"
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <DownloadIcon className="mr-2 h-4 w-4" />
          )}
          {isExporting ? "Exporting..." : "Export All Chats"}
        </Button>
      </div>

      <div className="border-t pt-6 border-destructive/50">
        <h3 className="text-lg font-medium text-destructive mb-2">
          Danger Zone
        </h3>
        <p className="text-sm text-destructive/90 mb-3">
          Be very careful with these actions. Data loss may be permanent.
        </p>
        <Button
          onClick={handleClearAllDataClick}
          variant="destructive"
          disabled={isClearing}
        >
          {isClearing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2Icon className="mr-2 h-4 w-4" />
          )}
          {isClearing
            ? "Clearing Data..."
            : "Clear All Local Data (Conversations, Keys, Settings, etc.)"}
        </Button>
      </div>
    </div>
  );
};

export const SettingsDataManagement = React.memo(
  SettingsDataManagementComponent,
);
