// src/components/LiteChat/settings/SettingsGitSyncRepos.tsx

import React, { useState, useCallback, useEffect } from "react";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trash2Icon,
  Edit2Icon,
  SaveIcon,
  XIcon,
  Loader2,
  PlusIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { SyncRepo } from "@/types/litechat/sync";
import { useShallow } from "zustand/react/shallow";
import { useConversationStore } from "@/store/conversation.store";
import { useSettingsStore } from "@/store/settings.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { conversationEvent } from "@/types/litechat/events/conversation.events";
import { syncEvent } from "@/types/litechat/events/sync.events";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { FieldMetaMessages } from "@/components/LiteChat/common/form-fields/FieldMetaMessages";
import { BulkSyncControl } from "@/controls/components/git-sync/BulkSyncControl";
import { BulkSyncService } from "@/services/bulk-sync.service";
import { useTranslation } from "react-i18next";

const syncRepoFormSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t('sync.errors.nameRequired')),
  remoteUrl: z
    .string()
    .min(1, t('sync.errors.urlRequired'))
    .url(t('sync.errors.urlInvalid')),
  branch: z.string().min(1, t('sync.errors.branchRequired')),
  username: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
});

type SyncRepoFormData = z.infer<ReturnType<typeof syncRepoFormSchema>>;

const defaultFormValues: SyncRepoFormData = {
  name: "",
  remoteUrl: "",
  branch: "main",
  username: null,
  password: null,
};

