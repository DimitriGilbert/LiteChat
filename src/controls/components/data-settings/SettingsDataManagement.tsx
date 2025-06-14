// src/components/LiteChat/settings/SettingsDataManagement.tsx
// FULL FILE
import React, { useRef, useState, useCallback } from "react";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
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
  PlugIcon,
  FileTextIcon,
  BotIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useConversationStore } from "@/store/conversation.store";
import { PersistenceService } from "@/services/persistence.service";
import {
  ImportExportService,
  type FullImportOptions,
  type FullExportOptions,
} from "@/services/import-export.service";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// Define Zod schemas for import and export options
const fullImportOptionsSchema = z.object({
  importSettings: z.boolean(),
  importApiKeys: z.boolean(),
  importProviderConfigs: z.boolean(),
  importProjects: z.boolean(),
  importConversations: z.boolean(),
  importRulesAndTags: z.boolean(),
  importMods: z.boolean(),
  importSyncRepos: z.boolean(),
  importMcpServers: z.boolean(),
  importPromptTemplates: z.boolean(),
  importAgents: z.boolean(),
});

const fullExportOptionsSchema = z.object({
  importSettings: z.boolean(), // Note: Key names match FullImportOptions for simplicity in FullExportOptions type
  importApiKeys: z.boolean(),
  importProviderConfigs: z.boolean(),
  importProjects: z.boolean(),
  importConversations: z.boolean(),
  importRulesAndTags: z.boolean(),
  importMods: z.boolean(),
  importSyncRepos: z.boolean(),
  importMcpServers: z.boolean(),
  importPromptTemplates: z.boolean(),
  importAgents: z.boolean(),
});

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
  const fullImportInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isFullExporting, setIsFullExporting] = useState(false);
  const [isFullImporting, setIsFullImporting] = useState(false);

  // TanStack Form for Import Options
  const importOptionsForm = useForm({
    defaultValues: {
      importSettings: true,
      importApiKeys: true,
      importProviderConfigs: true,
      importProjects: true,
      importConversations: true,
      importRulesAndTags: true,
      importMods: true,
      importSyncRepos: true,
      importMcpServers: true,
      importPromptTemplates: true,
      importAgents: true,
    } as FullImportOptions,
    validators: {
      onChange: fullImportOptionsSchema, // Validate on change
    },
  });

  // TanStack Form for Export Options
  const exportOptionsForm = useForm({
    defaultValues: {
      importSettings: true,
      importApiKeys: true,
      importProviderConfigs: true,
      importProjects: true,
      importConversations: true,
      importRulesAndTags: true,
      importMods: true,
      importSyncRepos: true,
      importMcpServers: true,
      importPromptTemplates: true,
      importAgents: true,
    } as FullExportOptions,
    validators: {
      onChange: fullExportOptionsSchema, // Validate on change
    },
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
          await ImportExportService.importFullConfiguration(
            file,
            importOptionsForm.state.values, // Use form state values
          );
        } catch (error) {
          console.error("Full import failed (from component):", error);
        } finally {
          if (fullImportInputRef.current) {
            fullImportInputRef.current.value = "";
          }
          setIsFullImporting(false);
        }
      }
    },
    [importOptionsForm], // Depend on form instance
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
      await ImportExportService.exportFullConfiguration(
        exportOptionsForm.state.values, // Use form state values
      );
    } catch (error) {
      console.error("Full export failed (from component):", error);
    } finally {
      setIsFullExporting(false);
    }
  }, [exportOptionsForm]); // Depend on form instance

  const handleClearAllDataClick = useCallback(async () => {
    if (
      window.confirm(
        `🚨 ARE YOU ABSOLUTELY SURE? 🚨\n\nThis will permanently delete ALL conversations, messages, mods, settings, providers, and stored API keys from your browser. This action cannot be undone.`,
      )
    ) {
      if (
        window.confirm(
          `SECOND CONFIRMATION:\n\nReally delete everything? Consider exporting first.`,
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

  // Updated to use TanStack Form Field
  const renderOptionCheckbox = (
    formInstance: typeof importOptionsForm | typeof exportOptionsForm, // Pass form instance
    optionKey: keyof FullImportOptions, // Assuming keys are same for FullExportOptions
    label: string,
    Icon: React.ElementType,
    isDisabledFlag: boolean,
    typePrefix: 'import' | 'export' // Added to differentiate IDs
  ) => {
    const fieldId = `${typePrefix}-${optionKey}-checkbox`; // Made ID unique
    return (
      <formInstance.Field
        key={optionKey}
        name={optionKey}
        children={(field: AnyFieldApi) => (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={fieldId}
              checked={field.state.value}
              onCheckedChange={(checked) => field.handleChange(!!checked)}
              disabled={isDisabledFlag} 
            />
            <Label
              htmlFor={fieldId}
              className="text-sm font-normal flex items-center gap-1.5"
            >
              <Icon className="h-4 w-4 text-muted-foreground" /> {label}
            </Label>
          </div>
        )}
      />
    );
  };

  return (
    <div className="space-y-4 p-1">
      {/* Single Conversation Import/Export */}
      <div>
        <h3 className="text-lg font-medium mb-2">Single Conversation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Import */}
          <div className="border p-3 rounded-md space-y-2">
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
          <div className="border p-3 rounded-md space-y-2">
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
        <h3 className="text-lg font-medium mb-2">Full Configuration Backup</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Import */}
          <div className="border p-3 rounded-md space-y-3">
            <Label className="font-semibold">Import Full Configuration</Label>
            <p className="text-xs text-muted-foreground">
              Import settings, providers, keys, projects, conversations, etc.,
              from a backup file. Select which data types to restore.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
              {renderOptionCheckbox(importOptionsForm, "importSettings", "Settings", SettingsIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, "importApiKeys", "API Keys", KeyIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, "importProviderConfigs", "Providers", ServerIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, "importProjects", "Projects", FolderTreeIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, "importConversations", "Conversations", MessageSquareIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, "importRulesAndTags", "Rules & Tags", TagsIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, "importMods", "Mods", PuzzleIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, "importSyncRepos", "Sync Repos", GitBranchIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, "importMcpServers", "MCP Servers", PlugIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, "importPromptTemplates", "Prompt Templates", FileTextIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, "importAgents", "Agents", BotIcon, isFullImporting, 'import')}
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
            >
              {isFullImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUpIcon className="mr-2 h-4 w-4" />
              )}
              {isFullImporting ? "Importing..." : "Select Backup File..."}
            </Button>
          </div>
          {/* Export */}
          <div className="border p-3 rounded-md space-y-3">
            <Label className="font-semibold">Export Full Configuration</Label>
            <p className="text-xs text-muted-foreground">
              Export all settings, providers, keys, projects, conversations,
              rules, tags, mods, etc., into a single backup file. Select which
              data types to include.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
              {renderOptionCheckbox(exportOptionsForm, "importSettings", "Settings", SettingsIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importApiKeys", "API Keys", KeyIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importProviderConfigs", "Providers", ServerIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importProjects", "Projects", FolderTreeIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importConversations", "Conversations", MessageSquareIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importRulesAndTags", "Rules & Tags", TagsIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importMods", "Mods", PuzzleIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importSyncRepos", "Sync Repos", GitBranchIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importMcpServers", "MCP Servers", PlugIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importPromptTemplates", "Prompt Templates", FileTextIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importAgents", "Agents", BotIcon, isFullExporting, 'export')}
            </div>
            <Button
              onClick={handleFullExportClick}
              variant="secondary"
              size="sm"
              disabled={isFullExporting}
            >
              {isFullExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDownIcon className="mr-2 h-4 w-4" />
              )}
              {isFullExporting ? "Exporting..." : "Export Configuration"}
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Individual Category Import/Export */}
      <div>
        <h3 className="text-lg font-medium mb-2">Individual Categories</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Import or export specific data categories independently.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* MCP Servers */}
          <div className="border p-3 rounded-md space-y-2">
            <Label className="font-semibold flex items-center gap-1.5">
              <PlugIcon className="h-4 w-4 text-muted-foreground" />
              MCP Servers
            </Label>
            <p className="text-xs text-muted-foreground">
              Export or import MCP server configurations.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => ImportExportService.exportMcpServers()}
                variant="outline"
                size="sm"
              >
                <DownloadIcon className="mr-1 h-3 w-3" />
                Export
              </Button>
              <input
                type="file"
                accept=".json"
                className="hidden"
                id="mcp-import-input"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      await ImportExportService.importMcpServers(file);
                    } catch (error) {
                      console.error("MCP import failed:", error);
                    } finally {
                      e.target.value = "";
                    }
                  }
                }}
              />
              <Button
                onClick={() => document.getElementById("mcp-import-input")?.click()}
                variant="outline"
                size="sm"
              >
                <UploadIcon className="mr-1 h-3 w-3" />
                Import
              </Button>
            </div>
          </div>

          {/* Prompt Templates */}
          <div className="border p-3 rounded-md space-y-2">
            <Label className="font-semibold flex items-center gap-1.5">
              <FileTextIcon className="h-4 w-4 text-muted-foreground" />
              Prompt Templates
            </Label>
            <p className="text-xs text-muted-foreground">
              Export or import prompt templates (excludes agents and tasks).
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => ImportExportService.exportPromptTemplates()}
                variant="outline"
                size="sm"
              >
                <DownloadIcon className="mr-1 h-3 w-3" />
                Export
              </Button>
              <input
                type="file"
                accept=".json"
                className="hidden"
                id="templates-import-input"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      await ImportExportService.importPromptTemplates(file);
                    } catch (error) {
                      console.error("Templates import failed:", error);
                    } finally {
                      e.target.value = "";
                    }
                  }
                }}
              />
              <Button
                onClick={() => document.getElementById("templates-import-input")?.click()}
                variant="outline"
                size="sm"
              >
                <UploadIcon className="mr-1 h-3 w-3" />
                Import
              </Button>
            </div>
          </div>

          {/* Agents */}
          <div className="border p-3 rounded-md space-y-2">
            <Label className="font-semibold flex items-center gap-1.5">
              <BotIcon className="h-4 w-4 text-muted-foreground" />
              Agents
            </Label>
            <p className="text-xs text-muted-foreground">
              Export or import agents with their associated tasks.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => ImportExportService.exportAgents()}
                variant="outline"
                size="sm"
              >
                <DownloadIcon className="mr-1 h-3 w-3" />
                Export
              </Button>
              <input
                type="file"
                accept=".json"
                className="hidden"
                id="agents-import-input"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      await ImportExportService.importAgents(file);
                    } catch (error) {
                      console.error("Agents import failed:", error);
                    } finally {
                      e.target.value = "";
                    }
                  }
                }}
              />
              <Button
                onClick={() => document.getElementById("agents-import-input")?.click()}
                variant="outline"
                size="sm"
              >
                <UploadIcon className="mr-1 h-3 w-3" />
                Import
              </Button>
            </div>
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
