// src/components/lite-chat/settings-data-management.tsx
import React, { useRef } from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input"; // For file input styling
import { UploadIcon, DownloadIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db"; // Import db for clearing data

export const SettingsDataManagement: React.FC = () => {
  const { importConversation, exportAllConversations } = useChatContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        await importConversation(file);
        // Reset file input to allow importing the same file again
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        // Error toast is handled within importConversation
        console.error("Import failed (from component):", error);
      }
    }
  };

  const handleExportAllClick = async () => {
    try {
      await exportAllConversations();
    } catch (error) {
      // Error toast is handled within exportAllConversations
      console.error("Export all failed (from component):", error);
    }
  };

  const handleClearAllData = async () => {
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
          await db.delete(); // Dexie's method to delete the entire database
          toast.success("All local data cleared. Reloading the application...");
          // Force reload to re-initialize the database and context
          setTimeout(() => window.location.reload(), 1500);
        } catch (error: any) {
          console.error("Failed to clear all data:", error);
          toast.error(`Failed to clear data: ${error.message}`);
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
          added as a new chat.
        </p>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden" // Hide the default input
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
        <Button onClick={handleClearAllData} variant="destructive">
          <Trash2Icon className="mr-2 h-4 w-4" />
          Clear All Local Data (Conversations & Keys)
        </Button>
      </div>
    </div>
  );
};
