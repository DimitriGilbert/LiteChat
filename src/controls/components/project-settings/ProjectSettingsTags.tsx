// src/controls/components/project-settings/ProjectSettingsTags.tsx
// FULL FILE
import React, { useMemo, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { ProjectDefaultTagSelector } from "./ProjectDefaultTagSelector";
import type { DbTag, DbRule } from "@/types/litechat/rules"; // Import DbRule

interface ProjectSettingsTagsProps {
  defaultTagIds: string[] | null;
  setDefaultTagIds: (ids: string[] | null) => void;
  isSaving: boolean;
  allTags: DbTag[]; // Add prop for allTags
  getRulesForTag: (tagId: string) => DbRule[]; // Add prop for getRulesForTag
}

export const ProjectSettingsTags: React.FC<ProjectSettingsTagsProps> = ({
  defaultTagIds,
  setDefaultTagIds,
  isSaving,
  allTags, // Destructure allTags
  getRulesForTag, // Destructure getRulesForTag
}) => {
  const selectedTagIdsSet = useMemo(
    () => new Set(defaultTagIds ?? []),
    [defaultTagIds]
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
    [selectedTagIdsSet, setDefaultTagIds]
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
        allTags={allTags} // Pass down allTags
        selectedTagIds={selectedTagIdsSet}
        onSelectionChange={handleSelectionChange}
        disabled={isSaving}
        getRulesForTag={getRulesForTag} // Pass down getRulesForTag
      />
    </div>
  );
};
