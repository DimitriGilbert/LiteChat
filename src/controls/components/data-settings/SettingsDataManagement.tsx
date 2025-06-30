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
import { Separator } from "@/components/ui/separator";
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
            />
            <Label
              htmlFor={fieldId}
              className="text-sm font-normal flex items-center gap-1.5"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span>{label}</span>
            </Label>
          </div>
        )}
      />
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-8">
      {/* --- Page Header --- */}
      <div>
        <h2 className="text-2xl font-bold">{t('dataManagement.title', 'Data Management')}</h2>
        <p className="text-muted-foreground mt-1">
          {t('dataManagement.description', 'Import, export, or clear your application data. Use full import/export for backups or migrations.')}
        </p>
      </div>

      <Separator />

      {/* --- Legacy Import/Export --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h3 className="font-semibold">{t('dataManagement.importConversationsTitle', 'Import Conversations (Legacy)')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('dataManagement.importConversationsDescription', 'Import conversations from a previously exported JSON file. This only imports chat history.')}
          </p>
          <Button
            onClick={handleImportClick}
            disabled={isImporting}
            variant="outline"
          >
            {isImporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileUpIcon className="mr-2 h-4 w-4" />
            )}
            {t('dataManagement.importConversationsButton', 'Import from File')}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".json"
          />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold">{t('dataManagement.exportConversationsTitle', 'Export All Conversations (Legacy)')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('dataManagement.exportConversationsDescription', 'Export all your conversations into a single JSON file. This only includes chat history.')}
          </p>
          <Button
            onClick={handleExportAllClick}
            disabled={isExporting}
            variant="outline"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDownIcon className="mr-2 h-4 w-4" />
            )}
            {t('dataManagement.exportConversationsButton', 'Export All to JSON')}
          </Button>
        </div>
      </div>

      <Separator />

      {/* --- Full Import/Export --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Full Export Section */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">{t('dataManagement.fullExportTitle', 'Full Export')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('dataManagement.fullExportDescription', 'Select the data to include in your full backup file.')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {renderOptionCheckbox(exportOptionsForm, 'importSettings', t('dataManagement.options.settings', 'Settings'), SettingsIcon, 'export')}
            {renderOptionCheckbox(exportOptionsForm, 'importApiKeys', t('dataManagement.options.apiKeys', 'API Keys'), KeyIcon, 'export')}
            {renderOptionCheckbox(exportOptionsForm, 'importProviderConfigs', t('dataManagement.options.providerConfigs', 'Provider Configs'), ServerIcon, 'export')}
            {renderOptionCheckbox(exportOptionsForm, 'importProjects', t('dataManagement.options.projects', 'Projects'), FolderTreeIcon, 'export')}
            {renderOptionCheckbox(exportOptionsForm, 'importConversations', t('dataManagement.options.conversations', 'Conversations'), MessageSquareIcon, 'export')}
            {renderOptionCheckbox(exportOptionsForm, 'importRulesAndTags', t('dataManagement.options.rulesAndTags', 'Rules & Tags'), TagsIcon, 'export')}
            {renderOptionCheckbox(exportOptionsForm, 'importMods', t('dataManagement.options.mods', 'Mods'), PuzzleIcon, 'export')}
            {renderOptionCheckbox(exportOptionsForm, 'importSyncRepos', t('dataManagement.options.syncRepos', 'Git Sync Repos'), GitBranchIcon, 'export')}
            {renderOptionCheckbox(exportOptionsForm, 'importMcpServers', t('dataManagement.options.mcpServers', 'MCP Servers'), PlugIcon, 'export')}
            {renderOptionCheckbox(exportOptionsForm, 'importPromptTemplates', t('dataManagement.options.promptTemplates', 'Prompt Templates'), FileTextIcon, 'export')}
            {renderOptionCheckbox(exportOptionsForm, 'importAgents', t('dataManagement.options.agents', 'Agents'), BotIcon, 'export')}
            {renderOptionCheckbox(exportOptionsForm, 'importWorkflows', t('dataManagement.options.workflows', 'Workflows'), WorkflowIcon, 'export')}
          </div>
          <Button onClick={handleFullExportClick} disabled={isFullExporting}>
            {isFullExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <DownloadIcon className="mr-2 h-4 w-4" />
            )}
            {t('dataManagement.exportButton', 'Export Full Backup')}
          </Button>
        </div>

        {/* Full Import Section */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">{t('dataManagement.fullImportTitle', 'Full Import')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('dataManagement.fullImportDescription', 'Import a full backup file. This will overwrite existing data for selected categories.')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {renderOptionCheckbox(importOptionsForm, 'importSettings', t('dataManagement.options.settings', 'Settings'), SettingsIcon, 'import')}
            {renderOptionCheckbox(importOptionsForm, 'importApiKeys', t('dataManagement.options.apiKeys', 'API Keys'), KeyIcon, 'import')}
            {renderOptionCheckbox(importOptionsForm, 'importProviderConfigs', t('dataManagement.options.providerConfigs', 'Provider Configs'), ServerIcon, 'import')}
            {renderOptionCheckbox(importOptionsForm, 'importProjects', t('dataManagement.options.projects', 'Projects'), FolderTreeIcon, 'import')}
            {renderOptionCheckbox(importOptionsForm, 'importConversations', t('dataManagement.options.conversations', 'Conversations'), MessageSquareIcon, 'import')}
            {renderOptionCheckbox(importOptionsForm, 'importRulesAndTags', t('dataManagement.options.rulesAndTags', 'Rules & Tags'), TagsIcon, 'import')}
            {renderOptionCheckbox(importOptionsForm, 'importMods', t('dataManagement.options.mods', 'Mods'), PuzzleIcon, 'import')}
            {renderOptionCheckbox(importOptionsForm, 'importSyncRepos', t('dataManagement.options.syncRepos', 'Git Sync Repos'), GitBranchIcon, 'import')}
            {renderOptionCheckbox(importOptionsForm, 'importMcpServers', t('dataManagement.options.mcpServers', 'MCP Servers'), PlugIcon, 'import')}
            {renderOptionCheckbox(importOptionsForm, 'importPromptTemplates', t('dataManagement.options.promptTemplates', 'Prompt Templates'), FileTextIcon, 'import')}
            {renderOptionCheckbox(importOptionsForm, 'importAgents', t('dataManagement.options.agents', 'Agents'), BotIcon, 'import')}
            {renderOptionCheckbox(importOptionsForm, 'importWorkflows', t('dataManagement.options.workflows', 'Workflows'), WorkflowIcon, 'import')}
          </div>
          <Button onClick={handleFullImportClick} disabled={isFullImporting}>
            {isFullImporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadIcon className="mr-2 h-4 w-4" />
            )}
            {t('dataManagement.importButton', 'Import from Backup')}
          </Button>
          <input
            type="file"
            ref={fullImportInputRef}
            onChange={handleFullImportFileChange}
            className="hidden"
            accept=".json"
          />
        </div>
      </div>

      <Separator />

      {/* --- Danger Zone --- */}
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5 space-y-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-destructive">
            {t('dataManagement.dangerZoneTitle', 'Danger Zone')}
          </h3>
          <p className="text-sm text-destructive/80">
            {t('dataManagement.dangerZoneDescription', 'These actions are destructive and cannot be undone. Proceed with caution.')}
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={handleClearAllDataClick}
          disabled={isClearing}
        >
          {isClearing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2Icon className="mr-2 h-4 w-4" />
          )}
          {t('dataManagement.clearAllDataButton', 'Clear All Local Data')}
        </Button>
      </div>
    </div>
  );
};

export default SettingsDataManagementComponent;
