// src/components/LiteChat/settings/ProjectSettingsSync.tsx
// NEW FILE
import React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SyncRepo } from "@/types/litechat/sync";

interface ProjectSettingsSyncProps {
  syncRepoId: string | null;
  setSyncRepoId: (value: string | null) => void;
  effectiveSyncRepoId: string | null;
  syncRepos: SyncRepo[];
  isSaving: boolean;
}

export const ProjectSettingsSync: React.FC<ProjectSettingsSyncProps> = ({
  syncRepoId,
  setSyncRepoId,
  effectiveSyncRepoId,
  syncRepos,
  isSaving,
}) => {
  const effectiveRepoName =
    syncRepos.find((r) => r.id === effectiveSyncRepoId)?.name ?? "None";

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="project-sync-repo">
          Sync Repository (Overrides Parent/Global)
        </Label>
        <p className="text-xs text-muted-foreground mb-1">
          Link this project to a sync repository. All new conversations created
          within this project will automatically inherit this link.
        </p>
        <Select
          value={syncRepoId ?? "none"}
          onValueChange={(value) =>
            setSyncRepoId(value === "none" ? null : value)
          }
          disabled={isSaving || syncRepos.length === 0}
        >
          <SelectTrigger id="project-sync-repo">
            <SelectValue
              placeholder={
                syncRepos.length === 0
                  ? "No sync repos configured"
                  : `Inherited: ${effectiveRepoName}`
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">
                Use Inherited/Default ({effectiveRepoName})
              </span>
            </SelectItem>
            {syncRepos.map((repo) => (
              <SelectItem key={repo.id} value={repo.id}>
                {repo.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="link"
          size="sm"
          className="text-xs h-auto p-0 mt-1 text-muted-foreground"
          onClick={() => setSyncRepoId(null)}
          disabled={isSaving || syncRepoId === null}
        >
          Use Inherited/Default
        </Button>
      </div>
    </div>
  );
};
