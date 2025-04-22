// src/components/lite-chat/settings/settings-data-management.tsx
import React, { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { UploadIcon, DownloadIcon, Trash2Icon, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Define props based on what SettingsModal passes down
interface SettingsDataManagementProps {
  importConversation: (file: File, parentId: string | null) => Promise<void>;
  exportAllConversations: () => Promise<void>;
  clearAllData: () => Promise<void>; // Action to clear all data
}

const SettingsDataManagementComponent: React.FC<
  SettingsDataManagementProps
> = ({
  importConversation, // Use prop action
  exportAllConversations, // Use prop action
  clearAllData, // Use prop action
}) => {
  // Local UI state remains
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Handlers use prop actions
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setIsImporting(true);
        try {
          await importConversation(file, null); // Use prop action
        } catch (error) {
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
      await exportAllConversations(); // Use prop action
    } catch (error) {
      console.error("Export all failed (from component):", error);
    } finally {
      setIsExporting(false);
    }
  }, [exportAllConversations]);

  const handleClearAllDataClick = useCallback(async () => {
    if (
      window.confirm(
        `🚨 ARE YOU ABSOLUTELY SURE? 🚨

This will permanently delete ALL conversations, messages, and stored API keys from your browser. This action cannot be undone.`,
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
          await clearAllData(); // Use prop action
          toast.success("All local data cleared. Reloading the application...");
          setTimeout(() => window.location.reload(), 1500);
        } catch (error: unknown) {
          console.error("Failed to clear all data:", error);
          const message =
            error instanceof Error ? error.message : "Unknown error";
          toast.error(`Failed to clear data: ${message}`);
          setIsClearing(false);
        }
      }
    }
  }, [clearAllData]);

  return (
    <div className="space-y-6 p-1">
      <div>
        <h3 className="text-lg font-medium mb-2">Import Conversation</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Import a previously exported conversation (.json file). It will be
          added as a new chat at the root level.
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
            : "Clear All Local Data (Conversations & Keys)"}
        </Button>
      </div>
    </div>
  );
};

export const SettingsDataManagement = React.memo(
  SettingsDataManagementComponent,
);
