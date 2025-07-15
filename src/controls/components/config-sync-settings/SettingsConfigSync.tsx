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
import { fs } from "@zenfs/core";

const SettingsConfigSyncComponent: React.FC = () => {
  const { t } = useTranslation('settings');
  
  const [configSyncStatus, setConfigSyncStatus] = useState<SyncStatus>("idle");
  const [configSyncError, setConfigSyncError] = useState<string | null>(null);

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
      configSyncInterval: state.configSyncInterval ?? 3600000, // 1 hour default
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
    // configSyncInterval: z.number().min(60000).max(86400000), // 1 minute to 24 hours
    configSyncInterval: z.string().refine(val => {
      const num = parseInt(val);
      return !isNaN(num) && num >= 60000 && num <= 86400000;
    }, {
      message: "Interval must be between 1 minute and 24 hours"
    })
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
        // TODO replace when formedible updated
        options: syncRepos.map(repo => repo.id)
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
        options: ["60000", "300000", "600000", "1800000", "3600000"]
      }
    ],
    formOptions: {
      defaultValues: {
        configSyncEnabled,
        configSyncRepoId,
        configSyncAutoSync,
        configSyncInterval: configSyncInterval.toString(),
      },
      onSubmit: async ({ value }) => {
        setConfigSyncEnabled(value.configSyncEnabled);
        setConfigSyncRepoId(value.configSyncRepoId);
        setConfigSyncAutoSync(value.configSyncAutoSync);
        setConfigSyncInterval(typeof value.configSyncInterval === 'string' ? parseInt(value.configSyncInterval) : value.configSyncInterval);
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
      configSyncInterval: configSyncInterval.toString(),
    });
  }, [configSyncEnabled, configSyncRepoId, configSyncAutoSync, configSyncInterval, form]);

  const selectedRepo = syncRepos.find(repo => repo.id === configSyncRepoId);

  const handleManualSync = useCallback(async () => {
    if (!selectedRepo) {
      toast.error(t('configSync.errors.noRepoSelected'));
      return;
    }

    try {
      const fsInstance = fs;
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
            variant="outline"
            size="sm"
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

    </div>
  );
};

export const SettingsConfigSync = SettingsConfigSyncComponent;