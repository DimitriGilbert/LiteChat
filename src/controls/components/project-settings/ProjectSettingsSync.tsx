// src/components/LiteChat/settings/ProjectSettingsSync.tsx

import React, { useEffect } from "react";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
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
import { FieldMetaMessages } from "@/components/LiteChat/common/form-fields/FieldMetaMessages";
import { Loader2, SaveIcon } from "lucide-react";

interface ProjectSettingsSyncProps {
  initialSyncRepoId: string | null;
  onSave: (data: { syncRepoId: string | null }) => Promise<void> | void;
  effectiveSyncRepoId: string | null;
  syncRepos: SyncRepo[];
  isParentSaving?: boolean;
}

const projectSettingsSyncSchema = z.object({
  syncRepoId: z.string().nullable(),
});

export const ProjectSettingsSync: React.FC<ProjectSettingsSyncProps> = ({
  initialSyncRepoId,
  onSave,
  effectiveSyncRepoId,
  syncRepos,
  isParentSaving = false,
}) => {
  const effectiveRepoName =
    syncRepos.find((r) => r.id === effectiveSyncRepoId)?.name ?? "None";

  const form = useForm({
    defaultValues: {
      syncRepoId: initialSyncRepoId ?? null,
    },
    validators: {
      onChangeAsync: projectSettingsSyncSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      await onSave(value);
    },
  });

  useEffect(() => {
    form.reset({
      syncRepoId: initialSyncRepoId ?? null,
    });
  }, [initialSyncRepoId, form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <form.Field
        name="syncRepoId"
        validators={{
          onChange: projectSettingsSyncSchema.shape.syncRepoId,
        }}
        children={(field: AnyFieldApi) => (
          <div className="space-y-1.5">
            <Label htmlFor={field.name}>
              Sync Repository (Overrides Parent/Global)
            </Label>
            <p className="text-xs text-muted-foreground mb-1">
              Link this project to a sync repository. All new conversations created
              within this project will automatically inherit this link.
            </p>
            <Select
              value={field.state.value ?? "none"}
              onValueChange={(value) => {
                field.handleChange(value === "none" ? null : value);
                field.handleBlur();
              }}
              disabled={form.state.isSubmitting || isParentSaving || syncRepos.length === 0}
            >
              <SelectTrigger id={field.name}>
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
            <FieldMetaMessages field={field} />
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 mt-1 text-muted-foreground"
              onClick={() => form.setFieldValue("syncRepoId", null)}
              disabled={form.state.isSubmitting || isParentSaving || field.state.value === null}
              type="button"
            >
              Use Inherited/Default
            </Button>
          </div>
        )}
      />
      <div className="flex justify-end pt-2">
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
              type="submit"
              size="sm"
              disabled={
                isParentSaving ||
                !canSubmit ||
                isSubmitting ||
                isValidating ||
                !isValid ||
                syncRepos.length === 0
              }
            >
              {(isSubmitting || isValidating) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              <SaveIcon className="h-4 w-4 mr-1" />
              {isSubmitting || isValidating
                ? "Saving..."
                : "Save Sync Settings"}
            </Button>
          )}
        />
      </div>
    </form>
  );
};