const SettingsGitSyncReposComponent: React.FC = () => {
  const { t } = useTranslation('git');
  const {
    syncRepos,
    addSyncRepo,
    updateSyncRepo,
    repoInitializationStatus,
    isLoading: isLoadingStore,
  } = useConversationStore(
    useShallow((state) => ({
      syncRepos: state.syncRepos,
      addSyncRepo: state.addSyncRepo,
      updateSyncRepo: state.updateSyncRepo,
      repoInitializationStatus: state.repoInitializationStatus,
      isLoading: state.isLoading,
    }))
  );

  const { autoSyncOnStreamComplete, setAutoSyncOnStreamComplete } = useSettingsStore(
    useShallow((state) => ({
      autoSyncOnStreamComplete: state.autoSyncOnStreamComplete,
      setAutoSyncOnStreamComplete: state.setAutoSyncOnStreamComplete,
    }))
  );

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  // Listen for sync repo changes to reset deleting state
  useEffect(() => {
    const handleRepoChanged = (payload: any) => {
      if (payload && payload.action === "deleted" && payload.repoId) {
        setIsDeleting((prev) => ({ ...prev, [payload.repoId]: false }));
      }
    };

    emitter.on(syncEvent.repoChanged, handleRepoChanged);
    return () => emitter.off(syncEvent.repoChanged, handleRepoChanged);
  }, []);

  const form = useForm({
    defaultValues: defaultFormValues as SyncRepoFormData,
    validators: {
      onChangeAsync: syncRepoFormSchema(t),
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      if (!value.name?.trim() || !value.remoteUrl?.trim()) {
        toast.error(t('sync.errors.saveFailed'));
        return;
      }
      try {
        const dataToSave = {
          name: value.name.trim(),
          remoteUrl: value.remoteUrl.trim(),
          branch: value.branch?.trim() || "main",
          username: value.username?.trim() || null,
          password: value.password || null,
        };

        if (editingId) {
          await updateSyncRepo(editingId, dataToSave);
        } else {
          await addSyncRepo(dataToSave);
        }
        resetFormAndState();
      } catch (_error) {
        console.error("Failed to save sync repo:", _error);
      }
    },
  });

  const resetFormAndState = useCallback(() => {
    form.reset(defaultFormValues);
    setIsAdding(false);
    setEditingId(null);
  }, [form]);

  useEffect(() => {
    if (editingId) {
      const repoToEdit = syncRepos.find((r) => r.id === editingId);
      if (repoToEdit) {
        form.reset({
          name: repoToEdit.name,
          remoteUrl: repoToEdit.remoteUrl,
          branch: repoToEdit.branch || "main",
          username: repoToEdit.username ?? null,
          password: repoToEdit.password ?? null,
        });
        setIsAdding(false);
      } else {
        resetFormAndState();
      }
    } else if (!isAdding) {
      form.reset(defaultFormValues);
    }
  }, [editingId, syncRepos, form, isAdding, resetFormAndState]);

  const handleEdit = (repo: SyncRepo) => {
    setEditingId(repo.id);
    setIsAdding(false);
  };

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (
        window.confirm(
          t('sync.deleteConfirmation', { name })
        )
      ) {
        setIsDeleting((prev) => ({ ...prev, [id]: true }));
        try {
          emitter.emit(conversationEvent.deleteSyncRepoRequest, { id });
          if (editingId === id) {
            resetFormAndState();
          }
        } catch (error) {
          console.error("Failed to delete sync repo:", error);
          setIsDeleting((prev) => ({ ...prev, [id]: false }));
        }
      }
    },
    [editingId, resetFormAndState, t]
  );

  const handleInitializeOrSync = useCallback(
    (repoId: string) => {
      emitter.emit(conversationEvent.initializeOrSyncRepoRequest, { repoId });
    },
    []
  );
  
  const handleAddNewClick = () => {
    setEditingId(null);
    form.reset(defaultFormValues);
    setIsAdding(true);
  };

  const renderForm = () => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="border rounded-md p-4 space-y-3 bg-card shadow-md mb-4"
    >
      <h4 className="font-semibold text-card-foreground">
        {editingId ? t('sync.form.editTitle') : t('sync.form.addTitle')}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <form.Field
          name="name"
          children={(field: AnyFieldApi) => (
            <div className="sm:col-span-1 space-y-1.5">
              <Label htmlFor={field.name}>{t('sync.form.nameLabel')}</Label>
              <Input
                id={field.name}
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder={t('sync.form.namePlaceholder')}
                disabled={form.state.isSubmitting}
              />
              <FieldMetaMessages field={field} />
            </div>
          )}
        />
        <form.Field
          name="remoteUrl"
          children={(field: AnyFieldApi) => (
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor={field.name}>{t('sync.form.remoteUrlLabel')}</Label>
              <Input
                id={field.name}
                type="url"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder={t('sync.form.remoteUrlPlaceholder')}
                disabled={form.state.isSubmitting}
              />
              <FieldMetaMessages field={field} />
            </div>
          )}
        />
        <form.Field
          name="branch"
          children={(field: AnyFieldApi) => (
            <div className="sm:col-span-1 space-y-1.5">
              <Label htmlFor={field.name}>{t('sync.form.branchLabel')}</Label>
              <Input
                id={field.name}
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder={t('sync.form.branchPlaceholder')}
                disabled={form.state.isSubmitting}
              />
              <FieldMetaMessages field={field} />
            </div>
          )}
        />
      </div>
      <div className="pt-2">
        <Label className="text-sm font-medium">
          {t('sync.form.authTitle')}
        </Label>
        <Alert variant="destructive" className="mt-2 mb-3">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>{t('sync.form.securityWarningTitle')}</AlertTitle>
          <AlertDescription className="text-xs">
            {t('sync.form.securityWarningDescription')}
          </AlertDescription>
        </Alert>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <form.Field
            name="username"
            children={(field: AnyFieldApi) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name}>{t('sync.form.usernameLabel')}</Label>
                <Input
                  id={field.name}
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('sync.form.usernamePlaceholder')}
                  disabled={form.state.isSubmitting}
                  autoComplete="off"
                />
                <FieldMetaMessages field={field} />
              </div>
            )}
          />
          <form.Field
            name="password"
            children={(field: AnyFieldApi) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name}>{t('sync.form.passwordLabel')}</Label>
                <Input
                  id={field.name}
                  type="password"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('sync.form.passwordPlaceholder')}
                  disabled={form.state.isSubmitting}
                  autoComplete="new-password"
                />
                <FieldMetaMessages field={field} />
              </div>
            )}
          />
        </div>
      </div>
      <div className="flex justify-end space-x-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFormAndState}
          disabled={form.state.isSubmitting}
          type="button"
        >
          <XIcon className="h-4 w-4 mr-1" /> {t('sync.form.cancelButton')}
        </Button>
        <form.Subscribe
           selector={(state) =>
            [
              state.canSubmit,
              state.isSubmitting,
              state.isValidating,
              state.isValid,
            ] as const
          }
          children={([canSubmit, isSubmitting, isValidating, isValid]) => (
            <Button
              variant="secondary"
              size="sm"
              type="submit"
              disabled={isSubmitting || !canSubmit || !isValid || isValidating}
            >
              {(isSubmitting || isValidating) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              <SaveIcon className="h-4 w-4 mr-1" />{" "}
              {isSubmitting || isValidating
                ? t('sync.form.savingButton')
                : t('sync.form.saveButton')}
            </Button>
          )}
        />
      </div>
    </form>
  );

  return (
    <div className="space-y-6 p-1">
      <div>
        <h3 className="text-lg font-medium">{t('sync.title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('sync.description')}
        </p>
        
        {/* Auto-sync settings */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
            <div className="space-y-1">
              <Label htmlFor="auto-sync-toggle" className="text-sm font-medium">
                {t('sync.autoSyncOnCompleteLabel')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('sync.autoSyncOnCompleteDescription')}
              </p>
            </div>
            <Switch
              id="auto-sync-toggle"
              checked={autoSyncOnStreamComplete}
              onCheckedChange={setAutoSyncOnStreamComplete}
            />
          </div>
          
          <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
            <div className="space-y-1">
              <Label htmlFor="auto-init-repos-toggle" className="text-sm font-medium">
                {t('sync.autoInitOnStartupLabel')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('sync.autoInitOnStartupDescription')}
              </p>
            </div>
            <Switch
              id="auto-init-repos-toggle"
              checked={useSettingsStore(state => state.autoInitializeReposOnStartup)}
              onCheckedChange={useSettingsStore.getState().setAutoInitializeReposOnStartup}
            />
          </div>
        </div>

        {/* Bulk Sync Control */}
        {syncRepos.length > 0 && (
          <BulkSyncControl
            onSyncAll={async () => {
              const conversationStore = useConversationStore.getState();
              await conversationStore.syncAllConversations();
            }}
            onSyncPending={async () => {
              const conversationStore = useConversationStore.getState();
              await conversationStore.syncPendingConversations();
            }}
            onInitializeRepos={async () => {
              const conversationStore = useConversationStore.getState();
              await conversationStore.initializeAllRepositories();
            }}
            onAbortSync={async () => {
              BulkSyncService.abort();
            }}
            totalRepos={syncRepos.length}
            totalConversations={useConversationStore.getState().conversations.filter(c => c.syncRepoId).length}
            pendingConversations={useConversationStore.getState().conversations.filter(c => {
              const status = useConversationStore.getState().conversationSyncStatus[c.id];
              return c.syncRepoId && status === 'needs-sync';
            }).length}
          />
        )}
      </div>

      {!isAdding && !editingId && (
        <Button
          onClick={handleAddNewClick}
          variant="outline"
          className="w-full mb-4"
          disabled={isLoadingStore}
        >
          <PlusIcon className="h-4 w-4 mr-1" /> {t('sync.addNewRepoButton')}
        </Button>
      )}

      {(isAdding || editingId) && renderForm()}

      <div>
        <h4 className="text-md font-medium mb-2">{t('sync.configuredReposTitle')}</h4>
        {isLoadingStore && !isAdding && !editingId ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : syncRepos.length === 0 && !isAdding && !editingId ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('sync.noRepos')}
          </p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('sync.tableHeaderName')}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('sync.tableHeaderRemoteUrl')}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t('sync.tableHeaderBranch')}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t('sync.tableHeaderAuth')}
                  </TableHead>
                  <TableHead className="text-right">{t('sync.tableHeaderActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncRepos.map((repo) => {
                  const isRepoDeleting = isDeleting[repo.id];
                  const isRepoEditing = editingId === repo.id;
                  const hasAuth = !!repo.username || !!repo.password;
                  const initStatus =
                    repoInitializationStatus[repo.id] || "idle";
                  const isInitializing = initStatus === "syncing";
                  const isDisabled =
                    isRepoDeleting || form.state.isSubmitting || !!editingId || isInitializing;

                  let statusIcon = null;
                  let statusTooltip = t('sync.status.default');
                  if (initStatus === "syncing") {
                    statusIcon = (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    );
                    statusTooltip = t('sync.status.syncing');
                  } else if (initStatus === "idle") {
                    statusIcon = (
                      <CheckCircle2Icon className="h-4 w-4 text-green-500 mr-1" />
                    );
                    statusTooltip = t('sync.status.ready');
                  } else if (initStatus === "error") {
                    statusIcon = (
                      <AlertCircleIcon className="h-4 w-4 text-destructive mr-1" />
                    );
                    statusTooltip = t('sync.status.failed');
                  } else {
                    statusIcon = <RefreshCwIcon className="h-4 w-4 mr-1" />;
                  }

                  return (
                    <TableRow
                      key={repo.id}
                      className={cn(
                        isRepoEditing ? "bg-muted/50" : "",
                        isDisabled && !isRepoEditing ? "opacity-70" : ""
                      )}
                    >
                      <TableCell className="font-medium truncate max-w-[100px] sm:max-w-xs">
                        {repo.name}
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[100px] sm:max-w-xs hidden md:table-cell">
                        {repo.remoteUrl}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {repo.branch || "main"}
                      </TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">
                        {hasAuth ? t('sync.authConfigured') : t('sync.authNone')}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <ActionTooltipButton
                          tooltipText={statusTooltip}
                          onClick={() => handleInitializeOrSync(repo.id)}
                          aria-label={t('sync.actions.syncAriaLabel', { name: repo.name })}
                          disabled={isDisabled}
                          icon={statusIcon}
                          variant="outline"
                          className="h-8 w-8"
                        />
                        <ActionTooltipButton
                          tooltipText={t('sync.actions.edit')}
                          onClick={() => handleEdit(repo)}
                          aria-label={t('sync.actions.editAriaLabel', { name: repo.name })}
                          disabled={isDisabled}
                          icon={<Edit2Icon />}
                          className="h-8 w-8"
                        />
                        <ActionTooltipButton
                          tooltipText={t('sync.actions.delete')}
                          onClick={() => handleDelete(repo.id, repo.name)}
                          aria-label={t('sync.actions.deleteAriaLabel', { name: repo.name })}
                          disabled={isDisabled}
                          icon={
                            isRepoDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2Icon />
                            )
                          }
                          className="text-destructive hover:text-destructive/80 h-8 w-8"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export const SettingsGitSyncRepos = React.memo(SettingsGitSyncReposComponent);
