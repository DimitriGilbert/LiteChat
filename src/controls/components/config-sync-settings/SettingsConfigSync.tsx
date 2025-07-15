// src/controls/components/config-sync-settings/SettingsConfigSync.tsx
import React, { useState, useCallback, useEffect } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  DownloadIcon,
  UploadIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  InfoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";
import { useConversationStore } from "@/store/conversation.store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { configSyncService } from "@/services/config-sync.service";
import type { SyncStatus } from "@/types/litechat/sync";
import { useTranslation } from "react-i18next";
import { useFormedible } from "@/hooks/use-formedible";

const SettingsConfigSyncComponent: React.FC = () => {
  const { t } = useTranslation('settings');
  
  const [configSyncStatus, setConfigSyncStatus] = useState<SyncStatus>("idle");
  const [configSyncError, setConfigSyncError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Get sync repos from conversation store
  const { syncRepos } = useConversationStore(
    useShallow((state) => ({
      syncRepos: state.syncRepos,
    }))
  );

  // Get config sync settings from settings store
  const {
    configSyncEnabled,
    configSyncRepoId,
    configSyncAutoSync,
    configSyncInterval,
    setConfigSyncEnabled,
    setConfigSyncRepoId,
    setConfigSyncAutoSync,
    setConfigSyncInterval,
  } = useSettingsStore(
    useShallow((state) => ({
      configSyncEnabled: state.configSyncEnabled ?? false,
      configSyncRepoId: state.configSyncRepoId ?? "",
      configSyncAutoSync: state.configSyncAutoSync ?? false,
      configSyncInterval: state.configSyncInterval ?? 300000, // 5 minutes default
      setConfigSyncEnabled: state.setConfigSyncEnabled,
      setConfigSyncRepoId: state.setConfigSyncRepoId,
      setConfigSyncAutoSync: state.setConfigSyncAutoSync,
      setConfigSyncInterval: state.setConfigSyncInterval,
    }))
  );

  const configSyncSchema = z.object({
    configSyncEnabled: z.boolean(),
    configSyncRepoId: z.string(),
    configSyncAutoSync: z.boolean(),
    configSyncInterval: z.number().min(60000).max(3600000), // 1 minute to 1 hour
  });

  const { Form, form } = useFormedible({
    schema: configSyncSchema,
    fields: [
      {
        name: "configSyncEnabled",
        type: "switch",
        label: t('configSync.enabled.label'),
        description: t('configSync.enabled.description')
      },
      {
        name: "configSyncRepoId",
        type: "select",
        label: t('configSync.repository.label'),
        description: t('configSync.repository.description'),
        placeholder: t('configSync.repository.placeholder'),
        conditional: (values) => !!values.configSyncEnabled,
        options: syncRepos.map(repo => repo.name)
      },
      {
        name: "configSyncAutoSync",
        type: "switch",
        label: t('configSync.autoSync.label'),
        description: t('configSync.autoSync.description'),
        conditional: (values) => !!values.configSyncEnabled && !!values.configSyncRepoId
      },
      {
        name: "configSyncInterval",
        type: "select",
        label: t('configSync.interval.label'),
        description: t('configSync.interval.description'),
        conditional: (values) => !!values.configSyncAutoSync,
        options: [
          t('configSync.intervals.1min'),
          t('configSync.intervals.5min'),
          t('configSync.intervals.10min'),
          t('configSync.intervals.30min'),
          t('configSync.intervals.1hour'),
        ]
      }
    ],
    formOptions: {
      defaultValues: {
        configSyncEnabled,
        configSyncRepoId,
        configSyncAutoSync,
        configSyncInterval,
      },
      onSubmit: async ({ value }) => {
        setConfigSyncEnabled(value.configSyncEnabled);
        setConfigSyncRepoId(value.configSyncRepoId);
        setConfigSyncAutoSync(value.configSyncAutoSync);
        setConfigSyncInterval(value.configSyncInterval);
        toast.success(t('configSync.settingsSaved'));
      },
    }
  });

  // Update form when store values change
  useEffect(() => {
    form.reset({
      configSyncEnabled,
      configSyncRepoId,
      configSyncAutoSync,
      configSyncInterval,
    });
  }, [configSyncEnabled, configSyncRepoId, configSyncAutoSync, configSyncInterval, form]);

  const selectedRepo = syncRepos.find(repo => repo.id === configSyncRepoId);

  const handleManualSync = useCallback(async () => {
    if (!selectedRepo) {
      toast.error(t('configSync.errors.noRepoSelected'));
      return;
    }

    try {
      const fsInstance = (await import("@zenfs/core")).fs;
      await configSyncService.syncConfiguration(
        fsInstance,
        selectedRepo,
        (status, error) => {
          setConfigSyncStatus(status);
          setConfigSyncError(error || null);
        }
      );
    } catch (error) {
      console.error('Manual config sync failed:', error);
      toast.error(t('configSync.errors.syncFailed', { 
        error: error instanceof Error ? error.message : String(error) 
      }));
    }
  }, [selectedRepo, t]);

  const handleExportConfig = useCallback(async () => {
    setIsExporting(true);
    try {
      const configData = await configSyncService.exportConfigToFile();
      
      // Create and download file
      const blob = new Blob([JSON.stringify(configData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `litechat-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(t('configSync.exportSuccess'));
    } catch (error) {
      console.error('Config export failed:', error);
      toast.error(t('configSync.errors.exportFailed', { 
        error: error instanceof Error ? error.message : String(error) 
      }));
    } finally {
      setIsExporting(false);
    }
  }, [t]);

  const handleImportConfig = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const text = await file.text();
        const configData = JSON.parse(text);
        
        await configSyncService.importConfigFromFile(configData);
        toast.success(t('configSync.importSuccess'));
      } catch (error) {
        console.error('Config import failed:', error);
        toast.error(t('configSync.errors.importFailed', { 
          error: error instanceof Error ? error.message : String(error) 
        }));
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  }, [t]);


  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t('configSync.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('configSync.description')}
        </p>
      </div>

      <Separator />

      <Form />

      <Separator />

      {/* Manual Sync Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCwIcon className="h-4 w-4" />
            {t('configSync.manualSync.title')}
          </CardTitle>
          <CardDescription>
            {t('configSync.manualSync.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedRepo && (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>{t('configSync.selectedRepo')}</AlertTitle>
              <AlertDescription>
                {selectedRepo.name} ({selectedRepo.remoteUrl})
              </AlertDescription>
            </Alert>
          )}

          {configSyncStatus === "syncing" && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>{t('configSync.status.syncing')}</AlertTitle>
              <AlertDescription>
                {t('configSync.status.syncingDescription')}
              </AlertDescription>
            </Alert>
          )}

          {configSyncStatus === "error" && configSyncError && (
            <Alert variant="destructive">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertTitle>{t('configSync.status.error')}</AlertTitle>
              <AlertDescription>{configSyncError}</AlertDescription>
            </Alert>
          )}

          {configSyncStatus === "idle" && !configSyncError && selectedRepo && (
            <Alert>
              <CheckCircle2Icon className="h-4 w-4" />
              <AlertTitle>{t('configSync.status.ready')}</AlertTitle>
              <AlertDescription>
                {t('configSync.status.readyDescription')}
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleManualSync}
            disabled={!selectedRepo || configSyncStatus === "syncing"}
            className="w-full"
          >
            {configSyncStatus === "syncing" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="mr-2 h-4 w-4" />
            )}
            {t('configSync.manualSync.button')}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Import/Export Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('configSync.importExport.title')}</CardTitle>
          <CardDescription>
            {t('configSync.importExport.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={handleExportConfig}
              disabled={isExporting}
              variant="outline"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DownloadIcon className="mr-2 h-4 w-4" />
              )}
              {t('configSync.export.button')}
            </Button>

            <Button
              onClick={handleImportConfig}
              disabled={isImporting}
              variant="outline"
            >
              {isImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadIcon className="mr-2 h-4 w-4" />
              )}
              {t('configSync.import.button')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const SettingsConfigSync = SettingsConfigSyncComponent;