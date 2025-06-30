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
  WorkflowIcon,
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
import { useTranslation } from "react-i18next";

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
  importWorkflows: z.boolean(),
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
  importWorkflows: z.boolean(),
});

const SettingsDataManagementComponent: React.FC = () => {
  const { t } = useTranslation('settings');
  // --- Fetch actions from stores ---
  const { importConversation, exportAllConversations, clearAllConversations } = useConversationStore(
    useShallow((state) => ({
      importConversation: state.importConversation,
      exportAllConversations: state.exportAllConversations,
      clearAllConversations: state.clearAllConversations,
    })),
  );

  // Local UI state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fullImportInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearingConversations, setIsClearingConversations] = useState(false);
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
      importWorkflows: true,
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
      importWorkflows: true,
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
            t('dataManagement.importConfirmation', `Importing this file will OVERWRITE existing data for the selected categories. Are you sure you want to proceed?`)
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
    [importOptionsForm, t], // Depend on form instance and translation function
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

  const handleClearConversationsClick = useCallback(async () => {
    if (
      !window.confirm(
        t('dataManagement.clearConversationsConfirmation', 'Are you sure you want to delete ALL conversations? This action cannot be undone.')
      )
    ) {
      return;
    }

    setIsClearingConversations(true);
    try {
      await clearAllConversations(true);
      toast.success(t('dataManagement.conversationsClearedSuccess', 'All conversations have been deleted. Reloading...'));
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      const errorMsg = t('dataManagement.conversationsClearedError', 'Failed to clear conversations');
      console.error(errorMsg, error);
      toast.error(
        `${errorMsg}: ${error instanceof Error ? error.message : String(error)}`,
      );
      setIsClearingConversations(false);
    }
  }, [clearAllConversations, t]);

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
        t('dataManagement.clearDataConfirmationTitle', `🚨 ARE YOU ABSOLUTELY SURE? 🚨`) + '\n\n' + t('dataManagement.clearDataConfirmationMessage', `This will permanently delete ALL conversations, messages, mods, settings, providers, and stored API keys from your browser. This action cannot be undone.`)
      )
    ) {
      if (
        window.confirm(
          t('dataManagement.clearDataSecondConfirmation', `SECOND CONFIRMATION:\n\nReally delete everything? Consider exporting first.`)
        )
      ) {
        setIsClearing(true);
        try {
          await PersistenceService.clearAllData();
          toast.success(t('dataManagement.dataClearedSuccess', "All local data cleared. Reloading the application..."));
          setTimeout(() => window.location.reload(), 1500);
        } catch (error: unknown) {
          const errorMsg = t('dataManagement.dataClearedError', "Failed to clear all data");
          console.error(errorMsg, error);
          toast.error(
            `${errorMsg}: ${error instanceof Error ? error.message : String(error)}`,
          );
          setIsClearing(false);
        }
      }
    }
  }, [t]);

  // Updated to use TanStack Form Field
  const renderOptionCheckbox = (
    formInstance: typeof importOptionsForm | typeof exportOptionsForm, // Pass form instance
    optionKey: keyof FullImportOptions, // Assuming keys are same for FullExportOptions
    label: string,
    Icon: React.ElementType,
    isDisabled: boolean,
    typePrefix: 'import' | 'export' // Added to differentiate IDs
  ) => {
    const uniqueId = `${typePrefix}-${optionKey}`;
    return (
      <formInstance.Field
        name={optionKey}
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        children={(fieldApi: AnyFieldApi) => (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={uniqueId}
              checked={fieldApi.state.value as boolean}
              onCheckedChange={(checked) => fieldApi.setValue(!!checked)}
              onBlur={fieldApi.handleBlur}
              disabled={isDisabled}
              aria-label={label}
            />
            <Label
              htmlFor={uniqueId}
              className="text-sm font-normal flex items-center gap-2 cursor-pointer"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {label}
            </Label>
          </div>
        )}
      />
    );
  };

  return (
    <div className="space-y-6 p-1">
      {/* --- Legacy Import/Export --- */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Import Conversations */}
          <div className="border p-3 rounded-md space-y-2 flex flex-col justify-between">
            <div>
              <Label className="font-semibold">{t('dataManagement.legacyImportTitle', "Import Conversations (Legacy)")}</Label>
              <p className="text-xs text-muted-foreground">
                {t('dataManagement.legacyImportDescription', "Import conversations from a previously exported JSON file.")}
              </p>
            </div>
            <Button
              onClick={handleImportClick}
              variant="outline"
              size="sm"
              disabled={isImporting}
              className="w-full sm:w-auto"
            >
              {isImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUpIcon className="mr-2 h-4 w-4" />
              )}
              {isImporting ? t('dataManagement.importingButton', "Importing...") : t('dataManagement.importButton', "Import from File...")}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".json"
              disabled={isImporting}
            />
          </div>

          {/* Export Conversations */}
          <div className="border p-3 rounded-md space-y-2 flex flex-col justify-between">
            <div>
              <Label className="font-semibold">{t('dataManagement.legacyExportTitle', "Export Conversations (Legacy)")}</Label>
              <p className="text-xs text-muted-foreground">
                {t('dataManagement.legacyExportDescription', "Export all conversations to a single JSON file as a backup.")}
              </p>
            </div>
            <Button
              onClick={handleExportAllClick}
              variant="outline"
              size="sm"
              disabled={isExporting}
              className="w-full sm:w-auto"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDownIcon className="mr-2 h-4 w-4" />
              )}
              {isExporting ? t('dataManagement.exportingButton', "Exporting...") : t('dataManagement.exportAllButton', "Export All to File")}
            </Button>
          </div>
        </div>
      </div>


      {/* --- Full Backup/Restore --- */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Import */}
          <div className="border p-4 rounded-md space-y-4">
            <div className="space-y-1">
              <Label className="font-semibold text-base">{t('dataManagement.fullImportTitle', 'Full Import / Restore')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('dataManagement.fullImportDescription', 'Restore a full configuration backup from a file. This will overwrite existing data for the selected categories.')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
              {renderOptionCheckbox(importOptionsForm, 'importSettings', t('dataManagement.options.settings', 'Settings'), SettingsIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, 'importApiKeys', t('dataManagement.options.apiKeys', 'API Keys'), KeyIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, 'importProviderConfigs', t('dataManagement.options.providerConfigs', 'Provider Configs'), ServerIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, 'importProjects', t('dataManagement.options.projects', 'Projects'), FolderTreeIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, 'importConversations', t('dataManagement.options.conversations', 'Conversations'), MessageSquareIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, 'importRulesAndTags', t('dataManagement.options.rulesAndTags', 'Rules & Tags'), TagsIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, 'importMods', t('dataManagement.options.mods', 'Mods'), PuzzleIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, 'importSyncRepos', t('dataManagement.options.syncRepos', 'Git Sync Repos'), GitBranchIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, 'importMcpServers', t('dataManagement.options.mcpServers', 'MCP Servers'), PlugIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, 'importPromptTemplates', t('dataManagement.options.promptTemplates', 'Prompt Templates'), FileTextIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, 'importAgents', t('dataManagement.options.agents', 'Agents'), BotIcon, isFullImporting, 'import')}
              {renderOptionCheckbox(importOptionsForm, 'importWorkflows', t('dataManagement.options.workflows', 'Workflows'), WorkflowIcon, isFullImporting, 'import')}
            </div>

            <Button onClick={handleFullImportClick} variant="secondary" size="sm" disabled={isFullImporting}>
              {isFullImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUpIcon className="mr-2 h-4 w-4" />}
              {isFullImporting ? t('dataManagement.importingButton', "Importing...") : t('dataManagement.fullImportButton', "Select Backup File...")}
            </Button>
            <input
              type="file"
              ref={fullImportInputRef}
              onChange={handleFullImportFileChange}
              className="hidden"
              id="full-import-file-input"
              disabled={isFullImporting}
            />
          </div>

          {/* Export */}
          <div className="border p-4 rounded-md space-y-4">
            <div className="space-y-1">
              <Label className="font-semibold text-base">{t('dataManagement.fullExportTitle', 'Full Export / Backup')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('dataManagement.fullExportDescription', 'Export all settings, conversations, etc., into a single backup file. Select which data types to include.')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
              {renderOptionCheckbox(exportOptionsForm, "importSettings", t('dataManagement.options.settings', 'Settings'), SettingsIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importApiKeys", t('dataManagement.options.apiKeys', 'API Keys'), KeyIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importProviderConfigs", t('dataManagement.options.providerConfigs', 'Provider Configs'), ServerIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importProjects", t('dataManagement.options.projects', 'Projects'), FolderTreeIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importConversations", t('dataManagement.options.conversations', 'Conversations'), MessageSquareIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importRulesAndTags", t('dataManagement.options.rulesAndTags', 'Rules & Tags'), TagsIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importMods", t('dataManagement.options.mods', 'Mods'), PuzzleIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importSyncRepos", t('dataManagement.options.syncRepos', 'Git Sync Repos'), GitBranchIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importMcpServers", t('dataManagement.options.mcpServers', 'MCP Servers'), PlugIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importPromptTemplates", t('dataManagement.options.promptTemplates', 'Prompt Templates'), FileTextIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importAgents", t('dataManagement.options.agents', 'Agents'), BotIcon, isFullExporting, 'export')}
              {renderOptionCheckbox(exportOptionsForm, "importWorkflows", t('dataManagement.options.workflows', 'Workflows'), WorkflowIcon, isFullExporting, 'export')}
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
              {isFullExporting ? t('dataManagement.exportingButton', "Exporting...") : t('dataManagement.exportButton', "Export Configuration")}
            </Button>
          </div>
        </div>
      </div>


      {/* Danger Zone */}
      <div className="border-t pt-6 mt-6 border-destructive/50">
        <h3 className="text-lg font-medium text-destructive mb-2">
          {t('dataManagement.dangerZoneTitle', 'Danger Zone')}
        </h3>
        <p className="text-sm text-destructive/90 mb-4">
          {t('dataManagement.dangerZoneDescription', 'These actions are destructive and cannot be undone. Proceed with caution.')}
        </p>
        <div className="flex flex-wrap gap-2">
          {isClearing ? (
            <Button disabled variant="destructive">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('dataManagement.clearing', 'Clearing...')}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleClearAllDataClick}
              aria-label={t('dataManagement.clearData', 'Clear All Data')}
            >
              <Trash2Icon className="mr-2 h-4 w-4" />
              {t('dataManagement.clearData', 'Clear All Data')}
            </Button>
          )}
          {isClearingConversations ? (
            <Button disabled variant="destructive" className="bg-red-700 hover:bg-red-800">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('dataManagement.clearingConversations', 'Clearing Conversations...')}
            </Button>
          ) : (
            <Button
              variant="destructive"
              className="bg-red-700 hover:bg-red-800"
              onClick={handleClearConversationsClick}
              aria-label={t('dataManagement.clearConversations', 'Clear All Conversations')}
            >
              <MessageSquareIcon className="mr-2 h-4 w-4" />
              {t('dataManagement.clearConversations', 'Clear All Conversations')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export const SettingsDataManagement = React.memo(
  SettingsDataManagementComponent,
);
