// src/components/LiteChat/settings/SettingsDataManagement.tsx
// FULL FILE
import React, { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  UploadIcon,
  DownloadIcon,
  Trash2Icon,
  Loader2,
  FileUpIcon,
  FileDownIcon,
  SettingsIcon,
  KeyIcon,
  ServerIcon,
  FolderTreeIcon,
  MessageSquareIcon,
  TagsIcon,
  PuzzleIcon,
  GitBranchIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useConversationStore } from "@/store/conversation.store";
import { PersistenceService } from "@/services/persistence.service";
import {
  ImportExportService,
  type FullImportOptions, // Import options type
} from "@/services/import-export.service"; // Import service
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Label } from "@/components/ui/label"; // Import Label
import { Separator } from "@/components/ui/separator"; // Import Separator

const SettingsDataManagementComponent: React.FC = () => {
  // --- Fetch actions from stores ---
  const { importConversation, exportAllConversations } = useConversationStore(
    useShallow((state) => ({
      importConversation: state.importConversation,
      exportAllConversations: state.exportAllConversations,
    })),
  );

  // Local UI state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fullImportInputRef = useRef<HTMLInputElement>(null); // Ref for full import
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isFullExporting, setIsFullExporting] = useState(false); // State for full export
  const [isFullImporting, setIsFullImporting] = useState(false); // State for full import
  // State for import options checkboxes
  const [importOptions, setImportOptions] = useState<FullImportOptions>({
    importSettings: true,
    importApiKeys: true,
    importProviderConfigs: true,
    importProjects: true,
    importConversations: true,
    importRulesAndTags: true,
    importMods: true,
    importSyncRepos: true,
  });

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFullImportClick = () => {
    fullImportInputRef.current?.click();
  };

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setIsImporting(true);
        try {
          await importConversation(file);
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

  const handleFullImportFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        if (
          !window.confirm(
            `Importing this file will OVERWRITE existing data for the selected categories. Are you sure you want to proceed?`,
          )
        ) {
          if (fullImportInputRef.current) {
            fullImportInputRef.current.value = "";
          }
          return;
        }

        setIsFullImporting(true);
        try {
          // Call service action with selected options
          await ImportExportService.importFullConfiguration(
            file,
            importOptions,
          );
          // Success toast and reload handled by service
        } catch (error) {
          console.error("Full import failed (from component):", error);
          // Error toast handled by service
        } finally {
          if (fullImportInputRef.current) {
            fullImportInputRef.current.value = "";
          }
          setIsFullImporting(false);
        }
      }
    },
    [importOptions], // Depend on selected import options
  );

  const handleExportAllClick = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportAllConversations();
    } catch (error) {
      console.error("Export all failed (from component):", error);
    } finally {
      setIsExporting(false);
    }
  }, [exportAllConversations]);

  const handleFullExportClick = useCallback(async () => {
    setIsFullExporting(true);
    try {
      // Call service action
      await ImportExportService.exportFullConfiguration();
    } catch (error) {
      console.error("Full export failed (from component):", error);
      // Error toast handled by service
    } finally {
      setIsFullExporting(false);
    }
  }, []);

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
          await PersistenceService.clearAllData();
          toast.success("All local data cleared. Reloading the application...");
          setTimeout(() => window.location.reload(), 1500);
        } catch (error: unknown) {
          const errorMsg = "Failed to clear all data";
          console.error(errorMsg, error);
          toast.error(
            `${errorMsg}: ${error instanceof Error ? error.message : String(error)}`,
          );
          setIsClearing(false);
        }
      }
    }
  }, []);

  const handleImportOptionChange = (
    option: keyof FullImportOptions,
    checked: boolean,
  ) => {
    setImportOptions((prev) => ({ ...prev, [option]: checked }));
  };

  const renderImportOption = (
    id: keyof FullImportOptions,
    label: string,
    Icon: React.ElementType,
  ) => (
    <div key={id} className="flex items-center space-x-2">
      <Checkbox
        id={`import-${id}`}
        checked={importOptions[id]}
        onCheckedChange={(checked) => handleImportOptionChange(id, !!checked)}
        disabled={isFullImporting}
      />
      <Label
        htmlFor={`import-${id}`}
        className="text-sm font-normal flex items-center gap-1.5"
      >
        <Icon className="h-4 w-4 text-muted-foreground" /> {label}
      </Label>
    </div>
  );

  return (
    <div className="space-y-6 p-1">
      {/* Single Conversation Import/Export */}
      <div>
        <h3 className="text-lg font-medium mb-2">Single Conversation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Import */}
          <div className="border p-4 rounded-md space-y-2">
            <Label className="font-semibold">Import Conversation</Label>
            <p className="text-xs text-muted-foreground">
              Import a previously exported single conversation (.json file).
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
              size="sm"
              disabled={isImporting}
            >
              {isImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadIcon className="mr-2 h-4 w-4" />
              )}
              {isImporting ? "Importing..." : "Select File..."}
            </Button>
          </div>
          {/* Export */}
          <div className="border p-4 rounded-md space-y-2">
            <Label className="font-semibold">Export All Conversations</Label>
            <p className="text-xs text-muted-foreground">
              Export all conversations and messages into a single JSON file.
            </p>
            <Button
              onClick={handleExportAllClick}
              variant="outline"
              size="sm"
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
        </div>
      </div>

      <Separator />

      {/* Full Configuration Import/Export */}
      <div>
        <h3 className="text-lg font-medium mb-2">Full Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Import */}
          <div className="border p-4 rounded-md space-y-3">
            <Label className="font-semibold">Import Full Configuration</Label>
            <p className="text-xs text-muted-foreground">
              Import a full configuration backup (.json). Select which data
              types to import below.{" "}
              <strong className="text-destructive">
                This will overwrite existing data for selected types.
              </strong>
            </p>
            {/* Checkboxes for import options */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
              {renderImportOption("importSettings", "Settings", SettingsIcon)}
              {renderImportOption("importApiKeys", "API Keys", KeyIcon)}
              {renderImportOption(
                "importProviderConfigs",
                "Providers",
                ServerIcon,
              )}
              {renderImportOption("importProjects", "Projects", FolderTreeIcon)}
              {renderImportOption(
                "importConversations",
                "Conversations",
                MessageSquareIcon,
              )}
              {renderImportOption(
                "importRulesAndTags",
                "Rules & Tags",
                TagsIcon,
              )}
              {renderImportOption("importMods", "Mods", PuzzleIcon)}
              {renderImportOption(
                "importSyncRepos",
                "Sync Repos",
                GitBranchIcon,
              )}
            </div>
            <input
              type="file"
              ref={fullImportInputRef}
              onChange={handleFullImportFileChange}
              accept=".json"
              className="hidden"
              id="full-import-file-input"
              disabled={isFullImporting}
            />
            <Button
              onClick={handleFullImportClick}
              variant="outline"
              size="sm"
              disabled={isFullImporting}
              className="mt-2"
            >
              {isFullImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUpIcon className="mr-2 h-4 w-4" />
              )}
              {isFullImporting ? "Importing..." : "Select Full Backup File..."}
            </Button>
          </div>
          {/* Export */}
          <div className="border p-4 rounded-md space-y-2">
            <Label className="font-semibold">Export Full Configuration</Label>
            <p className="text-xs text-muted-foreground">
              Export all settings, providers, keys, projects, conversations,
              rules, tags, mods, etc., into a single backup file.
            </p>
            <Button
              onClick={handleFullExportClick}
              variant="outline"
              size="sm"
              disabled={isFullExporting}
            >
              {isFullExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDownIcon className="mr-2 h-4 w-4" />
              )}
              {isFullExporting ? "Exporting..." : "Export Full Backup"}
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Danger Zone */}
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
