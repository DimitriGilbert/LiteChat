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

const syncRepoFormSchema = z.object({
  name: z.string().min(1, "Repository Name is required."),
  remoteUrl: z
    .string()
    .min(1, "Remote URL is required.")
    .url("Invalid URL format (e.g., https://github.com/user/repo.git)"),
  branch: z.string().min(1, "Branch name is required (e.g., main)."),
  username: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
});

type SyncRepoFormData = z.infer<typeof syncRepoFormSchema>;

const defaultFormValues: SyncRepoFormData = {
  name: "",
  remoteUrl: "",
  branch: "main",
  username: null,
  password: null,
};

const SettingsGitSyncReposComponent: React.FC = () => {
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
      onChangeAsync: syncRepoFormSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      if (!value.name?.trim() || !value.remoteUrl?.trim()) {
        toast.error("Repository Name and Remote URL are required.");
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
          `Are you sure you want to delete the sync repository "${name}"? This will unlink it from any conversations and remove the local copy.`
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
    [editingId, resetFormAndState]
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
        {editingId ? "Edit Sync Repository" : "Add New Sync Repository"}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <form.Field
          name="name"
          children={(field: AnyFieldApi) => (
            <div className="sm:col-span-1 space-y-1.5">
              <Label htmlFor={field.name}>Name</Label>
              <Input
                id={field.name}
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="e.g., My Backup"
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
              <Label htmlFor={field.name}>Remote URL (HTTPS)</Label>
              <Input
                id={field.name}
                type="url"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="https://github.com/user/repo.git"
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
              <Label htmlFor={field.name}>Branch</Label>
              <Input
                id={field.name}
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="main"
                disabled={form.state.isSubmitting}
              />
              <FieldMetaMessages field={field} />
            </div>
          )}
        />
      </div>
      <div className="pt-2">
        <Label className="text-sm font-medium">
          Authentication (Optional - Basic Auth/Token)
        </Label>
        <Alert variant="destructive" className="mt-2 mb-3">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Security Warning</AlertTitle>
          <AlertDescription className="text-xs">
            Storing credentials directly is insecure. Use a Personal Access
            Token (PAT) as the password if possible. Credentials are required
            only for private repositories.
          </AlertDescription>
        </Alert>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <form.Field
            name="username"
            children={(field: AnyFieldApi) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name}>Username</Label>
                <Input
                  id={field.name}
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Git Username (Optional)"
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
                <Label htmlFor={field.name}>Password / Token</Label>
                <Input
                  id={field.name}
                  type="password"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Password or PAT (Optional)"
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
          <XIcon className="h-4 w-4 mr-1" /> Cancel
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
                ? "Saving..."
                : "Save Repository"}
            </Button>
          )}
        />
      </div>
    </form>
  );

  return (
    <div className="space-y-6 p-1">
      <div>
        <h3 className="text-lg font-medium">Sync Repositories</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure remote Git repositories to synchronize conversations. Link
          conversations to a repo using the sync control in the chat input area.
          Use the 'Sync/Clone' button to initialize the local copy or pull
          updates.
        </p>
        
        {/* Auto-sync setting */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
          <div className="space-y-1">
            <Label htmlFor="auto-sync-toggle" className="text-sm font-medium">
              Auto-sync after stream completion
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically sync conversations with linked repositories when a message stream completes
            </p>
          </div>
          <Switch
            id="auto-sync-toggle"
            checked={autoSyncOnStreamComplete}
            onCheckedChange={setAutoSyncOnStreamComplete}
          />
        </div>
      </div>

      {!isAdding && !editingId && (
        <Button
          onClick={handleAddNewClick}
          variant="outline"
          className="w-full mb-4"
          disabled={isLoadingStore}
        >
          <PlusIcon className="h-4 w-4 mr-1" /> Add Sync Repository
        </Button>
      )}

      {(isAdding || editingId) && renderForm()}

      <div>
        <h4 className="text-md font-medium mb-2">Configured Repositories</h4>
        {isLoadingStore && !isAdding && !editingId ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : syncRepos.length === 0 && !isAdding && !editingId ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No sync repositories configured yet.
          </p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Remote URL
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Branch
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Auth
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                  let statusTooltip = "Initialize/Sync Repository";
                  if (initStatus === "syncing") {
                    statusIcon = (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    );
                    statusTooltip = "Initializing/Syncing...";
                  } else if (initStatus === "idle") {
                    statusIcon = (
                      <CheckCircle2Icon className="h-4 w-4 text-green-500 mr-1" />
                    );
                    statusTooltip = "Sync Successful / Ready";
                  } else if (initStatus === "error") {
                    statusIcon = (
                      <AlertCircleIcon className="h-4 w-4 text-destructive mr-1" />
                    );
                    statusTooltip = "Sync Failed";
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
                        {hasAuth ? "Configured" : "None"}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <ActionTooltipButton
                          tooltipText={statusTooltip}
                          onClick={() => handleInitializeOrSync(repo.id)}
                          aria-label={`Initialize or Sync repo ${repo.name}`}
                          disabled={isDisabled}
                          icon={statusIcon}
                          variant="outline"
                          className="h-8 w-8"
                        />
                        <ActionTooltipButton
                          tooltipText="Edit"
                          onClick={() => handleEdit(repo)}
                          aria-label={`Edit repo ${repo.name}`}
                          disabled={isDisabled}
                          icon={<Edit2Icon />}
                          className="h-8 w-8"
                        />
                        <ActionTooltipButton
                          tooltipText="Delete"
                          onClick={() => handleDelete(repo.id, repo.name)}
                          aria-label={`Delete repo ${repo.name}`}
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
