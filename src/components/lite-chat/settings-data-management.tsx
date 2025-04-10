// src/components/lite-chat/settings-data-management.tsx
import React, { useRef } from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { Button } from "@/components/ui/button";
import { UploadIcon, DownloadIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
// REMOVED: import { db } from "@/lib/db"; // No longer needed

export const SettingsDataManagement: React.FC = () => {
  const {
    importConversation,
    exportAllConversations,
    clearAllData, // Get clearAllData from context
  } = useChatContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ... (handleImportClick, handleFileChange, handleExportAllClick remain the same) ...
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        // Pass null for parentId to import at root level from settings
        await importConversation(file);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        console.error("Import failed (from component):", error);
      }
    }
  };

  const handleExportAllClick = async () => {
    try {
      await exportAllConversations();
    } catch (error) {
      console.error("Export all failed (from component):", error);
    }
  };

  const handleClearAllDataClick = async () => {
    // Renamed handler for clarity
    if (
      window.confirm(
        "🚨 ARE YOU ABSOLUTELY SURE? 🚨\n\nThis will permanently delete ALL conversations, messages, and stored API keys from your browser. This action cannot be undone.",
      )
    ) {
      if (
        window.confirm(
          "SECOND CONFIRMATION:\n\nReally delete everything? Consider exporting first.",
        )
      ) {
        try {
          await clearAllData(); // Use function from context
          toast.success("All local data cleared. Reloading the application...");
          setTimeout(() => window.location.reload(), 1500);
        } catch (error: unknown) {
          console.error("Failed to clear all data:", error);
          const message =
            error instanceof Error ? error.message : "Unknown error";
          toast.error(`Failed to clear data: ${message}`);
        }
      }
    }
  };

  return (
    <div className="space-y-6 p-1">
      {/* Import Section */}
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
        />
        <Button onClick={handleImportClick} variant="outline">
          <UploadIcon className="mr-2 h-4 w-4" />
          Select Import File...
        </Button>
      </div>

      {/* Export Section */}
      <div>
        <h3 className="text-lg font-medium mb-2">Export Data</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Export all your conversations and messages into a single JSON file.
        </p>
        <Button onClick={handleExportAllClick} variant="outline">
          <DownloadIcon className="mr-2 h-4 w-4" />
          Export All Chats
        </Button>
      </div>

      {/* Danger Zone */}
      <div className="border-t pt-6 border-destructive/50">
        <h3 className="text-lg font-medium text-destructive mb-2">
          Danger Zone
        </h3>
        <p className="text-sm text-destructive/90 mb-3">
          Be very careful with these actions. Data loss may be permanent.
        </p>
        <Button onClick={handleClearAllDataClick} variant="destructive">
          <Trash2Icon className="mr-2 h-4 w-4" />
          Clear All Local Data (Conversations & Keys)
        </Button>
      </div>
    </div>
  );
};
