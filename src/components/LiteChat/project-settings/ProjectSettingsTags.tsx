// src/components/LiteChat/project-settings/ProjectSettingsTags.tsx
// FULL FILE
import React, { useMemo, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { useRulesStore } from "@/store/rules.store";
import { ProjectDefaultTagSelector } from "./ProjectDefaultTagSelector";

interface ProjectSettingsTagsProps {
  defaultTagIds: string[] | null;
  setDefaultTagIds: (ids: string[] | null) => void;
  isSaving: boolean;
}

export const ProjectSettingsTags: React.FC<ProjectSettingsTagsProps> = ({
  defaultTagIds,
  setDefaultTagIds,
  isSaving,
}) => {
  const allTags = useRulesStore((state) => state.tags);

  const selectedTagIdsSet = useMemo(
    () => new Set(defaultTagIds ?? []),
    [defaultTagIds],
  );

  const handleSelectionChange = useCallback(
    (tagId: string, selected: boolean) => {
      const nextSet = new Set(selectedTagIdsSet);
      if (selected) {
        nextSet.add(tagId);
      } else {
        nextSet.delete(tagId);
      }
      const nextArray = Array.from(nextSet);
      setDefaultTagIds(nextArray.length > 0 ? nextArray : null);
    },
    [selectedTagIdsSet, setDefaultTagIds],
  );

  return (
    <div className="space-y-4">
      <Label>Default Tags for this Project</Label>
      <p className="text-xs text-muted-foreground">
        Select tags whose rules will be automatically applied to new
        conversations within this project. These can be overridden
        per-conversation or per-turn.
      </p>
      <ProjectDefaultTagSelector
        allTags={allTags}
        selectedTagIds={selectedTagIdsSet}
        onSelectionChange={handleSelectionChange}
        disabled={isSaving}
      />
    </div>
  );
};
