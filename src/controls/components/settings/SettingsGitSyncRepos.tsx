// src/components/LiteChat/settings/SettingsGitSyncRepos.tsx

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";

const SettingsGitSyncReposComponent: React.FC = () => {
  const {
    syncRepos,
    addSyncRepo,
    updateSyncRepo,
    deleteSyncRepo,
    initializeOrSyncRepo,
    repoInitializationStatus,
    isLoading,
  } = useConversationStore(
    useShallow((state) => ({
      syncRepos: state.syncRepos,
      addSyncRepo: state.addSyncRepo,
      updateSyncRepo: state.updateSyncRepo,
      deleteSyncRepo: state.deleteSyncRepo,
      initializeOrSyncRepo: state.initializeOrSyncRepo,
      repoInitializationStatus: state.repoInitializationStatus,
      isLoading: state.isLoading,
    }))
  );

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<
    Partial<Omit<SyncRepo, "id" | "createdAt" | "updatedAt">>
  >({
    name: "",
    remoteUrl: "",
    branch: "main",
    username: "",
    password: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      remoteUrl: "",
      branch: "main",
      username: "",
      password: "",
    });
    setIsAdding(false);
    setEditingId(null);
    setIsSaving(false);
  }, []);

  const handleInputChange = useCallback(
    (field: keyof typeof formData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!formData.name?.trim() || !formData.remoteUrl?.trim()) {
      toast.error("Repository Name and Remote URL are required.");
      return;
    }
    setIsSaving(true);
    try {
      const dataToSave: Omit<SyncRepo, "id" | "createdAt" | "updatedAt"> = {
        name: formData.name.trim(),
        remoteUrl: formData.remoteUrl.trim(),
        branch: formData.branch?.trim() || "main",
        username: formData.username?.trim() || null,
        password: formData.password || null,
      };

      if (editingId) {
        await updateSyncRepo(editingId, dataToSave);
      } else {
        await addSyncRepo(dataToSave);
      }
      resetForm();
    } catch (_error) {
      console.error("Failed to save sync repo:", _error);
    } finally {
      setIsSaving(false);
    }
  }, [formData, editingId, addSyncRepo, updateSyncRepo, resetForm]);

  const handleEdit = (repo: SyncRepo) => {
    setEditingId(repo.id);
    setFormData({
      name: repo.name,
      remoteUrl: repo.remoteUrl,
      branch: repo.branch || "main",
      username: repo.username ?? "",
      password: repo.password ?? "",
    });
    setIsAdding(false);
  };

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (
        window.confirm(
          `Are you sure you want to delete the sync repository "${name}"? This will unlink it from any conversations and remove the local copy.`
        )
      ) {
        setIsDeleting((prev) => ({ ...prev, [id]: true }));
        try {
          await deleteSyncRepo(id);
          if (editingId === id) {
            resetForm();
          }
        } catch (error) {
          console.error("Failed to delete sync repo:", error);
        } finally {
          setIsDeleting((prev) => ({ ...prev, [id]: false }));
        }
      }
    },
    [deleteSyncRepo, editingId, resetForm]
  );

  const handleInitializeOrSync = useCallback(
    async (repoId: string) => {
      await initializeOrSyncRepo(repoId);
    },
    [initializeOrSyncRepo]
  );

  const renderForm = () => (
    <div className="border rounded-md p-4 space-y-3 bg-card shadow-md mb-4">
      <h4 className="font-semibold text-card-foreground">
        {editingId ? "Edit Sync Repository" : "Add New Sync Repository"}
      </h4>
      {/* Use responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          <Label htmlFor="repo-name">Name</Label>
          <Input
            id="repo-name"
            value={formData.name || ""}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="e.g., My Backup"
            required
            className="mt-1"
            disabled={isSaving}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="repo-url">Remote URL (HTTPS)</Label>
          <Input
            id="repo-url"
            type="url"
            value={formData.remoteUrl || ""}
            onChange={(e) => handleInputChange("remoteUrl", e.target.value)}
            placeholder="https://github.com/user/repo.git"
            required
            className="mt-1"
            disabled={isSaving}
          />
        </div>
        <div className="sm:col-span-1">
          <Label htmlFor="repo-branch">Branch</Label>
          <Input
            id="repo-branch"
            value={formData.branch || ""}
            onChange={(e) => handleInputChange("branch", e.target.value)}
            placeholder="main"
            className="mt-1"
            disabled={isSaving}
          />
        </div>
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
        {/* Use responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="repo-username">Username</Label>
            <Input
              id="repo-username"
              value={formData.username || ""}
              onChange={(e) => handleInputChange("username", e.target.value)}
              placeholder="Git Username (Optional)"
              className="mt-1"
              disabled={isSaving}
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="repo-password">Password / Token</Label>
            <Input
              id="repo-password"
              type="password"
              value={formData.password || ""}
              onChange={(e) => handleInputChange("password", e.target.value)}
              placeholder="Password or PAT (Optional)"
              className="mt-1"
              disabled={isSaving}
              autoComplete="new-password"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end space-x-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetForm}
          disabled={isSaving}
          type="button"
        >
          <XIcon className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSave}
          disabled={
            isSaving || !formData.name?.trim() || !formData.remoteUrl?.trim()
          }
          type="button"
        >
          {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <SaveIcon className="h-4 w-4 mr-1" />{" "}
          {isSaving ? "Saving..." : "Save Repository"}
        </Button>
      </div>
    </div>
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
      </div>

      {!isAdding && !editingId && (
        <Button
          onClick={() => setIsAdding(true)}
          variant="outline"
          className="w-full mb-4"
          disabled={isLoading}
        >
          <PlusIcon className="h-4 w-4 mr-1" /> Add Sync Repository
        </Button>
      )}

      {(isAdding || editingId) && renderForm()}

      <div>
        <h4 className="text-md font-medium mb-2">Configured Repositories</h4>
        {isLoading && !isAdding && !editingId ? (
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
            {" "}
            {/* Added overflow-x-auto */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Remote URL
                  </TableHead>{" "}
                  {/* Hide on mobile */}
                  <TableHead className="hidden lg:table-cell">
                    Branch
                  </TableHead>{" "}
                  {/* Hide on small/medium */}
                  <TableHead className="hidden lg:table-cell">
                    Auth
                  </TableHead>{" "}
                  {/* Hide on small/medium */}
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
                    isRepoDeleting || isSaving || !!editingId || isInitializing;

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
